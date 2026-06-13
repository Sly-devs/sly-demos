import { NextResponse } from 'next/server';
import { bouquetEnv, tenantClient } from '@/lib/bouquet-flow';

/**
 * Sam's envelope status surface — reuses the platform's daily-limit
 * primitive to expose envelope ceiling + amount drawn.
 *
 *  GET   → { dailyLimit, spentToday, remaining }   (envelope-styled UI)
 *  PATCH { dailyLimit } → adjust the envelope ceiling
 */
function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

async function readState(agentId: string, t: ReturnType<typeof tenantClient>) {
  const stats = await t.apiGet<{
    effectiveLimits?: { daily?: number };
    limits?: { daily?: number };
    usage?: { daily?: number; dailyRemaining?: number };
  }>(`/v1/agents/${agentId}/limits`);

  const dailyLimit = num(stats?.effectiveLimits?.daily ?? stats?.limits?.daily);
  const spentToday = num(stats?.usage?.daily);
  const remaining =
    stats?.usage?.dailyRemaining != null
      ? num(stats.usage.dailyRemaining)
      : Math.max(0, dailyLimit - spentToday);

  return { dailyLimit, spentToday, remaining };
}

export async function GET() {
  const env = bouquetEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });
  try {
    const t = tenantClient(env);
    return NextResponse.json(await readState(env.agentId, t));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

export async function PATCH(req: Request) {
  const env = bouquetEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });
  const body = (await req.json().catch(() => ({}))) as { dailyLimit?: number };
  const dailyLimit = Number(body.dailyLimit);
  if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
    return NextResponse.json(
      { error: 'dailyLimit must be a positive number' },
      { status: 400 }
    );
  }
  try {
    const t = tenantClient(env);
    await t.apiPatch(`/v1/agents/${env.agentId}`, { dailyLimit });
    return NextResponse.json(await readState(env.agentId, t));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
