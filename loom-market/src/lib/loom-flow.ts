/**
 * Server-only Loom flow helpers — buyer agent calls into provider
 * via x402, every call metered & settled on Sly.
 */
import { createDemoClient } from '@sly/demo-kit';

export interface LoomEnv {
  tenantKey: string;
  buyerToken: string;
  buyerAgentId: string;
  buyerAccountId: string;
  providerToken: string;
  providerAgentId: string;
  providerAccountId: string;
  providerEndpointId: string;
  baseUrl: string;
}

export function loomEnv(): LoomEnv | { error: string } {
  const tenantKey = process.env.LOOM_API_KEY ?? 'pk_test_loom_demo_2026';
  const buyerToken = process.env.LOOM_BUYER_AGENT_TOKEN;
  const buyerAgentId = process.env.LOOM_BUYER_AGENT_ID;
  const buyerAccountId = process.env.LOOM_BUYER_ACCOUNT_ID;
  const providerToken = process.env.LOOM_PROVIDER_AGENT_TOKEN;
  const providerAgentId = process.env.LOOM_PROVIDER_AGENT_ID;
  const providerAccountId = process.env.LOOM_PROVIDER_ACCOUNT_ID;
  const providerEndpointId = process.env.LOOM_PROVIDER_ENDPOINT_ID ?? 'loom_forge_endpoint';
  const baseUrl = process.env.SLY_API_URL ?? 'https://sandbox.getsly.ai';
  if (!buyerToken || !buyerAgentId || !buyerAccountId || !providerToken || !providerAgentId) {
    return {
      error:
        'Missing LOOM_* env vars. Re-run seed-loom-demo.ts and update .env.local.',
    };
  }
  return {
    tenantKey,
    buyerToken,
    buyerAgentId,
    buyerAccountId,
    providerToken,
    providerAgentId,
    providerAccountId: providerAccountId ?? '',
    providerEndpointId,
    baseUrl,
  };
}

export const tenantClient = (e: LoomEnv) =>
  createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
export const buyerClient = (e: LoomEnv) =>
  createDemoClient({ apiKey: e.buyerToken, baseUrl: e.baseUrl });
export const providerClient = (e: LoomEnv) =>
  createDemoClient({ apiKey: e.providerToken, baseUrl: e.baseUrl });
