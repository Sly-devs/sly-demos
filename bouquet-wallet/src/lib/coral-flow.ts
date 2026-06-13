/**
 * Server-only Coral flow helpers. Implements the real Epic-82 handshake:
 *
 *   1. tenant key  → ACP createCheckout            (merchant backend)
 *   2. agent token → request `treasury` scope      (agent asks to pay)
 *   3. tenant key  → approve the scope request     (Maya / account owner)
 *   4. agent token → ACP completeCheckout          (agent settles, grant consumed)
 *
 * Steps 1–2 run in /api/agent/buy (returns a pending approval).
 * Steps 3–4 run in /api/agent/approve (after Maya taps Approve).
 */
import { createDemoClient } from '@sly/demo-kit';
import { HOKA, MERCHANT } from '@/lib/demo';

export interface CoralEnv {
  tenantKey: string;
  agentToken: string;
  agentId: string;
  accountId: string;
  baseUrl: string;
}

export function coralEnv(): CoralEnv | { error: string } {
  const tenantKey = process.env.CORAL_API_KEY ?? 'pk_test_coral_demo_2026';
  const agentToken = process.env.CORAL_AGENT_TOKEN;
  const agentId = process.env.CORAL_AGENT_ID;
  const accountId = process.env.CORAL_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) {
    return {
      error:
        'Missing CORAL_AGENT_TOKEN / CORAL_AGENT_ID / CORAL_ACCOUNT_ID. Re-run seed-coral-demo.ts and update .env.local.',
    };
  }
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}

export const tenantClient = (e: CoralEnv) =>
  createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
export const agentClient = (e: CoralEnv) =>
  createDemoClient({ apiKey: e.agentToken, baseUrl: e.baseUrl });

export const PRICE = HOKA.priceCents / 100; // Sly tracks major units (dollars)

export function buildCheckout(e: CoralEnv) {
  return {
    checkout_id: `chk_coral_${HOKA.itemId}_${Date.now()}`,
    agent_id: e.agentId,
    agent_name: 'Coral Shopping Agent',
    account_id: e.accountId,
    merchant_id: 'coral:crate-merchant',
    merchant_name: MERCHANT.name,
    currency: HOKA.currency,
    items: [
      {
        item_id: HOKA.itemId,
        name: HOKA.name,
        quantity: 1,
        unit_price: PRICE,
        total_price: PRICE,
        currency: HOKA.currency,
      },
    ],
    metadata: { demo: 'coral', surface: 'coral-mobile' },
  };
}

export const SCOPE_PURPOSE = `Pay ${MERCHANT.name} $${PRICE.toFixed(2)} for ${HOKA.name} (Coral shopping agent)`;
