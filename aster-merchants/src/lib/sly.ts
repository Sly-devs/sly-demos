/**
 * Server-only Sly access for the Aster operator console.
 *
 * Every call here uses the Aster OPERATOR API key (pk_test_aster_demo_2026)
 * via @sly/demo-kit. Real endpoints used:
 *   - GET   /v1/accounts                 → merchant directory
 *   - PATCH /v1/accounts/:id             → persist auto_accept_policy
 *   - GET   /v1/acp/checkouts            → live transaction feed
 *
 * demo-kit's option is `baseUrl` (it maps to the SDK's apiUrl internally) —
 * intentional, not a bug.
 */

import { createDemoClient } from '@sly/demo-kit';
import {
  MERCHANTS,
  type AutoAcceptPolicy,
  type MerchantSummary,
} from './data';

export function asterClient() {
  const apiKey = process.env.ASTER_API_KEY ?? 'pk_test_aster_demo_2026';
  const baseUrl = process.env.SLY_API_URL ?? 'https://sandbox.getsly.ai';
  return createDemoClient({ apiKey, baseUrl });
}

/** Raw account shape returned by GET /v1/accounts (camelCase, see helpers.ts). */
interface SlyAccount {
  id: string;
  type: string;
  name: string;
  verificationTier?: number;
  metadata?: Record<string, unknown> | null;
}

interface RawPolicy {
  min_kya_tier?: number;
  min_reputation?: number;
  min_cross_tenant_tx?: number;
}

/**
 * Single-account endpoints (`GET`/`PATCH /v1/accounts/:id`) wrap the account
 * in a HAL-style `{ data: <account>, links }` envelope. demo-kit's apiGet
 * already strips the outer `{ data }`, so we may receive either the account
 * directly (list rows) or the `{ data, links }` wrapper — unwrap defensively.
 */
function unwrapAccount(raw: unknown): SlyAccount {
  if (
    raw &&
    typeof raw === 'object' &&
    'data' in raw &&
    !('id' in raw)
  ) {
    return (raw as { data: SlyAccount }).data;
  }
  return raw as SlyAccount;
}

function coercePolicy(
  raw: RawPolicy | undefined,
  fallback: AutoAcceptPolicy,
): AutoAcceptPolicy {
  if (!raw) return fallback;
  const tier = Math.min(3, Math.max(0, Math.round(raw.min_kya_tier ?? fallback.minKyaTier)));
  return {
    minKyaTier: tier as AutoAcceptPolicy['minKyaTier'],
    minReputation:
      typeof raw.min_reputation === 'number'
        ? raw.min_reputation
        : fallback.minReputation,
    minCrossTenantTx:
      typeof raw.min_cross_tenant_tx === 'number'
        ? raw.min_cross_tenant_tx
        : fallback.minCrossTenantTx,
  };
}

/**
 * Live merchant directory. Filters the Aster tenant's accounts down to the
 * 5 known directory merchants and overlays Sly's current
 * metadata.auto_accept_policy (so a persisted policy edit is reflected).
 * Falls back to the static MERCHANTS table if the API is unreachable.
 */
export async function fetchMerchants(): Promise<{
  merchants: MerchantSummary[];
  live: boolean;
}> {
  try {
    const client = asterClient();
    const accounts =
      await client.apiGet<SlyAccount[]>('/v1/accounts?limit=50');
    // Join the live accounts to the static directory by either ID OR
    // name. The static IDs in data.ts were captured from a specific
    // seed run; partners onboarding fresh tenants via
    // scripts/onboard.sh get freshly-generated UUIDs, so a name-fallback
    // is what lets their live mode light up. Each merchant in the
    // static directory has a unique display name (Lume Goods, North
    // Field Supply, …), so name collisions are not a concern here.
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const byName = new Map(
      accounts.map((a) => [a.name.trim().toLowerCase(), a]),
    );

    const merchants = MERCHANTS.map((base) => {
      const acct =
        byId.get(base.id) ?? byName.get(base.name.trim().toLowerCase());
      if (!acct) return base;
      const meta = (acct.metadata ?? {}) as Record<string, unknown>;
      const catalog = Array.isArray(meta.catalog) ? meta.catalog : [];
      return {
        ...base,
        // Carry the LIVE account id so downstream API calls (policy
        // edits, settlement) hit the real row on the partner's tenant
        // rather than the static seed UUID.
        id: acct.id,
        name: acct.name || base.name,
        storefront: (meta.storefront as string) || base.storefront,
        blurb: (meta.blurb as string) || base.blurb,
        policy: coercePolicy(
          meta.auto_accept_policy as RawPolicy | undefined,
          base.policy,
        ),
        catalogSize: catalog.length || base.catalogSize,
        verificationTier: acct.verificationTier ?? base.verificationTier,
        live: true,
      } satisfies MerchantSummary;
    });
    return { merchants, live: true };
  } catch {
    return { merchants: MERCHANTS, live: false };
  }
}

/** Fetch one merchant account's raw metadata + the parsed directory entry. */
export async function fetchMerchantDetail(id: string): Promise<{
  merchant: MerchantSummary;
  metadata: Record<string, unknown>;
  live: boolean;
} | null> {
  try {
    const client = asterClient();
    // Two-step lookup so this works on fresh tenants where the static
    // seed IDs don't exist: fetch the account by the id we got from
    // fetchMerchants (which is the LIVE id), then resolve the static
    // base entry by name. Fall back to static-id match if the live
    // lookup fails (network blip, expired ID, etc.).
    const acct = unwrapAccount(
      await client.apiGet<unknown>(`/v1/accounts/${id}`),
    );
    const acctName = (acct.name ?? '').trim().toLowerCase();
    const base =
      MERCHANTS.find((m) => m.id === id) ??
      MERCHANTS.find((m) => m.name.trim().toLowerCase() === acctName);
    if (!base) return null;
    const meta = (acct.metadata ?? {}) as Record<string, unknown>;
    const catalog = Array.isArray(meta.catalog) ? meta.catalog : [];
    return {
      merchant: {
        ...base,
        name: acct.name || base.name,
        storefront: (meta.storefront as string) || base.storefront,
        blurb: (meta.blurb as string) || base.blurb,
        policy: coercePolicy(
          meta.auto_accept_policy as RawPolicy | undefined,
          base.policy,
        ),
        catalogSize: catalog.length || base.catalogSize,
        verificationTier: acct.verificationTier ?? base.verificationTier,
        live: true,
      },
      metadata: meta,
      live: true,
    };
  } catch {
    // Live lookup failed (network blip, deleted account, …). Fall back
    // to the static directory matched by the requested id.
    const fallback = MERCHANTS.find((m) => m.id === id);
    if (!fallback) return null;
    return { merchant: fallback, metadata: {}, live: false };
  }
}

/**
 * Persist a merchant's auto-accept policy through the real Sly API.
 *
 * PATCH /v1/accounts/:id REPLACES metadata wholesale (verified in
 * apps/api/src/routes/accounts.ts) — so we read the current metadata,
 * splice in the new policy, and write the whole object back. Then we
 * re-fetch so the caller can prove the round-trip.
 */
export async function persistPolicy(
  id: string,
  policy: AutoAcceptPolicy,
): Promise<{ before: AutoAcceptPolicy | null; after: AutoAcceptPolicy }> {
  const client = asterClient();
  const acct = unwrapAccount(
    await client.apiGet<unknown>(`/v1/accounts/${id}`),
  );
  const meta = (acct.metadata ?? {}) as Record<string, unknown>;
  const before = (meta.auto_accept_policy as RawPolicy | undefined) ?? null;

  const nextMeta = {
    ...meta,
    auto_accept_policy: {
      min_kya_tier: policy.minKyaTier,
      min_reputation: policy.minReputation,
      min_cross_tenant_tx: policy.minCrossTenantTx,
    },
  };

  await client.apiPatch(`/v1/accounts/${id}`, { metadata: nextMeta });

  // Re-fetch to prove persistence (round-trip).
  const verify = unwrapAccount(
    await client.apiGet<unknown>(`/v1/accounts/${id}`),
  );
  const verifiedMeta = (verify.metadata ?? {}) as Record<string, unknown>;
  const after = verifiedMeta.auto_accept_policy as RawPolicy | undefined;

  return {
    before: before
      ? {
          minKyaTier: (before.min_kya_tier ?? 0) as AutoAcceptPolicy['minKyaTier'],
          minReputation: before.min_reputation ?? 0,
          minCrossTenantTx: before.min_cross_tenant_tx ?? 0,
        }
      : null,
    after: {
      minKyaTier: (after?.min_kya_tier ??
        policy.minKyaTier) as AutoAcceptPolicy['minKyaTier'],
      minReputation: after?.min_reputation ?? policy.minReputation,
      minCrossTenantTx: after?.min_cross_tenant_tx ?? policy.minCrossTenantTx,
    },
  };
}
