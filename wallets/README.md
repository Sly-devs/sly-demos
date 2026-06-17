# Wallets · consumer surfaces

Phone-framed consumer wallets that exercise different parts of Sly's governance stack: AP2 envelope mandates, parent-mandated caps, autonomous subscription management.

Each demo is self-serve — one tenant key, one `pnpm onboard`, one `pnpm dev`.

| Demo | Port | What it shows |
|---|---|---|
| [`bouquet-wallet/`](./bouquet-wallet) | 3212 | Agentic gifting wallet. Sam lets an AI agent shop for a gift inside a pre-approved AP2 envelope rather than authorizing a specific item. Three-agent cross-tenant flow (Bouquet buyer · Coral merchant · Maya advisor). |
| [`pocket-game/`](./pocket-game) | 3266 | In-game wallet with parent-mandated caps + A2A peer trades. Kid agent spends within the parent's policy; peer trades go through Sly's spending engine. |
| [`trim-subs/`](./trim-subs) | 3261 | Subscription autopilot. Finds duplicate / unused subs, cancels with one tap, governed by Sly's spending policy. |
