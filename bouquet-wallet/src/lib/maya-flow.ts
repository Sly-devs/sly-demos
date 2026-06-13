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
  compassApiKeyAuth: string;
  compassBin: string;
  baseUrl: string;
}

export function mayaEnv(): MayaEnv | { error: string } {
  const tenantKey = process.env.MAYA_TENANT_KEY;
  const agentToken = process.env.MAYA_AGENT_TOKEN;
  const agentId = process.env.MAYA_AGENT_ID;
  const accountId = process.env.MAYA_ACCOUNT_ID;
  const ownerEoa = process.env.MAYA_OWNER_EOA;
  const compassApiKeyAuth = process.env.COMPASS_API_KEY_AUTH;
  const compassBin = process.env.COMPASS_BIN;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';

  const missing = [
    !tenantKey && 'MAYA_TENANT_KEY',
    !agentToken && 'MAYA_AGENT_TOKEN',
    !agentId && 'MAYA_AGENT_ID',
    !accountId && 'MAYA_ACCOUNT_ID',
    !ownerEoa && 'MAYA_OWNER_EOA',
    !compassApiKeyAuth && 'COMPASS_API_KEY_AUTH',
    !compassBin && 'COMPASS_BIN',
  ].filter(Boolean);
  if (missing.length) {
    return {
      error: `Missing Maya env: ${missing.join(', ')}. Check apps/demo/coral-mobile/.env.local.`,
    };
  }
  return {
    tenantKey: tenantKey!,
    agentToken: agentToken!,
    agentId: agentId!,
    accountId: accountId!,
    ownerEoa: ownerEoa!,
    compassApiKeyAuth: compassApiKeyAuth!,
    compassBin: compassBin!,
    baseUrl: baseUrl.replace(/\/$/, ''),
  };
}

/** Borrow parameters for the demo — deliberately a sub-dollar amount. */
export const BORROW = {
  amount: '0.00005',
  asset: 'WETH',
  scope: 'compass:credit',
  chain: 'base',
  venueType: 'aave-credit:WETH',
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

export function readPosition(env: MayaEnv): MayaPosition {
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
  return {
    collateralUsd: num(collateral?.usd_value),
    suppliedUsdc: num(collateral?.amount_supplied),
    supplyApy: num(collateral?.supply_apy),
    debt,
  };
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
