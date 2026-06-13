import { createDemoClient } from '@sly/demo-kit';
export interface PocketEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function pocketEnv(): PocketEnv | { error: string } {
  const tenantKey = process.env.POCKET_API_KEY ?? 'pk_test_pocket_demo_2026';
  const agentToken = process.env.POCKET_KID_AGENT_TOKEN;
  const agentId = process.env.POCKET_KID_AGENT_ID;
  const accountId = process.env.POCKET_PARENT_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing POCKET_* env vars. Re-run seed-pocket-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: PocketEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
