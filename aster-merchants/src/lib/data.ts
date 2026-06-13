/**
 * Aster operator-dashboard data layer.
 *
 * Aster is a commerce platform; this console is Aster's OWN product. Every
 * agentic checkout that touches an Aster merchant is wrapped by Sly (KYA,
 * policy, fraud scoring, signed audit anchor). This module holds:
 *
 *  - the canonical merchant directory (5 business accounts in the Aster
 *    tenant — IDs/policies mirror seed-aster-demo.ts and are verified live)
 *  - the buyer-agent registry (reputation + cross-tenant history are real
 *    seed facts; the operator agents API does not surface agent metadata,
 *    so they are mapped by the agent's real Sly id)
 *  - pure policy-verdict + deterministic fraud-score helpers
 *  - a clearly-labelled synthetic "volume" backfill so the feed feels alive
 *    (Aster serves many merchants) WITHOUT minting real ledger rows
 */

export type TxStatus = 'completed' | 'review' | 'blocked';
export type FeedSource = 'sly-api' | 'mock';

/** Auto-accept policy as stored on the merchant account's metadata. */
export interface AutoAcceptPolicy {
  minKyaTier: 0 | 1 | 2 | 3;
  minReputation: number;
  minCrossTenantTx: number;
}

export interface FeedTx {
  id: string;
  at: string; // ISO
  merchant: string;
  merchantId: string;
  agent: string;
  agentId: string;
  kyaTier: 0 | 1 | 2 | 3;
  reputation: number; // 0–5
  crossTenantTx: number;
  fraudScore: number; // 0–100, lower is safer (synthesized — labelled in UI)
  amountCents: number;
  currency: string;
  status: TxStatus;
  /** Auto-accept verdict computed from the merchant policy vs the agent. */
  verdict: PolicyVerdict;
  /** Short audit-anchor reference (Sly transfer id). */
  auditAnchor: string;
  /** true => synthetic volume backfill (NOT a real ledger transaction). */
  synthetic: boolean;
}

export interface MerchantSummary {
  id: string;
  name: string;
  storefront: string;
  blurb: string;
  policy: AutoAcceptPolicy;
  catalogSize: number;
  verificationTier: number;
  /** true => loaded from the live Sly accounts API for this request. */
  live: boolean;
}

/**
 * Buyer agents in the Aster tenant. `reputation` + `crossTenantTx` are real
 * seed facts (seed-aster-demo.ts writes them to agent.metadata) but the
 * operator-scoped agents API does not return agent metadata, so we map them
 * by the agent's real Sly id. KYA tier IS returned live and is reconciled
 * against this table when a live checkout is rendered.
 */
export const AGENTS: Record<
  string,
  { name: string; kya: 0 | 1 | 2 | 3; reputation: number; crossTenantTx: number; hero?: boolean }
> = {
  'bf159c1e-d32c-2d43-02e7-a7e1cab94d81': {
    name: 'Velo',
    kya: 2,
    reputation: 4.6,
    crossTenantTx: 23,
    hero: true,
  },
  'ba48e706-a546-3c01-d09c-4980b6f4c5b5': {
    name: 'Orion',
    kya: 2,
    reputation: 4.9,
    crossTenantTx: 41,
  },
  '56810a4d-1029-d292-20a1-8089257ce123': {
    name: 'Vega',
    kya: 1,
    reputation: 3.6,
    crossTenantTx: 2,
  },
};

/**
 * Merchant directory — 5 business accounts in the Aster tenant. IDs and
 * default policies mirror seed-aster-demo.ts and are verified against the
 * live Sly accounts API. The live merchants route overrides policy +
 * verification tier with whatever Sly currently holds (so a persisted
 * policy edit shows up here too); this is the static fallback.
 */
export const MERCHANTS: MerchantSummary[] = [
  {
    id: '973ee9a0-34f8-50f7-f9f3-0828fea3bb04',
    name: 'Lume Goods',
    storefront: 'lume-goods',
    blurb: 'Warm, editorial home goods — lighting, textiles, ceramics.',
    policy: { minKyaTier: 2, minReputation: 4.0, minCrossTenantTx: 5 },
    catalogSize: 4,
    verificationTier: 2,
    live: false,
  },
  {
    id: 'b646b269-ca6a-7c99-ab2e-413fed2fc322',
    name: 'North Field Supply',
    storefront: 'north-field',
    blurb: 'Durable outdoor and workshop goods, built to be repaired.',
    policy: { minKyaTier: 1, minReputation: 3.5, minCrossTenantTx: 1 },
    catalogSize: 3,
    verificationTier: 2,
    live: false,
  },
  {
    id: 'c5481443-6a5e-c5da-5398-38dabe9e2ac0',
    name: 'Atelier Mode',
    storefront: 'atelier-mode',
    blurb: 'Considered apparel and small leather goods.',
    policy: { minKyaTier: 2, minReputation: 4.2, minCrossTenantTx: 3 },
    catalogSize: 2,
    verificationTier: 2,
    live: false,
  },
  {
    id: '8841f46c-55fc-62ad-f7e4-59014ce807e6',
    name: 'Still Roast Coffee',
    storefront: 'still-roast',
    blurb: 'Single-origin coffee and brewing equipment.',
    policy: { minKyaTier: 1, minReputation: 3.5, minCrossTenantTx: 1 },
    catalogSize: 3,
    verificationTier: 2,
    live: false,
  },
  {
    id: '311ef7f2-f27d-3c88-4e0e-1b34020987b2',
    name: 'Verdant Botanics',
    storefront: 'verdant-botanics',
    blurb: 'Houseplants, planters, and care goods.',
    policy: { minKyaTier: 1, minReputation: 3.8, minCrossTenantTx: 2 },
    catalogSize: 2,
    verificationTier: 2,
    live: false,
  },
];

export function getMerchant(id: string): MerchantSummary | undefined {
  return MERCHANTS.find((m) => m.id === id);
}

export function getMerchantByName(name?: string): MerchantSummary | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return MERCHANTS.find((m) => m.name.toLowerCase() === n);
}

export function formatUsd(cents: number, currency = 'USD'): string {
  const code = currency === 'USDC' ? 'USD' : currency;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
  }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Policy verdict — the heart of Aster's distinctive feature
// ---------------------------------------------------------------------------

export interface PolicyCheck {
  label: string;
  required: string;
  actual: string;
  pass: boolean;
}

export interface PolicyVerdict {
  pass: boolean;
  checks: PolicyCheck[];
}

/**
 * Evaluate a merchant's auto-accept policy against an agent's identity.
 * A checkout that satisfies EVERY rule is auto-accepted; a single miss
 * routes it to operator review.
 */
export function evaluatePolicy(
  policy: AutoAcceptPolicy,
  agent: { kya: number; reputation: number; crossTenantTx: number }
): PolicyVerdict {
  const checks: PolicyCheck[] = [
    {
      label: 'KYA tier',
      required: `≥ T${policy.minKyaTier}`,
      actual: `T${agent.kya}`,
      pass: agent.kya >= policy.minKyaTier,
    },
    {
      label: 'Reputation',
      required: `≥ ${policy.minReputation.toFixed(1)}`,
      actual: agent.reputation.toFixed(1),
      pass: agent.reputation >= policy.minReputation,
    },
    {
      label: 'Cross-tenant history',
      required: `≥ ${policy.minCrossTenantTx}`,
      actual: String(agent.crossTenantTx),
      pass: agent.crossTenantTx >= policy.minCrossTenantTx,
    },
  ];
  return { pass: checks.every((c) => c.pass), checks };
}

/**
 * Deterministic fraud score (0–100, lower = safer). Sly does not expose a
 * native fraud score on ACP checkouts, so this is SYNTHESIZED from agent
 * trust signals — the UI labels it as a derived heuristic, not a Sly field.
 * Higher KYA, higher reputation and more cross-tenant history => lower risk.
 */
export function fraudScore(agent: {
  kya: number;
  reputation: number;
  crossTenantTx: number;
}): number {
  const tierRisk = (3 - agent.kya) * 11; // 0 (T3) … 33 (T0)
  const repRisk = (5 - agent.reputation) * 9; // 0 … 45
  const histRisk = Math.max(0, 8 - agent.crossTenantTx) * 2.5; // 0 … 20
  return Math.max(2, Math.min(96, Math.round(tierRisk + repRisk + histRisk)));
}

// ---------------------------------------------------------------------------
// Synthetic volume backfill (clearly labelled; never hits the ledger)
// ---------------------------------------------------------------------------

/** Deterministic PRNG so the synthetic backfill is stable within a minute. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(rand: () => number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.floor(rand() * 16).toString(16);
  return s;
}

const AGENT_IDS = Object.keys(AGENTS);

/**
 * Generate synthetic platform volume so the feed reflects that Aster serves
 * many merchants. Every row is flagged `synthetic: true` and rendered with a
 * distinct, honest treatment — it never creates a Sly checkout or transfer.
 */
export function generateSyntheticVolume(
  merchants: MerchantSummary[],
  count = 26,
  seed = 7,
): FeedTx[] {
  const rand = mulberry32(seed);
  const now = Date.now();
  const rows: FeedTx[] = [];

  for (let i = 0; i < count; i++) {
    const merchant = merchants[Math.floor(rand() * merchants.length)];
    const agentId = AGENT_IDS[Math.floor(rand() * AGENT_IDS.length)];
    const agent = AGENTS[agentId];
    const amountCents = 1800 + Math.floor(rand() * 24000);
    const verdict = evaluatePolicy(merchant.policy, agent);
    const fs = fraudScore(agent);

    let status: TxStatus;
    if (!verdict.pass) status = 'review';
    else if (fs >= 55) status = 'review';
    else status = 'completed';

    rows.push({
      id: `chk_${hex(rand, 10)}`,
      at: new Date(now - (i + 1) * (40000 + Math.floor(rand() * 110000))).toISOString(),
      merchant: merchant.name,
      merchantId: merchant.id,
      agent: agent.name,
      agentId,
      kyaTier: agent.kya,
      reputation: agent.reputation,
      crossTenantTx: agent.crossTenantTx,
      fraudScore: fs,
      amountCents,
      currency: 'USDC',
      status,
      verdict,
      auditAnchor: `0x${hex(rand, 12)}`,
      synthetic: true,
    });
  }
  return rows;
}

export interface FeedResponse {
  source: FeedSource;
  generatedAt: string;
  realCount: number;
  syntheticCount: number;
  transactions: FeedTx[];
}

export function summarize(txs: FeedTx[]) {
  const real = txs.filter((t) => !t.synthetic);
  const volume = txs
    .filter((t) => t.status === 'completed')
    .reduce((s, t) => s + t.amountCents, 0);
  const autoAccepted = txs.filter((t) => t.verdict.pass).length;
  const autoAcceptRate = txs.length
    ? Math.round((autoAccepted / txs.length) * 100)
    : 0;
  return {
    merchants: MERCHANTS.length,
    realTx: real.length,
    totalTx: txs.length,
    volumeCents: volume,
    autoAcceptRate,
  };
}
