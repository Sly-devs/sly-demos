/**
 * Compass demo: per-scenario state setup/teardown.
 *
 * Each demo scenario needs a specific starting state on the Sly side
 * (compass:credit grant present-or-absent, allowlist with-or-without
 * USDC + TSLAon, agent active-or-suspended). These helpers run
 * server-side with the demo tenant's API key only — NO Supabase service-
 * role key, NO RLS-bypass paths. Everything goes through the same Sly
 * API endpoints a partner integration would use.
 *
 * All operations are idempotent — the goal is "scenario X starts with
 * the world in state Y", not "transition from current state Z".
 */

import { AGENTS, type Scenario, type AgentKey } from './scenarios';

const SLY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sandbox.getsly.ai';
const SLY_TENANT_KEY = process.env.SLY_DEMO_TENANT_API_KEY || '';

// Base venue allowlist that always stays on. Scenarios add/remove
// 'aave-credit:USDC' (credit borrow target) and 'equity:TSLAon'
// (tokenized buy target) on top of this.
const BASE_VENUES_CREDIT = ['aave-v3-base', 'morpho-base', 'aave-credit:WETH', 'compass-earn-account'];
// `compass-earn-account` covers governed_earn_transfer (EOA → Compass Earn
// Account staging) — needed by the multi_stage_and_deposit scenario.
const BASE_VENUES_EARN = ['aave-v3-base', 'morpho-base', 'compass-earn-account'];

type CompassScope = 'compass:credit' | 'compass:tokenized';

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

/**
 * Set the EOA / Circle wallet's venue allowlist for a scenario.
 *
 * Uses `PUT /v1/agents/:agentId/wallet/policy` which merges the supplied
 * partial policy with the existing one (preserves spend counters etc.),
 * so we only need to send the contractPolicy slice we're changing.
 *
 * NOTE: this updates the agent's primary wallet only. The Compass-managed
 * Safe (if any) has its own spending policy seeded once with the venues
 * it supports; we don't re-stamp it from here.
 */
async function setAllowlistForAgent(
  agent: AgentKey,
  includesUsdcCredit: boolean,
  includesTsla: boolean,
): Promise<void> {
  const base = agent === 'credit' ? BASE_VENUES_CREDIT : BASE_VENUES_EARN;
  const allowed = [...base];
  if (includesUsdcCredit) allowed.push('aave-credit:USDC');
  if (includesTsla) allowed.push('equity:TSLAon');
  await slyFetch(`/v1/agents/${AGENTS[agent].id}/wallet/policy`, {
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

/**
 * Revoke every active grant of (agent, scope). Returns the count revoked.
 *
 * Tactic: list active grants filtered by agent_id, filter client-side to
 * the target scope, DELETE each. The Sly API doesn't have a bulk-revoke
 * by (agent_id, scope) so we do this in two steps.
 */
async function revokeScope(agent: AgentKey, scope: CompassScope): Promise<number> {
  const list = await slyFetch<{ grants: ScopeGrant[] }>(
    `/v1/organization/scopes?agent_id=${encodeURIComponent(AGENTS[agent].id)}`,
  );
  const matching = (list.grants ?? []).filter(
    (g) => g.scope === scope && g.status === 'active',
  );
  for (const g of matching) {
    await slyFetch(`/v1/organization/scopes/${g.id}`, { method: 'DELETE' });
  }
  return matching.length;
}

/**
 * Make sure (agent, scope) has an active standing grant. Returns the grant id.
 * If a usable grant already exists, returns it without issuing a new one.
 */
async function ensureActiveScope(agent: AgentKey, scope: CompassScope): Promise<string> {
  const list = await slyFetch<{ grants: ScopeGrant[] }>(
    `/v1/organization/scopes?agent_id=${encodeURIComponent(AGENTS[agent].id)}`,
  );
  const now = new Date().toISOString();
  const existing = (list.grants ?? []).find(
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
        agent_id: AGENTS[agent].id,
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
 * Flip an agent's active/suspended status via the dedicated endpoints.
 * `/suspend` and `/activate` are both idempotent (suspend returns a
 * "already suspended" 400 if the agent is already suspended) — we swallow
 * that case to keep setupScenario idempotent.
 */
async function setAgentStatus(
  agent: AgentKey,
  status: 'active' | 'suspended',
): Promise<void> {
  const path = `/v1/agents/${AGENTS[agent].id}/${status === 'suspended' ? 'suspend' : 'activate'}`;
  try {
    await slyFetch(path, { method: 'POST' });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    // The endpoints throw 400 with a clear "already X" message — treat
    // as success to preserve idempotency.
    if (/already (suspended|active)/i.test(msg)) return;
    throw e;
  }
}

export async function setupScenario(scenario: Scenario): Promise<void> {
  const s = scenario.setup;
  // ORDER MATTERS: scopes must be issued/revoked BEFORE setting agent
  // status, because Sly rejects grant issuance to a non-active agent
  // ("Cannot issue grant to non-active agent (status: suspended)"). The
  // deny_kill_switch scenario needs scopes=true AND status=suspended,
  // which only works if we grant first then suspend.
  await setAllowlistForAgent(s.agent, s.usdcInAllowlist, s.tslaInAllowlist);
  for (const [scope, wanted] of Object.entries(s.scopes) as Array<[CompassScope, boolean]>) {
    if (wanted) await ensureActiveScope(s.agent, scope);
    else await revokeScope(s.agent, scope);
  }
  await setAgentStatus(s.agent, s.agentStatus);
}

export async function restoreBaseline(): Promise<void> {
  // After every compass-live run, snap agents + allowlists back. We
  // intentionally do NOT auto-grant compass:credit — the Maya/Coral
  // mobile flow on :3211 starts from "no grant" so it can demo the
  // just-in-time approval story. Each compass-live scenario sets up
  // its own grant state in setupScenario; restoreBaseline only needs
  // to leave the world non-broken.
  await setAgentStatus('credit', 'active');
  await setAgentStatus('earn', 'active');
  await setAllowlistForAgent('credit', true, true);
  await setAllowlistForAgent('earn', true, true);
}
