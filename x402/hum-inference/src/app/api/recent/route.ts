import { NextResponse } from 'next/server';
import { listReceipts } from '@/lib/recent-receipts';

/**
 * Returns the last N receipts that landed via /api/x402-inference. Used by
 * the phone UI to render a live feed of real buyer calls.
 *
 * Query params:
 *   since=<iso ts>  - only return receipts newer than this timestamp
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const since = url.searchParams.get('since') ?? undefined;
  const receipts = listReceipts(since);
  return NextResponse.json({
    ok: true,
    receipts,
    serverTs: new Date().toISOString(),
  });
}
