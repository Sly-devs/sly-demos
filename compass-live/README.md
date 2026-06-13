# compass-live · Sly × Compass operator dashboard

Live two-pane operator demo. Left pane shows the agent's MCP-stdio output; right pane shows every Sly policy gate that fires plus the exact `compass …` CLI invocation that gets shelled out on approve.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos). For the integration architecture, see [`_docs/compass-architecture.md`](../_docs/compass-architecture.md).

![cover](./screenshots/cover.png)

## Run it

```bash
cp .env.example .env.local
# Fill in the Sly sandbox + Compass credentials
pnpm install
pnpm dev
# → http://localhost:3270
```

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
