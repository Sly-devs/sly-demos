import { createDemoClient } from '@sly/demo-kit';
export interface DriftEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function driftEnv(): DriftEnv | { error: string } {
  const tenantKey = process.env.DRIFT_API_KEY ?? 'pk_test_drift_demo_2026';
  const agentToken = process.env.DRIFT_AGENT_TOKEN;
  const agentId = process.env.DRIFT_AGENT_ID;
  const accountId = process.env.DRIFT_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing DRIFT_* env vars. Re-run seed-drift-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: DriftEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
