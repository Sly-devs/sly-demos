import { createDemoClient } from '@sly/demo-kit';
export interface BarterEnv { tenantKey: string; buyerToken: string; buyerId: string; sellerToken: string; sellerId: string; buyerAccountId: string; baseUrl: string; }
export function barterEnv(): BarterEnv | { error: string } {
  const tenantKey = process.env.BARTER_API_KEY ?? 'pk_test_barter_demo_2026';
  const buyerToken = process.env.BARTER_BUYER_AGENT_TOKEN;
  const buyerId = process.env.BARTER_BUYER_AGENT_ID;
  const sellerToken = process.env.BARTER_SELLER_AGENT_TOKEN;
  const sellerId = process.env.BARTER_SELLER_AGENT_ID;
  const buyerAccountId = process.env.BARTER_BUYER_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!buyerToken || !buyerId || !sellerToken || !sellerId || !buyerAccountId) return { error: 'Missing BARTER_* env vars. Re-run seed-barter-demo.ts.' };
  return { tenantKey, buyerToken, buyerId, sellerToken, sellerId, buyerAccountId, baseUrl };
}
export const tenantClient = (e: BarterEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
