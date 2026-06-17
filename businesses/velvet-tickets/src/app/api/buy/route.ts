import { NextResponse } from 'next/server';
import { velvetEnv } from '@/lib/velvet-flow';
import { DROP, QUEUE, evaluate } from '@/lib/demo';

function genHash() { return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }
function mintId() { return 'AP-' + Array.from({ length: 6 }, () => Math.floor(Math.random() * 36).toString(36).toUpperCase()).join(''); }

export async function POST() {
  const env = velvetEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });

  // Sort the queue by KYA-weighted priority. Tier 3 > Tier 2 > else; ties broken
  // by reputation, then queuedAt. Bots/scalpers get pushed to the back as a
  // *visual* effect; they still get blocked downstream.
  const sorted = [...QUEUE].sort((a, b) => {
    if (b.kyaTier !== a.kyaTier) return b.kyaTier - a.kyaTier;
    if (b.rep !== a.rep) return b.rep - a.rep;
    return a.queuedAt.localeCompare(b.queuedAt);
  });

  let remaining = DROP.totalTickets;
  const decisions = sorted.map((a) => {
    const { verdict, reasons } = evaluate(a);
    if (verdict === 'block') {
      return { agentId: a.id, verdict, reasons };
    }
    if (a.qty > remaining) {
      return { agentId: a.id, verdict: 'block' as const, reasons: [`only ${remaining} left · couldn't fit ${a.qty}`] };
    }
    remaining -= a.qty;
    return {
      agentId: a.id,
      verdict: 'mint' as const,
      reasons: [],
      mintIds: Array.from({ length: a.qty }, () => mintId()),
      txHash: genHash(),
    };
  });

  return NextResponse.json({
    decisions,
    remainingTickets: remaining,
    events: [
      { protocol: 'KYA', label: `${QUEUE.length} queued · ${decisions.filter((d) => d.verdict === 'mint').length} KYA-verified` },
      { protocol: 'AP2', label: `policy applied · ${DROP.totalTickets - remaining}/${DROP.totalTickets} minted` },
      { protocol: 'ACP', label: `KYA-bound mints settled · resale gated to T${DROP.resaleKyaFloor}+` },
    ],
  });
}
