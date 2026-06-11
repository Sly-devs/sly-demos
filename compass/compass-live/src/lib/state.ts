/**
 * Compass demo: per-scenario state setup/teardown.
 *
 * Each demo scenario needs a specific starting state on the Sly side
 * (compass:credit grant present-or-absent, allowlist with-or-without
 * USDC + TSLAon, agent active-or-suspended). These helpers run
 * server-side with the service-role Supabase key and the demo tenant's
 * API key, never client-side.
 *
 * All operations are idempotent — the goal is "scenario X starts with
 * the world in state Y", not "transition from current state Z".
 */

import { createClient } from '@supabase/supabase-js';
import { AGENTS, type Scenario, type AgentKey } from './scenarios';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SLY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SLY_TENANT_KEY = process.env.SLY_DEMO_TENANT_API_KEY || '';

// Base venue allowlist that always stays on. Scenarios add/remove
// 'aave-credit:USDC' (credit borrow target) and 'equity:TSLAon'
// (tokenized buy target) on top of this.
const BASE_VENUES_CREDIT = ['aave-v3-base', 'morpho-base', 'aave-credit:WETH'];
const BASE_VENUES_EARN = ['aave-v3-base', 'morpho-base'];

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Demo runner missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/demo/compass-live/.env.local');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function setAllowlistForAgent(agent: AgentKey, includesUsdcCredit: boolean, includesTsla: boolean): Promise<void> {
  const client = sb();
  // Only mutate the EOA / Circle wallet. The Compass-managed Safe has
  // its own spending_policy (seeded once with the venues it supports
  // including 'compass:withdraw') and shouldn't be re-stamped every
  // scenario click — doing so would erase venues that aren't in the
  // BASE_VENUES list.
  const { data: wallets, error } = await client
    .from('wallets')
    .select('id, spending_policy')
    .eq('managed_by_agent_id', AGENTS[agent].id)
    .neq('wallet_type', 'smart_wallet');
  if (error) throw new Error(`setAllowlist read failed: ${error.message}`);
  const base = agent === 'credit' ? BASE_VENUES_CREDIT : BASE_VENUES_EARN;
  for (const w of wallets ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sp: any = w.spending_policy ?? {};
    const cp = sp.contractPolicy ?? {};
    const allowed = [...base];
    if (includesUsdcCredit) allowed.push('aave-credit:USDC');
    if (includesTsla) allowed.push('equity:TSLAon');
    const spending_policy = { ...sp, contractPolicy: { ...cp, allowedContractTypes: allowed } };
    const { error: e2 } = await client.from('wallets').update({ spending_policy }).eq('id', w.id);
    if (e2) throw new Error(`setAllowlist write failed: ${e2.message}`);
  }
}

type CompassScope = 'compass:credit' | 'compass:tokenized';

async function revokeScope(agent: AgentKey, scope: CompassScope): Promise<number> {
  const client = sb();
  const { data, error } = await client
    .from('auth_scope_grants')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('agent_id', AGENTS[agent].id)
    .eq('scope', scope)
    .eq('status', 'active')
    .select('id');
  if (error) throw new Error(`revokeScope(${scope}) failed: ${error.message}`);
  return data?.length ?? 0;
}

async function ensureActiveScope(agent: AgentKey, scope: CompassScope): Promise<string> {
  const client = sb();
  const { data: existing } = await client
    .from('auth_scope_grants')
    .select('id')
    .eq('agent_id', AGENTS[agent].id)
    .eq('scope', scope)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  if (existing && existing.length > 0) return existing[0].id;

  const res = await fetch(`${SLY_API_URL}/v1/organization/scopes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SLY_TENANT_KEY}` },
    body: JSON.stringify({
      agent_id: AGENTS[agent].id,
      scope,
      lifecycle: 'standing',
      purpose: `Live demo: ${scope} action (standing, restorable across runs)`,
      duration_minutes: 120,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`issue ${scope} grant failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const body = (await res.json()) as { data?: { grant_id?: string }; grant_id?: string };
  const grantId = body?.data?.grant_id ?? body?.grant_id;
  if (!grantId) throw new Error(`issue ${scope}: missing grant_id in response`);
  return grantId;
}

async function setAgentStatus(agent: AgentKey, status: 'active' | 'suspended'): Promise<void> {
  const client = sb();
  const { error } = await client.from('agents').update({ status }).eq('id', AGENTS[agent].id);
  if (error) throw new Error(`setAgentStatus failed: ${error.message}`);
}

export async function setupScenario(scenario: Scenario): Promise<void> {
  const s = scenario.setup;
  await setAgentStatus(s.agent, s.agentStatus);
  await setAllowlistForAgent(s.agent, s.usdcInAllowlist, s.tslaInAllowlist);
  for (const [scope, wanted] of Object.entries(s.scopes) as Array<[CompassScope, boolean]>) {
    if (wanted) await ensureActiveScope(s.agent, scope);
    else await revokeScope(s.agent, scope);
  }
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
