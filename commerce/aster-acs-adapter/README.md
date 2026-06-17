# aster-acs-adapter

Stripe ACS → Sly ACP shim. A thin TypeScript adapter that translates Stripe's Agentic Commerce Spec shape into a Sly ACP `agentBuy` call. Demo-only (mock host) — production callers use the equivalent in `@sly_ai/sdk`.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos).

## Run it

```bash
echo "SLY_TENANT_API_KEY=pk_test_…" > .env.local
pnpm install
pnpm dev
```

### Prerequisites

- Node 20+ and pnpm
- A Sly sandbox tenant key (`pk_test_…`) — sign up at app.getsly.ai

### No `pnpm onboard` needed

The adapter is a pure mapper — no agents, accounts, or wallets to provision. It only needs your tenant key to authorize the downstream `agentBuy` call. Any sandbox tenant works.

## Dependencies

- `@sly/demo-kit` (vendored at `../../_kit/`) — shared demo helpers
- `@sly_ai/sdk` — Sly TypeScript SDK ([npm](https://www.npmjs.com/package/@sly_ai/sdk))
