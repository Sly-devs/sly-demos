import { createDemoClient } from '@sly/demo-kit';
export interface VelvetEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function velvetEnv(): VelvetEnv | { error: string } {
  const tenantKey = process.env.VELVET_API_KEY ?? 'pk_test_velvet_demo_2026';
  const agentToken = process.env.VELVET_BUYER_AGENT_TOKEN;
  const agentId = process.env.VELVET_BUYER_AGENT_ID;
  const accountId = process.env.VELVET_BUYER_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'https://sandbox.getsly.ai';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing VELVET_* env vars. Re-run seed-velvet-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: VelvetEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
