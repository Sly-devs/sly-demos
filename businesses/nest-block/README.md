# nest-block

Neighborhood agent mesh — borrow a drill, hire a dog-walker, lend a spare key.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos).

![cover](./screenshots/cover.png)

## Run it (self-serve, three commands)

```bash
# 1. Paste your Sly sandbox tenant key into .env.local.
echo "NEST_API_KEY=pk_test_…" > .env.local

# 2. Provision agent + account on your tenant. Idempotent.
pnpm onboard
# → writes `SLY_API_URL` + `NEST_ACCOUNT_ID` + `NEST_AGENT_ID` + `NEST_AGENT_TOKEN` to .env.local

# 3. Run the demo.
pnpm install
pnpm dev
# → http://localhost:3264
```

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai

### What `pnpm onboard` does

- Creates a **Nest Demo** business account (KYB tier 2)
- Creates a **Nest Block Agent** under it (peer-to-peer mesh transactions)
- Writes the resulting IDs + agent token to `.env.local`

Idempotent — re-running finds existing rows by name.

## Dependencies

- `@sly/demo-kit` (vendored at `../../_kit/`) — shared demo helpers
- `@sly_ai/sdk` — Sly TypeScript SDK ([npm](https://www.npmjs.com/package/@sly_ai/sdk))
