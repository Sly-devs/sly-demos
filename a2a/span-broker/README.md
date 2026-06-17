# span-broker

Split-screen Claude ↔ Sly ↔ ChatGPT broker viewer — watch a cross-platform agent transaction.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos).

![cover](./screenshots/cover.png)

## Run it (self-serve, three commands)

```bash
# 1. Paste your Sly sandbox tenant key into .env.local.
echo "SPAN_API_KEY=pk_test_…" > .env.local

# 2. Provision agents + accounts on your tenant. Idempotent.
pnpm onboard
# → writes `SLY_API_URL` + `SPAN_ACCOUNT_ID` + `SPAN_OUTPOST_ACCOUNT_ID` + `SPAN_AGENT_ID` + `SPAN_OUTPOST_AGENT_ID` + `SPAN_AGENT_TOKEN` + `SPAN_OUTPOST_AGENT_TOKEN` + `SPAN_OUTPOST_API_KEY` to .env.local

# 3. Run the demo.
pnpm install
pnpm dev
# → http://localhost:3220
```

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai

### What `pnpm onboard` does

- Creates **Span Demo** + **Outpost Demo** business accounts (both KYB tier 2)
- Creates **Span Buyer Agent** + **Outpost Merchant Agent**
- Defaults `SPAN_OUTPOST_API_KEY` to the same `SPAN_API_KEY` so a single tenant runs both halves of the broker
- Writes the resulting IDs + agent token(s) to `.env.local`

Idempotent — re-running finds existing rows by name.

## Dependencies

- `@sly/demo-kit` (vendored at `../../_kit/`) — shared demo helpers
- `@sly_ai/sdk` — Sly TypeScript SDK ([npm](https://www.npmjs.com/package/@sly_ai/sdk))
