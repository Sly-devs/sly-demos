import { NextResponse } from 'next/server';
import { loomEnv } from '@/lib/loom-flow';

/**
 * POST /api/close — close the session, emit a bundle receipt summary.
 */
export async function POST(req: Request) {
  const env = loomEnv();
  if ('error' in env) {
    return NextResponse.json({ error: env.error }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    calls?: number;
    cents?: number;
  };
  const calls = Number(body.calls ?? 0);
  const cents = Number(body.cents ?? 0);

  const bundleHash = `0xbundle_${(Date.now() % 1e8).toString(16)}`;
  return NextResponse.json({
    sessionId: body.sessionId,
    calls,
    cents,
    bundleHash,
    events: [
      {
        protocol: 'x402',
        label: `Session closed · ${calls} calls · ${(cents / 100).toFixed(2)} USDC`,
      },
      {
        protocol: 'MPP',
        label: 'Bundle receipt signed · session consumed',
      },
    ],
  });
}
