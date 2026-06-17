# lume-goods

'Lume Goods' premium storefront (Next.js, ACP-enabled). Aster wallet users come through this storefront and the Aster Buyer Agent fires the checkout.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos).

![cover](./screenshots/cover.png)

## Run it (self-serve, three commands)

```bash
# 1. Paste your Sly sandbox tenant key into .env.local.
echo "ASTER_API_KEY=pk_test_…" > .env.local

# 2. Provision the Aster Demo account + Aster Buyer Agent on your tenant. Idempotent.
pnpm onboard
# → writes SLY_API_URL + ASTER_ACCOUNT_ID + ASTER_AGENT_ID + ASTER_AGENT_TOKEN to .env.local

# 3. Run the demo.
pnpm install
pnpm dev
# → http://localhost:3231
```

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai

### What `pnpm onboard` does

- Creates an **Aster Demo** business account (KYB tier 2 — sandbox-verified)
- Creates an **Aster Buyer Agent** under it (auto-created wallet, transactions:initiate=true)
- Writes the resulting IDs + agent token to `.env.local`

Idempotent — re-running finds existing rows by name.

## Dependencies

- `@sly/demo-kit` (vendored at `../../_kit/`) — shared demo helpers
- `@sly_ai/sdk` — Sly TypeScript SDK ([npm](https://www.npmjs.com/package/@sly_ai/sdk))
