import { NextResponse } from 'next/server';
import { bouquetEnv, tenantClient } from '@/lib/bouquet-flow';

/**
 * Live agent wallet balance — reads the real Bouquet gift wallet on Sly
 * (GET /v1/agents/:id/wallet) so the mobile balance card decrements
 * after the agent spends.
 */
export async function GET() {
  const env = bouquetEnv();
  if ('error' in env) {
    return NextResponse.json({ error: env.error }, { status: 500 });
  }
  try {
    const t = tenantClient(env);
    const w = await t.apiGet<{
      balance?: number;
      currency?: string;
      all_wallets?: Array<{ balance?: number; currency?: string }>;
    }>(`/v1/agents/${env.agentId}/wallet`);
    const balance =
      typeof w?.balance === 'number'
        ? w.balance
        : (w?.all_wallets?.[0]?.balance ?? null);
    return NextResponse.json({
      balance,
      currency: w?.currency ?? w?.all_wallets?.[0]?.currency ?? 'USDC',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
