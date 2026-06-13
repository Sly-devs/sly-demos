import { NextResponse } from 'next/server';
import { asterTipEnv } from '@/lib/aster-flow';
import { AGENT, CREATORS } from '@/lib/demo';

/**
 * POST /api/tip { creatorId }
 *
 * Sly evaluates reputation floor + weekly cap, then either fires the
 * x402 micropayment or refuses with a reason. Synthetic settlement —
 * the demo shows the gate + receipt shape.
 */
function genHash(): string {
  return (
    '0x' +
    Array.from({ length: 14 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
  );
}

export async function POST(req: Request) {
  const env = asterTipEnv();
  if ('error' in env) {
    return NextResponse.json({ error: env.error }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    creatorId?: string;
    spentCents?: number;
  };
  const creator = CREATORS.find((c) => c.id === body.creatorId);
  if (!creator) {
    return NextResponse.json({ error: 'creator not found' }, { status: 404 });
  }

  // L2 Policy gate — reputation floor + weekly cap
  if (creator.reputation < AGENT.reputationFloor) {
    return NextResponse.json({
      decision: 'deny',
      reason: `reputation ${creator.reputation.toFixed(1)} below tipping floor of ${AGENT.reputationFloor.toFixed(1)}`,
      events: [
        {
          protocol: 'KYA',
          label: `${creator.handle} flagged · reputation ${creator.reputation.toFixed(1)} < floor ${AGENT.reputationFloor.toFixed(1)}`,
        },
        { protocol: 'AP2', label: 'DENY · no x402 payment dispatched' },
      ],
    });
  }
  const spent = Number(body.spentCents ?? 0);
  if (spent + AGENT.perTipCents > AGENT.weeklyCapCents) {
    return NextResponse.json({
      decision: 'deny',
      reason: `weekly tipping cap $${(AGENT.weeklyCapCents / 100).toFixed(2)} reached`,
      events: [{ protocol: 'AP2', label: 'DENY · weekly cap exhausted' }],
    });
  }

  return NextResponse.json({
    decision: 'allow',
    tip: {
      id: `tip_${Date.now().toString(36)}`,
      creatorId: creator.id,
      amountCents: AGENT.perTipCents,
      ts: new Date().toISOString(),
      hash: genHash(),
      status: 'allowed',
    },
    events: [
      {
        protocol: 'KYA',
        label: `${creator.handle} verified · reputation ${creator.reputation.toFixed(1)}`,
      },
      { protocol: 'AP2', label: `Tip allowed · $${(AGENT.perTipCents / 100).toFixed(2)} within weekly cap` },
      { protocol: 'x402', label: `x402 micropayment settled · receipt signed` },
    ],
  });
}
