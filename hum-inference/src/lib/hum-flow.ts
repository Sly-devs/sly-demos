import { createDemoClient } from '@sly/demo-kit';
export interface HumEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function humEnv(): HumEnv | { error: string } {
  const tenantKey = process.env.HUM_API_KEY ?? 'pk_test_hum_demo_2026';
  const agentToken = process.env.HUM_AGENT_TOKEN;
  const agentId = process.env.HUM_AGENT_ID;
  const accountId = process.env.HUM_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing HUM_* env vars. Re-run seed-hum-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: HumEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
