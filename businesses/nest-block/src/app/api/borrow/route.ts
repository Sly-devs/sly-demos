import { NextResponse } from 'next/server';
import { nestEnv } from '@/lib/nest-flow';
import { NEIGHBORS, POLICY, evaluateFavor } from '@/lib/demo';

function genHash() { return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

export async function POST(req: Request) {
  const env = nestEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });
  const { offerId } = (await req.json().catch(() => ({}))) as { offerId?: string };

  const neighbor = NEIGHBORS.find((n) => n.offers.some((o) => o.id === offerId));
  const offer = neighbor?.offers.find((o) => o.id === offerId);
  if (!neighbor || !offer) return NextResponse.json({ error: 'offer not found' }, { status: 404 });

  const evalRes = evaluateFavor(neighbor, offer);

  if (evalRes.decision === 'deny') {
    return NextResponse.json({
      decision: 'deny',
      reasons: evalRes.reasons,
      events: [
        { protocol: 'KYA', label: `neighbor ${neighbor.handle} KYA T${neighbor.kyaTier} · rep ${neighbor.blockRep}` },
        { protocol: 'AP2', label: `DENY · ${evalRes.reasons.map((r) => r.label).join(' · ')}` },
      ],
    });
  }

  const isFavor = offer.rateCents === 0;
  return NextResponse.json({
    decision: 'allow',
    receipt: {
      id: `nest_${offer.id}_${Date.now().toString(36)}`,
      neighbor: neighbor.handle,
      offerTitle: offer.title,
      amountCents: offer.rateCents,
      isFavor,
      hash: genHash(),
      ts: new Date().toISOString(),
    },
    events: [
      { protocol: 'KYA', label: `${neighbor.handle} KYA T${neighbor.kyaTier} · block-rep ${neighbor.blockRep} ✓` },
      { protocol: 'AP2', label: isFavor ? `favor-token issued · no cash` : `pay ${(offer.rateCents / 100).toFixed(2)} · within $${POLICY.perFavorCeilingCents / 100} ceiling` },
      { protocol: isFavor ? 'A2A' : 'x402', label: isFavor ? `block-mesh favor logged · reciprocity bumps Noor's rep` : `x402 micropay settled · ${neighbor.agent} credited` },
    ],
  });
}
