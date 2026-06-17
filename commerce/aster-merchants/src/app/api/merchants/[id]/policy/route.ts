import { NextResponse } from 'next/server';
import { fetchMerchantDetail, persistPolicy } from '@/lib/sly';
import type { AutoAcceptPolicy } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Current persisted policy for a merchant (read back from Sly). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await fetchMerchantDetail(id);
  if (!detail) {
    return NextResponse.json({ error: 'Unknown merchant' }, { status: 404 });
  }
  return NextResponse.json({
    live: detail.live,
    policy: detail.merchant.policy,
  });
}

function clampPolicy(input: unknown): AutoAcceptPolicy | null {
  if (typeof input !== 'object' || input === null) return null;
  const p = input as Record<string, unknown>;
  const kya = Number(p.minKyaTier);
  const rep = Number(p.minReputation);
  const xtx = Number(p.minCrossTenantTx);
  if (![kya, rep, xtx].every(Number.isFinite)) return null;
  return {
    minKyaTier: Math.min(3, Math.max(0, Math.round(kya))) as
      AutoAcceptPolicy['minKyaTier'],
    minReputation: Math.min(5, Math.max(0, Math.round(rep * 10) / 10)),
    minCrossTenantTx: Math.max(0, Math.round(xtx)),
  };
}

/**
 * Persist a policy edit to the real Sly account metadata, then re-fetch and
 * return the before/after so the client can prove the round-trip.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await fetchMerchantDetail(id);
  if (!detail) {
    return NextResponse.json({ error: 'Unknown merchant' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const policy = clampPolicy((body as { policy?: unknown })?.policy ?? body);
  if (!policy) {
    return NextResponse.json(
      { error: 'Invalid policy payload' },
      { status: 400 },
    );
  }

  try {
    const { before, after } = await persistPolicy(id, policy);
    return NextResponse.json({ ok: true, persisted: true, before, after });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        persisted: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
