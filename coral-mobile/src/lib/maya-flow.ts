/**
 * Server-only Maya / Compass-Labs DeFi flow helpers.
 *
 * Maya's savings = a real on-chain Aave position. Borrowing against it is a
 * RISK-INCREASING action, so Sly requires a just-in-time `compass:credit`
 * scope grant before the borrow can execute on Base mainnet.
 *
 * The PROVEN sequence (replicated across the API routes):
 *   1. agent token → POST /v1/policy/evaluate-intent  (credit:borrow)  → 403 deny: scope_required:compass:credit
 *   2. agent token → POST /v1/auth/scopes/request      (compass:credit, one_shot) → { request_id }
 *   3. tenant key  → POST /v1/organization/scopes/:id/decide ({decision:'approve'}) → { status, grant_id }
 *   4. agent token → POST /v1/policy/evaluate-intent  (re-evaluate)    → { decision:'approve', evaluation_id }
 *   5. COMPASS_BIN credit borrow … -o json            → { transaction:{ to, data, value, gas } }
 *   6. agent token → POST /v1/policy/execute-intent   (broadcast)      → { executed, tx_hash, block_number, bilateral_receipt }
 *
 * Steps 1–2 run in /api/maya/borrow (free — evaluate + scope request, no broadcast).
 * Steps 3–6 run in /api/maya/approve (after Maya taps Approve — broadcasts a real tx).
 *
 * Demo-only. Never import from production apps.
 */
import { execFileSync } from 'node:child_process';

export interface MayaEnv {
  tenantKey: string;
  agentToken: string;
  agentId: string;
  accountId: string;
  ownerEoa: string;
  // Compass-managed Safe wallet that holds the borrowed asset (owned by
  // ownerEoa as signer). Optional — when set, we surface its WETH
  // balance on the savings card so the user can see the borrowed funds
  // actually landed somewhere reachable.
  safeAddress?: string;
  compassApiKeyAuth: string;
  compassBin: string;
  baseUrl: string;
}

/**
 * Resolve Maya's runtime env. The partner supplies two secrets —
 * MAYA_TENANT_KEY + COMPASS_API_KEY_AUTH — plus optionally
 * MAYA_AGENT_ID + MAYA_AGENT_TOKEN to pin a specific agent (written by
 * `pnpm onboard`). The Compass binary is assumed to be on PATH per the
 * installer's default (`curl -fsSL https://compasslabs.ai/install.sh | bash`);
 * COMPASS_BIN remains as an override for nonstandard installs.
 * Everything else (agent EOA, parent account, the Compass-managed Safe
 * address) is derived at boot from the Sly API, so .env.local never has
 * to mention those.
 */
export async function mayaEnv(): Promise<MayaEnv | { error: string }> {
  const tenantKey = process.env.MAYA_TENANT_KEY;
  const compassApiKeyAuth = process.env.COMPASS_API_KEY_AUTH;
  // Bare `compass` resolves via PATH at spawn time — the canonical
  // installer puts it on PATH by default. COMPASS_BIN is an override.
  const compassBin = process.env.COMPASS_BIN || 'compass';
  const baseUrl = (process.env.SLY_API_URL ?? 'https://sandbox.getsly.ai').replace(/\/$/, '');

  const missing = [
    !tenantKey && 'MAYA_TENANT_KEY',
    !compassApiKeyAuth && 'COMPASS_API_KEY_AUTH',
  ].filter(Boolean);
  if (missing.length) {
    return { error: `Missing env: ${missing.join(', ')}. Run \`pnpm onboard\` from ../compass-live or paste your tenant key into .env.local.` };
  }

  let agentId = process.env.MAYA_AGENT_ID;
  if (!agentId) {
    const picked = await pickMayaAgent(baseUrl, tenantKey!);
    if ('error' in picked) return picked;
    agentId = picked.id;
  }

  const details = await fetchAgentDetails(baseUrl, tenantKey!, agentId);
  if ('error' in details) return details;

  const safeAddress = await fetchCompassSafeAddress(baseUrl, tenantKey!, agentId);
  // safeAddress is optional — coral-mobile still boots if the Onboard
  // agent scenario hasn't been run yet; the savings card just shows
  // "live position unavailable" until the Safe is up.

  return {
    tenantKey: tenantKey!,
    agentToken: process.env.MAYA_AGENT_TOKEN ?? tenantKey!,
    agentId,
    accountId: details.parentAccountId,
    ownerEoa: details.walletAddress,
    safeAddress: process.env.MAYA_SAFE_ADDRESS || safeAddress || undefined,
    compassApiKeyAuth: compassApiKeyAuth!,
    compassBin,
    baseUrl,
  };
}

async function pickMayaAgent(baseUrl: string, tenantKey: string): Promise<{ id: string } | { error: string }> {
  const r = await fetch(`${baseUrl}/v1/agents?limit=100`, { headers: { authorization: `Bearer ${tenantKey}` } });
  if (!r.ok) return { error: `Failed to list agents (${r.status}). Check MAYA_TENANT_KEY.` };
  const body = (await r.json()) as { data?: unknown };
  const list = (Array.isArray(body?.data) ? body.data : (body as { data?: { data?: unknown[] } })?.data?.data ?? []) as Array<{
    id: string;
    name?: string;
    kyaTier?: number;
    kya_tier?: number;
    status?: string;
  }>;
  if (!list.length) return { error: 'No agents in tenant. Run `pnpm onboard` from ../compass-live first.' };
  // Prefer an active T2 agent whose name contains "Credit" — that's the
  // Compass Credit Agent in the standard onboarding seed. Fall back to
  // first active T2, then first active.
  const active = list.filter((a) => a.status === 'active');
  const tier2 = active.filter((a) => (a.kyaTier ?? a.kya_tier ?? 0) >= 2);
  const credit = tier2.find((a) => /credit/i.test(a.name ?? ''));
  const picked = credit ?? tier2[0] ?? active[0] ?? list[0];
  return { id: picked.id };
}

async function fetchAgentDetails(baseUrl: string, tenantKey: string, agentId: string): Promise<{ parentAccountId: string; walletAddress: string } | { error: string }> {
  // Parent account comes from /v1/agents/:id; the EOA we explicitly pick
  // from /v1/agents/:id/wallet because the agent record's `walletAddress`
  // can resolve to a smart_wallet Safe (the Compass-managed proxy) once
  // the agent has been onboarded — we want the signing EOA, not the
  // Safe that holds funds. Two round-trips, but both are tiny and the
  // result is cached for the lifetime of the request handler anyway.
  const [agentRes, walletRes] = await Promise.all([
    fetch(`${baseUrl}/v1/agents/${encodeURIComponent(agentId)}`, { headers: { authorization: `Bearer ${tenantKey}` } }),
    fetch(`${baseUrl}/v1/agents/${encodeURIComponent(agentId)}/wallet`, { headers: { authorization: `Bearer ${tenantKey}` } }),
  ]);
  if (!agentRes.ok) return { error: `Failed to fetch agent ${agentId.slice(0, 8)}… (${agentRes.status})` };
  const agentBody = (await agentRes.json()) as { data?: { parentAccountId?: string; parent_account_id?: string } };
  const a = agentBody?.data ?? (agentBody as Record<string, unknown>);
  const parentAccountId = (a as { parentAccountId?: string; parent_account_id?: string }).parentAccountId ?? (a as { parent_account_id?: string }).parent_account_id;
  if (!parentAccountId) return { error: `Agent ${agentId.slice(0, 8)}… missing parent account` };

  // EOA = the external/coinbase wallet. Fallback to the agent record's
  // top-level walletAddress for tenants that haven't been onboarded
  // through the wallets pipeline yet.
  let walletAddress: string | undefined;
  if (walletRes.ok) {
    const walletBody = (await walletRes.json()) as { data?: { all_wallets?: Array<{ wallet_type?: string; provider?: string; wallet_address?: string; address?: string }> } };
    const all = walletBody?.data?.all_wallets ?? [];
    const eoa = all.find((w) => w.wallet_type === 'external' && w.provider === 'coinbase');
    walletAddress = eoa?.wallet_address ?? eoa?.address;
  }
  if (!walletAddress) {
    walletAddress = (a as { walletAddress?: string; eoa?: string }).walletAddress ?? (a as { eoa?: string }).eoa;
  }
  if (!walletAddress) return { error: `Agent ${agentId.slice(0, 8)}… has no external EOA wallet` };
  return { parentAccountId, walletAddress };
}

async function fetchCompassSafeAddress(baseUrl: string, tenantKey: string, agentId: string): Promise<string | null> {
  try {
    const r = await fetch(`${baseUrl}/v1/agents/${encodeURIComponent(agentId)}/wallet`, { headers: { authorization: `Bearer ${tenantKey}` } });
    if (!r.ok) return null;
    const body = (await r.json()) as { data?: { all_wallets?: Array<{ wallet_type?: string; provider?: string; address?: string; wallet_address?: string }> } };
    const all = body?.data?.all_wallets ?? [];
    const safe = all.find((w) => w.wallet_type === 'smart_wallet' && w.provider === 'compass');
    return safe?.address ?? safe?.wallet_address ?? null;
  } catch {
    return null;
  }
}

/** Borrow parameters for the demo — deliberately a sub-dollar amount.
 * Borrows USDC against the USDC collateral (recursive credit against
 * savings). Single-currency story keeps the card readable and the
 * narrative simple: "supplied $X, borrowed $Y, total controlled = $X+$Y". */
export const BORROW = {
  amount: '0.10',
  asset: 'USDC',
  scope: 'compass:credit',
  chain: 'base',
  venueType: 'aave-credit:USDC',
} as const;

export const BORROW_PURPOSE = `Maya: borrow ${BORROW.amount} ${BORROW.asset} against Aave collateral`;

/** A 403 deny from /v1/policy/evaluate-intent (NOT wrapped in {success,data}). */
export interface PolicyDeny {
  decision: 'deny';
  reasons?: string[];
  [k: string]: unknown;
}

export interface PolicyApprove {
  decision: 'approve';
  evaluation_id: string;
  [k: string]: unknown;
}

export interface ScopeRequestResult {
  request_id: string;
  status?: string;
}

export interface ScopeDecideResult {
  status: string;
  grant_id?: string;
}

export interface ExecuteResult {
  executed: boolean;
  tx_hash: string;
  block_number?: number;
  bilateral_receipt?: unknown;
}

export interface CompassTx {
  to: string;
  data: string;
  value?: string;
  gas?: string;
  [k: string]: unknown;
}

interface FetchOpts {
  token: string;
  body?: unknown;
}

/**
 * Authed POST to the Sly API. 2xx bodies are wrapped `{ success, data, meta }`
 * and are unwrapped to `.data`. Non-2xx bodies (e.g. 403 policy denies) are
 * NOT wrapped — they are returned raw via the `onDeny` escape hatch so callers
 * can branch on the deny decision instead of throwing.
 */
export async function slyPost<T>(
  env: MayaEnv,
  path: string,
  { token, body }: FetchOpts,
): Promise<{ ok: true; data: T } | { ok: false; status: number; raw: unknown }> {
  const res = await fetch(`${env.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    return { ok: false, status: res.status, raw: json };
  }
  return { ok: true, data: (json?.data ?? json) as T };
}

/** Same as slyPost but throws on non-2xx — for steps where a deny is unexpected. */
export async function slyPostOrThrow<T>(
  env: MayaEnv,
  path: string,
  opts: FetchOpts,
): Promise<T> {
  const r = await slyPost<T>(env, path, opts);
  if (!r.ok) {
    const msg =
      (r.raw as { error?: string })?.error ??
      JSON.stringify(r.raw) ??
      `POST ${path} → ${r.status}`;
    throw new Error(`POST ${path} → ${r.status}: ${msg}`);
  }
  return r.data;
}

/** Build the credit:borrow intent body used by evaluate-intent (steps 1 & 4). */
export function borrowIntent(env: MayaEnv) {
  return {
    version: '1',
    subcommand: 'credit:borrow',
    agent_id: env.agentId,
    requested_at: new Date().toISOString(),
    params: {
      chain: BORROW.chain,
      amount: BORROW.amount,
      currency: BORROW.asset,
      venue_type: BORROW.venueType,
    },
  };
}

/**
 * execFile wrapper around the Compass CLI. Always runs `-o json
 * --no-interactive`, injects COMPASS_API_KEY_AUTH into the child env, and
 * parses stdout as JSON. 90s timeout, 8MB maxBuffer.
 */
export function compass<T = unknown>(env: MayaEnv, args: string[]): T {
  const stdout = execFileSync(env.compassBin, args, {
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, COMPASS_API_KEY_AUTH: env.compassApiKeyAuth },
  });
  return JSON.parse(stdout) as T;
}

/** Maya's on-chain Aave position, shaped for the savings card. */
export interface MayaPosition {
  collateralUsd: number | null;
  suppliedUsdc: number | null;
  supplyApy: number | null;
  debt: { symbol: string; amount: number }[];
  // Compass routes credit borrows through a per-owner Safe wallet —
  // the borrowed asset lands there, not on the EOA. Surface the Safe's
  // balance for whatever asset Maya is borrowing (USDC in the current
  // demo) so the user sees the funds actually arrived.
  safe?: {
    address: string;
    balance: number;     // human-readable units
    currency: string;    // 'USDC' | 'WETH' | …
  };
  // True when Compass returned a successful response but Maya has no
  // Aave supply yet (fresh tenant that hasn't run the compass-live
  // "Onboard agent" scenario). Lets the savings card render a clear
  // empty state instead of falling back to the seed-value $1,450.
  empty?: boolean;
}

interface CompassPositions {
  collateral_positions?: {
    amount_supplied?: number | string;
    usd_value?: number | string;
    supply_apy?: number | string;
  }[];
  debt_positions?: {
    symbol?: string;
    amount_borrowed?: number | string;
  }[];
}

/** Compass emits numeric fields as strings — coerce to number (or null). */
function num(v: number | string | undefined | null): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function readPosition(env: MayaEnv): Promise<MayaPosition> {
  const json = compass<CompassPositions>(env, [
    'credit',
    'positions',
    '--owner',
    env.ownerEoa,
    '--chain',
    BORROW.chain,
    '-o',
    'json',
    '--no-interactive',
  ]);
  const collateral = json.collateral_positions?.[0];
  const debt = (json.debt_positions ?? [])
    .map((d) => ({ symbol: d.symbol ?? '—', amount: num(d.amount_borrowed) ?? 0 }))
    .filter((d) => d.amount > 0);

  // If we know the Safe address, fetch its on-chain balance for the
  // currently-borrowed asset (the one that should have landed in the
  // Safe). Non-fatal: a network blip just hides the Safe row.
  let safe: MayaPosition['safe'] | undefined;
  if (env.safeAddress) {
    try {
      const balance = await readSafeTokenBalance(env.safeAddress, BORROW.asset);
      if (balance != null) safe = { address: env.safeAddress, balance, currency: BORROW.asset };
    } catch {
      /* leave safe unset on RPC failure */
    }
  }

  const collateralUsd = num(collateral?.usd_value);
  const suppliedUsdc = num(collateral?.amount_supplied);
  // Treat as "empty" when Compass reports no supplied collateral. A
  // fresh tenant lands here until the compass-live "Onboard agent"
  // scenario seeds Aave.
  const empty = !collateral || (suppliedUsdc ?? 0) <= 0;
  return {
    collateralUsd,
    suppliedUsdc,
    supplyApy: num(collateral?.supply_apy),
    debt,
    safe,
    ...(empty ? { empty: true } : {}),
  };
}

// ─── Safe wallet balance (Base mainnet RPC) ─────────────────────────

const BASE_RPC = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';

// Per-asset config: on-chain contract + decimals. Add a token here to
// support balance reads for it.
const BASE_TOKENS: Record<string, { addr: string; decimals: number }> = {
  USDC: { addr: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  WETH: { addr: '0x4200000000000000000000000000000000000006', decimals: 18 },
};

/**
 * Raw eth_call for `balanceOf(address)` on the requested ERC-20.
 * No dep on viem — just JSON-RPC + a bit of hex math, so the demo
 * package stays lean.
 */
async function readSafeTokenBalance(addr: string, symbol: string): Promise<number | null> {
  const token = BASE_TOKENS[symbol];
  if (!token) return null;
  const padded = addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  // balanceOf(address) selector = 0x70a08231
  const data = '0x70a08231' + padded;
  const res = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: token.addr, data }, 'latest'],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: string };
  if (!json?.result) return null;
  try {
    const wei = BigInt(json.result);
    return Number(wei) / 10 ** token.decimals;
  } catch {
    return null;
  }
}

/** Run the Compass `credit borrow` command and return the unsigned tx. */
export function borrowUnsignedTx(env: MayaEnv): CompassTx {
  const json = compass<{ transaction?: CompassTx }>(env, [
    'credit',
    'borrow',
    '--borrow-token',
    BORROW.asset,
    '--borrow-amount',
    BORROW.amount,
    '--owner',
    env.ownerEoa,
    '--chain',
    BORROW.chain,
    '-o',
    'json',
    '--no-interactive',
  ]);
  if (!json.transaction?.to || !json.transaction?.data) {
    throw new Error('Compass borrow returned no transaction payload');
  }
  return json.transaction;
}

/* ── credit-checkout (borrow → withdraw → pay merchant) ─────────────── */

/**
 * Concrete demo product. Sub-dollar so re-running against the smoke-test
 * tenant doesn't drain anything. Single weekly subscription so the
 * narrative stays simple ("recurring debit from your Aave credit line").
 */
/** Demo product: a Nike Pegasus 41 at $145, framed as the answer to
 * "find me shoes under $150". The real on-chain pay is still `amount`
 * (a sub-dollar USDC transfer), but every user-facing surface speaks
 * in `displayAmount` so the narrative reads like a real purchase. */
export const CHECKOUT_PRODUCT = {
  sku: 'nike-pegasus-41',
  label: 'Nike Pegasus 41',
  merchant: 'Nike',
  amount: '0.10', // real USDC moved on-chain (sandbox)
  displayAmount: '145', // displayed price — see DEMO_SCALE
  displayBudget: '150', // "shoes under $150" budget framing
  asset: 'USDC',
  chain: 'base',
} as const;

export interface CheckoutStepReceipt {
  label: string;
  evaluationId?: string;
  txHash?: string;
  blockNumber?: string;
  policyDecisionId?: string;
}

/** Build the credit:withdraw intent body for evaluate-intent. */
export function withdrawIntent(env: MayaEnv, amount: string, asset: string = 'USDC') {
  return {
    version: '1',
    subcommand: 'credit:withdraw',
    agent_id: env.agentId,
    requested_at: new Date().toISOString(),
    params: {
      chain: BORROW.chain,
      amount,
      currency: asset,
      venue_type: 'compass:withdraw',
    },
  };
}

/** Run the Compass `credit transfer --action WITHDRAW` and return the unsigned tx. */
export function withdrawUnsignedTx(env: MayaEnv, amount: string, asset: string = 'USDC'): CompassTx {
  const json = compass<{ transaction?: CompassTx }>(env, [
    'credit',
    'transfer',
    '--action',
    'WITHDRAW',
    '--token',
    asset,
    '--amount',
    amount,
    '--owner',
    env.ownerEoa,
    '--chain',
    BORROW.chain,
    '-o',
    'json',
    '--no-interactive',
  ]);
  if (!json.transaction?.to || !json.transaction?.data) {
    throw new Error('Compass withdraw returned no transaction payload');
  }
  return json.transaction;
}

interface AgentSummary {
  id: string;
  name?: string;
  walletAddress?: string;
  kya_tier?: number;
  kyaTier?: number;
  status?: string;
}

/**
 * Pick a "merchant" EOA on the same tenant. For the self-contained
 * Option A demo this is the Operator agent (cleanest because USDC stays
 * inside the tenant footprint — repeated demos don't drain external
 * addresses). Returns null if no suitable agent exists.
 *
 * Falls back to any active agent that isn't Maya herself.
 */
export async function fetchMerchantEoa(env: MayaEnv): Promise<{ eoa: string; agentId: string; agentName: string } | null> {
  const r = await fetch(`${env.baseUrl}/v1/agents?limit=100`, {
    headers: { authorization: `Bearer ${env.tenantKey}` },
  });
  if (!r.ok) return null;
  const body = (await r.json()) as { data?: AgentSummary[] };
  const list = Array.isArray(body?.data) ? body.data : [];
  // Prefer an agent whose name contains "Operator" — matches the Compass
  // Demo Operator that pnpm onboard provisions.
  const operator = list.find(
    (a) =>
      a.id !== env.agentId &&
      a.status === 'active' &&
      /operator/i.test(a.name ?? '') &&
      a.walletAddress,
  );
  const fallback = list.find(
    (a) => a.id !== env.agentId && a.status === 'active' && a.walletAddress,
  );
  const picked = operator ?? fallback;
  if (!picked?.walletAddress) return null;
  return { eoa: picked.walletAddress, agentId: picked.id, agentName: picked.name ?? 'merchant' };
}

/** Get the EXTERNAL (CDP) wallet id for Maya's agent — needed by /v1/wallets/:id/transfer. */
export async function fetchAgentExternalWalletId(env: MayaEnv): Promise<string | null> {
  const r = await fetch(
    `${env.baseUrl}/v1/agents/${encodeURIComponent(env.agentId)}/wallet`,
    { headers: { authorization: `Bearer ${env.tenantKey}` } },
  );
  if (!r.ok) return null;
  const body = (await r.json()) as {
    data?: { all_wallets?: Array<{ id?: string; wallet_type?: string; provider?: string }> };
  };
  const all = body?.data?.all_wallets ?? [];
  const eoa = all.find((w) => w.wallet_type === 'external' && w.provider === 'coinbase');
  return eoa?.id ?? null;
}
