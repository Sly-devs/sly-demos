# Agentic commerce · ACP / UCP

Storefronts and operator dashboards that show agents transacting on behalf of users through the [Agentic Commerce Protocol](https://docs.getsly.ai). Spending caps, KYA tier checks, venue allowlists, and cross-tenant split settlement all live on Sly.

Each demo is self-serve (where the architecture allows) — one tenant key, one `pnpm onboard`, one `pnpm dev`.

| Demo | Port | What it shows |
|---|---|---|
| [`crate-storefront/`](./crate-storefront) | 3210 | 'Crate' merchant storefront, ACP-enabled. Coral wallet users come through this storefront and the Coral Buyer Agent fires the checkout. |
| [`petal-lane/`](./petal-lane) | 3210 | 'Petal Lane' merchant storefront, ACP-enabled. Sibling to crate-storefront — same Coral demo account, dedicated buyer agent per storefront. |
| [`lume-goods/`](./lume-goods) | 3231 | 'Lume Goods' premium storefront, ACP-enabled. Aster wallet users come through this storefront. |
| [`aster-merchants/`](./aster-merchants) | 3230 | Commerce-platform operator/merchant dashboard. Directory of 5 merchant businesses with live KYB tier, reputation gate, auto-accept policy, and catalog size. |
| [`aster-acs-adapter/`](./aster-acs-adapter) | — | Stripe ACS → Sly ACP shim. Pure TypeScript mapper that translates Stripe's Agentic Commerce Spec shape into a Sly ACP `agentBuy` call. No agents to provision. |
| [`forum-platform/`](./forum-platform) | 3240 | Marketplace-as-a-service operator platform. Real Sly cross-tenant ACP + split engine — Quill (buyer agent) hires Mira (seller agent) via x402; $100 splits 10% platform fee, 8% tax, 82% to Mira. Multi-tenant onboarding still pending. |
