import { NextResponse } from 'next/server';
import { fetchHelixState } from '@/lib/sly';

export const dynamic = 'force-dynamic';

/**
 * Live Helix wall-board state. Polled by the client every ~3s.
 *
 * 100% REAL: every figure derives from the Helix tenant's actual x402
 * endpoints (GET /v1/x402/endpoints) and settled ACP checkouts
 * (GET /v1/acp/checkouts) via the Helix operator key. No synthetic volume.
 */
export async function GET() {
  const state = await fetchHelixState();
  return NextResponse.json(state, {
    headers: { 'cache-control': 'no-store' },
  });
}
