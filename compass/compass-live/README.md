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
- The `compass` CLI installed locally and on `PATH`. Install: `curl -fsSL https://compasslabs.ai/install.sh | bash` (puts it on `PATH` by default). Override via `COMPASS_BIN` only if you installed it somewhere nonstandard.
- Bump file-descriptor limit before `pnpm dev` on macOS: `ulimit -n 65536` (Next.js's file watcher needs headroom; default 256 starves dynamic-route discovery)

### Pairing with the Coral × Compass demo

`pnpm onboard` provisions both demos by default, so the same three agents power `compass-live` and `../coral-mobile`. The onboarding endpoint enables `usdc_faucet`, pre-drips a small amount of ETH + USDC to the Credit Agent's EOA, and writes every agent's id/EOA to `.env.local`. To actually deploy the Compass Credit Safe and seed it with Aave V3 collateral (the on-chain state Coral's savings card reads), run two scenarios in this demo once after onboarding completes:

1. **Onboard agent · 3-surface Compass setup** — deploys your Earn, Credit, and Tokenized Safes via the Compass CLI. Each step is Sly-gated independently. After this, the Credit Safe address is the EOA's per-owner Safe on Base.
2. **Seed Aave collateral · supply $X USDC** — atomic Safe tx that supplies USDC and takes a minimum-size borrow against it, so the Safe shows up in Aave V3 as a live position.

Use `pnpm onboard -- --compass-only` if you don't want the Coral extras.

### MCP server (vendored)

The two-pane runner spawns the Sly × Compass MCP server as a child process — `node $repo/_mcp-compass/demo-agent-client.mjs`. The `@sly_ai/mcp-compass` package is **vendored at the repo root in `_mcp-compass/`** and wired as a `workspace:*` dependency, not pulled from npm. Clones run as-is; no separate install step.

## What you see

Fourteen scenarios, click any to fire it. The left pane streams `demo-agent-client.mjs` stdout (an MCP stdio client → the `@sly_ai/mcp-compass` wrapper → Sly's policy gate → Compass). The right pane streams curated Sly events: `[precheck]` kill-switch · `[precheck]` scope step-up · `[engine]` spending policy · `[engine]` contract-type allowlist · `[decision]` → `[audit]` policy_evaluations row inserted · `[audit]` audit_log signed · `[exec] $ compass …` (the literal command) · `[compass]` payload returned · `[bilateral_receipt]` evaluation_id ⇄ tx_hash.

Above the scenario list, a **Fund Safe — Sly sponsors $1 USDC** action appears whenever the Credit Safe is under-funded — one tap tops it up via the sandbox faucet so the credit / withdraw legs have something to move.

### Approve scenarios (single-action)

| Button | What |
|---|---|
| Earn deposit · Morpho USDC | Sly approves, CDP signs + broadcasts on Base, real tx hash |
| Credit borrow · Aave V3 | Sly approves, Compass returns the Safe execTransaction; Sly signs + broadcasts via CDP |
| Withdraw · Safe → EOA | `governed_compass_withdraw` — Safe execTransaction moves USDC back to the agent EOA, CDP signs + broadcasts |
| Tokenized buy · TSLAon (Ondo) | Sly approves, Compass returns an EIP-712 order payload (caller-signed, not auto-broadcast) |
| Seed Aave collateral · supply $X USDC | Atomic supply-then-borrow: deposits USDC into Aave V3 and takes a $0.01 borrow in one Safe tx. Required prereq for the **Coral × Compass** "Maya has $X earning yield" narrative. |

### Multi-step scenarios

| Button | What |
|---|---|
| Autonomous yield · rebalance | Withdraw from Morpho (low APY) → Deposit into Aave V3 (high APY). Each step independently gated. |
| Stage-and-deposit · Earn Account | EOA → Earn Account ($0.10 USDC stage) → Morpho vault ($0.05 USDC deposit). Two Sly gates, two receipts. |
| Onboard agent · 3-surface Compass setup | Deploys the agent's Earn, Credit, and Tokenized Safes (three create-account txs). Each step is Sly-gated independently. The Credit Safe address ends up on the agent's wallet record — coral-mobile reads it from there. |
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

## What we actually call from Compass

Every scenario shells out to the `compass` CLI in `--no-interactive -o json` mode after Sly approves. The wrapper at `@sly_ai/mcp-compass` is what owns these invocations — this table is the exhaustive list of subcommands the demo touches, mapped from the governed-action specs in `packages/mcp-compass/src/governed-actions.ts`:

| Governed tool (MCP) | Compass subcommand | What Compass returns | Broadcast |
|---|---|---|---|
| `governed_earn_create_account` | `compass earn create-account --chain base --owner <eoa> --sender <eoa>` | Unsigned EVM tx that deploys the Earn Safe proxy | Sly executes via CDP `sendTransaction` |
| `governed_credit_create_account` | `compass credit create-account --chain base --owner <eoa> --sender <eoa>` | Unsigned EVM tx that deploys the Credit Safe proxy | Sly executes via CDP `sendTransaction` |
| `governed_tokenized_create_account` | `compass tokenized-equities create-account --owner <eoa> --sender <eoa>` | Unsigned EVM tx that deploys the Tokenized Safe proxy | Sly executes via CDP `sendTransaction` |
| `governed_earn_transfer` | `compass earn transfer --action DEPOSIT --token <T> --amount <A> --owner <eoa> --chain base` | Plain `USDC.transfer(EarnSafe, A)` to fund the Earn Safe | Sly executes via CDP |
| `governed_earn_deposit` | `compass earn manage --action DEPOSIT --venue '{type:VAULT,vault_address:…}' --amount <A> --owner <eoa> --chain base` | Safe execTransaction depositing into a Morpho vault | Sly executes via CDP |
| `governed_earn_withdraw` | `compass earn manage --action WITHDRAW --venue '{type:VAULT,vault_address:…}' --amount <A> --owner <eoa> --chain base` | Safe execTransaction withdrawing from the vault | Sly executes via CDP |
| `governed_credit_borrow` | `compass credit borrow --borrow-token <T> --borrow-amount <A> --owner <eoa> --chain base` *(optional `--token-in --collateral-token --amount-in` for atomic supply+borrow)* | Safe execTransaction against Aave V3 — borrow only, or supply-then-borrow as one tx | Sly executes via CDP *(when gas-sponsorship is off)* |
| `governed_compass_withdraw` | `compass credit transfer --action WITHDRAW --token <T> --amount <A> --owner <eoa> --chain base` | Safe execTransaction moving funds out of the Credit Safe back to the EOA | Sly executes via CDP |
| `governed_tokenized_buy` | `compass tokenized-equities order --from-token USDC --to-token <SYMBOL> --amount <A> --owner <eoa>` | EIP-712 order payload to buy Ondo tokenized equity | Caller-signed (not auto-broadcast) |
| `governed_perps_order` *(FAKED PREVIEW)* | `compass global-markets-perps market-order --asset <X> --side <S> --size <N> --owner <eoa>` | Hyperliquid order (signature scheme is on Compass's roadmap) | Stubbed in the demo |

Every state-changing call goes `agent → MCP wrapper → POST /v1/policy/evaluate-intent → (Sly approves) → shell: compass … → POST /v1/policy/execute-intent (if executable)`. On deny, the `compass …` shell-out is the line that gets blocked — the binary is never invoked. On approve, the returned Safe / EVM tx is signed and broadcast by Sly's CDP wallet for the calling EOA; Permit2 / EIP-712 surfaces (tokenized, future perps) return a signable payload instead.

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
