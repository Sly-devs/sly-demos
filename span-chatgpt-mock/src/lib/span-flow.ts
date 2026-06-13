/**
 * Server-only Span flow helpers (ChatGPT-mock side). Implements the real
 * Epic-82 handshake:
 *
 *   1. tenant key  → ACP createCheckout            (merchant backend)
 *   2. agent token → request `treasury` scope      (agent asks to pay)
 *   3. tenant key  → approve the scope request     (Maya / account owner)
 *   4. agent token → ACP completeCheckout          (agent settles, grant consumed)
 *
 * Auto-approved server-side here: the storefront is the merchant surface; on
 * Maya's phone the approve step would be a human tap.
 *
 * Catalog product id / price comes from src/lib/catalog.ts and must agree with
 * the SKU seeded by apps/demo/_seed/seed-span-demo.ts.
 */
import { createDemoClient } from '@sly/demo-kit';
import { OUTPOST_MERCHANT_ID, OUTPOST_MERCHANT_NAME } from '@/lib/catalog';

export { OUTPOST_MERCHANT_ID, OUTPOST_MERCHANT_NAME };

export interface SpanEnv {
  tenantKey: string;
  agentToken: string;
  agentId: string;
  accountId: string;
  baseUrl: string;
}

export function spanEnv(): SpanEnv | { error: string } {
  const tenantKey = process.env.SPAN_API_KEY ?? 'pk_test_span_demo_2026';
  const agentToken = process.env.SPAN_AGENT_TOKEN;
  const agentId = process.env.SPAN_AGENT_ID;
  const accountId = process.env.SPAN_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) {
    return {
      error:
        'Missing SPAN_AGENT_TOKEN / SPAN_AGENT_ID / SPAN_ACCOUNT_ID. Re-run seed-span-demo.ts and update .env.local.',
    };
  }
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}

export const tenantClient = (e: SpanEnv) =>
  createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
export const agentClient = (e: SpanEnv) =>
  createDemoClient({ apiKey: e.agentToken, baseUrl: e.baseUrl });

export interface BuildCheckoutItem {
  productId: string;
  productName: string;
  priceCents: number;
}

export function buildCheckout(e: SpanEnv, item: BuildCheckoutItem) {
  // Settlement asset is USDC (on Base) regardless of the catalog's display
  // currency — matches the agent + merchant wallets. Sly ACP tracks amounts
  // in major units (dollars); convert from cents.
  const price = item.priceCents / 100;
  return {
    checkout_id: `chk_outpost_${item.productId}_${Date.now()}`,
    agent_id: e.agentId,
    agent_name: 'Claude Shopping Agent',
    account_id: e.accountId,
    merchant_id: OUTPOST_MERCHANT_ID,
    merchant_name: OUTPOST_MERCHANT_NAME,
    currency: 'USDC',
    items: [
      {
        item_id: item.productId,
        name: item.productName,
        quantity: 1,
        unit_price: price,
        total_price: price,
        currency: 'USDC',
      },
    ],
    metadata: {
      demo: 'span',
      buyer_ecosystem: 'claude',
      seller_ecosystem: 'chatgpt',
      surface: 'chatgpt-custom-gpt',
    },
  };
}

export function scopePurpose(item: BuildCheckoutItem): string {
  return `Pay ${OUTPOST_MERCHANT_NAME} $${(item.priceCents / 100).toFixed(2)} for ${item.productName} (Span Claude shopping agent)`;
}
