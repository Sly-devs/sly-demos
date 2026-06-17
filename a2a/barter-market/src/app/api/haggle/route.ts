import { NextResponse } from 'next/server';
import { barterEnv } from '@/lib/barter-flow';
import { BUYER_AGENT, ITEM, SELLER_AGENT, type Round } from '@/lib/demo';

function ts() { return new Date().toISOString(); }
function hash(prefix = 'a2a') {
  return prefix + '_' + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * POST /api/haggle — runs the full A2A haggle in one response.
 * Returns:
 *   - rounds[] (offer/counter/accept/walk)
 *   - finalCents (or null if walked away)
 *   - events[] (KYA/AP2/A2A/ACP) keyed by stage
 *   - txHash (only if settled)
 */
export async function POST() {
  const env = barterEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });

  // Simulated A2A negotiation. Each round is a real `mcp__sly__a2a_send_task`-shaped beat,
  // but for demo determinism we model the haggle in code and tag every round with a
  // synthetic A2A id. The mandates + ACP grant are still backed by Sly state.
  const rounds: Round[] = [];

  rounds.push({ n: 1, side: 'seller', kind: 'offer', cents: SELLER_AGENT.askCents,
    rationale: 'list price · 90-day warranty', ts: ts() });

  rounds.push({ n: 2, side: 'buyer', kind: 'counter', cents: 19000,
    rationale: `under market low ${ITEM.marketLowCents / 100} · within ceiling`, ts: ts() });

  rounds.push({ n: 3, side: 'seller', kind: 'counter', cents: 22500,
    rationale: 'parts cost · still above floor', ts: ts() });

  rounds.push({ n: 4, side: 'buyer', kind: 'counter', cents: 20500,
    rationale: 'meeting at market mid · still under ceiling', ts: ts() });

  rounds.push({ n: 5, side: 'seller', kind: 'accept', cents: 20500,
    rationale: 'above floor · accept', ts: ts() });

  const finalCents = 20500; // both agreed

  if (finalCents > BUYER_AGENT.ceilingCents) {
    return NextResponse.json({
      rounds, finalCents, settled: false,
      events: [{ protocol: 'AP2', label: `DENY · over Cinder ceiling (${BUYER_AGENT.ceilingCents / 100})` }],
    });
  }

  return NextResponse.json({
    rounds,
    finalCents,
    settled: true,
    txHash: '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    events: [
      { protocol: 'KYA', label: `${BUYER_AGENT.name} KYA T${BUYER_AGENT.kyaTier} · ${SELLER_AGENT.name} KYA T${SELLER_AGENT.kyaTier} ✓` },
      { protocol: 'A2A', label: `negotiation complete · ${rounds.length} rounds · ${hash()}` },
      { protocol: 'AP2', label: `settlement allowed · $${(finalCents / 100).toFixed(0)} within $${BUYER_AGENT.ceilingCents / 100} ceiling` },
      { protocol: 'ACP', label: `ACP checkout settled · seller funded` },
    ],
  });
}
