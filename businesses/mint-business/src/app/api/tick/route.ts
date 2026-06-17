import { NextResponse } from 'next/server';
import { mintEnv } from '@/lib/mint-flow';
import { NEXT_TICK_JOBS, SHOP, marginPct } from '@/lib/demo';

function genHash() { return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

/**
 * Tick — Mint's autonomous step. It evaluates incoming jobs against its
 * policy and either accepts (sourced + shipped) or rejects.
 */
export async function POST() {
  const env = mintEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });

  const decisions = NEXT_TICK_JOBS.map((j) => {
    const margin = marginPct(j.priceCents, j.costCents);
    const reasons: string[] = [];
    if (margin < SHOP.minMarginPct) reasons.push(`margin ${Math.round(margin * 100)}% under ${SHOP.minMarginPct * 100}% floor`);
    if (j.costCents > SHOP.maxSourceCostCents) reasons.push(`source cost ${(j.costCents / 100).toFixed(0)} over ${SHOP.maxSourceCostCents / 100} cap`);
    if (j.clientKyaTier < 2) reasons.push(`client KYA T${j.clientKyaTier} below floor T2`);
    if (reasons.length === 0) {
      return { ...j, status: 'shipped' as const, txHash: genHash() };
    }
    return { ...j, status: 'failed' as const, rejectReasons: reasons };
  });

  return NextResponse.json({
    decisions,
    events: [
      { protocol: 'KYA', label: `Mint #014 KYA T${SHOP.kyaTier} · ${decisions.length} new jobs evaluated` },
      { protocol: 'AP2', label: `${decisions.filter((d) => d.status === 'shipped').length} accepted · ${decisions.filter((d) => d.status === 'failed').length} rejected (below ${SHOP.minMarginPct * 100}% margin)` },
      { protocol: 'ACP', label: `revenue settled · upstream providers paid` },
    ],
  });
}
