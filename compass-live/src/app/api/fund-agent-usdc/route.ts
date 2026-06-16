/**
 * POST /api/fund-agent-usdc
 *
 * Body: { agent_id: string }
 *
 * Holds the tenant key server-side; resolves the agent's Compass Safe
 * address from /v1/agents/:id/wallet's all_wallets, then drips USDC via
 * Sly's cross-tenant USDC faucet at /v1/faucet/usdc.
 *
 * Unlike the ETH faucet (which targets the EOA signer), this one targets
 * the *Safe* — that's where collateral and borrowed funds live. The Safe
 * must be in the tenant's usdc_faucet.allowed_destinations or the
 * endpoint will 403.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SLY_TENANT_KEY = process.env.SLY_DEMO_TENANT_API_KEY || 'pk_test_compass_demo_2026';

interface WalletDto {
  address?: string;
  wallet_address?: string;
  wallet_type?: string;
  provider?: string;
}

export async function POST(req: Request) {
  let body: { agent_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (!body.agent_id) return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });

  // 1. Find the agent's smart_wallet (Safe) address.
  let safeAddress: string | null = null;
  try {
    const r = await fetch(`${SLY_API_URL}/v1/agents/${body.agent_id}/wallet`, {
      headers: { Authorization: `Bearer ${SLY_TENANT_KEY}` },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return NextResponse.json(
        { error: `Failed to resolve agent wallet: ${r.status} ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const wallet = (await r.json()) as { data?: { all_wallets?: WalletDto[] } };
    const all = wallet.data?.all_wallets ?? [];
    const safe = all.find((w) => w.wallet_type === 'smart_wallet' && w.provider === 'compass');
    safeAddress = safe?.address ?? safe?.wallet_address ?? null;
    if (!safeAddress) {
      return NextResponse.json(
        { error: 'Agent has no Compass Safe — USDC drips target the Safe, not the EOA.' },
        { status: 400 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Wallet lookup error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  // 2. Drip USDC.
  const dripRes = await fetch(`${SLY_API_URL}/v1/faucet/usdc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SLY_TENANT_KEY}`,
    },
    body: JSON.stringify({ destination: safeAddress, chain: 'base' }),
  });
  const dripBody = await dripRes.json().catch(() => ({}));
  return NextResponse.json(
    { ...dripBody, agent_id: body.agent_id, destination: safeAddress },
    { status: dripRes.status },
  );
}
