import { NextResponse } from 'next/server';
import { anvilEnv } from '@/lib/anvil-flow';
import { INCOMING_BIDS, INTENT, scoreBid } from '@/lib/demo';

function genHash() { return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

export async function POST() {
  const env = anvilEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });

  const scored = INCOMING_BIDS.map((b) => scoreBid(b)).sort((a, b) => b.score - a.score);
  const winner = scored.find((s) => s.eligible) ?? null;

  return NextResponse.json({
    scored,
    winner,
    settled: !!winner,
    txHash: winner ? genHash() : null,
    events: winner ? [
      { protocol: 'KYA', label: `winning bid ${winner.seller} KYA T${winner.kyaTier} · rep ${winner.rep} ✓` },
      { protocol: 'A2A', label: `${scored.length} bids ingested · ${scored.filter((s) => s.eligible).length} eligible` },
      { protocol: 'AP2', label: `award allowed · ${winner.priceCents / 100} within ${INTENT.ceilingCents / 100} ceiling` },
      { protocol: 'ACP', label: `ACP checkout settled to ${winner.seller}` },
    ] : [
      { protocol: 'AP2', label: 'no eligible bid found · ask Anvil to widen rubric' },
    ],
  });
}
