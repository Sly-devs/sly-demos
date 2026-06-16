/**
 * GET /api/agents
 *
 * Returns the tenant's agents (paginated through every page) annotated
 * with the capability flags the picker needs to gate scenarios:
 *
 *   - hasWallet            : agent has a Sly wallet at all
 *   - walletProvider       : 'coinbase' | 'compass' | 'circle' | …
 *   - walletAddress        : EOA the runner uses for --owner
 *   - hasCompassAllowlist  : wallet's contract policy already contains
 *                            at least one Compass venue (seed marker —
 *                            used to surface "Compass-ready" agents).
 *
 * The Next page proxies through here so the tenant API key never leaves
 * the server. Capabilities are computed once per agent in parallel.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sandbox.getsly.ai';
const SLY_TENANT_KEY =
  process.env.SLY_DEMO_TENANT_API_KEY || '';

const COMPASS_VENUES = new Set([
  'aave-v3-base',
  'morpho-base',
  'aave-credit:WETH',
  'aave-credit:USDC',
  'compass-earn-account',
  'equity:TSLAon',
  'compass:withdraw',
]);

interface AgentDto {
  id: string;
  name: string;
  status: string;
  kyaTier?: number;
  kya_tier?: number;
  description?: string;
}

interface AgentRow {
  id: string;
  name: string;
  status: string;
  kyaTier: number;
  hasWallet: boolean;
  walletProvider: string | null;
  walletAddress: string | null;
  hasCompassAllowlist: boolean;
}

async function slyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SLY_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${SLY_TENANT_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAllAgents(): Promise<AgentDto[]> {
  const all: AgentDto[] = [];
  const seen = new Set<string>();
  let page = 1;
  while (page < 10) {
    const body = await slyGet<{
      data: AgentDto[];
      pagination?: { totalPages?: number };
    }>(`/v1/agents?page=${page}&limit=100`);
    for (const a of body.data ?? []) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      all.push(a);
    }
    const totalPages = body.pagination?.totalPages ?? 1;
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

async function annotate(a: AgentDto): Promise<AgentRow> {
  const tier = a.kyaTier ?? a.kya_tier ?? 0;
  const base: AgentRow = {
    id: a.id,
    name: a.name,
    status: a.status,
    kyaTier: tier,
    hasWallet: false,
    walletProvider: null,
    walletAddress: null,
    hasCompassAllowlist: false,
  };
  try {
    const w = await slyGet<{
      data: {
        address?: string;
        wallet_address?: string;
        provider?: string;
        spending_policy?: {
          contractPolicy?: { allowedContractTypes?: string[] };
        };
      };
    }>(`/v1/agents/${a.id}/wallet`);
    const d = w.data;
    base.hasWallet = true;
    base.walletProvider = d.provider ?? null;
    base.walletAddress = d.address ?? d.wallet_address ?? null;
    const allowed = d.spending_policy?.contractPolicy?.allowedContractTypes ?? [];
    base.hasCompassAllowlist = allowed.some((v) => COMPASS_VENUES.has(v));
  } catch {
    // Agent has no wallet — leave flags false.
  }
  return base;
}

export async function GET() {
  try {
    const agents = await fetchAllAgents();
    // Annotate in parallel but bounded — 25 concurrent wallet fetches.
    const rows: AgentRow[] = [];
    for (let i = 0; i < agents.length; i += 25) {
      const batch = agents.slice(i, i + 25);
      const out = await Promise.all(batch.map(annotate));
      rows.push(...out);
    }
    // Sort: Compass-ready active agents first, then active+wallet, then the rest.
    rows.sort((a, b) => {
      const score = (r: AgentRow) =>
        (r.hasCompassAllowlist ? 4 : 0) +
        (r.hasWallet ? 2 : 0) +
        (r.status === 'active' ? 1 : 0);
      return score(b) - score(a) || a.name.localeCompare(b.name);
    });
    return NextResponse.json({ agents: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
