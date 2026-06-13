/**
 * Forum demo config. Every value is sourced from the seed contract
 * (apps/demo/_seed/seed-forum-demo.ts) via .env.local — see .env.example.
 *
 * Two separate Sly tenants:
 *  - Forum operator tenant: the marketplace platform (buyer agent Quill,
 *    human seller Sarah Reyes).
 *  - Lume Market tenant: a marketplace running on Forum (agent seller Mira,
 *    platform-fee leg, tax-withholding leg) — where settlement lands.
 */

export const SLY_API_URL = process.env.SLY_API_URL ?? 'http://localhost:4000';

// Forum operator tenant
export const FORUM_API_KEY =
  process.env.FORUM_API_KEY ?? 'pk_test_forum_demo_2026';
export const FORUM_AGENT_TOKEN = process.env.FORUM_AGENT_TOKEN ?? '';
export const FORUM_AGENT_ID = process.env.FORUM_AGENT_ID ?? '';
export const FORUM_ACCOUNT_ID = process.env.FORUM_ACCOUNT_ID ?? '';
export const FORUM_SARAH_ACCOUNT_ID =
  process.env.FORUM_SARAH_ACCOUNT_ID ?? '';

// Lume Market tenant (separate Sly tenant)
export const LUME_API_KEY =
  process.env.LUME_API_KEY ?? 'pk_test_forumlume_demo_2026';
/**
 * Mira's agent token (Lume tenant). Used to authorize the two intra-Lume
 * split transfers (Mira account → fee, Mira account → tax). The seeded
 * Lume *API key* shares its first 12 chars ("pk_test_foru") with the
 * Forum key, so the Sly legacy key-prefix lookup can't disambiguate it —
 * Mira's agent token authenticates cleanly via the agents table instead,
 * resolves to the Lume tenant, and the transfers route authorizes
 * agent-initiated transfers where the agent's parent account (Mira's
 * account) is the sender. Seeded deterministically; recomputed here as a
 * fallback so the demo runs even if the env var is unset.
 */
export const MIRA_AGENT_TOKEN =
  process.env.MIRA_AGENT_TOKEN ?? '';
export const MIRA_MERCHANT_ID =
  process.env.MIRA_MERCHANT_ID ?? 'forum:mira-seller';
export const MIRA_ACCOUNT_ID = process.env.MIRA_ACCOUNT_ID ?? '';
export const MIRA_AGENT_ID = process.env.MIRA_AGENT_ID ?? '';
export const MIRA_WALLET_ID = process.env.MIRA_WALLET_ID ?? '';
export const LUME_FEE_ACCOUNT_ID = process.env.LUME_FEE_ACCOUNT_ID ?? '';
export const TAX_ACCOUNT_ID = process.env.TAX_ACCOUNT_ID ?? '';

// Quill's funding wallet (Forum tenant) — the x402 payer wallet.
export const FORUM_WALLET_ID = process.env.FORUM_WALLET_ID ?? '';

// Mira's x402 service endpoint (her "Invoice Reconciliation Run", priced
// per call at $GROSS). The checkout route self-heals it (lookup by this
// slug, create if missing) so no seed/API ordering coupling.
export const MIRA_X402_SLUG = 'forum-mira-invoice-recon';
export const MIRA_X402_PATH = '/v1/invoice/reconcile';

// Split engine — fixed by the seed contract. $100 gross.
export const GROSS = 100;
export const PLATFORM_FEE_PCT = 10;
export const TAX_PCT = 8;
export const FEE_AMOUNT = +(GROSS * (PLATFORM_FEE_PCT / 100)).toFixed(2); // 10
export const TAX_AMOUNT = +(GROSS * (TAX_PCT / 100)).toFixed(2); // 8
export const MIRA_NET = +(GROSS - FEE_AMOUNT - TAX_AMOUNT).toFixed(2); // 82

export const MIRA_SKU = {
  id: 'mira_svc_invoice_recon',
  name: 'Invoice Reconciliation Run',
  unit_price: GROSS,
  currency: 'USDC' as const,
  description:
    'Mira reconciles a batch of invoices against POs + ledger and returns an exceptions report.',
};

/** Platform-scale context figures (spec mock data — clearly labeled in UI). */
export const PLATFORM_STATS = {
  activeSellers: 50247,
  humanPct: 62,
  agentPct: 38,
  volumeTodayUsd: 4_200_000,
  reputationEventsWeek: 142_000,
  humanInterventionDisputes: 0,
};

import { createHash, randomUUID } from 'crypto';

/** Mirrors apps/demo/_seed/lib/provision.ts deterministicUUID. */
function deterministicUUID(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Resolve Mira's agent token: prefer the env var, else recompute the
 * seed's deterministic value so the split works out of the box.
 */
export function miraAgentToken(): string {
  if (MIRA_AGENT_TOKEN) return MIRA_AGENT_TOKEN;
  return `agent_mira01_${deterministicUUID('forum:mira-token').replace(/-/g, '')}`;
}

/** Quill's funding wallet id — env, else the seed's deterministic value. */
export function quillWalletId(): string {
  return FORUM_WALLET_ID || deterministicUUID('forum:wallet-quill');
}

/**
 * x402 idempotency request id. Sly's unique index is
 * (tenant_id, x402_metadata->>request_id); a fixed value collides with
 * any prior row. Each demo run is a single POST after a RESET seed, so a
 * fresh per-call id keeps the hero exactly one real settlement without
 * colliding with history.
 */
export function heroRequestId(): string {
  return randomUUID();
}

/** Mira's public A2A agent card URL (cross-tenant discovery/hire). */
export function miraAgentCardUrl(): string {
  return `${SLY_API_URL}/a2a/${MIRA_AGENT_ID}/.well-known/agent.json`;
}

export function configReady(): boolean {
  return Boolean(
    FORUM_AGENT_TOKEN &&
      FORUM_AGENT_ID &&
      FORUM_ACCOUNT_ID &&
      MIRA_ACCOUNT_ID &&
      MIRA_AGENT_ID &&
      LUME_FEE_ACCOUNT_ID &&
      TAX_ACCOUNT_ID,
  );
}
