# pocket-game

Pocket — in-game wallet with parent-mandate caps + A2A peer trades.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos).

![cover](./screenshots/cover.png)

## Run it (self-serve, three commands)

```bash
# 1. Paste your Sly sandbox tenant key into .env.local.
echo "POCKET_API_KEY=pk_test_…" > .env.local

# 2. Provision the parent treasury + Kid agent on your tenant. Idempotent.
pnpm onboard
# → writes SLY_API_URL + POCKET_PARENT_ACCOUNT_ID + POCKET_KID_AGENT_ID + POCKET_KID_AGENT_TOKEN to .env.local

# 3. Run the demo.
pnpm install
pnpm dev
# → http://localhost:3266
```

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai

### What `pnpm onboard` does

- Creates a **Pocket Parent Treasury** business account on your tenant (KYB tier 2 — sandbox-verified)
- Creates a **Pocket Kid Agent** under it (KYA tier 1, auto-created wallet, transactions:initiate=true)
- Writes the resulting IDs + agent token to `.env.local`

Idempotent — re-running finds existing rows by name.

## Dependencies

This demo runs against a Sly sandbox tenant. Sign up at [sandbox.getsly.ai](https://sandbox.getsly.ai) for credentials.

- `@sly/demo-kit` (vendored at `../_kit/`) — shared demo helpers
- `@sly_ai/sdk` — Sly TypeScript SDK ([npm](https://www.npmjs.com/package/@sly_ai/sdk))
