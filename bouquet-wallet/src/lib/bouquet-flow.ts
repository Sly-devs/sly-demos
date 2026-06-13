/**
 * Server-only Bouquet flow helpers — same Epic-82 handshake as Coral,
 * but the mandate is an **envelope** rather than a single-item ceiling:
 *
 *   1. tenant key  → ACP createCheckout (Petal Lane backend)
 *   2. agent token → request `treasury` one-shot scope ≤ envelope
 *   3. tenant key  → approve the scope request (Sam, the account owner)
 *   4. agent token → ACP completeCheckout (envelope grant consumed)
 *
 * Steps 1–2 run in /api/agent/buy. Steps 3–4 run in /api/agent/approve.
 */
import { createDemoClient } from '@sly/demo-kit';
import { GIFT, MERCHANT } from '@/lib/demo';

export interface BouquetEnv {
  tenantKey: string;
  agentToken: string;
  agentId: string;
  accountId: string;
  baseUrl: string;
}

export function bouquetEnv(): BouquetEnv | { error: string } {
  const tenantKey = process.env.BOUQUET_API_KEY ?? 'pk_test_bouquet_demo_2026';
  const agentToken = process.env.BOUQUET_AGENT_TOKEN;
  const agentId = process.env.BOUQUET_AGENT_ID;
  const accountId = process.env.BOUQUET_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) {
    return {
      error:
        'Missing BOUQUET_AGENT_TOKEN / BOUQUET_AGENT_ID / BOUQUET_ACCOUNT_ID. Re-run seed-bouquet-demo.ts and update .env.local.',
    };
  }
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}

export const tenantClient = (e: BouquetEnv) =>
  createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
export const agentClient = (e: BouquetEnv) =>
  createDemoClient({ apiKey: e.agentToken, baseUrl: e.baseUrl });

export const PRICE = GIFT.priceCents / 100;

export function buildCheckout(e: BouquetEnv) {
  return {
    checkout_id: `chk_bouquet_${GIFT.itemId}_${Date.now()}`,
    agent_id: e.agentId,
    agent_name: 'Bouquet Gift Agent',
    account_id: e.accountId,
    merchant_id: 'bouquet:petal-lane-merchant',
    merchant_name: MERCHANT.name,
    currency: GIFT.currency,
    items: [
      {
        item_id: GIFT.itemId,
        name: GIFT.name,
        quantity: 1,
        unit_price: PRICE,
        total_price: PRICE,
        currency: GIFT.currency,
      },
    ],
    metadata: { demo: 'bouquet', surface: 'bouquet-wallet', gift: true },
  };
}

export const SCOPE_PURPOSE = `Gift envelope ≤ $75 for Maya — agent picked ${GIFT.name} at ${MERCHANT.name} ($${PRICE.toFixed(2)})`;
