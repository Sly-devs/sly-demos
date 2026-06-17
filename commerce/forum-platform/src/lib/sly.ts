/**
 * Server-side Sly data access for Forum. Read paths use the demo-kit
 * client's `apiGet` (it unwraps `{ data }` envelopes). Transfers use a
 * thin raw POST since demo-kit only exposes apiGet/apiPatch.
 */

import { createDemoClient } from '@sly/demo-kit';
import {
  SLY_API_URL,
  FORUM_API_KEY,
  MIRA_AGENT_ID as CFG_MIRA_AGENT_ID,
  MIRA_ACCOUNT_ID as CFG_MIRA_ACCOUNT_ID,
  miraAgentToken,
} from './config';

export type SellerKind = 'human' | 'agent';

export interface SellerProfile {
  accountId: string;
  name: string;
  kind: SellerKind;
  /** 'KYC' for humans, 'KYA' for AI agents. */
  identityScheme: 'KYC' | 'KYA';
  /** Verification tier (0-3). Same scale across human/agent. */
  tier: number;
  role: string;
  reputation: number;
  jobsDone: number;
  joined: string;
  agentId?: string;
  /** From the agent row when seller is an agent. */
  agentStatus?: string;
  fetchedFromSly: boolean;
}

interface RawAccount {
  id: string;
  name: string;
  type: string;
  verificationTier?: number;
  verificationType?: string;
  metadata?: Record<string, unknown>;
}

interface RawAgent {
  id: string;
  name: string;
  status?: string;
  kyaTier?: number;
}

// Note: LUME_API_KEY is intentionally NOT used for reads — it collides
// on its 12-char prefix with FORUM_API_KEY in Sly's legacy key lookup,
// so Lume-tenant reads go through Mira's agent token instead.
function forumClient() {
  return createDemoClient({ apiKey: FORUM_API_KEY, baseUrl: SLY_API_URL });
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * The Sly API double-wraps single resources: {success,data:{data,links}}.
 * demo-kit's req() peels one `.data`; peel the inner one here so callers
 * get the bare resource.
 */
function unwrap<T>(v: unknown): T {
  if (v && typeof v === 'object' && 'data' in (v as Record<string, unknown>)) {
    return (v as { data: T }).data;
  }
  return v as T;
}

/**
 * Fetch the HUMAN seller (Sarah) from real Sly via the Forum tenant key.
 * The account row carries all seller metadata.
 */
async function fetchHumanSeller(accountId: string): Promise<SellerProfile> {
  const raw = await forumClient().apiGet<unknown>(
    `/v1/accounts/${accountId}`,
  );
  const account = unwrap<RawAccount>(raw);
  const meta = (account.metadata ?? {}) as Record<string, unknown>;
  return {
    accountId: account.id,
    name: account.name,
    kind: 'human',
    identityScheme: 'KYC',
    tier: account.verificationTier ?? 0,
    role: (meta.role as string) ?? 'Freelance Ops Consultant',
    reputation: num(meta.reputation, 0),
    jobsDone: Number(meta.jobs_done ?? 0),
    joined: (meta.joined as string) ?? '—',
    fetchedFromSly: true,
  };
}

/**
 * Fetch the AGENT seller (Mira) using her own agent token (Lume tenant).
 * Her agent row (name, KYA tier, status) is read LIVE from Sly. The
 * account-level seller metadata (reputation/jobs/role) lives on the Lume
 * *account* row, which is unreadable here only because the seeded Lume
 * API key collides on its 12-char prefix with the Forum key in Sly's
 * legacy key lookup — so those fields use the fixed seed-contract values.
 */
async function fetchAgentSeller(): Promise<SellerProfile> {
  const client = createDemoClient({
    apiKey: miraAgentToken(),
    baseUrl: SLY_API_URL,
  });
  const raw = await client.apiGet<unknown>(
    `/v1/agents/${CFG_MIRA_AGENT_ID}`,
  );
  const agent = unwrap<RawAgent>(raw);
  return {
    accountId: CFG_MIRA_ACCOUNT_ID,
    name: agent.name ?? 'Mira',
    kind: 'agent',
    identityScheme: 'KYA',
    tier: typeof agent.kyaTier === 'number' ? agent.kyaTier : 2,
    role: 'Invoice-Processing Specialist (AI agent)',
    // Seed-contract values (Lume account metadata unreadable — see above).
    reputation: 4.9,
    jobsDone: 488,
    joined: '2026-01-22',
    agentId: agent.id ?? CFG_MIRA_AGENT_ID,
    agentStatus: agent.status,
    fetchedFromSly: true,
  };
}

/** Fetch a seller (human or agent). */
export async function fetchSeller(opts: {
  tenant: 'forum' | 'lume';
  accountId: string;
  agentId?: string;
}): Promise<SellerProfile> {
  return opts.tenant === 'forum'
    ? fetchHumanSeller(opts.accountId)
    : fetchAgentSeller();
}

interface RawTransfer {
  id: string;
  status: string;
  amount: number | string;
  description?: string;
  from?: { accountId?: string };
  to?: { accountId?: string };
  fromAccountId?: string;
  toAccountId?: string;
}

/**
 * Derive the verified split end-state from Mira's own transfer ledger,
 * read with her agent token (Lume tenant). This is the in-scope read
 * path: the seeded Lume *API key* collides on its 12-char prefix with
 * the Forum key in Sly's legacy key lookup, but Mira's agent token
 * authenticates cleanly and can list every transfer where her account
 * is a party. Net = gross ACP credit − fee leg − tax leg.
 */
export async function fetchVerifiedSplit(
  miraAgentToken: string,
  ids: {
    miraAccountId: string;
    feeAccountId: string;
    taxAccountId: string;
    /** Known gross (the SKU price, confirmed by the ACP settlement). */
    gross: number;
  },
): Promise<{
  miraGrossIn: number;
  feeOut: number;
  taxOut: number;
  miraNet: number;
  completed: boolean;
}> {
  const client = createDemoClient({
    apiKey: miraAgentToken,
    baseUrl: SLY_API_URL,
  });
  const list = await client.apiGet<RawTransfer[] | { data: RawTransfer[] }>(
    '/v1/transfers?limit=50',
  );
  const rows: RawTransfer[] = Array.isArray(list)
    ? list
    : ((list as { data?: RawTransfer[] }).data ?? []);

  const to = (t: RawTransfer) => t.to?.accountId ?? t.toAccountId;
  const settled = (t: RawTransfer) =>
    t.status === 'completed' || t.status === 'authorized';

  // The split OUT legs are unambiguous (one fee transfer, one tax
  // transfer, both idempotent). Gross is the fixed SKU price confirmed
  // by the completed ACP settlement — NOT a ledger sum: the single
  // cross-tenant ACP settlement writes both a buyer-leg and seller-leg
  // row into Mira's ledger, so summing inbound rows would double-count.
  let feeOut = 0;
  let taxOut = 0;
  for (const t of rows) {
    if (!settled(t)) continue;
    const amt = num(t.amount);
    const dest = to(t);
    if (dest === ids.feeAccountId) feeOut = Math.max(feeOut, amt);
    else if (dest === ids.taxAccountId) taxOut = Math.max(taxOut, amt);
  }
  const miraNet = +(ids.gross - feeOut - taxOut).toFixed(2);
  return {
    miraGrossIn: +ids.gross.toFixed(2),
    feeOut: +feeOut.toFixed(2),
    taxOut: +taxOut.toFixed(2),
    miraNet,
    completed: feeOut > 0 && taxOut > 0,
  };
}

export interface TransferResult {
  id: string;
  status: string;
  amount: number;
  fromAccountId: string;
  toAccountId: string;
}

/**
 * Create a real Sly transfer. demo-kit doesn't wrap POST, so use a raw
 * authed call. Internal USDC transfers execute synchronously server-side
 * (balanceService.transfer) — the row status is `authorized` but ledger
 * balances move immediately.
 */
export async function postTransfer(
  apiKey: string,
  body: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
  },
  idempotencyKey: string,
): Promise<TransferResult> {
  const res = await fetch(`${SLY_API_URL}/v1/transfers`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...body, currency: 'USDC' }),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(
      json?.error ?? `POST /v1/transfers → ${res.status} ${text}`,
    );
  }
  // API double-wraps: {success,data:{data:transfer,...}} — peel both.
  const t = unwrap<{
    id: string;
    status: string;
    amount: number;
    from?: { accountId?: string };
    to?: { accountId?: string };
    from_account_id?: string;
    to_account_id?: string;
    fromAccountId?: string;
    toAccountId?: string;
  }>(json?.data ?? json);
  return {
    id: t.id,
    status: t.status,
    amount: num(t.amount, body.amount),
    fromAccountId:
      t.from?.accountId ??
      t.from_account_id ??
      t.fromAccountId ??
      body.fromAccountId,
    toAccountId:
      t.to?.accountId ??
      t.to_account_id ??
      t.toAccountId ??
      body.toAccountId,
  };
}

async function rawPost(
  apiKey: string,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(`${SLY_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  return { ok: res.ok, status: res.status, json };
}

/**
 * Ensure Mira's x402 service endpoint exists (idempotent by serviceSlug).
 * Owned by Mira's account in the Lume tenant → use Mira's agent token.
 * Returns the endpoint id.
 */
export async function ensureX402Endpoint(
  miraToken: string,
  opts: {
    accountId: string;
    name: string;
    slug: string;
    path: string;
    price: number;
    description?: string;
  },
): Promise<string> {
  const client = createDemoClient({ apiKey: miraToken, baseUrl: SLY_API_URL });
  try {
    const list = await client.apiGet<
      Array<Record<string, unknown>> | { data?: Array<Record<string, unknown>> }
    >('/v1/x402/endpoints?limit=50');
    const rows: Array<Record<string, unknown>> = Array.isArray(list)
      ? list
      : ((list as { data?: Array<Record<string, unknown>> }).data ?? []);
    const hit = rows.find(
      (r) => r.service_slug === opts.slug || r.serviceSlug === opts.slug,
    );
    if (hit?.id) return String(hit.id);
  } catch {
    /* fall through to create */
  }
  const { ok, status, json } = await rawPost(miraToken, '/v1/x402/endpoints', {
    name: opts.name,
    path: opts.path,
    method: 'POST',
    description: opts.description ?? opts.name,
    accountId: opts.accountId,
    basePrice: opts.price,
    currency: 'USDC',
    network: 'base-sepolia',
    serviceSlug: opts.slug,
    category: 'services',
  });
  if (!ok) {
    throw new Error(
      json?.error ?? `POST /v1/x402/endpoints → ${status}`,
    );
  }
  const ep = unwrap<{ id: string }>(json?.data ?? json);
  return String(ep.id);
}

/**
 * Open an A2A task hiring Mira (cross-tenant via her public agent card).
 * Real `a2a_tasks` row. Best-effort: returns the task id/state.
 */
export async function postA2ATask(
  quillToken: string,
  opts: { agentId: string; cardUrl: string; text: string },
): Promise<{ taskId: string | null; state: string }> {
  const { ok, status, json } = await rawPost(quillToken, '/v1/a2a/tasks', {
    agent_id: opts.agentId,
    url: opts.cardUrl,
    message: { parts: [{ type: 'text', text: opts.text }] },
    metadata: { demo: 'forum', kind: 'hire' },
  });
  if (!ok) {
    throw new Error(json?.error ?? `POST /v1/a2a/tasks → ${status}`);
  }
  const t = unwrap<{
    id?: string;
    task_id?: string;
    taskId?: string;
    status?: unknown;
    state?: unknown;
  }>(json?.data ?? json);
  const rawState = t.state ?? t.status;
  const state =
    typeof rawState === 'string'
      ? rawState
      : ((rawState as { state?: string; status?: string } | undefined)
          ?.state ??
        (rawState as { status?: string } | undefined)?.status ??
        'submitted');
  return {
    taskId: t.id ?? t.task_id ?? t.taskId ?? null,
    state,
  };
}

/**
 * Settle Mira's service per-call via x402 (the real money movement —
 * `transfers` row type `x402_payment`). Idempotent on requestId, so the
 * hero stays ONE real settlement across repeated runs.
 */
export async function payX402(
  quillToken: string,
  opts: {
    endpointId: string;
    walletId: string;
    amount: number;
    requestId: string;
    path: string;
  },
): Promise<{ transferId: string | null; status: string; amount: number }> {
  const { ok, status, json } = await rawPost(quillToken, '/v1/x402/pay', {
    endpointId: opts.endpointId,
    requestId: opts.requestId,
    amount: opts.amount,
    currency: 'USDC',
    walletId: opts.walletId,
    method: 'POST',
    path: opts.path,
    timestamp: Date.now(),
  });
  if (!ok) {
    throw new Error(json?.error ?? `POST /v1/x402/pay → ${status}`);
  }
  const p = unwrap<{
    transfer_id?: string;
    transferId?: string;
    id?: string;
    status?: string;
    state?: string;
    amount?: number | string;
  }>(json?.data ?? json);
  return {
    transferId: p.transfer_id ?? p.transferId ?? p.id ?? null,
    status: p.status ?? p.state ?? 'completed',
    amount: num(p.amount, opts.amount),
  };
}
