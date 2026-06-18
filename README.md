# Sly Demos

Public, partner-facing demos for [Sly](https://getsly.ai) — the agentic economy platform.

Sly is the governance layer for AI agents that move money. Each demo here is a runnable scenario showing one slice of what Sly does: KYA tier checks, scope step-up, venue allowlists, spending caps, kill-switch, bilateral receipts. Some demos exercise a specific partner stack (Compass, Stripe ACS, …); others are standalone capability showcases.

Every demo is its own top-level folder. Inside: source + `package.json` (a runnable Next.js app pointed at the [Sly sandbox](https://sandbox.getsly.ai)), a README with a cover screenshot, and (where applicable) a `recordings/` folder with narrated walkthroughs.

## Demo catalogue

### DeFi · governed by Sly via Compass

> **Looking for the Compass × Sly integration overview?** Start at [`compass/`](./compass) — a curated landing page that pitches the integration, links to all three demos with cover images, and walks you through the joint `pnpm onboard --with-quartz` flow that wires everything together. (Sharable URL for Compass-side docs: `github.com/Sly-devs/sly-demos/tree/main/compass`.)

| Demo | Port | What it shows |
|---|---|---|
| [`compass/compass-live/`](./compass/compass-live) | 3270 | **Operator dashboard.** Two-pane terminal — agent's MCP stdio + every Sly gate that fires + the exact `compass …` CLI invocation. 14 scenarios spanning earn / credit / perps / tokenized. Narrated long-form + 4 short clips in `recordings/`. |
| [`compass/coral-mobile/`](./compass/coral-mobile) | 3211 | **Consumer mobile.** Maya's DeFi agent buys Nike Pegasus 41s by borrowing USDC against her Aave collateral, withdrawing to her EOA, and paying the merchant — three real on-chain legs gated by Sly. One-tap Repay closes the loop. Phone-framed. Animated cover in `screenshots/cover.gif`. |
| [`compass/quartz-portfolio/`](./compass/quartz-portfolio) | 3242 | **Self-driving portfolio.** Jordan's autopilot agent runs a 60/30/10 USDC/ETH/EXP allocation with a $250/trade ceiling, weekly DCA, and a -10% drawdown circuit breaker. Every proposed trade goes through Sly's policy engine before Compass fires. |

### Agentic commerce · ACP / UCP

| Demo | Port | What it shows |
|---|---|---|
| [`commerce/crate-storefront/`](./commerce/crate-storefront) | 3210 | "Crate" merchant storefront, ACP-enabled. |
| [`commerce/petal-lane/`](./commerce/petal-lane) | 3210 | "Petal Lane" merchant storefront, ACP-enabled. |
| [`commerce/lume-goods/`](./commerce/lume-goods) | 3231 | "Lume Goods" premium storefront, ACP-enabled. |
| [`commerce/aster-merchants/`](./commerce/aster-merchants) | 3230 | Commerce-platform operator/merchant dashboard. |
| [`commerce/aster-acs-adapter/`](./commerce/aster-acs-adapter) | — | Stripe ACS → Sly ACP shim (demo-only mock host). |

### x402 · per-call micropayments

| Demo | Port | What it shows |
|---|---|---|
| [`x402/aster-tipping/`](./x402/aster-tipping) | 3250 | Creator tipping — x402 micropayments + reputation gate. |
| [`x402/drift-mobility/`](./x402/drift-mobility) | 3251 | Mobility micropay wallet (parking · tolls · charging). |
| [`x402/echo-attention/`](./x402/echo-attention) | 3253 | Sell-my-attention agent. Brand offers in, x402 micropay out. |
| [`x402/hum-inference/`](./x402/hum-inference) | 3260 | Sell spare phone NPU cycles — buyer agents pay per call. |
| [`x402/loom-market/`](./x402/loom-market) | 3243 | Peer resource market — A2A x402 metered compute rental. |

### A2A · agent-to-agent coordination

| Demo | Port | What it shows |
|---|---|---|
| [`a2a/barter-market/`](./a2a/barter-market) | 3252 | A2A haggling market — offers, counters, accept, governed. |
| [`a2a/anvil-reverse/`](./a2a/anvil-reverse) | 3254 | Reverse marketplace — you post an intent, KYA-bonded sellers bid. |
| [`a2a/sigil-skills/`](./a2a/sigil-skills) | 3263 | A2A skill rental — time-bounded skill grants with auto-revoke. |
| [`a2a/helix-live/`](./a2a/helix-live) | 3241 | Live agentic-marketplace wall-board across 4 protocol rails. |
| [`a2a/span-broker/`](./a2a/span-broker) | 3220 | Split-screen Claude ↔ Sly ↔ ChatGPT broker viewer. |
| [`a2a/span-chatgpt-mock/`](./a2a/span-chatgpt-mock) | 3221 | High-fidelity ChatGPT custom-GPT mock ("Outpost Outdoors") for the broker viewer. |

### Wallets · consumer surfaces

| Demo | Port | What it shows |
|---|---|---|
| [`wallets/bouquet-wallet/`](./wallets/bouquet-wallet) | 3212 | Agentic gifting wallet, phone-framed. |
| [`wallets/pocket-game/`](./wallets/pocket-game) | 3266 | In-game wallet with parent-mandate caps + A2A peer trades. |
| [`wallets/trim-subs/`](./wallets/trim-subs) | 3261 | Subscription autopilot — finds dupes & unused subs, cancels with one tap. |

### Agent-run businesses · mesh · scarce drops

| Demo | Port | What it shows |
|---|---|---|
| [`businesses/mint-business/`](./businesses/mint-business) | 3265 | Agent-run micro-business — autonomous shop with P&L, dividends, on Sly. |
| [`businesses/nest-block/`](./businesses/nest-block) | 3264 | Neighborhood agent mesh — borrow a drill, hire a dog-walker, lend a spare key. |
| [`businesses/velvet-tickets/`](./businesses/velvet-tickets) | 3262 | KYA-gated scarce drops — no scalper bots, no fake queues. |

## Status

| | |
|---|---|
| ✅ Source + screenshot + walkthrough video | `compass-live`, `coral-mobile` |
| ✅ Source + screenshot (basic README) | every other demo above |
| ✅ Points at public sandbox by default | every demo — `SLY_API_URL` defaults to `https://sandbox.getsly.ai` |
| ✅ Per-demo `.env.example` listing exact env vars | every demo |
| 🚧 Pre-provisioned demo tenant (drop-in tokens) | email `partners@getsly.ai` |

Every demo now defaults to the public Sly sandbox (`https://sandbox.getsly.ai`, Base Sepolia, no real money). To run end-to-end you need a tenant on that sandbox + at least one provisioned agent — email `partners@getsly.ai` for a Compass-ready demo tenant (agents + Compass venue allowlist already configured) or self-provision following the [SDK quickstart](https://docs.getsly.ai/quickstart).

## Install + run

```bash
git clone https://github.com/Sly-devs/sly-demos.git
cd sly-demos
pnpm install

# Run any demo:
pnpm --filter compass-live dev          # → http://localhost:3270
pnpm --filter coral-mobile dev          # → http://localhost:3211
pnpm --filter aster-tipping dev         # → http://localhost:3250
# … (port for each demo is in its README)
```

### Pointing at sandbox vs production

Every demo defaults to `https://sandbox.getsly.ai`. Copy the demo's `.env.example` to `.env.local`, drop in your agent/account/API-key values, and run.

To target production instead, set `SLY_API_URL=https://api.getsly.ai` in `.env.local` and use a `pk_live_…` tenant key.

Each demo's `.env.example` lists exactly the env vars it expects — running `pnpm --filter <demo> dev` with empty placeholders fails loudly with the missing-var name so you can see what to fill in.

## Repo shape

```
sly-demos/
├── _docs/                          cross-demo architecture briefs
├── _kit/                           shared @sly/demo-kit helpers used by most demos
├── compass/                        Sly × Compass — landing page + the three Compass-governed demos
│   ├── README.md
│   ├── _mcp-compass/, compass-live/, coral-mobile/, quartz-portfolio/
├── commerce/                       ACP / UCP storefronts + operator dashboards
│   ├── README.md
│   ├── crate-storefront/, petal-lane/, lume-goods/
│   └── aster-merchants/, aster-acs-adapter/, forum-platform/
├── x402/                           per-call micropayment demos
│   ├── README.md
│   └── aster-tipping/, drift-mobility/, echo-attention/, hum-inference/, loom-market/
├── a2a/                            agent-to-agent coordination
│   ├── README.md
│   ├── barter-market/, anvil-reverse/, sigil-skills/
│   └── helix-live/, span-broker/, span-chatgpt-mock/
├── wallets/                        consumer phone-framed wallets
│   ├── README.md
│   └── bouquet-wallet/, pocket-game/, trim-subs/
├── businesses/                     agent-run businesses · mesh · scarce drops
│   ├── README.md
│   └── mint-business/, nest-block/, velvet-tickets/
└── README.md

Each demo folder:
  README.md, .env.example, scripts/onboard.sh (where shipped),
  package.json, src/, screenshots/cover.png, recordings/ (where applicable)
```

## License

MIT.

## Contact

- Partnerships: `partners@getsly.ai`
- Docs: [docs.getsly.ai](https://docs.getsly.ai)
- npm: [`@sly_ai/mcp-compass`](https://www.npmjs.com/package/@sly_ai/mcp-compass) (the MCP wrapper several Compass-related demos depend on) · [`@sly_ai/sdk`](https://www.npmjs.com/package/@sly_ai/sdk)
