import { createDemoClient } from '@sly/demo-kit';
export interface NestEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function nestEnv(): NestEnv | { error: string } {
  const tenantKey = process.env.NEST_API_KEY ?? 'pk_test_nest_demo_2026';
  const agentToken = process.env.NEST_AGENT_TOKEN;
  const agentId = process.env.NEST_AGENT_ID;
  const accountId = process.env.NEST_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'https://sandbox.getsly.ai';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing NEST_* env vars. Re-run seed-nest-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: NestEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
