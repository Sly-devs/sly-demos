import { NextResponse } from 'next/server';
import { pocketEnv } from '@/lib/pocket-flow';
import { LISTINGS, KID_AGENT, evaluate } from '@/lib/demo';

function genHash() { return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

export async function POST(req: Request) {
  const env = pocketEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });
  const { listingId, spentCents = 0 } = (await req.json().catch(() => ({}))) as { listingId?: string; spentCents?: number };
  const l = LISTINGS.find((x) => x.id === listingId);
  if (!l) return NextResponse.json({ error: 'listing not found' }, { status: 404 });
  const evalRes = evaluate(l, spentCents);

  if (evalRes.verdict === 'deny') {
    return NextResponse.json({
      verdict: 'deny', reasons: evalRes.reasons, priceCents: evalRes.priceCents,
      events: [
        { protocol: 'KYA', label: `seller ${l.seller} KYA T${l.sellerKyaTier} · mechanic ${l.mechanic}` },
        { protocol: 'AP2', label: `DENY · ${evalRes.reasons.map((r) => r.label).join(' · ')}` },
      ],
    });
  }

  const isPeerTrade = l.mechanic === 'a2a-peer';
  return NextResponse.json({
    verdict: 'allow',
    receipt: {
      id: `pocket_${l.id}_${Date.now().toString(36)}`,
      listing: l.title,
      seller: l.seller,
      priceCents: evalRes.priceCents,
      mechanic: l.mechanic,
      hash: genHash(),
      ts: new Date().toISOString(),
    },
    events: [
      { protocol: 'KYA', label: `${l.seller} KYA T${l.sellerKyaTier} ✓ · "${KID_AGENT.name}" KYA T${KID_AGENT.kyaTier}` },
      { protocol: 'AP2', label: `ALLOW · within daily $${KID_AGENT.dailyCapCents / 100} cap · mechanic ${l.mechanic} ok` },
      { protocol: isPeerTrade ? 'A2A' : 'ACP', label: isPeerTrade ? `peer-to-peer skin trade · @jo paid in coins` : `Stratos shop checkout settled` },
    ],
  });
}
