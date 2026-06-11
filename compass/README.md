# Sly × Compass Labs

Governed DeFi via MCP. Compass Labs ships embedded DeFi (yield, credit, perpetuals, tokenized equities) with an agent-friendly CLI. Sly adds the governance layer — KYA, spending policies, step-up scope grants, kill-switch, signed audit trail. Same Compass UX for the agent; every state-changing call evaluated by Sly first.

| | |
|---|---|
| **MCP wrapper** | [`@sly_ai/mcp-compass`](https://www.npmjs.com/package/@sly_ai/mcp-compass) |
| **Sandbox** | [`sandbox.getsly.ai`](https://sandbox.getsly.ai) |
| **Compass docs** | [`compasslabs.ai`](https://compasslabs.ai) |
| **Architecture brief** | [`../_docs/compass-architecture.md`](../_docs/compass-architecture.md) |

## What's in here

| Demo | Surface | Quick start |
|---|---|---|
| [**compass-live/**](./compass-live) | **Operator dashboard.** Two-pane terminal (port 3270). 8 scenarios spanning the 4 Compass surfaces × 3 governance outcomes. | `pnpm compass:live` |
| [**coral-mobile/**](./coral-mobile) | **Consumer mobile.** Phone-framed UI (port 3211). Maya borrows USDC against her Aave collateral via just-in-time approval. | `pnpm compass:mobile` |
| [**videos/**](./videos) | Narrated MP4 walkthroughs for every flow (61s hero · 1:22 long-form · 4 short clips). | — |

## How the integration works

```
agent
  │
  │  MCP call: governed_credit_borrow(...)
  ▼
@sly_ai/mcp-compass
  │
  │  ① POST /v1/policy/evaluate-intent → Sly evaluates: kill-switch · scope step-up · spending policy · venue allowlist · KYA
  │
  │  approve? ──► ② shell: compass credit borrow … -o json --no-interactive
  │                 │
  │                 ▼
  │              Compass CLI → Compass API → on-chain (Base / Ethereum / Arbitrum / Hyperliquid)
  │                 │
  │                 ▼
  │              unsigned tx | EIP-712 typed_data | Hyperliquid action
  │
  │  ③ POST /v1/policy/execute-intent → Sly: CDP signs + broadcasts (for plain EVM)
  │     POST /v1/policy/sign-typed-data → Sly: CDP signs (for Permit2 / EIP-712 — caller submits)
  │
  ▼
bilateral receipt: { evaluation_id (Sly), tx_hash (chain) }
```

Read `../_docs/compass-architecture.md` for the full decision log: why an MCP wrapper instead of a proxy, why the per-owner Safe is a Sly wallet, why credit/perps/tokenized need step-up scopes, how bilateral receipts are anchored.

## The Compass surface coverage

| Surface | Read-only tools (no gate) | Governed tools (Sly gate) |
|---|---|---|
| Earn | `compass_earn_vaults`, `compass_earn_positions` | `governed_earn_deposit`, `governed_earn_withdraw`, `governed_earn_swap` |
| Credit | `compass_credit_positions` | `governed_credit_borrow`, `governed_credit_repay`, `governed_compass_withdraw` |
| Perps | `compass_perps_markets`, `compass_perps_positions` | `governed_perps_order` *(broadcast leg is roadmap — see [`../_docs/compass-perps-execution-scoping.md`](../_docs/compass-perps-execution-scoping.md))* |
| Tokenized | `compass_tokenized_markets`, `compass_tokenized_positions` | `governed_tokenized_buy`, `governed_tokenized_sell` |
