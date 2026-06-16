/**
 * Compass demo: per-scenario state setup/teardown.
 *
 * Every scenario operates on a single agent — the one the partner picks
 * in the page UI. The runner POSTs `agent_id` with each /api/run call;
 * these helpers use it to flip status / allowlist / scope on that one
 * agent before the MCP wrapper is invoked. No role split (earn vs
 * credit), no name matching, no env-var hardcoding.
 *
 * All operations talk to the Sly API with the tenant key — no Supabase
 * service-role access, no RLS bypass. Same code path a partner would
 * build against.
 *
 * All operations are idempotent — the goal is "scenario X starts with
 * the world in state Y", not "transition from current state Z".
 */

import { type Scenario } from './scenarios';

const SLY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SLY_TENANT_KEY = process.env.SLY_DEMO_TENANT_API_KEY || 'pk_test_compass_demo_2026';

// Venues we keep allowlisted on the picked agent. Covers everything any
// scenario might call: yield vaults (earn), credit borrow (USDC against
// WETH), the EOA → Earn Account staging hop, the equity buy. Scenarios
// add `aave-credit:USDC` / `equity:TSLAon` conditionally on top of this.
const BASE_VENUES = [
  'aave-v3-base',
  'morpho-base',
  'aave-credit:WETH',
  'compass-earn-account',
  // Gates per-owner Compass smart-account deploys — see
  // governed_*_create_account in @sly_ai/mcp-compass.
  'compass-onboarding',
];

type CompassScope = 'compass:credit' | 'compass:tokenized';

interface ResolvedAgent {
  id: string;
  eoa: string;
}

/**
 * Authed JSON fetch against the Sly API using the demo tenant key.
 * Throws on non-2xx with the response body for diagnosis.
 */
async function slyFetch<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${SLY_API_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SLY_TENANT_KEY}`,
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** Per-agent EOA cache (keyed by agent_id; survives across scenario runs). */
const _agentCache = new Map<string, ResolvedAgent>();

/**
 * Resolve an agent's EOA address by fetching its wallet from the public
 * Sly API. Caches the result per-agent — EOAs don't change once a wallet
 * is provisioned.
 */
export async function resolveAgent(agentId: string): Promise<ResolvedAgent> {
  const cached = _agentCache.get(agentId);
  if (cached) return cached;
  const body = await slyFetch<{
    data: { address?: string; wallet_address?: string };
  }>(`/v1/agents/${agentId}/wallet`);
  const eoa = body.data.address ?? body.data.wallet_address ?? '';
  const resolved: ResolvedAgent = { id: agentId, eoa };
  _agentCache.set(agentId, resolved);
  return resolved;
}

/**
 * Rewrite the picked agent's wallet allowlist to include exactly the
 * venues needed for this scenario. setupScenario re-stamps every run so
 * partners don't have to pre-configure their agent — whatever was there
 * before gets replaced with the demo's known-good set.
 */
async function setAllowlistForAgent(
  agentId: string,
  includesUsdcCredit: boolean,
  includesTsla: boolean,
): Promise<void> {
  const allowed = [...BASE_VENUES];
  if (includesUsdcCredit) allowed.push('aave-credit:USDC');
  if (includesTsla) allowed.push('equity:TSLAon');
  await slyFetch(`/v1/agents/${agentId}/wallet/policy`, {
    method: 'PUT',
    body: {
      contractPolicy: { allowedContractTypes: allowed },
    },
  });
}

interface ScopeGrant {
  id: string;
  agent_id: string;
  scope: string;
  status: string;
  expires_at?: string | null;
}

/** Extract `grants[]` from either flat or `{data:{grants}}` envelopes. */
function unwrapGrants(list: { grants?: ScopeGrant[]; data?: { grants?: ScopeGrant[] } }): ScopeGrant[] {
  return list?.grants ?? list?.data?.grants ?? [];
}

/** Revoke every active grant of (agent, scope). Returns the count revoked. */
async function revokeScope(agentId: string, scope: CompassScope): Promise<number> {
  const list = await slyFetch<{ grants?: ScopeGrant[]; data?: { grants?: ScopeGrant[] } }>(
    `/v1/organization/scopes?agent_id=${encodeURIComponent(agentId)}`,
  );
  const matching = unwrapGrants(list).filter(
    (g) => g.scope === scope && g.status === 'active',
  );
  for (const g of matching) {
    await slyFetch(`/v1/organization/scopes/${g.id}`, { method: 'DELETE' });
  }
  return matching.length;
}

/**
 * Make sure (agent, scope) has an active standing grant. Returns the
 * grant id. If a usable grant already exists, returns it without
 * issuing a new one.
 */
async function ensureActiveScope(agentId: string, scope: CompassScope): Promise<string> {
  const list = await slyFetch<{ grants?: ScopeGrant[]; data?: { grants?: ScopeGrant[] } }>(
    `/v1/organization/scopes?agent_id=${encodeURIComponent(agentId)}`,
  );
  const now = new Date().toISOString();
  const existing = unwrapGrants(list).find(
    (g) =>
      g.scope === scope &&
      g.status === 'active' &&
      (!g.expires_at || g.expires_at > now),
  );
  if (existing) return existing.id;

  const body = await slyFetch<{ data?: { grant_id?: string }; grant_id?: string }>(
    '/v1/organization/scopes',
    {
      method: 'POST',
      body: {
        agent_id: agentId,
        scope,
        lifecycle: 'standing',
        purpose: `Live demo: ${scope} action (standing, restorable across runs)`,
        duration_minutes: 120,
      },
    },
  );
  const grantId = body?.data?.grant_id ?? body?.grant_id;
  if (!grantId) throw new Error(`issue ${scope}: missing grant_id in response`);
  return grantId;
}

/**
 * Flip the picked agent's active/suspended status via the dedicated
 * endpoints. Both are idempotent (suspend returns a "already suspended"
 * 400 if the agent is already suspended) — we swallow that case.
 */
async function setAgentStatus(
  agentId: string,
  status: 'active' | 'suspended',
): Promise<void> {
  const path = `/v1/agents/${agentId}/${status === 'suspended' ? 'suspend' : 'activate'}`;
  try {
    await slyFetch(path, { method: 'POST' });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    // Idempotency: the endpoints throw 400 with "already X" — treat as success.
    if (/already (suspended|active)/i.test(msg)) return;
    throw e;
  }
}

export async function setupScenario(scenario: Scenario, agentId: string): Promise<void> {
  const s = scenario.setup;
  // ORDER MATTERS: scopes must be issued/revoked BEFORE setting agent
  // status, because Sly rejects grant issuance to a non-active agent.
  // The deny_kill_switch scenario needs scopes=true AND status=suspended,
  // which only works if we grant first then suspend.
  await setAllowlistForAgent(agentId, s.usdcInAllowlist, s.tslaInAllowlist);
  for (const [scope, wanted] of Object.entries(s.scopes) as Array<[CompassScope, boolean]>) {
    if (wanted) await ensureActiveScope(agentId, scope);
    else await revokeScope(agentId, scope);
  }
  await setAgentStatus(agentId, s.agentStatus);
}

export async function restoreBaseline(agentId: string): Promise<void> {
  // After every compass-live run, snap the picked agent back to a sane
  // state — active, allowlist re-stamped. We intentionally do NOT
  // auto-grant compass:credit — each scenario sets up its own grant
  // state in setupScenario; restoreBaseline only needs to leave the
  // world non-broken.
  await setAgentStatus(agentId, 'active');
  await setAllowlistForAgent(agentId, true, true);
}
