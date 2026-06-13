import { NextResponse } from 'next/server';
import {
  spanEnv,
  tenantClient,
  agentClient,
  rawPost,
  buildUcpCheckout,
  SCOPE_PURPOSE,
  OUTPOST_MERCHANT_NAME,
  CARD_LABEL,
  TOKENIZED_CARD,
  PRICE,
  HOKA,
} from '@/lib/span-flow';

/**
 * Span — phase 1 of 2. Sly (neutral broker) opens a real UCP checkout at
 * the ChatGPT-side Outpost merchant and the Claude agent requests a
 * one-shot treasury scope — but NOTHING is charged yet. The response is
 * what the Claude column renders as an interactive checkout widget; the
 * human clicks "Buy" in that widget (→ /api/broker/confirm) to authorize.
 */
export async function POST() {
  const env = spanEnv();
  if ('error' in env) {
    return NextResponse.json({ status: 'error', error: env.error }, { status: 500 });
  }
  const tenant = tenantClient(env);
  const agent = agentClient(env);

  try {
    // Buyer-driven: the checkout is opened in the Span (buyer) tenant so
    // the Claude agent can authorize + complete it with its one-shot
    // treasury scope. Sly mirrors the completed order into Outpost's
    // tenant via invu_merchant_id (no merchant scope needed to receive).
    const created = await rawPost<{ id: string }>(
      env.baseUrl,
      env.tenantKey,
      '/v1/ucp/checkouts',
      buildUcpCheckout(env),
    );
    if (!created.ok || !created.data?.id) {
      throw new Error(
        `UCP createCheckout ${created.status}: ${JSON.stringify(created.data).slice(0, 200)}`,
      );
    }
    const checkoutId = created.data.id;

    const { requestId } = await agent.requestScope({
      scope: 'treasury',
      lifecycle: 'one_shot',
      purpose: SCOPE_PURPOSE,
      intent: {
        route: '/v1/ucp/checkouts/:id/complete',
        args: { checkout_id: checkoutId },
      },
    });

    const at = () => new Date().toISOString();
    return NextResponse.json({
      status: 'awaiting_approval',
      checkoutId,
      requestId,
      product: {
        name: HOKA.name,
        description: 'Neutral road running shoe · breathable mesh',
        price: PRICE,
        currency: HOKA.currency,
        image: '/products/hoka-clifton-10.webp',
        merchant: OUTPOST_MERCHANT_NAME,
      },
      paymentMethod: {
        label: CARD_LABEL,
        brand: TOKENIZED_CARD.brand,
        last4: TOKENIZED_CARD.last4,
        type: 'card',
        handler: TOKENIZED_CARD.handler,
      },
      events: [
        {
          kind: 'checkout.created',
          protocol: 'UCP',
          label: `UCP checkout opened at ${OUTPOST_MERCHANT_NAME} — tokenized card attached`,
          at: at(),
        },
        {
          kind: 'scope.requested',
          protocol: 'AP2',
          label: 'Claude agent requested a one-shot treasury scope — awaiting your approval',
          at: at(),
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
