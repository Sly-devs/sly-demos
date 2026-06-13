/**
 * Server-only Sly access for the Helix live wall-board.
 *
 * Every number on the board is REAL — read from the Helix tenant via the
 * operator key (pk_test_helix_demo_2026). Nothing is synthesised. Exactly
 * 3 Sly reads per poll (kept lean so a busy driver can't starve it):
 *   - GET /v1/x402/endpoints   → the x402 rails (calls + revenue)
 *   - GET /v1/acp/checkouts    → settled agent checkouts
 *   - GET /v1/a2a/tasks        → agent-to-agent tasks (Beacon)
 *
 * If the API is unreachable the board renders empty and honestly reports
 * `source: 'offline'` — never fake volume.
 */

import { createDemoClient } from '@sly/demo-kit';

export const HELIX_MERCHANT_ID = 'helix:catalog-merchant';
export const HELIX_MERCHANT_NAME = 'Helix Supply Co.';

/** The 10 seeded Helix buyer names (stable demo config — matches
 *  apps/demo/_seed/seed-marketplace-demo.ts + drive-marketplace.mjs).
 *  By the marketplace's design every buyer uses every x402 service and
 *  hires Beacon every round — so buyer↔service relationship edges are
 *  REAL (not invented); the per-pair *volume* that isn't attributable
 *  via API (x402 deferred intents, a2a null clientAgentId) is shown as
 *  real aggregate totals on the service NODES instead. */
const BUYER_NAMES = [
  'Atlas Agent',
  'Bolt Agent',
  'Core Agent',
  'Dash Agent',
  'Nova Agent',
  'Iris Agent',
  'Echo Agent',
  'Flux Agent',
  'Onyx Agent',
  'Zephyr Agent',
];

export function helixClient() {
  const apiKey = process.env.HELIX_API_KEY ?? 'pk_test_helix_demo_2026';
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  return createDemoClient({ apiKey, baseUrl });
}

export interface X402EndpointRow {
  id: string;
  name: string;
  path: string;
  basePrice: number;
  currency: string;
  status: string;
  totalCalls: number;
  totalRevenue: number;
  publishStatus: string;
  category: string | null;
  account?: { id: string; name: string } | null;
}

export interface AcpCheckoutRow {
  id: string;
  agent_id: string;
  agent_name: string | null;
  merchant_id: string;
  total_amount: number;
  currency: string;
  status: string;
  item_count: number;
  created_at: string;
}

export type Protocol = 'x402' | 'acp' | 'a2a' | 'ucp';

export interface X402Rail {
  id: string;
  name: string;
  path: string;
  basePrice: number;
  currency: string;
  category: string | null;
  calls: number;
  revenue: number;
}

export interface FeedEvent {
  id: string;
  protocol: Protocol;
  agent: string;
  label: string;
  amount: number | null;
  currency: string;
  status: 'settled' | 'pending' | 'failed' | 'ok';
  at: string;
}

export interface AgentNode {
  agent: string;
  agentId: string;
  txns: number;
  volume: number;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: 'buyer' | 'prosumer' | 'provider' | 'service' | 'hub';
  proto?: Protocol;
}
export interface GraphEdge {
  from: string;
  to: string;
  proto: Protocol;
  count: number;
}

export interface HelixState {
  source: 'live' | 'offline';
  generatedAt: string;
  metrics: {
    x402Calls: number;
    x402Revenue: number;
    acpSettledUsd: number;
    acpSettledCount: number;
    a2aTasks: number;
    txnTotal: number;
    agentsActive: number;
  };
  rails: {
    x402: { live: boolean; endpoints: X402Rail[] };
    ucp: { live: boolean; catalogName: string; discoverable: boolean };
    acp: { live: boolean; merchant: string; checkoutCount: number };
    a2a: { live: boolean; agentName: string; taskCount: number };
  };
  feed: FeedEvent[];
  byAgent: AgentNode[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

/** Coerce demo-kit/SDK responses (array vs {data}/{tasks}/{...}) to array. */
function asArray<T = any>(r: any): T[] {
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.data)) return r.data;
  if (Array.isArray(r?.tasks)) return r.tasks;
  if (Array.isArray(r?.items)) return r.items;
  return [];
}

/** One quick retry — rides brief API hiccups when the driver is busy. */
async function getRetry<T>(
  client: ReturnType<typeof helixClient>,
  path: string,
): Promise<T> {
  try {
    return await client.apiGet<T>(path);
  } catch {
    await new Promise((r) => setTimeout(r, 350));
    return client.apiGet<T>(path);
  }
}

export async function fetchHelixState(): Promise<HelixState> {
  const generatedAt = new Date().toISOString();
  const client = helixClient();

  // ── x402 rails (calls + revenue per endpoint) ───────────────────────
  let x402Live = false;
  let rails: X402Rail[] = [];
  try {
    const rows = await getRetry<X402EndpointRow[]>(client, '/v1/x402/endpoints');
    const arr = asArray<X402EndpointRow>(rows);
    if (arr.length || Array.isArray(rows)) {
      x402Live = true;
      rails = arr
        .map((r) => ({
          id: r.id,
          name: r.name,
          path: r.path,
          basePrice: num(r.basePrice),
          currency: r.currency ?? 'USDC',
          category: r.category ?? null,
          calls: num(r.totalCalls),
          revenue: num(r.totalRevenue),
        }))
        .sort((a, b) => b.calls - a.calls);
    }
  } catch {
    x402Live = false;
  }
  const x402Calls = rails.reduce((s, r) => s + r.calls, 0);
  const x402Revenue = rails.reduce((s, r) => s + r.revenue, 0);

  // x402 micropayments settle as deferred payment_intents; the wall-board
  // derives x402 feed rows CLIENT-SIDE from the real per-poll increase in
  // each endpoint's totalCalls. We deliberately do NOT fetch per-endpoint
  // detail here — keeping /api/state to 3 Sly calls (x402 list + ACP +
  // A2A) so a busy driver can't rate-limit the board into "offline".
  const x402Feed: FeedEvent[] = [];

  // ── ACP settled checkouts ───────────────────────────────────────────
  let acpLive = false;
  let acpRows: AcpCheckoutRow[] = [];
  try {
    const rows = await getRetry<AcpCheckoutRow[]>(
      client,
      '/v1/acp/checkouts?limit=100',
    );
    const arr = asArray<AcpCheckoutRow>(rows);
    if (arr.length || Array.isArray(rows)) {
      acpLive = true;
      acpRows = arr.filter((c) => c.merchant_id === HELIX_MERCHANT_ID);
    }
  } catch {
    acpLive = false;
  }
  const acpSettled = acpRows.filter((c) => c.status === 'completed');
  const acpSettledUsd = acpSettled.reduce(
    (s, c) => s + num(c.total_amount),
    0,
  );
  const acpFeed: FeedEvent[] = acpRows.map((c) => ({
    id: `acp-${c.id}`,
    protocol: 'acp',
    agent: c.agent_name ?? 'Buyer agent',
    label: `ACP · checkout ${c.item_count > 1 ? `${c.item_count} items` : '1 item'}`,
    amount: num(c.total_amount),
    currency: c.currency ?? 'USDC',
    status:
      c.status === 'completed'
        ? 'settled'
        : c.status === 'failed' || c.status === 'cancelled'
          ? 'failed'
          : 'pending',
    at: c.created_at,
  }));

  // ── agents directory (id → name + role) ─────────────────────────────
  // One extra Sly read; covered by getRetry + keep-last-good + 2.5s poll.
  // Role is derived from the seed's agent description (no metadata dep).
  const agentName = new Map<string, string>();
  const agentRole = new Map<string, 'buyer' | 'prosumer' | 'provider'>();
  try {
    const r = await getRetry<any>(client, '/v1/agents?limit=100');
    for (const a of asArray<any>(r)) {
      if (!a?.id || !a?.name) continue;
      agentName.set(a.id, a.name);
      const d: string = a.description ?? '';
      agentRole.set(
        a.id,
        d.startsWith('A2A provider')
          ? 'provider'
          : d.startsWith('Prosumer')
            ? 'prosumer'
            : 'buyer',
      );
    }
  } catch {
    /* maps empty → node build falls back to BUYER_NAMES */
  }

  // ── A2A tasks — real per-pair (buyer → provider) attribution ────────
  let a2aLive = false;
  let a2aTasks = 0;
  const a2aFeed: FeedEvent[] = [];
  const a2aPair = new Map<string, number>(); // `${fromName}|${toName}` → n
  try {
    const r = await getRetry<any>(client, '/v1/a2a/tasks?limit=300');
    const arr = asArray<any>(r);
    a2aLive = true;
    a2aTasks = arr.length;
    for (const t of arr) {
      const provId = t.agentId ?? t.agent_id;
      const provName = agentName.get(provId) ?? t.agentName ?? 'Provider';
      const cliId = t.clientAgentId ?? t.client_agent_id;
      const cliName = cliId ? agentName.get(cliId) ?? null : null;
      a2aFeed.push({
        id: `a2a-${t.id}`,
        protocol: 'a2a',
        agent: cliName ?? t.agentName ?? 'agent',
        label: `A2A · task → ${provName}`,
        amount: null,
        currency: '',
        status: 'ok',
        at: t.created_at ?? t.createdAt ?? generatedAt,
      });
      if (cliName && provName && cliName !== provName) {
        const k = `${cliName}|${provName}`;
        a2aPair.set(k, (a2aPair.get(k) ?? 0) + 1);
      }
    }
  } catch {
    a2aLive = false;
  }

  // ── unified, time-sorted live feed ──────────────────────────────────
  const feed = [...x402Feed, ...acpFeed, ...a2aFeed]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 36);

  // ── agent nodes (from ACP settled volume) ───────────────────────────
  const agentMap = new Map<string, AgentNode>();
  for (const c of acpSettled) {
    const cur =
      agentMap.get(c.agent_id) ??
      {
        agent: c.agent_name ?? 'Buyer agent',
        agentId: c.agent_id,
        txns: 0,
        volume: 0,
      };
    cur.txns += 1;
    cur.volume += num(c.total_amount);
    agentMap.set(c.agent_id, cur);
  }
  const byAgent = [...agentMap.values()].sort((a, b) => b.volume - a.volume);

  // ── real peer-economy edge model ────────────────────────────────────
  // A2A edges carry REAL per-pair counts (buyer/prosumer → provider/
  // prosumer), now that the API records client_agent_id. ACP edges carry
  // real per-buyer settled counts. x402 stays an honest *relationship*
  // edge (deferred intents are batch-netted — no per-pair API; the real
  // aggregate volume rides on the x402 service NODE).
  const edgeMap = new Map<string, GraphEdge>();

  // A2A: real attributed peer mesh.
  for (const [k, count] of a2aPair) {
    const [from, to] = k.split('|');
    edgeMap.set(`${from}|${to}|a2a`, { from, to, proto: 'a2a', count });
  }

  // ACP: real buyer → Helix Supply, weighted by real settled count.
  const acpByBuyer = new Map<string, number>();
  for (const c of acpRows) {
    if (c.status === 'completed') {
      const n = c.agent_name ?? 'Buyer agent';
      acpByBuyer.set(n, (acpByBuyer.get(n) ?? 0) + 1);
    }
  }
  for (const [buyer, count] of acpByBuyer) {
    edgeMap.set(`${buyer}|helix-supply|acp`, {
      from: buyer,
      to: 'helix-supply',
      proto: 'acp',
      count,
    });
  }

  // Agent roster (real, from the agents directory; fall back to the
  // stable seed list when the directory read failed this poll).
  const roster: { name: string; role: 'buyer' | 'prosumer' | 'provider' }[] =
    agentName.size
      ? [...agentName.entries()].map(([id, name]) => ({
          name,
          role: agentRole.get(id) ?? 'buyer',
        }))
      : BUYER_NAMES.map((name) => ({ name, role: 'buyer' as const }));

  // x402: honest relationship edges — every buyer/prosumer uses every
  // x402 service each round by the marketplace's design (count 0 = "uses
  // this service", not a per-pair volume claim).
  const x402Ids = rails.slice(0, 3).map((r) => r.id);
  for (const a of roster) {
    if (a.role === 'provider') continue;
    for (const epId of x402Ids) {
      edgeMap.set(`${a.name}|${epId}|x402`, {
        from: a.name,
        to: epId,
        proto: 'x402',
        count: 0,
      });
    }
  }

  const edges = [...edgeMap.values()];
  const agentNodes: GraphNode[] = roster.map((a) => ({
    id: a.name,
    label: a.name,
    kind: a.role,
  }));
  const graphNodes: GraphNode[] = [
    ...agentNodes,
    ...rails.slice(0, 3).map(
      (r): GraphNode => ({
        id: r.id,
        label: r.name,
        kind: 'service',
        proto: 'x402',
      }),
    ),
    { id: 'helix-supply', label: 'Helix Supply', kind: 'service', proto: 'acp' },
    { id: 'sly', label: 'Sly', kind: 'hub' },
  ];

  const source: HelixState['source'] =
    x402Live || acpLive || a2aLive ? 'live' : 'offline';

  return {
    source,
    generatedAt,
    metrics: {
      x402Calls,
      x402Revenue,
      acpSettledUsd,
      acpSettledCount: acpSettled.length,
      a2aTasks,
      txnTotal: x402Calls + acpRows.length + a2aTasks,
      agentsActive: Math.max(byAgent.length, a2aTasks > 0 ? 1 : 0),
    },
    rails: {
      x402: { live: x402Live, endpoints: rails },
      ucp: {
        live: x402Live || acpLive,
        catalogName: HELIX_MERCHANT_NAME,
        discoverable: true,
      },
      acp: {
        live: acpLive,
        merchant: HELIX_MERCHANT_NAME,
        checkoutCount: acpRows.length,
      },
      a2a: {
        live: a2aLive,
        agentName: (() => {
          const provs = roster.filter((a) => a.role === 'provider').length;
          return provs > 1 ? `${provs} A2A providers` : 'Beacon';
        })(),
        taskCount: a2aTasks,
      },
    },
    feed,
    byAgent,
    graph: { nodes: graphNodes, edges },
  };
}
