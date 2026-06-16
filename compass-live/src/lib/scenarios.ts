/**
 * Scenario catalogue for the Compass live demo.
 *
 * Each scenario carries everything the runner needs:
 *   • which MCP tool to call (always a `governed_*`)
 *   • which arguments to pass (chain, owner, amount, etc.)
 *   • which seeded agent + wallet to use
 *   • how to prep the world before running (`setup`)
 *   • the exact `compass <...>` CLI invocation the wrapper will shell out
 *     to on approve — this is what Diego's team needs to review
 *
 * Adding a scenario = one entry here. The runner + UI both consume this.
 */

export type ScenarioId =
  | 'happy_earn_deposit'
  | 'happy_credit_borrow'
  | 'happy_compass_withdraw'
  | 'happy_tokenized_buy'
  | 'seed_aave_collateral'
  | 'deny_scope'
  | 'deny_allowlist'
  | 'deny_kill_switch'
  // Multi-step scenarios — each runs N tool calls in sequence, each
  // gated by Sly independently. The right pane numbers them [step k/N].
  | 'multi_autonomous_yield'
  | 'multi_borrow_and_pay'
  | 'multi_stage_and_deposit'
  | 'onboard_compass'
  // Faked previews — the underlying primitive (hierarchical agent
  // delegation, perps execute, etc.) isn't built in v1, but we want
  // the demo to show the operator what the flow will look like. Each
  // step's parsed result is canned; the curated event flow is
  // otherwise identical to a real run.
  | 'multi_treasury_of_agents'
  | 'fake_perps_order';

export type AgentKey = 'earn' | 'credit';

// Setup mutations the runner applies before the agent invocation.
export interface SetupSpec {
  agent: AgentKey;
  agentStatus: 'active' | 'suspended';
  // Step-up scope grants to ensure are active (true) or revoked (false)
  // before the run. Only specify the ones the scenario depends on.
  // Default for unspecified scopes is "leave alone".
  scopes: {
    'compass:credit'?: boolean;
    'compass:tokenized'?: boolean;
  };
  usdcInAllowlist: boolean;
  // Tokenized scenarios need 'equity:TSLAon' in the venue allowlist.
  tslaInAllowlist: boolean;
}

// Resolved from .env.local (written by `pnpm onboard`). Falls back to the
// hardcoded local-dev seed values so dev-mode (seed-compass-demo.ts) still
// works without env vars. Partner-onboarded tenants get fresh agent IDs
// per `POST /v1/onboarding/compass-demo`, which the onboard script writes
// to .env.local as NEXT_PUBLIC_COMPASS_AGENT_{EARN,CREDIT}_{ID,EOA}.
export const AGENTS: Record<AgentKey, { id: string; eoa: string; tier: number }> = {
  earn: {
    id: process.env.NEXT_PUBLIC_COMPASS_AGENT_EARN_ID || '565824b1-1fe4-7260-bcf2-7856f6eb007a',
    eoa: process.env.NEXT_PUBLIC_COMPASS_AGENT_EARN_EOA || '0x9Bed369ecE5aAaC52110Be91fAE0A5aE69BF1BDd',
    tier: 1,
  },
  credit: {
    id: process.env.NEXT_PUBLIC_COMPASS_AGENT_CREDIT_ID || '3c7812a6-0e45-6149-9e74-d807c33b622e',
    eoa: process.env.NEXT_PUBLIC_COMPASS_AGENT_CREDIT_EOA || '0x897Fb7B2447a750B5d5d0054c848CF2aB42c04e3',
    tier: 2,
  },
};

// Morpho USDC vault on Base (Steakhouse Prime) — same one used in the
// e2e test script (`test-compass-policy-flow.ts`).
const MORPHO_USDC_VAULT_BASE = '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2';

const COMPASS_FLAGS = '-o json --no-interactive';

// A single tool invocation. Single-step scenarios encode their action
// directly on Scenario; multi-step scenarios use Scenario.steps[].
export interface ScenarioStep {
  label: string;       // shown as "[step k/N] <label>" on both panes
  description?: string; // longer subtitle for the right pane banner
  tool: 'governed_earn_deposit' | 'governed_earn_withdraw' | 'governed_earn_swap' | 'governed_earn_transfer' | 'governed_credit_borrow' | 'governed_tokenized_buy' | 'governed_compass_withdraw' | 'governed_perps_order' | 'governed_earn_create_account' | 'governed_credit_create_account' | 'governed_tokenized_create_account';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
  // Render the exact compass invocation that the wrapper would (and
  // does, on approve) shell out. Kept in sync with @sly_ai/mcp-compass
  // governed-actions.ts.
  buildCli(): string;
  // Optional: skip the real MCP-client call and curated-event flow for
  // this step, and replay a canned visual instead. Used when the
  // underlying primitive isn't built yet (e.g. hierarchical agent
  // delegation in v1) but we still want the demo to show what the
  // experience will be. Left pane gets `leftLines` echoed verbatim;
  // the runner pipes `parsed` through emitCuratedEvents the same way
  // a real result would flow, so the right-pane policy-event display
  // is identical whether real or faked.
  fake?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsed: any;
    leftLines?: string[];
    // Optional: skip the standard curated event block entirely and emit
    // a custom event list (useful for delegation-request beats that
    // don't fit the precheck → engine → decision shape).
    customEvents?: Array<{
      text: string;
      level?: 'info' | 'good' | 'warn' | 'deny' | 'dim';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detail?: Record<string, any>;
      waitAfterMs?: number;
    }>;
  };
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  sub: string;
  tone: 'good' | 'deny';
  expected: 'approve' | 'deny';
  setup: SetupSpec;
  // Either a single step (the common case — back-compat with the
  // original scenario shape that had tool/args/buildCli inline) or an
  // array of steps for sequenced demos.
  tool?: ScenarioStep['tool'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: Record<string, any>;
  buildCli?(): string;
  steps?: ScenarioStep[];
}

/** Normalise a Scenario into its step list — single-step scenarios
 *  collapse to a length-1 array so the runner code is uniform. */
export function scenarioSteps(s: Scenario): ScenarioStep[] {
  if (s.steps && s.steps.length > 0) return s.steps;
  if (!s.tool || !s.args || !s.buildCli) {
    throw new Error(`Scenario ${s.id} has neither steps nor tool/args/buildCli`);
  }
  return [{ label: s.label, tool: s.tool, args: s.args, buildCli: s.buildCli }];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'happy_earn_deposit',
    label: 'Earn deposit · Morpho USDC',
    sub: 'governed_earn_deposit · auto-broadcast via CDP on approve',
    tone: 'good',
    expected: 'approve',
    tool: 'governed_earn_deposit',
    args: {
      agent_id: AGENTS.earn.id,
      owner: AGENTS.earn.eoa,
      chain: 'base',
      amount: '0.1',
      venue_type: 'morpho-base',
      vault_address: MORPHO_USDC_VAULT_BASE,
    },
    setup: { agent: 'earn', agentStatus: 'active', scopes: {}, usdcInAllowlist: true, tslaInAllowlist: true },
    buildCli() {
      const v = JSON.stringify({ type: 'VAULT', vault_address: MORPHO_USDC_VAULT_BASE });
      return `compass earn manage --action DEPOSIT --venue '${v}' --amount 0.1 --owner ${AGENTS.earn.eoa} --chain base ${COMPASS_FLAGS}`;
    },
  },
  {
    id: 'happy_credit_borrow',
    label: 'Credit borrow · Aave V3',
    sub: 'governed_credit_borrow · returns signable EIP-712 payload',
    tone: 'good',
    expected: 'approve',
    tool: 'governed_credit_borrow',
    args: {
      agent_id: AGENTS.credit.id,
      owner: AGENTS.credit.eoa,
      borrow_token: 'USDC',
      amount: '0.5',
      chain: 'base',
    },
    setup: { agent: 'credit', agentStatus: 'active', scopes: { 'compass:credit': true }, usdcInAllowlist: true, tslaInAllowlist: true },
    buildCli() {
      return `compass credit borrow --borrow-token USDC --borrow-amount 0.5 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
    },
  },
  {
    id: 'happy_compass_withdraw',
    label: 'Withdraw · Safe → EOA',
    sub: 'governed_compass_withdraw · Safe execTransaction → CDP signs → Compass tracks',
    tone: 'good',
    expected: 'approve',
    tool: 'governed_compass_withdraw',
    args: {
      agent_id: AGENTS.credit.id,
      owner: AGENTS.credit.eoa,
      chain: 'base',
      token: 'USDC',
      amount: '0.10',
    },
    setup: { agent: 'credit', agentStatus: 'active', scopes: { 'compass:credit': true }, usdcInAllowlist: true, tslaInAllowlist: true },
    buildCli() {
      return `compass credit transfer --action WITHDRAW --token USDC --amount 0.10 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
    },
  },
  {
    id: 'happy_tokenized_buy',
    label: 'Tokenized buy · TSLAon (Ondo)',
    sub: 'governed_tokenized_buy · returns EIP-712 order',
    tone: 'good',
    expected: 'approve',
    tool: 'governed_tokenized_buy',
    args: {
      agent_id: AGENTS.credit.id,
      owner: AGENTS.credit.eoa,
      chain: 'base',
      symbol: 'TSLAon',
      amount: '0.25',
    },
    setup: { agent: 'credit', agentStatus: 'active', scopes: { 'compass:tokenized': true }, usdcInAllowlist: true, tslaInAllowlist: true },
    buildCli() {
      return `compass tokenized-equities order --from-token USDC --to-token TSLAon --amount 0.25 --owner ${AGENTS.credit.eoa} ${COMPASS_FLAGS}`;
    },
  },
  {
    id: 'seed_aave_collateral',
    label: 'Seed Aave collateral · supply $X USDC',
    sub: 'governed_credit_borrow with --token-in/--collateral-token — supplies USDC to Aave and takes a $0.01 borrow in one atomic Safe tx. Required prerequisite for the Coral × Compass "Maya has $X earning yield" narrative.',
    tone: 'good',
    expected: 'approve',
    tool: 'governed_credit_borrow',
    args: {
      agent_id: AGENTS.credit.id,
      owner: AGENTS.credit.eoa,
      chain: 'base',
      // Atomic supply + minimal self-borrow. `amount` here is the borrow
      // amount Sly evaluates against the spending policy; the supply is
      // an implicit prerequisite tracked via venue_type=aave-credit:USDC.
      borrow_token: 'USDC',
      amount: '0.01',
      token_in: 'USDC',
      collateral_token: 'USDC',
      amount_in: '1.0',
    },
    setup: { agent: 'credit', agentStatus: 'active', scopes: { 'compass:credit': true }, usdcInAllowlist: true, tslaInAllowlist: true },
    buildCli() {
      return `compass credit borrow --borrow-token USDC --borrow-amount 0.01 --token-in USDC --collateral-token USDC --amount-in 1.0 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
    },
  },
  {
    id: 'deny_scope',
    label: 'Denied · no compass:credit grant',
    sub: 'credit borrow attempted without the step-up scope',
    tone: 'deny',
    expected: 'deny',
    tool: 'governed_credit_borrow',
    args: {
      agent_id: AGENTS.credit.id,
      owner: AGENTS.credit.eoa,
      borrow_token: 'USDC',
      amount: '5',
      chain: 'base',
    },
    setup: { agent: 'credit', agentStatus: 'active', scopes: { 'compass:credit': false }, usdcInAllowlist: true, tslaInAllowlist: true },
    buildCli() {
      return `compass credit borrow --borrow-token USDC --borrow-amount 5 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
    },
  },
  {
    id: 'deny_allowlist',
    label: 'Denied · venue not allowlisted',
    sub: 'borrow USDC, but aave-credit:USDC not in allowlist',
    tone: 'deny',
    expected: 'deny',
    tool: 'governed_credit_borrow',
    args: {
      agent_id: AGENTS.credit.id,
      owner: AGENTS.credit.eoa,
      borrow_token: 'USDC',
      amount: '5',
      chain: 'base',
    },
    setup: { agent: 'credit', agentStatus: 'active', scopes: { 'compass:credit': true }, usdcInAllowlist: false, tslaInAllowlist: true },
    buildCli() {
      return `compass credit borrow --borrow-token USDC --borrow-amount 5 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
    },
  },
  {
    id: 'deny_kill_switch',
    label: 'Denied · operator kill-switch',
    sub: 'agent suspended — engine never invoked',
    tone: 'deny',
    expected: 'deny',
    tool: 'governed_credit_borrow',
    args: {
      agent_id: AGENTS.credit.id,
      owner: AGENTS.credit.eoa,
      borrow_token: 'USDC',
      amount: '5',
      chain: 'base',
    },
    setup: { agent: 'credit', agentStatus: 'suspended', scopes: { 'compass:credit': true }, usdcInAllowlist: true, tslaInAllowlist: true },
    buildCli() {
      return `compass credit borrow --borrow-token USDC --borrow-amount 5 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
    },
  },

  // ── Multi-step scenarios — sequenced demos that show the agent
  // chaining multiple governed actions, each independently gated by
  // Sly. The right pane numbers them [step k/N].

  {
    id: 'multi_autonomous_yield',
    label: 'Autonomous yield · rebalance',
    sub: '3 steps: withdraw low-APY → deposit high-APY · each Sly-gated',
    tone: 'good',
    expected: 'approve',
    // Earn agent operates without step-up scope (earn:* is non-step-up).
    setup: { agent: 'earn', agentStatus: 'active', scopes: {}, usdcInAllowlist: true, tslaInAllowlist: true },
    steps: [
      {
        label: 'Withdraw from Morpho (low APY)',
        description: 'Agent decides to move out of the low-yield vault. Sly gates the venue + amount.',
        tool: 'governed_earn_withdraw',
        args: {
          agent_id: AGENTS.earn.id,
          owner: AGENTS.earn.eoa,
          chain: 'base',
          amount: '0.05',
          venue_type: 'morpho-base',
          vault_address: '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2',
        },
        buildCli() {
          const v = JSON.stringify({ type: 'VAULT', vault_address: '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2' });
          return `compass earn manage --action WITHDRAW --venue '${v}' --amount 0.05 --owner ${AGENTS.earn.eoa} --chain base ${COMPASS_FLAGS}`;
        },
      },
      {
        label: 'Deposit into Aave V3 (higher APY)',
        description: 'Same dollar amount lands in the better-yielding venue. Same allowlist + spend caps re-evaluated.',
        tool: 'governed_earn_deposit',
        args: {
          agent_id: AGENTS.earn.id,
          owner: AGENTS.earn.eoa,
          chain: 'base',
          amount: '0.05',
          venue_type: 'aave-v3-base',
          // Aave V3 USDC market on Base — used as the "VAULT" address in
          // Compass's vocabulary (it routes to the right pool).
          vault_address: '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2',
        },
        buildCli() {
          return `compass earn manage --action DEPOSIT --venue aave-v3-base --amount 0.05 --owner ${AGENTS.earn.eoa} --chain base ${COMPASS_FLAGS}`;
        },
      },
    ],
  },

  {
    id: 'multi_stage_and_deposit',
    label: 'Stage-and-deposit · Earn Account',
    sub: '2 steps: EOA → Earn Account → Morpho · each Sly-gated independently',
    tone: 'good',
    expected: 'approve',
    // Earn agent — same as happy_earn_deposit, no step-up scope needed.
    // Requires `compass-earn-account` in the venue allowlist (added in
    // seed-compass-demo.ts).
    setup: { agent: 'earn', agentStatus: 'active', scopes: {}, usdcInAllowlist: true, tslaInAllowlist: true },
    steps: [
      {
        label: 'Stage $0.10 USDC EOA → Earn Account',
        description:
          "Compass's new 2-step model: `compass earn manage` only moves funds BETWEEN the Earn Account and a venue — it doesn't pull from the EOA. The agent stages first. Sly gates the staging hop as its own decision: venue='compass-earn-account', amount within KYA T1 cap.",
        tool: 'governed_earn_transfer',
        args: {
          agent_id: AGENTS.earn.id,
          owner: AGENTS.earn.eoa,
          chain: 'base',
          amount: '0.1',
        },
        buildCli() {
          return `compass earn transfer --action DEPOSIT --token USDC --amount 0.1 --owner ${AGENTS.earn.eoa} --chain base ${COMPASS_FLAGS}`;
        },
      },
      {
        label: 'Deposit $0.05 USDC Earn Account → Morpho vault',
        description:
          'Same dollar pool, second governed call. With the Earn Account now funded, `earn manage` lands in the yield vault. Independent policy decision + audit row.',
        tool: 'governed_earn_deposit',
        args: {
          agent_id: AGENTS.earn.id,
          owner: AGENTS.earn.eoa,
          chain: 'base',
          amount: '0.05',
          venue_type: 'morpho-base',
          vault_address: MORPHO_USDC_VAULT_BASE,
        },
        buildCli() {
          const v = JSON.stringify({ type: 'VAULT', vault_address: MORPHO_USDC_VAULT_BASE });
          return `compass earn manage --action DEPOSIT --venue '${v}' --amount 0.05 --owner ${AGENTS.earn.eoa} --chain base ${COMPASS_FLAGS}`;
        },
      },
    ],
  },

  {
    id: 'onboard_compass',
    label: 'Onboard agent · 3-surface Compass setup',
    sub: '3 steps: create earn + credit + tokenized accounts · each Sly-gated',
    tone: 'good',
    expected: 'approve',
    // Onboarding uses the earn role purely for routing through setupScenario;
    // the runner patches agent_id + owner from the picker at request time.
    // No scope step-up needed — create-account is allowed by default.
    setup: { agent: 'earn', agentStatus: 'active', scopes: {}, usdcInAllowlist: true, tslaInAllowlist: true },
    steps: [
      {
        label: 'Deploy Earn Account',
        description:
          "Compass's per-owner smart-account for the yield surface. One contract deploy per owner per chain; required before any earn:* action.",
        tool: 'governed_earn_create_account',
        args: {
          agent_id: AGENTS.earn.id,
          owner: AGENTS.earn.eoa,
          chain: 'base',
        },
        buildCli() {
          return `compass earn create-account --owner ${AGENTS.earn.eoa} --sender ${AGENTS.earn.eoa} --chain base ${COMPASS_FLAGS}`;
        },
      },
      {
        label: 'Deploy Credit Account',
        description:
          'Same idea for the credit surface — a Safe-style smart account per owner. Independent policy decision + signed audit row.',
        tool: 'governed_credit_create_account',
        args: {
          agent_id: AGENTS.earn.id,
          owner: AGENTS.earn.eoa,
          chain: 'base',
        },
        buildCli() {
          return `compass credit create-account --owner ${AGENTS.earn.eoa} --sender ${AGENTS.earn.eoa} --chain base ${COMPASS_FLAGS}`;
        },
      },
      {
        label: 'Deploy Tokenized Equities Account',
        description:
          "Final surface — Ondo-style tokenized equities. With these three deploys, the agent is Compass-ready for all governed_* usage tools.",
        tool: 'governed_tokenized_create_account',
        args: {
          agent_id: AGENTS.earn.id,
          owner: AGENTS.earn.eoa,
          chain: 'base',
        },
        buildCli() {
          return `compass tokenized-equities create-account --owner ${AGENTS.earn.eoa} --sender ${AGENTS.earn.eoa} ${COMPASS_FLAGS}`;
        },
      },
    ],
  },

  {
    id: 'multi_borrow_and_pay',
    label: 'Borrow-and-pay loop',
    sub: '2 steps: credit borrow → withdraw to EOA · agent now holds spendable funds',
    tone: 'good',
    expected: 'approve',
    setup: { agent: 'credit', agentStatus: 'active', scopes: { 'compass:credit': true }, usdcInAllowlist: true, tslaInAllowlist: true },
    steps: [
      {
        label: 'Borrow $0.50 USDC against Aave collateral',
        description: 'Agent draws a credit line. Sly checks the compass:credit scope + the contract-type allowlist + spending caps.',
        tool: 'governed_credit_borrow',
        args: {
          agent_id: AGENTS.credit.id,
          owner: AGENTS.credit.eoa,
          borrow_token: 'USDC',
          amount: '0.5',
          chain: 'base',
        },
        buildCli() {
          return `compass credit borrow --borrow-token USDC --borrow-amount 0.5 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
        },
      },
      {
        label: 'Withdraw $0.50 USDC from Safe → EOA',
        description: 'Borrowed funds land in the Compass Safe. The agent moves them to its own EOA to spend. Sly gates the Safe execTransaction.',
        tool: 'governed_compass_withdraw',
        args: {
          agent_id: AGENTS.credit.id,
          owner: AGENTS.credit.eoa,
          chain: 'base',
          token: 'USDC',
          amount: '0.5',
        },
        buildCli() {
          return `compass credit transfer --action WITHDRAW --token USDC --amount 0.5 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
        },
      },
    ],
  },

  // ── FAKED PREVIEW: Treasury of agents — hierarchical delegation.
  //
  // The underlying primitive (parent_agent_id on agents + delegated
  // scope grant issuance) is scoped in
  // docs/prd/compass-treasury-of-agents-design.md but not built in
  // v1. This scenario uses fake.parsed + fake.customEvents to show the
  // operator what the experience will look like once we ship.
  //
  // Storyline:
  //   1. Treasury agent borrows $1 USDC — succeeds (it has a standing
  //      compass:credit grant, no human needed).
  //   2. Junior sub-agent tries the same — Sly denies with a NEW
  //      reason: scope_required:compass:credit:ask_parent_or_owner.
  //      Junior fires a delegation request.
  //   3. Treasury approves the delegation request (carved under its
  //      own grant — "ceiling never rises" invariant). Junior retries
  //      → succeeds, with the audit trail showing issued_by_agent_id
  //      = treasury.
  {
    id: 'multi_treasury_of_agents',
    label: 'Treasury of agents',
    sub: '3 steps: treasury spends · junior denied · treasury delegates · junior retries — FAKED PREVIEW',
    tone: 'good',
    expected: 'approve',
    // The treasury agent has its own active grant; junior starts with
    // nothing. We use the existing credit agent as both for the demo
    // (it's a single-agent fake — no real hierarchy underneath).
    setup: { agent: 'credit', agentStatus: 'active', scopes: { 'compass:credit': true }, usdcInAllowlist: true, tslaInAllowlist: true },
    steps: [
      {
        label: 'Treasury borrows $1 USDC',
        description: 'Treasury agent has a standing compass:credit grant — Sly approves without asking anyone.',
        tool: 'governed_credit_borrow',
        args: {
          agent_id: AGENTS.credit.id,
          owner: AGENTS.credit.eoa,
          borrow_token: 'USDC',
          amount: '1.0',
          chain: 'base',
        },
        buildCli() {
          return `compass credit borrow --borrow-token USDC --borrow-amount 1.0 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
        },
        fake: {
          leftLines: [
            'Sly × Compass MCP server running on stdio',
            'Sly API: http://localhost:4000 | default chain: base',
            '[agent→MCP] connected — 16 tools available',
            '[agent→MCP] (acting as TREASURY agent) calling governed_credit_borrow (owner 0x897Fb7…, amount 1.0 USDC)',
            '',
            '[MCP→agent] result:',
            '{',
            '  "governed": true,',
            '  "executed": false,',
            '  "decision": "approve",',
            '  "evaluation_id": "treasury-eval-7a9e",',
            '  "compass_payload": { "transaction": { "to": "0x2E92…f0cC", "gas": "0x6ffa2", "from": "0x897Fb7…04e3", "chainId": "0x2105" }, "eip_712": null }',
            '}',
            '# agent client exited (code=0)',
          ],
          parsed: {
            governed: true,
            executed: false,
            decision: 'approve',
            evaluation_id: 'treasury-eval-7a9e',
            reasons: [],
            checks: [
              { check: 'spending_policy', result: 'pass', detail: 'Within spending limits' },
              { check: 'contract_type_allowed', result: 'pass', detail: 'Contract type permitted' },
            ],
            compass_payload: {
              transaction: { to: '0x2E927139AD2c19000Ff2Cb1c79f6e4ba9c72f0cC', from: '0x897Fb7B2447a750B5d5d0054c848CF2aB42c04e3', gas: '0x6ffa2', chainId: '0x2105' },
            },
          },
        },
      },
      {
        label: 'Junior sub-agent tries — denied · asked to ask parent',
        description: 'A sub-agent without its own grant. Sly walks the parent chain, sees the treasury holds compass:credit, and surfaces a delegation path instead of a flat deny.',
        tool: 'governed_credit_borrow',
        args: {
          agent_id: 'junior-sub-agent-uuid',
          owner: AGENTS.credit.eoa,
          borrow_token: 'USDC',
          amount: '0.5',
          chain: 'base',
        },
        buildCli() {
          return `compass credit borrow --borrow-token USDC --borrow-amount 0.5 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
        },
        fake: {
          leftLines: [
            '[agent→MCP] (acting as JUNIOR sub-agent) calling governed_credit_borrow (owner 0x897Fb7…, amount 0.5 USDC)',
            '',
            '[MCP→agent] result:',
            '{',
            '  "governed": true,',
            '  "executed": false,',
            '  "decision": "deny",',
            '  "evaluation_id": null,',
            '  "reasons": ["scope_required:compass:credit:ask_parent_or_owner"],',
            '  "delegation_hint": {',
            '    "parent_agent_id": "treasury-uuid",',
            '    "request_endpoint": "POST /v1/auth/scopes/delegate-request"',
            '  }',
            '}',
            '# agent client exited (code=0)',
            '# junior auto-fires delegation request to treasury…',
          ],
          parsed: {
            governed: true,
            executed: false,
            decision: 'deny',
            evaluation_id: null,
            reasons: ['scope_required:compass:credit:ask_parent_or_owner'],
            checks: [{ check: 'scope_step_up', result: 'fail', detail: "Action requires 'compass:credit' grant. No direct grant; parent agent holds the scope — request delegation." }],
          },
          customEvents: [
            { text: '[step 2/3] POST /v1/auth/scopes/delegate-request', level: 'info', detail: { scope: 'compass:credit', purpose: 'Junior needs to borrow for an ad-hoc payment', duration_minutes: 30, lifecycle: 'one_shot', max_amount: 0.5 }, waitAfterMs: 250 },
            { text: '[step 2/3] delegation request created · request_id=b3e7a2f1…', level: 'info', waitAfterMs: 200 },
            { text: '[step 2/3] notification dispatched → treasury agent SSE', level: 'dim', waitAfterMs: 600 },
          ],
        },
      },
      {
        label: 'Treasury approves → junior retries → succeeds',
        description: 'Treasury issues a one-shot $0.50 grant under its own credit grant (parent_grant_id set). Junior retries; the scope precheck now finds the delegated grant. Borrow goes through.',
        tool: 'governed_credit_borrow',
        args: {
          agent_id: 'junior-sub-agent-uuid',
          owner: AGENTS.credit.eoa,
          borrow_token: 'USDC',
          amount: '0.5',
          chain: 'base',
        },
        buildCli() {
          return `compass credit borrow --borrow-token USDC --borrow-amount 0.5 --owner ${AGENTS.credit.eoa} --chain base ${COMPASS_FLAGS}`;
        },
        fake: {
          leftLines: [
            '[agent→MCP] (treasury approves delegation request b3e7a2f1…)',
            '[treasury→Sly] POST /v1/agents/treasury/scopes/b3e7a2f1/decide → { decision: "approve", duration_minutes: 30, max_amount: 0.5 }',
            '',
            '[Sly→agent] grant issued: scope=compass:credit, issued_by_agent_id=treasury, parent_grant_id=treasury-grant',
            '',
            '[agent→MCP] (junior retries) calling governed_credit_borrow (owner 0x897Fb7…, amount 0.5 USDC)',
            '',
            '[MCP→agent] result:',
            '{',
            '  "governed": true,',
            '  "executed": false,',
            '  "decision": "approve",',
            '  "evaluation_id": "junior-eval-c4d2",',
            '  "compass_payload": { "transaction": { "to": "0x2E92…f0cC", "gas": "0x6ffa2", "from": "0x897Fb7…04e3", "chainId": "0x2105" } }',
            '}',
            '# agent client exited (code=0)',
          ],
          parsed: {
            governed: true,
            executed: false,
            decision: 'approve',
            evaluation_id: 'junior-eval-c4d2',
            reasons: [],
            checks: [
              { check: 'scope_step_up', result: 'pass', detail: "'compass:credit' delegated by treasury (parent_grant_id set)" },
              { check: 'spending_policy', result: 'pass', detail: 'Within delegated max_amount of $0.50' },
              { check: 'contract_type_allowed', result: 'pass', detail: 'Contract type permitted' },
            ],
            compass_payload: {
              transaction: { to: '0x2E927139AD2c19000Ff2Cb1c79f6e4ba9c72f0cC', from: '0x897Fb7B2447a750B5d5d0054c848CF2aB42c04e3', gas: '0x6ffa2', chainId: '0x2105' },
            },
          },
        },
      },
    ],
  },

  // ── FAKED PREVIEW: Perps order on Hyperliquid.
  //
  // The Compass CLI returns a real perps signing payload, but Sly's
  // executor doesn't yet implement the Hyperliquid signature scheme
  // (see docs/prd/compass-perps-execution-scoping.md). This scenario
  // gates the intent for real but stubs the result so we can show what
  // the partner sees once we ship the executor.
  {
    id: 'fake_perps_order',
    label: 'Perps order · Hyperliquid',
    sub: 'governed_perps_order · gate is real, broadcast is FAKED PREVIEW',
    tone: 'good',
    expected: 'approve',
    // Perps require their own step-up scope (compass:perps). For the
    // demo we extend the credit agent's allowlist to include perp:BTC
    // and grant compass:perps via the setup baseline.
    setup: { agent: 'credit', agentStatus: 'active', scopes: { 'compass:credit': true }, usdcInAllowlist: true, tslaInAllowlist: true },
    steps: [
      {
        label: 'Market order · BTC long 0.001',
        description: 'Sly gates the intent (kill-switch · scope · spending policy · contract type). Approved → typed-data payload returned for the owner to sign + submit via Compass.',
        tool: 'governed_perps_order',
        args: {
          agent_id: AGENTS.credit.id,
          owner: AGENTS.credit.eoa,
          asset: 'BTC',
          side: 'buy',
          size: '0.001',
        },
        buildCli() {
          return `compass global-markets-perps market-order --asset BTC --side buy --size 0.001 --owner ${AGENTS.credit.eoa} ${COMPASS_FLAGS}`;
        },
        fake: {
          leftLines: [
            'Sly × Compass MCP server running on stdio',
            'Sly API: http://localhost:4000 | default chain: hyperevm',
            '[agent→MCP] connected — 16 tools available',
            '[agent→MCP] calling governed_perps_order (owner 0x897Fb7…, BTC buy 0.001)',
            '',
            '[MCP→agent] result:',
            '{',
            '  "governed": true,',
            '  "executed": false,',
            '  "decision": "approve",',
            '  "evaluation_id": "perps-eval-a48d",',
            '  "compass_payload": {',
            '    "typed_data": { "primaryType": "OrderAction", "domain": { "name": "Hyperliquid", "chainId": 1337 } },',
            '    "action": { "type": "order", "asset": "BTC", "side": "buy", "size": "0.001", "limit_px": null },',
            '    "nonce": 1781100000123',
            '  },',
            '  "note": "Approved by Sly. Perps use Hyperliquid signing — sign the typed_data with the owner key and submit via the Compass CLI."',
            '}',
            '# agent client exited (code=0)',
          ],
          parsed: {
            governed: true,
            executed: false,
            decision: 'approve',
            evaluation_id: 'perps-eval-a48d',
            reasons: [],
            checks: [
              { check: 'spending_policy', result: 'pass', detail: 'Position risk $0.001 BTC within KYA T2 cap' },
              { check: 'contract_type_allowed', result: 'pass', detail: 'perp:BTC permitted' },
            ],
            compass_payload: {
              eip_712: { primaryType: 'OrderAction' },
              action: { type: 'order', asset: 'BTC', side: 'buy', size: '0.001' },
            },
          },
        },
      },
    ],
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
