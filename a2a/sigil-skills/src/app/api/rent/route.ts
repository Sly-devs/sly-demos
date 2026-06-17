import { NextResponse } from 'next/server';
import { sigilEnv } from '@/lib/sigil-flow';
import { CATALOG, evaluateRental, POLICY } from '@/lib/demo';

function genHash() { return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

interface RentBody { skillId?: string; windowHours?: number; spentCents?: number; }

export async function POST(req: Request) {
  const env = sigilEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });
  const { skillId, windowHours = 2, spentCents = 0 } = (await req.json().catch(() => ({}))) as RentBody;
  const skill = CATALOG.find((s) => s.id === skillId);
  if (!skill) return NextResponse.json({ error: 'skill not found' }, { status: 404 });

  const evalRes = evaluateRental(skill, windowHours, spentCents);

  if (evalRes.decision === 'deny') {
    return NextResponse.json({
      decision: 'deny', reasons: evalRes.reasons, costCents: evalRes.costCents,
      events: [
        { protocol: 'KYA', label: `owner ${skill.owner} KYA T${skill.ownerKyaTier} · rep ${skill.ownerRep}` },
        { protocol: 'AP2', label: `DENY · ${evalRes.reasons.map((r) => r.label).join(' · ')}` },
      ],
    });
  }

  const startTs = new Date().toISOString();
  const expiryTs = new Date(Date.now() + windowHours * 3600 * 1000).toISOString();
  const grant = {
    id: `grant_${skill.id}_${Date.now().toString(36)}`,
    skill,
    windowHours,
    startTs,
    expiryTs,
    costCents: evalRes.costCents,
    hash: genHash(),
    status: 'active' as const,
  };

  return NextResponse.json({
    decision: 'allow', grant,
    events: [
      { protocol: 'KYA', label: `${skill.owner} KYA T${skill.ownerKyaTier} · rep ${skill.ownerRep} ✓` },
      { protocol: 'AP2', label: `grant minted · ${windowHours}h window · ${(evalRes.costCents / 100).toFixed(2)} ≤ $${POLICY.perRentalCeilingCents / 100} ceiling` },
      { protocol: 'ACP', label: `skill ${skill.name} bound to Avi · expires ${expiryTs.slice(11, 19)} UTC` },
    ],
  });
}
