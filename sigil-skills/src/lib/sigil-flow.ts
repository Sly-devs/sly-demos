import { createDemoClient } from '@sly/demo-kit';
export interface SigilEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function sigilEnv(): SigilEnv | { error: string } {
  const tenantKey = process.env.SIGIL_API_KEY ?? 'pk_test_sigil_demo_2026';
  const agentToken = process.env.SIGIL_RENTER_AGENT_TOKEN;
  const agentId = process.env.SIGIL_RENTER_AGENT_ID;
  const accountId = process.env.SIGIL_RENTER_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing SIGIL_* env vars. Re-run seed-sigil-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: SigilEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
