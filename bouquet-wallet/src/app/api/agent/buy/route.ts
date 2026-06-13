import { NextResponse } from 'next/server';
import {
  agentClient,
  bouquetEnv,
  buildCheckout,
  PRICE,
  SCOPE_PURPOSE,
  tenantClient,
} from '@/lib/bouquet-flow';
import { ENVELOPE_CENTS, MERCHANT } from '@/lib/demo';

/**
 * Step 1–2 of the Epic-82 handshake (envelope variant):
 *  - tenant key creates the ACP checkout (Petal Lane backend)
 *  - the agent requests a one-shot `treasury` scope ≤ envelope ceiling
 *
 * Returns a PENDING approval — wallet shows Sam the envelope request,
 * /api/agent/approve finishes it.
 */
export async function POST() {
  const env = bouquetEnv();
  if ('error' in env) {
    return NextResponse.json({ phase: 'error', error: env.error }, { status: 500 });
  }

  try {
    const tenant = tenantClient(env);
    const agent = agentClient(env);

    const checkout = buildCheckout(env);
    const created = await tenant.sly.acp.createCheckout(checkout);
    tenant.events;

    const { requestId, status } = await agent.requestScope({
      scope: 'treasury',
      lifecycle: 'one_shot',
      purpose: SCOPE_PURPOSE,
      intent: {
        route: '/v1/acp/checkouts/:id/complete',
        args: {
          checkout_id: created.id,
          amount: PRICE,
          merchant: MERCHANT.name,
          envelope_cents: ENVELOPE_CENTS,
        },
      },
    });

    return NextResponse.json({
      phase: 'awaiting_approval',
      requestId,
      requestStatus: status,
      checkoutId: created.id,
      amount: PRICE,
      envelopeCents: ENVELOPE_CENTS,
      currency: checkout.currency,
      merchant: MERCHANT.name,
      purpose: SCOPE_PURPOSE,
      events: [
        { kind: 'checkout.created', protocol: 'ACP', label: `Checkout created at ${MERCHANT.name}` },
        {
          kind: 'scope.requested',
          protocol: 'AP2',
          label: 'Agent requested envelope scope — awaiting your approval',
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { phase: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
