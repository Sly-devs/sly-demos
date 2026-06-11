# Sly × Compass — Architecture Brief

Public partner-facing summary of the integration. Source-of-truth for the engineering team is the internal Epic 101 PRD; this is what we share externally.

## What it is

Compass Labs ships embedded DeFi infrastructure — yield (Aave, Morpho), credit lines, perpetuals (Hyperliquid global markets), and tokenized equities (Ondo) — across Ethereum / Base / Arbitrum. Their CLI ships with `--agent-mode`, TOON output, KDL usage schema, and auto-activation in Claude Code / Cursor environments.

What Compass doesn't have: a governance layer. No KYA, no spending policies, no kill-switch, no step-up scopes, no signed audit trail. That's the seam Sly sits in. Every state-changing Compass call goes through Sly's policy engine first; Compass only sees the action if Sly approves.

## High-level flow

```
agent
  │  MCP call (governed_*)
  ▼
@sly_ai/mcp-compass  (stdio MCP server; an npm package the agent hosts)
  │
  │  ① POST /v1/policy/evaluate-intent
  ▼
Sly policy gate
  │  · kill-switch precheck     (agent.status = active, no operator override)
  │  · scope step-up precheck   (compass:credit / compass:perps / compass:tokenized)
  │  · contract policy engine   (spending_policy, contract_type allowlist, KYA tier)
  │  · INSERT policy_evaluations
  │  · pushAuditLogRow          (Ed25519-signed, anchored on Base)
  │
  │  approve → { decision, evaluation_id, reasons, checks, action_type }
  ▼
@sly_ai/mcp-compass
  │  ② shell out: compass <subcommand> -o json --no-interactive
  ▼
Compass CLI → Compass API → on-chain
  │
  ▼
unsigned tx | EIP-712 typed_data | Hyperliquid action
  │
  ▼
③ Sly executes (only for plain EVM tx) — CDP signs + broadcasts on Base
  OR returns the signable payload to the caller (for Permit2 / EIP-712 / Hyperliquid)

→ bilateral receipt: { evaluation_id (Sly), tx_hash (chain) }
```

## Key design decisions

1. **MCP wrapper, not a proxy.** `@sly_ai/mcp-compass` is a stdio MCP server agents host themselves. Wraps Compass's state-changing commands behind `governed_*` tools; passes through read-only commands as-is. Compass keeps its product surface; agents add Sly with one config line in their MCP client.

2. **The per-owner Safe is a Sly wallet.** Compass routes credit borrows and tokenized buys through a per-owner Safe contract — the borrowed asset lands there, not on the EOA. Sly registers that Safe in its `wallets` table as a first-class wallet with its own `spending_policy`. The wallet you see in the operator dashboard for the Compass Demo Credit Agent has both the EOA *and* the Safe as peer cards, both with editable policies.

3. **Step-up scopes for risk-increasing surfaces.** Earn deposits stay within the protocol. Credit takes on debt. Perps and tokenized buys take directional exposure. Three step-up scope grants — `compass:credit`, `compass:perps`, `compass:tokenized` — gate the risky surfaces. Grants come in two lifecycles: `one_shot` (consumed on first use) and `standing` (short-lived "trading session," ≤120 min ceiling).

4. **Bilateral receipts.** Every governed action produces `{ policy_decision_id, tx_hash }`. Stored on `policy_evaluations.execution_tx_hash` on Sly's side; trackable in Compass's event log on theirs. Either side can audit the other.

5. **Single executor.** Earn `manage` + `swap` and credit `transfer --action WITHDRAW` are plain EVM txs — Sly's CDP layer signs + broadcasts and returns the tx hash. Credit `borrow` / `repay` and tokenized orders return EIP-712 payloads — Sly's CDP layer signs the typed data and returns the signature; caller submits via Compass. Perps execution (Hyperliquid signing scheme) is roadmap — see [`compass-perps-execution-scoping.md`](./compass-perps-execution-scoping.md).

## Surface coverage

| Compass surface | Read-only MCP tools | Governed MCP tools | Step-up scope |
|---|---|---|---|
| Earn | `compass_earn_vaults` · `compass_earn_positions` | `governed_earn_deposit` · `governed_earn_withdraw` · `governed_earn_swap` | none |
| Credit | `compass_credit_positions` | `governed_credit_borrow` · `governed_credit_repay` · `governed_compass_withdraw` | `compass:credit` |
| Perps | `compass_perps_markets` · `compass_perps_positions` | `governed_perps_order` *(broadcast roadmap)* | `compass:perps` |
| Tokenized | `compass_tokenized_markets` · `compass_tokenized_positions` | `governed_tokenized_buy` · `governed_tokenized_sell` | `compass:tokenized` |

Adding a new Compass surface = one entry in `tools.ts` + one spec in `governed-actions.ts` of `@sly_ai/mcp-compass`. The Sly side picks it up automatically.

## What's NOT in v1 (roadmap)

- `--decision-jwt` runtime mode (Compass-side ask — would let Sly become a pure attestation provider with no HTTP round-trip)
- Hyperliquid perps execute (gate is complete; the CDP `signTypedData` → Hyperliquid `/exchange` POST path needs wiring; ~1–2 days)
- Hierarchical agent delegation (parent treasury · scoped sub-agents). Faked preview in `compass-live`'s Treasury-of-agents scenario; real build is ~5 days
- Multi-step intent governance (rebalance plans, conditional sequences)
- Jurisdiction policy for tokenized equities (KYA tier × geo restrictions)
- Programmable revoke triggers (e.g. auto-revoke on N consecutive denials)

## Two ways for partners to integrate

1. **As-is via MCP** — install `@sly_ai/mcp-compass` in your MCP client config, point at a Sly sandbox tenant, agents see governed Compass tools alongside their existing tool catalog. Lowest-friction.
2. **Via the Sly REST API** — partners with non-MCP agents can call `POST /v1/policy/evaluate-intent` directly with a `CompassIntent` body. Same gate, same bilateral receipt, no MCP transport required. Useful for custom agent stacks.

## Contact

- Partnerships: `partnerships@getsly.ai`
- Engineering: `eng@getsly.ai`
- npm: [`@sly_ai/mcp-compass`](https://www.npmjs.com/package/@sly_ai/mcp-compass)
- Sandbox: [`sandbox.getsly.ai`](https://sandbox.getsly.ai)
