import { NextResponse } from 'next/server';
import type { CreateCheckoutRequest } from '@sly/demo-kit';
import {
  spanEnv,
  tenantClient,
  agentClient,
  buildCheckout,
  scopePurpose,
  OUTPOST_MERCHANT_NAME,
} from '@/lib/span-flow';

/**
 * Outpost Outdoors' ChatGPT-side ACS (Agentic Commerce / Stripe-style)
 * checkout endpoint. The mock GPT calls this when the shopper confirms the
 * in-chat purchase card; it drives the canonical Sly Epic-82 ACP handshake on
 * behalf of Maya's Claude-side shopping agent and returns the structured demo
 * events.
 *
 * Sly is the neutral broker here: the buyer agent lives in the Claude
 * ecosystem (Span tenant), the seller is a SEPARATE Sly tenant (Outpost
 * Outdoors), and Sly verifies identity + policy and settles cross-tenant.
 *
 * Real Epic-82 handshake (auto-approved server-side — the storefront is the
 * merchant surface; on Maya's phone the approve step is a human tap):
 *   1. tenant key  → ACP createCheckout
 *   2. agent token → request `treasury` one_shot scope
 *   3. tenant key  → approve the scope request
 *   4. agent token → ACP completeCheckout (grant consumed, cross-tenant settle)
 *
 * Config (set in apps/demo/span-chatgpt-mock/.env.local — see .env.example):
 *   SLY_API_URL       Sly API base (default https://sandbox.getsly.ai)
 *   SPAN_API_KEY      Span tenant test key (pk_test_span_demo_2026)
 *   SPAN_AGENT_TOKEN  Claude Shopping Agent token (printed by seed-span-demo)
 *   SPAN_AGENT_ID     Claude Shopping Agent id (printed by seed-span-demo)
 *   SPAN_ACCOUNT_ID   Maya's account id (printed by seed-span-demo)
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    productId: string;
    productName: string;
    priceCents: number;
    currency: string;
  };

  const env = spanEnv();
  if ('error' in env) {
    return NextResponse.json(
      { status: 'error', error: env.error },
      { status: 500 }
    );
  }

  const tenant = tenantClient(env);
  const agent = agentClient(env);
  const item = {
    productId: body.productId,
    productName: body.productName,
    priceCents: body.priceCents,
  };
  const checkout = buildCheckout(env, item) as CreateCheckoutRequest;

  try {
    const created = await tenant.sly.acp.createCheckout(checkout);
    const { requestId } = await agent.requestScope({
      scope: 'treasury',
      lifecycle: 'one_shot',
      purpose: scopePurpose(item),
      intent: {
        route: '/v1/acp/checkouts/:id/complete',
        args: { checkout_id: created.id, product: body.productId },
      },
    });
    await tenant.decideScope(requestId, 'approve');
    const completed = await agent.sly.acp.completeCheckout(created.id, {
      shared_payment_token: `outpost-spt-${Date.now().toString(36)}`,
      idempotency_key: `outpost-idem-${created.id}`,
    });

    const at = () => new Date().toISOString();
    return NextResponse.json({
      status: completed.status,
      transferId: completed.transfer_id,
      totalAmount: completed.total_amount,
      currency: completed.currency,
      events: [
        {
          kind: 'checkout.created',
          protocol: 'ACP',
          label: `Checkout created at ${OUTPOST_MERCHANT_NAME}`,
          at: at(),
        },
        {
          kind: 'scope.requested',
          protocol: 'AP2',
          label: 'Agent requested one-shot treasury scope',
          at: at(),
        },
        {
          kind: 'scope.approved',
          protocol: 'AP2',
          label: 'Scope approved by account owner',
          at: at(),
        },
        {
          kind: 'checkout.completed',
          protocol: 'ACP',
          label: 'Checkout completed',
          at: at(),
        },
        {
          kind: 'settlement.completed',
          protocol: 'MPP',
          label: `Settlement ${completed.status} — grant consumed`,
          at: at(),
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
