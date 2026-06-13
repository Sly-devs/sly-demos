import { NextResponse } from 'next/server';
import { echoEnv } from '@/lib/echo-flow';
import { AGENT, FEED, evaluate } from '@/lib/demo';

function genHash() { return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

export async function POST(req: Request) {
  const env = echoEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });
  const { offerId, earnedCents = 0 } = (await req.json().catch(() => ({}))) as { offerId?: string; earnedCents?: number };
  const offer = FEED.find((o) => o.id === offerId);
  if (!offer) return NextResponse.json({ error: 'offer not found' }, { status: 404 });

  const { decision, reasons } = evaluate(offer);

  if (decision === 'reject') {
    return NextResponse.json({
      offer, decision, reasons,
      events: [
        { protocol: 'KYA', label: `brand "${offer.brand}" KYA T${offer.brandKyaTier} · rep ${offer.brandRep}` },
        { protocol: 'AP2', label: `DENY · ${reasons.map((r) => r.label).join(' · ')}` },
      ],
    });
  }

  if (earnedCents + offer.payoutCents > AGENT.weeklyCapCents) {
    return NextResponse.json({
      offer, decision: 'reject', reasons: [{ kind: 'low-payout', label: 'weekly attention cap reached' }],
      events: [{ protocol: 'AP2', label: `DENY · would exceed weekly $${AGENT.weeklyCapCents / 100} cap` }],
    });
  }

  return NextResponse.json({
    offer, decision: 'accept',
    receipt: { id: `att_${Date.now().toString(36)}`, hash: genHash(), payoutCents: offer.payoutCents, brand: offer.brand, ts: new Date().toISOString() },
    events: [
      { protocol: 'KYA', label: `${offer.brand} KYA T${offer.brandKyaTier} · rep ${offer.brandRep} ✓` },
      { protocol: 'AP2', label: `ACCEPT · payout ${offer.payoutCents}¢ within weekly cap` },
      { protocol: 'x402', label: `x402 micropay credited · receipt signed` },
    ],
  });
}
