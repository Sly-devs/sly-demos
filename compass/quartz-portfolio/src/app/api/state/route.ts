import { NextResponse } from 'next/server';
import { quartzEnv, tenantClient } from '@/lib/quartz-flow';
import { PORTFOLIO } from '@/lib/demo';

/**
 * GET /api/state — composed portfolio state. Reads agent + wallet from
 * Sly to confirm L1 (KYA tier) + L2 readiness (policy bands).
 */
function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  const env = quartzEnv();
  if ('error' in env) {
    return NextResponse.json({ error: env.error }, { status: 500 });
  }
  try {
    const t = tenantClient(env);
    // Live KYA tier + daily limit so the UI can show real Sly state.
    const stats = await t
      .apiGet<{
        effectiveLimits?: { daily?: number };
        limits?: { daily?: number };
        kyaTier?: number;
      }>(`/v1/agents/${env.agentId}/limits`)
      .catch(() => null);

    const dailyLimit = num(
      stats?.effectiveLimits?.daily ?? stats?.limits?.daily ?? PORTFOLIO.perTradeCeilingUsd
    );

    return NextResponse.json({
      navUsd: PORTFOLIO.navUsd,
      drawdownPct: PORTFOLIO.drawdownPct,
      perTradeCeilingUsd: Math.min(dailyLimit, PORTFOLIO.perTradeCeilingUsd),
      bands: PORTFOLIO.bands,
      kyaTier: stats?.kyaTier ?? 2,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
