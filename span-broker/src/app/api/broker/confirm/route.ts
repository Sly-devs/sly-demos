import { NextResponse } from 'next/server';
import {
  spanEnv,
  tenantClient,
  rawPost,
  CARD_LABEL,
  TOKENIZED_CARD,
  PRICE,
  HOKA,
} from '@/lib/span-flow';

/**
 * Span — phase 2 of 2. The human clicked "Buy" in the Claude checkout
 * widget. THAT is the approval: the account owner approves the one-shot
 * scope and the Claude agent completes the real UCP checkout, settling
 * to the tokenized card and creating a UCP order.
 */
export async function POST(req: Request) {
  const env = spanEnv();
  if ('error' in env) {
    return NextResponse.json({ status: 'error', error: env.error }, { status: 500 });
  }
  let body: { checkoutId?: string; requestId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: 'error', error: 'Invalid body' }, { status: 400 });
  }
  if (!body.checkoutId || !body.requestId) {
    return NextResponse.json(
      { status: 'error', error: 'Missing checkoutId / requestId' },
      { status: 400 },
    );
  }

  const tenant = tenantClient(env);

  try {
    // The Buy click = the human approving the buyer's one-shot treasury
    // scope. The Claude agent (holding that scope) completes the UCP
    // checkout; Sly mirrors the order into Outpost's tenant.
    await tenant.decideScope(body.requestId, 'approve');

    const completed = await rawPost<{ status: string; order_id?: string }>(
      env.baseUrl,
      env.agentToken,
      `/v1/ucp/checkouts/${body.checkoutId}/complete`,
      {},
    );
    if (!completed.ok) {
      throw new Error(
        `UCP completeCheckout ${completed.status}: ${JSON.stringify(completed.data).slice(0, 200)}`,
      );
    }

    const orderId = completed.data.order_id ?? null;
    const status = completed.data.status ?? 'completed';
    const at = () => new Date().toISOString();

    return NextResponse.json({
      status,
      orderId,
      checkoutId: body.checkoutId,
      totalAmount: PRICE,
      currency: HOKA.currency,
      paymentMethod: {
        label: CARD_LABEL,
        brand: TOKENIZED_CARD.brand,
        last4: TOKENIZED_CARD.last4,
        type: 'card',
        handler: TOKENIZED_CARD.handler,
      },
      events: [
        {
          kind: 'scope.approved',
          protocol: 'AP2',
          label: 'You approved the purchase in the Claude widget',
          at: at(),
        },
        {
          kind: 'checkout.completed',
          protocol: 'UCP',
          label: orderId
            ? `UCP checkout completed — order ${orderId}`
            : 'UCP checkout completed',
          at: at(),
        },
        {
          kind: 'settlement.completed',
          protocol: 'UCP',
          label: `Settled to ${CARD_LABEL} — cross-ecosystem`,
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
