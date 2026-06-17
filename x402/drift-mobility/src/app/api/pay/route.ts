import { NextResponse } from 'next/server';
import { driftEnv } from '@/lib/drift-flow';
import { AGENT, PROVIDERS } from '@/lib/demo';

function genHash() {
  return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export async function POST(req: Request) {
  const env = driftEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });
  const body = (await req.json().catch(() => ({}))) as { providerId?: string; spentCents?: number; tag?: 'business' | 'personal' };
  const p = PROVIDERS.find((x) => x.id === body.providerId);
  if (!p) return NextResponse.json({ error: 'provider not found' }, { status: 404 });

  // L2 Policy — daily cap
  const spent = Number(body.spentCents ?? 0);
  if (spent + p.perTapCents > AGENT.dailyCapCents) {
    return NextResponse.json({
      decision: 'deny',
      reason: 'daily mobility cap reached',
      events: [{ protocol: 'AP2', label: 'DENY · daily cap exhausted' }],
    });
  }

  return NextResponse.json({
    decision: 'allow',
    receipt: {
      id: `mob_${Date.now().toString(36)}`,
      providerId: p.id,
      amountCents: p.perTapCents,
      ts: new Date().toISOString(),
      hash: genHash(),
      reimbursableTag: body.tag ?? 'personal',
    },
    events: [
      { protocol: 'KYA', label: `Drift Pay Agent KYA T${AGENT.kyaTier} · ${p.name} ✓` },
      { protocol: 'AP2', label: `Tap allowed · within $${(AGENT.dailyCapCents / 100).toFixed(0)} daily cap` },
      { protocol: 'x402', label: `x402 micropayment settled to ${p.name.split(' · ')[0]}` },
    ],
  });
}
