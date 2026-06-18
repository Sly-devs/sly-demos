# velvet-tickets

KYA-gated scarce drops — no scalper bots, no fake queues.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos).

![cover](./screenshots/cover.png)

## Run it (self-serve, three commands)

```bash
# 1. Paste your Sly sandbox tenant key into .env.local.
echo "VELVET_API_KEY=pk_test_…" > .env.local

# 2. Provision agent + account on your tenant. Idempotent.
pnpm onboard
# → writes `SLY_API_URL` + `VELVET_BUYER_ACCOUNT_ID` + `VELVET_BUYER_AGENT_ID` + `VELVET_BUYER_AGENT_TOKEN` to .env.local

# 3. Run the demo.
pnpm install
pnpm dev
# → http://localhost:3262
```

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai

### What `pnpm onboard` does

- Creates a **Velvet Demo** business account (KYB tier 2)
- Creates a **Velvet Buyer Agent** under it (KYA tier check enforced at ACP checkout)
- Writes the resulting IDs + agent token to `.env.local`

Idempotent — re-running finds existing rows by name.

## Dependencies

- `@sly/demo-kit` (vendored at `../../_kit/`) — shared demo helpers
- `@sly_ai/sdk` — Sly TypeScript SDK ([npm](https://www.npmjs.com/package/@sly_ai/sdk))
