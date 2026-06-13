import { createDemoClient } from '@sly/demo-kit';

export interface QuartzEnv {
  tenantKey: string;
  agentToken: string;
  agentId: string;
  accountId: string;
  baseUrl: string;
}

export function quartzEnv(): QuartzEnv | { error: string } {
  const tenantKey = process.env.QUARTZ_API_KEY ?? 'pk_test_quartz_demo_2026';
  const agentToken = process.env.QUARTZ_AGENT_TOKEN;
  const agentId = process.env.QUARTZ_AGENT_ID;
  const accountId = process.env.QUARTZ_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) {
    return {
      error:
        'Missing QUARTZ_* env vars. Re-run seed-quartz-demo.ts and update .env.local.',
    };
  }
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}

export const tenantClient = (e: QuartzEnv) =>
  createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
