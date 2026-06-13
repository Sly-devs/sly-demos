# Sly Demos

Public, partner-facing demos for [Sly](https://getsly.ai) — the agentic economy platform.

Sly is the governance layer for AI agents that move money. Every demo here is a runnable scenario showing one slice of what Sly does: KYA tier checks, scope step-up, venue allowlists, spending caps, kill-switch, bilateral receipts. Some demos exercise a specific partner stack (Compass, Tempo, …); others are standalone capability showcases.

Each demo is its own folder. Inside: source + `package.json` (a runnable Next.js app pointed at the [Sly sandbox](https://sandbox.getsly.ai)), a README, and a `recordings/` folder with the narrated walkthroughs.

## Demo catalogue

| Demo | Surface | What it shows | Quick start |
|---|---|---|---|
| [**compass-live/**](./compass-live) | Operator dashboard · port 3270 | Two-pane terminal: agent's MCP stdio + every Sly gate that fires + the exact `compass …` CLI invocation. 8 scenarios spanning earn, credit, perps, tokenized. | `pnpm compass-live` |
| [**coral-mobile/**](./coral-mobile) | Consumer mobile · port 3211 | Maya borrows USDC against her Aave collateral through Compass, with Sly's just-in-time approval. Phone-framed. | `pnpm coral-mobile` |

More demos land here as partner integrations and capability showcases ship.

## Repo shape

```
sly-demos/
├── _docs/                          # cross-demo architecture briefs
├── compass-live/                   # 1 demo = 1 top-level folder
│   ├── README.md
│   ├── .env.example                # sandbox-tenant credentials template
│   ├── package.json, src/, …       # runnable Next.js app
│   └── recordings/
│       ├── walkthrough.mp4         # the long-form (1:22)
│       ├── walkthrough.narration.md
│       ├── autonomous-yield.mp4    # short clips, all recorded against this demo
│       ├── borrow-and-pay.mp4
│       ├── treasury-of-agents.mp4
│       └── perps-order.mp4
│       (+ .narration.md siblings)
├── coral-mobile/
│   ├── README.md
│   ├── package.json, src/, …
│   └── recordings/
│       └── maya-borrow.mp4
└── (more demos coming)
```

## Sandbox credentials

Demos talk to a real Sly API. Two ways to get credentials:

1. **Self-serve** — sign up at [sandbox.getsly.ai](https://sandbox.getsly.ai). Issues a `pk_test_…` API key for your own tenant. Use this when you want to demo against agents and policies you control.
2. **Partnership demo tenant** — email `partnerships@getsly.ai` for shared credentials to the public demo tenants (one per partner integration). Use this when you want to spin up quickly without provisioning your own agents.

Each demo's `.env.example` lists exactly which variables to fill in.

## Install + run

```bash
git clone https://github.com/Sly-devs/sly-demos.git
cd sly-demos
pnpm install

# Run any demo:
pnpm compass-live           # → http://localhost:3270
pnpm coral-mobile           # → http://localhost:3211
```

Copy `.env.example` → `.env.local` in the demo directory and fill in your sandbox credentials before running.

## License

MIT.

## Contact

- Partnerships: `partnerships@getsly.ai`
- Engineering: `eng@getsly.ai`
- Docs: [docs.getsly.ai](https://docs.getsly.ai)
- npm: [`@sly_ai/mcp-compass`](https://www.npmjs.com/package/@sly_ai/mcp-compass) (the MCP wrapper several Compass-related demos depend on)
