import { NextResponse } from 'next/server';
import { trimEnv } from '@/lib/trim-flow';
import { AGENT, SUBS } from '@/lib/demo';

function genHash() { return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

export async function POST(req: Request) {
  const env = trimEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });
  const { subIds = [] } = (await req.json().catch(() => ({}))) as { subIds?: string[] };

  const targets = SUBS.filter((s) => subIds.includes(s.id) && (s.rec === 'cancel' || s.rec === 'downgrade'));
  const totalSavingsCents = targets.reduce((acc, s) => acc + (s.monthlyCents - (s.proposedMonthlyCents ?? 0)), 0);

  // Policy gate: total monthly impact must be under unilateral cap.
  if (totalSavingsCents > AGENT.unilateralCapCents) {
    return NextResponse.json({
      decision: 'human-required',
      reason: `monthly impact ${(totalSavingsCents / 100).toFixed(0)} exceeds Trim's $${AGENT.unilateralCapCents / 100} unilateral cap`,
      events: [{ protocol: 'AP2', label: `ESCALATE · over $${AGENT.unilateralCapCents / 100} unilateral cap` }],
    });
  }

  const receipts = targets.map((s) => ({
    id: `cancel_${s.id}_${Date.now().toString(36)}`,
    subId: s.id,
    merchant: s.merchant,
    action: s.rec === 'downgrade' ? 'downgrade' : 'cancel',
    savedCents: s.monthlyCents - (s.proposedMonthlyCents ?? 0),
    hash: genHash(),
    ts: new Date().toISOString(),
  }));

  return NextResponse.json({
    decision: 'allow',
    receipts,
    totalSavingsCents,
    events: [
      { protocol: 'KYA', label: `Trim Autopilot KYA T${AGENT.kyaTier} · ${targets.length} merchants verified` },
      { protocol: 'AP2', label: `ALLOW · ${(totalSavingsCents / 100).toFixed(2)}/mo within $${AGENT.unilateralCapCents / 100} unilateral cap` },
      { protocol: 'ACP', label: `${targets.length} cancellation calls fired · receipts signed` },
    ],
  });
}
