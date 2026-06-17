# x402 · per-call micropayments

Demos that exercise [x402](https://docs.getsly.ai) — Sly's per-call HTTP micropayment rail. Buyer agents pay per call, providers register endpoints with fixed or volume-discounted pricing, every settlement lands a signed receipt.

Each demo is self-serve — one tenant key, one `pnpm onboard`, one `pnpm dev`.

| Demo | Port | What it shows |
|---|---|---|
| [`aster-tipping/`](./aster-tipping) | 3250 | Creator tipping. x402 micropayments + reputation gate so fans can't be hit by impostors. |
| [`drift-mobility/`](./drift-mobility) | 3251 | Mobility micropay wallet — parking, tolls, charging. One agent, per-tap payment, daily caps. |
| [`echo-attention/`](./echo-attention) | 3253 | Sell-my-attention agent. Brand offers come in, x402 micropayments come out, the user keeps the deciding vote. |
| [`hum-inference/`](./hum-inference) | 3260 | Sell spare phone NPU cycles. Buyer agents pay per call via x402, seller's relay agent serves the inference. |
| [`loom-market/`](./loom-market) | 3243 | Peer resource market — A2A x402 metered compute rental. Beacon (buyer) hires Forge (provider, GPU inference) at $0.02/call. |
