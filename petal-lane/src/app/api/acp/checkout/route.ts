import { NextResponse } from 'next/server';
import { createDemoClient, type CreateCheckoutRequest } from '@sly/demo-kit';
import { CRATE_MERCHANT_ID, CRATE_MERCHANT_NAME } from '@/lib/catalog';

/**
 * Crate's ACP merchant endpoint. The storefront calls this when a shopper taps
 * "Buy with Agent"; it drives the canonical Sly ACP flow on behalf of Maya's
 * Coral shopping agent and streams back the structured demo events.
 *
 * Config (set in apps/demo/crate-storefront/.env.local — see .env.example):
 *   SLY_API_URL          Sly API base (default http://localhost:4000)
 *   CORAL_API_KEY        Coral tenant test key (pk_test_coral_demo_2026)
 *   CORAL_AGENT_ID       Coral Shopping Agent id (printed by seed-coral-demo)
 *   CORAL_ACCOUNT_ID     Maya's account id (printed by seed-coral-demo)
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    productId: string;
    productName: string;
    priceCents: number;
    currency: string;
  };

  const tenantKey = process.env.CORAL_API_KEY ?? 'pk_test_coral_demo_2026';
  const agentToken = process.env.CORAL_AGENT_TOKEN;
  const agentId = process.env.CORAL_AGENT_ID;
  const accountId = process.env.CORAL_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';

  if (!agentToken || !agentId || !accountId) {
    return NextResponse.json(
      {
        status: 'error',
        error:
          'Missing CORAL_AGENT_TOKEN / CORAL_AGENT_ID / CORAL_ACCOUNT_ID. Re-run seed-coral-demo.ts and update .env.local.',
      },
      { status: 500 }
    );
  }

  // Real Epic-82 handshake (auto-approved server-side here: the storefront
  // is the merchant; on Maya's phone the approve step is a human tap).
  const tenant = createDemoClient({ apiKey: tenantKey, baseUrl });
  const agent = createDemoClient({ apiKey: agentToken, baseUrl });

  const checkout: CreateCheckoutRequest = {
    checkout_id: `chk_crate_${body.productId}_${Date.now()}`,
    agent_id: agentId,
    agent_name: 'Coral Shopping Agent',
    account_id: accountId,
    merchant_id: CRATE_MERCHANT_ID,
    merchant_name: CRATE_MERCHANT_NAME,
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
    metadata: { demo: 'coral', storefront: 'crate' },
  };

  try {
    const created = await tenant.sly.acp.createCheckout(checkout);
    const { requestId } = await agent.requestScope({
      scope: 'treasury',
      lifecycle: 'one_shot',
      purpose: `Pay ${CRATE_MERCHANT_NAME} $${(body.priceCents / 100).toFixed(2)} for ${body.productName} (Coral shopping agent)`,
      intent: {
        route: '/v1/acp/checkouts/:id/complete',
        args: { checkout_id: created.id, product: body.productId },
      },
    });
    await tenant.decideScope(requestId, 'approve');
    const completed = await agent.sly.acp.completeCheckout(created.id, {
      shared_payment_token: `crate-spt-${Date.now().toString(36)}`,
      idempotency_key: `crate-idem-${created.id}`,
    });

    return NextResponse.json({
      status: completed.status,
      transferId: completed.transfer_id,
      totalAmount: completed.total_amount,
      currency: completed.currency,
      events: [
        { kind: 'checkout.created', protocol: 'ACP', label: `Checkout created at ${CRATE_MERCHANT_NAME}` },
        { kind: 'scope.requested', protocol: 'AP2', label: 'Agent requested one-shot treasury scope' },
        { kind: 'scope.approved', protocol: 'AP2', label: 'Scope approved by account owner' },
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
