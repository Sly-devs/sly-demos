import { createDemoClient } from '@sly/demo-kit';
export interface MintEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function mintEnv(): MintEnv | { error: string } {
  const tenantKey = process.env.MINT_API_KEY ?? 'pk_test_mint_demo_2026';
  const agentToken = process.env.MINT_AGENT_TOKEN;
  const agentId = process.env.MINT_AGENT_ID;
  const accountId = process.env.MINT_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing MINT_* env vars. Re-run seed-mint-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: MintEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
