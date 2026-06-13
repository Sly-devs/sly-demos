import { createDemoClient } from '@sly/demo-kit';
export interface EchoEnv { tenantKey: string; agentToken: string; agentId: string; accountId: string; baseUrl: string; }
export function echoEnv(): EchoEnv | { error: string } {
  const tenantKey = process.env.ECHO_API_KEY ?? 'pk_test_echo_demo_2026';
  const agentToken = process.env.ECHO_AGENT_TOKEN;
  const agentId = process.env.ECHO_AGENT_ID;
  const accountId = process.env.ECHO_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'https://sandbox.getsly.ai';
  if (!agentToken || !agentId || !accountId) return { error: 'Missing ECHO_* env vars. Re-run seed-echo-demo.ts.' };
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}
export const tenantClient = (e: EchoEnv) => createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
