# Sly Demos

Public, partner-facing demos for [Sly](https://getsly.ai) — the agentic economy platform.

Sly is the governance layer for AI agents that move money. Each demo here is a runnable scenario showing one slice of what Sly does: KYA tier checks, scope step-up, venue allowlists, spending caps, kill-switch, bilateral receipts. Some demos exercise a specific partner stack (Compass, Stripe ACS, …); others are standalone capability showcases.

Every demo is its own top-level folder. Inside: source + `package.json` (a runnable Next.js app pointed at the [Sly sandbox](https://sandbox.getsly.ai)), a README with a cover screenshot, and (where applicable) a `recordings/` folder with narrated walkthroughs.

## Demo catalogue

### DeFi · governed by Sly via Compass

| Demo | Port | What it shows |
|---|---|---|
| [`compass-live/`](./compass-live) | 3270 | **Operator dashboard.** Two-pane terminal — agent's MCP stdio + every Sly gate that fires + the exact `compass …` CLI invocation. 8 scenarios spanning earn / credit / perps / tokenized. Narrated long-form + 4 short clips in `recordings/`. |
| [`coral-mobile/`](./coral-mobile) | 3211 | **Consumer mobile.** Maya borrows USDC against her Aave collateral via just-in-time approval. Phone-framed. Narrated 1:01 hero in `recordings/`. |
| [`quartz-portfolio/`](./quartz-portfolio) | 3242 | Self-driving crypto portfolio (Compass + policy-bounded DCA). |

### Agentic commerce · ACP / UCP

| Demo | Port | What it shows |
|---|---|---|
| [`crate-storefront/`](./crate-storefront) | 3210 | "Crate" merchant storefront, ACP-enabled. |
| [`petal-lane/`](./petal-lane) | 3210 | "Petal Lane" merchant storefront, ACP-enabled. |
| [`lume-goods/`](./lume-goods) | 3231 | "Lume Goods" premium storefront, ACP-enabled. |
| [`aster-merchants/`](./aster-merchants) | 3230 | Commerce-platform operator/merchant dashboard. |
| [`aster-acs-adapter/`](./aster-acs-adapter) | — | Stripe ACS → Sly ACP shim (demo-only mock host). |
| [`forum-platform/`](./forum-platform) | 3240 | Marketplace-as-a-service operator platform — real Sly cross-tenant ACP + split engine. |

### x402 · per-call micropayments

| Demo | Port | What it shows |
|---|---|---|
| [`aster-tipping/`](./aster-tipping) | 3250 | Creator tipping — x402 micropayments + reputation gate. |
| [`drift-mobility/`](./drift-mobility) | 3251 | Mobility micropay wallet (parking · tolls · charging). |
| [`echo-attention/`](./echo-attention) | 3253 | Sell-my-attention agent. Brand offers in, x402 micropay out. |
| [`hum-inference/`](./hum-inference) | 3260 | Sell spare phone NPU cycles — buyer agents pay per call. |
| [`loom-market/`](./loom-market) | 3243 | Peer resource market — A2A x402 metered compute rental. |

### A2A · agent-to-agent coordination

| Demo | Port | What it shows |
|---|---|---|
| [`barter-market/`](./barter-market) | 3252 | A2A haggling market — offers, counters, accept, governed. |
| [`anvil-reverse/`](./anvil-reverse) | 3254 | Reverse marketplace — you post an intent, KYA-bonded sellers bid. |
| [`sigil-skills/`](./sigil-skills) | 3263 | A2A skill rental — time-bounded skill grants with auto-revoke. |
| [`helix-live/`](./helix-live) | 3241 | Live agentic-marketplace wall-board across 4 protocol rails. |
| [`span-broker/`](./span-broker) | 3220 | Split-screen Claude ↔ Sly ↔ ChatGPT broker viewer. |
| [`span-chatgpt-mock/`](./span-chatgpt-mock) | 3221 | High-fidelity ChatGPT custom-GPT mock ("Outpost Outdoors") for the broker viewer. |

### Wallets · consumer surfaces

| Demo | Port | What it shows |
|---|---|---|
| [`bouquet-wallet/`](./bouquet-wallet) | 3212 | Agentic gifting wallet, phone-framed. |
| [`pocket-game/`](./pocket-game) | 3266 | In-game wallet with parent-mandate caps + A2A peer trades. |
| [`trim-subs/`](./trim-subs) | 3261 | Subscription autopilot — finds dupes & unused subs, cancels with one tap. |

### Agent-run businesses · mesh · scarce drops

| Demo | Port | What it shows |
|---|---|---|
| [`mint-business/`](./mint-business) | 3265 | Agent-run micro-business — autonomous shop with P&L, dividends, on Sly. |
| [`nest-block/`](./nest-block) | 3264 | Neighborhood agent mesh — borrow a drill, hire a dog-walker, lend a spare key. |
| [`velvet-tickets/`](./velvet-tickets) | 3262 | KYA-gated scarce drops — no scalper bots, no fake queues. |

## Status

| | |
|---|---|
| ✅ Source + screenshot + walkthrough video | `compass-live`, `coral-mobile` |
| ✅ Source + screenshot (basic README) | every other demo above |
| 🚧 Full runnable setup against public sandbox | rolling out — email `partnerships@getsly.ai` for the demo you want to spin up |

The source for every demo is here today. Each one originally ran inside the internal Sly monorepo against a local API + Supabase; getting each one cleanly pointed at the public sandbox is a per-demo cleanup task we're working through.

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

Copy `.env.example` → `.env.local` inside the demo directory and fill in your sandbox credentials before running.

## Repo shape

```
sly-demos/
├── _docs/                          cross-demo architecture briefs (e.g. compass-architecture.md)
├── _kit/                           shared @sly/demo-kit helpers used by most demos
├── <demo-name>/                    one folder per demo
│   ├── README.md                   description + cover screenshot + run instructions
│   ├── .env.example
│   ├── package.json, src/, …
│   ├── screenshots/cover.png
│   └── recordings/ (where applicable)
└── README.md
```

## License

MIT.

## Contact

- Partnerships: `partnerships@getsly.ai`
- Engineering: `eng@getsly.ai`
- Docs: [docs.getsly.ai](https://docs.getsly.ai)
- npm: [`@sly_ai/mcp-compass`](https://www.npmjs.com/package/@sly_ai/mcp-compass) (the MCP wrapper several Compass-related demos depend on) · [`@sly_ai/sdk`](https://www.npmjs.com/package/@sly_ai/sdk)
