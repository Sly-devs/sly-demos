import { createDemoClient } from '@sly/demo-kit';

export interface AsterTipEnv {
  tenantKey: string;
  agentToken: string;
  agentId: string;
  accountId: string;
  baseUrl: string;
}

export function asterTipEnv(): AsterTipEnv | { error: string } {
  const tenantKey = process.env.ASTER_API_KEY ?? 'pk_test_aster_tip_2026';
  const agentToken = process.env.ASTER_AGENT_TOKEN;
  const agentId = process.env.ASTER_AGENT_ID;
  const accountId = process.env.ASTER_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) {
    return {
      error:
        'Missing ASTER_* env vars. Re-run seed-aster-tipping-demo.ts and update .env.local.',
    };
  }
  return { tenantKey, agentToken, agentId, accountId, baseUrl };
}

export const tenantClient = (e: AsterTipEnv) =>
  createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
