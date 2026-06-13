import { createDemoClient } from '@sly/demo-kit';
export interface TrimEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function trimEnv(): TrimEnv | { error: string } {
  const tenantKey = process.env.TRIM_API_KEY ?? 'pk_test_trim_demo_2026';
  const agentToken = process.env.TRIM_AGENT_TOKEN;
  const agentId = process.env.TRIM_AGENT_ID;
  const accountId = process.env.TRIM_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'https://sandbox.getsly.ai';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing TRIM_* env vars. Re-run seed-trim-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: TrimEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
