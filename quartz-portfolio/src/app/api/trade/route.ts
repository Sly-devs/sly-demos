import { NextResponse } from 'next/server';
import { quartzEnv } from '@/lib/quartz-flow';

/**
 * POST /api/trade — fire a policy-allowed DCA trade.
 *
 * Demo synthesizes a $250 USDC→ETH buy. Sly policy gate allows it
 * (within bands, within per-trade ceiling), Compass executes, receipt
 * emitted with policyDecisionId + txHash.
 */
function genHash(prefix = '0x'): string {
  return (
    prefix +
    Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
  );
}

export async function POST() {
  const env = quartzEnv();
  if ('error' in env) {
    return NextResponse.json({ error: env.error }, { status: 500 });
  }

  const amountUsd = 250;
  const policyDecisionId = `pd_${Date.now().toString(36)}`;
  const txHash = genHash();

  return NextResponse.json({
    decision: 'allow',
    reason: '',
    policyDecisionId,
    trade: {
      id: `tr_${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      side: 'BUY',
      assetIn: 'USDC',
      assetOut: 'ETH',
      amountUsd,
      policyDecisionId,
      txHash,
      status: 'allowed',
    },
    events: [
      { protocol: 'AP2', label: `Policy evaluated · within 60/30/10 bands · ${amountUsd} USD` },
      { protocol: 'KYA', label: 'Quartz autopilot KYA T2 verified · trade authorized' },
      { protocol: 'MPP', label: `Compass executed USDC → ETH swap on Base · receipt signed` },
    ],
  });
}
