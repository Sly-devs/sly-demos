# quartz-portfolio · self-driving crypto portfolio, policy-bounded

Desktop portfolio UI where Jordan's autopilot agent runs a 60/30/10 USDC/ETH/EXP allocation with a $250/trade ceiling, weekly DCA, and a -10% drawdown circuit breaker. Every proposed trade goes through Sly's policy engine before Compass fires.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos). For the Compass integration architecture see [`_docs/compass-architecture.md`](../_docs/compass-architecture.md).

![cover](./screenshots/cover.png)

## Run it

The fastest path is the sibling `compass-live` demo's onboarding script with `--with-quartz`. It provisions the Quartz Autopilot agent ($250/tx · $1,250/day · $5,000/month policy) on your tenant and writes the QUARTZ_* env block here automatically:

```bash
# 1. Provision the agent (opt-in flag for Quartz; idempotent).
cd ../compass-live
pnpm onboard --with-quartz
# → writes SLY_API_URL + QUARTZ_API_KEY + QUARTZ_AGENT_ID + QUARTZ_AGENT_TOKEN
#   + QUARTZ_ACCOUNT_ID + COMPASS_API_KEY_AUTH to ../quartz-portfolio/.env.local.

# 2. Run quartz-portfolio.
cd ../quartz-portfolio
pnpm install
pnpm dev
# → http://localhost:3242
```

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai
- A Compass API key — sign up at api.compasslabs.ai
- The `compass` CLI on `PATH` (`curl -fsSL https://compasslabs.ai/install.sh | bash`). Override via `COMPASS_BIN` only if you installed it somewhere nonstandard. Quartz uses `compass earn swap` for the actual rebalances.

### Running standalone

If you can't use compass-live's onboard script, run it standalone:

```bash
cp .env.example .env.local
# Fill in QUARTZ_API_KEY + QUARTZ_AGENT_ID + QUARTZ_AGENT_TOKEN + QUARTZ_ACCOUNT_ID,
# plus COMPASS_API_KEY_AUTH. See .env.example for the full list.
pnpm install && pnpm dev
```

### About the portfolio policy

The Quartz agent caps surface in Sly's policy engine: per-trade $250, daily $1,250, monthly $5,000 — every trade goes through these gates server-side. The 60/30/10 allocation bands, weekly DCA cadence, and -10% drawdown circuit breaker are **soft constraints enforced in Quartz's client code** (this is fine for a demo; promoting them into the policy engine is a future change once Sly supports allocation-band primitives).

## What you see

A single dashboard page showing:

- **Portfolio header** — NAV ($5,000 demo seed), 24h change, drawdown indicator
- **Allocation rings** — target 60/30/10 USDC/ETH/EXP, actual holdings, drift bars
- **Autopilot agent card** — Quartz Autopilot · KYA T2 · 42 trades in last 30d · reputation
- **Policy panel** — per-trade ceiling ($250), drawdown trigger (-10%), weekly DCA day + amount, the active venue allowlist
- **Trade feed** — last N proposed trades with their `policyDecisionId`, allowed/denied status, and `txHash` (or deny reason)

Every row in the trade feed is a real `policy_evaluations` row from the sandbox — clicking a `policyDecisionId` deep-links to the audit-log entry, clicking a `txHash` opens BaseScan.

## The flow

The autopilot runs on a timer (or you can poke it via the dashboard). On each tick:

1. Agent reads its current position via `compass earn positions`
2. Computes the drift from the 60/30/10 target bands
3. If drift > threshold, proposes a rebalance trade (e.g., "swap $42 USDC → ETH")
4. **Sly evaluates the intent**:
   - `kill_switch` precheck — agent.status active?
   - `spending_policy` engine — within KYA T2 daily/monthly caps?
   - `contract_policy` engine — trade amount ≤ $250 per-tx ceiling?
   - `venue_allowlist` engine — Compass earn:swap venue allowed?
   - `drawdown` engine — has the NAV dropped > 10% from a recent high?
5. On **approve**: Compass `earn swap` returns the unsigned tx → Sly's executor signs via CDP → broadcast on Base → `tx_hash` lands in the trade feed
6. On **deny**: the trade card surfaces the deny reason in plain language ("Above $250 per-trade ceiling" / "Drawdown circuit breaker tripped" / etc.) — *the agent never reaches Compass*

## What this demo proves

The same point as compass-live but framed as a **product surface** rather than an operator dashboard:

- Sly isn't a wrapper layer the user has to know about. The agent autopilot UI looks like any robo-advisor; the difference is that every action is gated, audited, and explainable.
- Multiple engines fire on the same intent — per-tx limits, allocation bands, drawdown triggers, venue allowlists. Each one is configurable per-tenant without changing the agent code.
- Trade-level transparency. Every line in the trade feed has a `policyDecisionId` you can click through to the signed audit-log row. No black box.

## Architecture

```
Autopilot tick (timer or manual)
  │
  ▼
GET /api/state ──► compass earn positions → portfolio NAV + holdings
  │
  ▼
compute drift vs 60/30/10 target
  │
  ▼ (if drift > threshold OR weekly DCA OR manual button tap)
POST /api/rebalance ──► Sly: /v1/policy/evaluate-intent
                         ├── kill_switch precheck
                         ├── spending_policy engine
                         ├── contract_policy engine (per-tx ceiling)
                         ├── venue_allowlist engine
                         └── drawdown engine (custom check)

  ├─ approve
  │     │
  │     ▼
  │   POST /api/trade → compass earn swap → unsigned tx
  │     │
  │     ▼
  │   Sly: /v1/policy/execute-intent → CDP signs + broadcasts
  │     │
  │     ▼
  │   tx_hash on Base, bilateral receipt → trade feed
  │
  └─ deny
        │
        ▼
      reason returned, trade card shows it, NO Compass call
```

## Where to go next

- The operator-side view of the same flow: [`../compass-live/`](../compass-live/) — shows the same audit trail as a two-pane terminal
- The consumer-mobile borrow flow: [`../coral-mobile/`](../coral-mobile/)
- The MCP wrapper underneath: [`@sly_ai/mcp-compass`](https://www.npmjs.com/package/@sly_ai/mcp-compass) — `governed_earn_swap` is the tool Quartz actually calls
- The drawdown engine is a custom policy check beyond the stock catalog — see `_docs/compass-architecture.md` for how custom engines compose with the built-in ones
