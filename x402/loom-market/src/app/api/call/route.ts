import { NextResponse } from 'next/server';
import { loomEnv } from '@/lib/loom-flow';

/**
 * POST /api/call — fire one metered x402 call from Beacon to Forge.
 *
 * For the demo we emit a synthetic per-call settlement event so the
 * meter UI sees real data with the right shape and hashes. The real
 * Epic-90 path would call Sly's x402_pay against Forge's endpoint.
 */
function genHash(): string {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

export async function POST(req: Request) {
  const env = loomEnv();
  if ('error' in env) {
    return NextResponse.json({ error: env.error }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    callIndex?: number;
  };
  const i = Number(body.callIndex ?? 0);

  // Synthetic but real-shaped settlement
  const amountCents = 2; // $0.02
  const hash = `0x${genHash()}`;
  const ts = new Date().toISOString();

  return NextResponse.json({
    i,
    ts,
    amountCents,
    hash,
    protocol: 'x402',
    endpoint: '/v1/forge/infer',
  });
}
