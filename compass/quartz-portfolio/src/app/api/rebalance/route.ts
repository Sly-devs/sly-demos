import { NextResponse } from 'next/server';
import { quartzEnv } from '@/lib/quartz-flow';

/**
 * POST /api/rebalance — attempts to force a 100% ETH rebalance.
 * Sly's policy engine denies the intent because it would cross the
 * 30% ETH band cap by 70pp. **No swap is fired.**
 *
 * This is the canonical "policy stops the agent before money moves"
 * demonstration for Quartz.
 */
export async function POST() {
  const env = quartzEnv();
  if ('error' in env) {
    return NextResponse.json({ error: env.error }, { status: 500 });
  }

  const policyDecisionId = `pd_${Date.now().toString(36)}`;

  return NextResponse.json({
    decision: 'deny',
    reason: 'rebalance to 100% ETH exceeds the 30% ETH allocation band by 70pp',
    policyDecisionId,
    events: [
      {
        protocol: 'AP2',
        label: 'Policy evaluated · would shift ETH from 30% to 100% · band breach',
      },
      {
        protocol: 'AP2',
        label: 'DENY · Sly rejected rebalance before Compass dispatch',
      },
    ],
  });
}
