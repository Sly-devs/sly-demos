import { NextResponse } from 'next/server';
import { createDemoClient, type CreateCheckoutRequest } from '@sly/demo-kit';
import { LUME_MERCHANT_ID, LUME_MERCHANT_NAME } from '@/lib/catalog';

/**
 * Lume Goods' ACP merchant endpoint. The storefront calls this when a shopper
 * taps "Buy with Agent"; it drives the canonical Sly ACP flow on behalf of a
 * seeded Aster buyer agent and returns the structured demo events.
 *
 * Config (set in apps/demo/lume-goods/.env.local — see .env.example):
 *   SLY_API_URL          Sly API base (default http://localhost:4000)
 *   ASTER_API_KEY        Aster tenant test key (pk_test_aster_demo_2026)
 *   ASTER_AGENT_ID       Buyer agent id (printed by seed-aster-demo)
 *   ASTER_ACCOUNT_ID     Buyer agent's account id (printed by seed-aster-demo)
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    productId: string;
    productName: string;
    priceCents: number;
    currency: string;
  };

  const tenantKey = process.env.ASTER_API_KEY ?? 'pk_test_aster_demo_2026';
  const agentToken = process.env.ASTER_AGENT_TOKEN;
  const agentId = process.env.ASTER_AGENT_ID;
  const accountId = process.env.ASTER_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';

  if (!agentToken || !agentId || !accountId) {
    return NextResponse.json(
      {
        status: 'error',
        error:
          'Missing ASTER_AGENT_TOKEN / ASTER_AGENT_ID / ASTER_ACCOUNT_ID. Re-run seed-aster-demo.ts and update .env.local.',
      },
      { status: 500 }
    );
  }

  // Real Epic-82 handshake (auto-approved server-side here: the storefront
  // is the merchant; the approve step is the platform owner authorizing
  // the agent's one-shot treasury scope for this checkout).
  const tenant = createDemoClient({ apiKey: tenantKey, baseUrl });
  const agent = createDemoClient({ apiKey: agentToken, baseUrl });

  const checkout: CreateCheckoutRequest = {
    checkout_id: `chk_lume_${body.productId}_${Date.now()}`,
    agent_id: agentId,
    agent_name: 'Velo',
    account_id: accountId,
    merchant_id: LUME_MERCHANT_ID,
    merchant_name: LUME_MERCHANT_NAME,
    // Settlement asset is USDC (on Base) regardless of the catalog's
    // display currency — matches the agent + merchant wallets.
    currency: 'USDC',
    // Sly ACP tracks amounts in major units (dollars). Convert from cents.
    items: [
      {
        item_id: body.productId,
        name: body.productName,
        quantity: 1,
        unit_price: body.priceCents / 100,
        total_price: body.priceCents / 100,
        currency: 'USDC',
      },
    ],
    metadata: { demo: 'aster', storefront: 'lume-goods' },
  };

  try {
    const created = await tenant.sly.acp.createCheckout(checkout);
    const { requestId } = await agent.requestScope({
      scope: 'treasury',
      lifecycle: 'one_shot',
      purpose: `Pay ${LUME_MERCHANT_NAME} $${(body.priceCents / 100).toFixed(2)} for ${body.productName} (Velo, Aster platform)`,
      intent: {
        route: '/v1/acp/checkouts/:id/complete',
        args: { checkout_id: created.id, product: body.productId },
      },
    });
    await tenant.decideScope(requestId, 'approve');
    const completed = await agent.sly.acp.completeCheckout(created.id, {
      shared_payment_token: `lume-spt-${Date.now().toString(36)}`,
      idempotency_key: `lume-idem-${created.id}`,
    });

    return NextResponse.json({
      status: completed.status,
      transferId: completed.transfer_id,
      totalAmount: completed.total_amount,
      currency: completed.currency,
      events: [
        { kind: 'agent.verified', protocol: 'A2A', label: 'Agent identity verified — Velo (KYA Tier 2)' },
        { kind: 'policy.evaluated', protocol: 'AP2', label: `Auto-accept policy cleared — within mandate` },
        { kind: 'checkout.created', protocol: 'ACP', label: `Checkout created at ${LUME_MERCHANT_NAME}` },
        { kind: 'scope.requested', protocol: 'AP2', label: 'Agent requested one-shot treasury scope' },
        { kind: 'scope.approved', protocol: 'AP2', label: 'Scope approved by platform owner' },
        { kind: 'checkout.completed', protocol: 'ACP', label: 'Checkout completed' },
        { kind: 'settlement.completed', protocol: 'MPP', label: `Settlement ${completed.status} — grant consumed` },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
