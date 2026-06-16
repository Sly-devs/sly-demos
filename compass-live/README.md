# compass-live · Sly × Compass operator dashboard

Live two-pane operator demo. Left pane shows the agent's MCP-stdio output; right pane shows every Sly policy gate that fires plus the exact `compass …` CLI invocation that gets shelled out on approve.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos). For the integration architecture, see [`_docs/compass-architecture.md`](../_docs/compass-architecture.md).

![cover](./screenshots/cover.png)

## Run it (self-serve, three commands)

```bash
# 1. Paste your Sly + Compass keys into .env.local.
cp .env.example .env.local
$EDITOR .env.local

# 2. Provision your tenant (agents + KYB tier + faucets, both demos). Idempotent.
pnpm onboard
# → prints the 3 agent IDs/EOAs and what got created
# → use `pnpm onboard -- --compass-only` to skip the Coral extras

# 3. Run the demo.
pnpm install
pnpm dev
# → http://localhost:3270
```

`pnpm onboard` reads your `.env.local`, calls the Sly onboarding API,
and pretty-prints what got provisioned. Re-run any time — the endpoint
returns the same agent IDs on subsequent calls. By default it provisions
for **both compass-live and the Coral × Compass demo** (`../coral-mobile`)
since they share the same agent set.

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai
- A Compass API key — sign up at api.compasslabs.ai
- The `compass` CLI installed locally and authenticated (set `COMPASS_BIN` to its absolute path in `.env.local`). Install: `curl -fsSL https://compasslabs.ai/install.sh | bash`
- Bump file-descriptor limit before `pnpm dev` on macOS: `ulimit -n 65536` (Next.js's file watcher needs headroom; default 256 starves dynamic-route discovery)

### Note for the Coral × Compass demo

If you're also running `../coral-mobile`, include `"coral_compass":true` in the onboarding payload. The endpoint enables `usdc_faucet` for your tenant and pre-drips a small amount of ETH + USDC to your Credit Agent's EOA. To actually deploy the Compass Credit Safe + supply USDC to Aave V3 as collateral (which Coral's savings card reads), run the `Onboard agent` scenario in this demo once after onboarding completes — that step uses the Compass CLI to deploy your Safes interactively.

### MCP server (vendored)

The two-pane runner spawns the Sly × Compass MCP server as a child process — `node $repo/_mcp-compass/demo-agent-client.mjs`. The `@sly_ai/mcp-compass` package is **vendored at the repo root in `_mcp-compass/`** and wired as a `workspace:*` dependency, not pulled from npm. Clones run as-is; no separate install step.

## What you see

Eight scenarios, click any to fire it. The left pane streams `demo-agent-client.mjs` stdout (an MCP stdio client → the `@sly_ai/mcp-compass` wrapper → Sly's policy gate → Compass). The right pane streams curated Sly events: `[precheck]` kill-switch · `[precheck]` scope step-up · `[engine]` spending policy · `[engine]` contract-type allowlist · `[decision]` → `[audit]` policy_evaluations row inserted · `[audit]` audit_log signed · `[exec] $ compass …` (the literal command) · `[compass]` payload returned · `[bilateral_receipt]` evaluation_id ⇄ tx_hash.

### Approve scenarios (single-action)

| Button | What |
|---|---|
| Earn deposit · Morpho USDC | Sly approves, CDP signs + broadcasts on Base, real tx hash |
| Credit borrow · Aave V3 | Sly approves, Compass returns the Permit2 EIP-712 payload (Permit2 signs are not auto-broadcast — by design) |
| Tokenized buy · TSLAon (Ondo) | Sly approves, Compass returns an EIP-712 order payload |

### Multi-step scenarios

| Button | What |
|---|---|
| Autonomous yield · rebalance | Withdraw from Morpho (low APY) → Deposit into Aave V3 (high APY). Each step independently gated. |
| Borrow-and-pay loop | Credit borrow → Safe → EOA withdraw. Two receipts in one flow. |
| Treasury of agents (FAKED PREVIEW) | Treasury borrows · junior denied · treasury delegates · junior retries. Hierarchical delegation is in our roadmap; the visual is a faked preview. |
| Perps order · Hyperliquid (FAKED PREVIEW) | Gate is real, broadcast leg is stubbed (Hyperliquid signature scheme is roadmap). |

### Deny scenarios

| Button | What |
|---|---|
| Denied · no compass:credit grant | Scope step-up precheck stops the call — engine NOT invoked |
| Denied · venue not allowlisted | Engine fires `contract_type_allowed` → fail |
| Denied · operator kill-switch | Kill-switch precheck stops the call — engine NOT invoked |

On every deny, the right pane shows `[exec-blocked] $ compass …` — the literal command that *would* have run, locked in red. The CLI never reaches Compass.

## How a scenario click flows

```
You click a scenario button
  │
  ▼
POST /api/run ───► setupScenario(scenario)  // adjusts agent.status, allowlist, scopes
  │                spawn(demo-agent-client.mjs, env: { DEMO_TOOL, DEMO_ARGS })
  │                  │
  │                  ▼
  │                MCP wrapper (@sly_ai/mcp-compass)
  │                  │
  │                  ├─► POST /v1/policy/evaluate-intent ────► Sly: gate fires
  │                  │                                          → approve / deny
  │                  │
  │                  ├─► shell: compass <subcommand> -o json
  │                  │
  │                  └─► POST /v1/policy/execute-intent       (for executable: true)
  │                       → CDP signs + broadcasts on Base
  │
  └─► curated events streamed back via SSE → right pane
```

The runner emits events as they happen — there's no replay. Multi-step scenarios use `[step k/N]` prefixes on every event so each step is legible separately.

## Architecture deep-dive

For the full architecture (MCP wrapper layout, step-up scope model, bilateral receipts, the per-owner Safe-as-Sly-wallet pattern), see `_docs/compass-architecture.md` in the repo root.

## Where to go next

- The consumer-side view of the same machinery: [`../coral-mobile/`](../coral-mobile/)
- Narrated walkthroughs in [`recordings/`](./recordings) — `walkthrough.mp4` (long-form) plus short clips for autonomous-yield, borrow-and-pay, treasury-of-agents, perps-order
- The npm package this wraps: [`@sly_ai/mcp-compass`](https://www.npmjs.com/package/@sly_ai/mcp-compass)
