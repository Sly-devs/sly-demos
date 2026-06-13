import { createDemoClient } from '@sly/demo-kit';
export interface AnvilEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function anvilEnv(): AnvilEnv | { error: string } {
  const tenantKey = process.env.ANVIL_API_KEY ?? 'pk_test_anvil_demo_2026';
  const agentToken = process.env.ANVIL_BUYER_AGENT_TOKEN;
  const agentId = process.env.ANVIL_BUYER_AGENT_ID;
  const accountId = process.env.ANVIL_BUYER_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'https://sandbox.getsly.ai';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing ANVIL_* env vars. Re-run seed-anvil-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: AnvilEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
