# Sly Demos

Public, partner-facing demos for [Sly](https://getsly.ai) — the agentic economy platform.

Sly is the governance layer that lets AI agents move money safely. Every demo here shows a working agentic-payment flow, with Sly's policy engine in front: KYA tier checks, scope step-up, venue allowlists, spending caps, kill-switch. Each demo is a Next.js app you can clone and run locally against a [Sly sandbox tenant](https://sandbox.getsly.ai).

| Demo collection | What's shown | Quick start |
|---|---|---|
| **[compass/](./compass)** | Sly × Compass Labs — governed DeFi via MCP (earn, credit, perps, tokenized equities). 6 narrated videos + 2 runnable apps. | `pnpm install && pnpm compass:live` |

More demo collections will land here as partnerships ship — Tempo (MPP), AP2, x402 native, and others.

## Repo shape

```
demos/
├── compass/                       Sly × Compass Labs
│   ├── compass-live/              Operator dashboard demo (2-pane terminal · port 3270)
│   ├── coral-mobile/              Consumer mobile demo · Maya borrows on Aave (port 3211)
│   ├── videos/                    Narrated MP4s + scripts for each scenario
│   └── README.md                  Compass-specific setup + architecture summary
├── _docs/                         Sanitised architecture briefs (read these first)
├── package.json                   pnpm workspace root
└── pnpm-workspace.yaml
```

## Getting a Sly sandbox tenant

The demos talk to a real Sly API. Two ways to get credentials:

1. **Self-serve** — sign up at [sandbox.getsly.ai](https://sandbox.getsly.ai). Issues a `pk_test_…` API key for your own tenant. Useful when you want to demo against agents and policies you control.
2. **Partnership demo tenant** — email `partnerships@getsly.ai` for shared credentials to the public Compass demo tenant. Useful when you want to spin up quickly without provisioning your own agents.

Each demo's `.env.example` lists the variables you need to fill in.

## Install + run

```bash
# Clone
git clone https://github.com/Sly-devs/demos.git
cd demos

# Install
pnpm install

# Pick a demo
pnpm compass:live      # compass-live (operator dashboard) at http://localhost:3270
pnpm compass:mobile    # coral-mobile (Maya's phone view) at http://localhost:3211
```

For each demo, copy `.env.example` → `.env.local` and fill in the credentials before running.

## License

MIT.

## Contact

- Sales / partnerships: `partnerships@getsly.ai`
- Engineering: `eng@getsly.ai`
- Docs: [docs.getsly.ai](https://docs.getsly.ai)
- npm package (the MCP wrapper these demos use): [`@sly_ai/mcp-compass`](https://www.npmjs.com/package/@sly_ai/mcp-compass)
