# helix-live

Live agentic-marketplace wall-board across 4 protocol rails — ACP, UCP, x402, A2A. Read-only feed off your sandbox tenant; great for "watch the marketplace breathe" demos.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos).

![cover](./screenshots/cover.png)

## Run it

```bash
echo "HELIX_API_KEY=pk_test_…" > .env.local
pnpm install
pnpm dev
# → http://localhost:3241
```

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai

### No `pnpm onboard` needed

helix-live is a read-only feed off `/v1/x402/endpoints`, `/v1/acp/checkouts`, and `/v1/a2a/tasks`. No agents to provision — any sandbox tenant works. Defaults to `pk_test_helix_demo_2026` when `HELIX_API_KEY` is unset, so you can preview with a placeholder before pasting your real key.

## Dependencies

- `@sly/demo-kit` (vendored at `../../_kit/`) — shared demo helpers
- `@sly_ai/sdk` — Sly TypeScript SDK ([npm](https://www.npmjs.com/package/@sly_ai/sdk))
