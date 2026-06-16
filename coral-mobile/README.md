# coral-mobile · Maya × Compass consumer demo

Phone-framed mobile UI showing Maya — a user whose AI agent borrows USDC against her Aave collateral via Compass, governed by Sly.

> Part of [Sly-devs/sly-demos](https://github.com/Sly-devs/sly-demos). For the integration architecture, see [`_docs/compass-architecture.md`](../_docs/compass-architecture.md).

![cover](./screenshots/cover.png)

## Run it

The fastest path is via the sibling `compass-live` demo's onboarding script, which provisions both demos in one call and auto-writes this directory's `.env.local`:

```bash
# From ../compass-live (assumes you've already pasted your Sly + Compass keys
# into ../compass-live/.env.local — see that README).
cd ../compass-live
pnpm onboard
# → writes the MAYA_* block to ../coral-mobile/.env.local with the Credit
#   agent's id/token/EOA, your treasury account id, and your tenant key.

# Then back here:
cd ../coral-mobile
pnpm install
pnpm dev
# → http://localhost:3211/savings
```

### MAYA_SAFE_ADDRESS

The auto-block leaves `MAYA_SAFE_ADDRESS=` blank because the Compass Credit Safe doesn't exist until you run the **Onboard agent · 3-surface Compass setup** scenario in compass-live, which deploys it locally via the Compass CLI. After that scenario completes:

1. Copy the deployed Credit Safe address from compass-live's right pane (the `compass credit create-account` result).
2. Register it for USDC drips so the savings card can be funded:
   ```bash
   curl -X POST https://sandbox.getsly.ai/v1/onboarding/compass-demo/register-safe \
     -H "Authorization: Bearer $MAYA_TENANT_KEY" \
     -H "Content-Type: application/json" \
     -d '{"safe_address":"0xYOUR_SAFE"}'
   ```
3. Paste the same address into `.env.local` as `MAYA_SAFE_ADDRESS`.
4. Restart `pnpm dev` so the Safe address is in the runtime env (Next.js reads server-side env at boot).

### Running standalone

If you only want coral-mobile without compass-live:

```bash
cp .env.example .env.local
# Fill in MAYA_TENANT_KEY (pk_test_…), MAYA_AGENT_ID/TOKEN/EOA, MAYA_ACCOUNT_ID,
# COMPASS_API_KEY_AUTH, COMPASS_BIN, MAYA_SAFE_ADDRESS by hand.
pnpm install
pnpm dev
```

## What you see

A device-frame mobile UI on `/savings`:

- **Savings card** — Maya's live Aave position (USDC supplied · APY · outstanding debt · the borrowed asset's balance in the Compass-managed Safe)
- **Agent card** — Maya's DeFi Agent (KYA tier 2, reputation, last-touched venue)
- **Borrow CTA** — "Borrow $0.10 USDC against savings"

The agent itself is a real Sly-registered agent on your sandbox tenant. The position card reads via `compass credit positions`; the borrow executes through `compass credit borrow` after Sly approves.

## The flow

1. Maya taps **Borrow $0.10 USDC against savings**
2. Backend route `POST /api/maya/borrow` builds a CompassIntent, posts to Sly's `/v1/policy/evaluate-intent`
3. Sly **denies** — no active `compass:credit` scope grant. Agent calls `/v1/auth/scopes/request` and the page transitions to **awaiting_approval**
4. UI presents an approval card with the request id and the amount (Face-ID-styled flow for the demo)
5. Maya taps **Approve & borrow**
6. Backend route `POST /api/maya/approve` calls `/v1/organization/scopes/:id/decide` → grant issued
7. Re-evaluation → approve → `compass credit borrow …` returns the unsigned Permit2 tx
8. Sly's executor signs via CDP + broadcasts on Base
9. UI flips to **settled** with the on-chain tx hash + bilateral receipt
10. The savings card auto-refreshes — new debt visible, borrowed asset balance appears in the Compass Safe row

The full demo runs in ~10 seconds end-to-end against the sandbox. Real on-chain Base transactions.

## Architecture

```
Maya taps Borrow
  │
  ▼
POST /api/maya/borrow ─────────────► Sly: /v1/policy/evaluate-intent → 403 deny (scope_required)
  │                                  Sly: /v1/auth/scopes/request   → request_id
  ▼
{ phase: 'awaiting_approval', requestId }

Maya taps Approve
  │
  ▼
POST /api/maya/approve ────────────► Sly: /v1/organization/scopes/:id/decide → grant issued
                                     Sly: /v1/policy/evaluate-intent → approve
                                     Compass: credit borrow → unsigned tx
                                     Sly: /v1/policy/execute-intent → CDP signs + broadcasts
                                     ▼
                                     tx_hash on Base, bilateral receipt returned
  ▼
{ phase: 'settled', txHash, blockNumber, events: [...] }
```

The position card (savings supply / APY / debt / Safe balance) reads via `GET /api/maya/position`, which shells `compass credit positions --owner <eoa>` and adds a `balanceOf` RPC call to surface the Compass Safe's actual holdings (Compass routes credit borrows through a per-owner Safe — the borrowed asset lands there, not on the EOA).

## Where to go next

- The operator-side view of the same flow: [`../compass-live/`](../compass-live/)
- The narrated walkthrough: [`recordings/maya-borrow.mp4`](./recordings/maya-borrow.mp4)
- The MCP wrapper underneath: [`@sly_ai/mcp-compass`](https://www.npmjs.com/package/@sly_ai/mcp-compass)
