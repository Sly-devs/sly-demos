# petal-lane

'Petal Lane' merchant storefront (Next.js, ACP-enabled). Coral wallet users come through this storefront and the Coral Buyer Agent (Petal Lane) fires the checkout.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos).

## Run it (self-serve, three commands)

```bash
# 1. Paste your Sly sandbox tenant key into .env.local.
echo "CORAL_API_KEY=pk_test_…" > .env.local

# 2. Provision the Coral Demo account + Coral Buyer Agent (Petal Lane). Idempotent.
pnpm onboard
# → writes SLY_API_URL + CORAL_ACCOUNT_ID + CORAL_AGENT_ID + CORAL_AGENT_TOKEN to .env.local

# 3. Run the demo.
pnpm install
pnpm dev
# → http://localhost:3210
```

> petal-lane shares port 3210 with `crate-storefront` (you'd typically run one or the other, not both simultaneously). Both reuse the same shared `Coral Demo` business account but each provisions its own dedicated agent so they stay independent.

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai

## Dependencies

- `@sly/demo-kit` (vendored at `../../_kit/`) — shared demo helpers
- `@sly_ai/sdk` — Sly TypeScript SDK ([npm](https://www.npmjs.com/package/@sly_ai/sdk))
