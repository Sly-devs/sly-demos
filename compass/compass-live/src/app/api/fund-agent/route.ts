/**
 * POST /api/fund-agent
 *
 * Body: { agent_id: string }
 *
 * Holds the tenant key server-side; resolves the agent's EOA from
 * /v1/agents/:id/wallet, then drips ETH for gas via the Sly platform's
 * cross-tenant faucet at /v1/faucet/gas. The faucet is gated by a
 * per-tenant feature flag (`gas_faucet` in `tenant_features`); if a
 * partner's tenant isn't enabled, this surfaces the 403 with the
 * partnerships@ contact upstream of the picker so they see a clean
 * "not enabled — contact us" message.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SLY_TENANT_KEY = process.env.SLY_DEMO_TENANT_API_KEY || 'pk_test_compass_demo_2026';

export async function POST(req: Request) {
  let body: { agent_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (!body.agent_id) return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });

  // 1. Resolve the agent's EOA via the public wallet endpoint.
  let eoa: string;
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
    const wallet = (await r.json()) as { data?: { address?: string; wallet_address?: string } };
    const addr = wallet.data?.address ?? wallet.data?.wallet_address;
    if (!addr) return NextResponse.json({ error: 'Agent has no wallet address' }, { status: 400 });
    eoa = addr;
  } catch (e) {
    return NextResponse.json(
      { error: `Wallet lookup error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  // 2. Drip from Sly's cross-tenant faucet.
  const dripRes = await fetch(`${SLY_API_URL}/v1/faucet/gas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SLY_TENANT_KEY}`,
    },
    body: JSON.stringify({ destination: eoa, chain: 'base' }),
  });
  const dripBody = await dripRes.json().catch(() => ({}));
  return NextResponse.json(
    { ...dripBody, agent_id: body.agent_id, destination: eoa },
    { status: dripRes.status },
  );
}
