import { NextResponse } from 'next/server';
import { agentClient, bouquetEnv, tenantClient } from '@/lib/bouquet-flow';
import { MERCHANT } from '@/lib/demo';

/**
 * Step 3–4 of the envelope handshake, run when Sam taps Approve:
 *  - tenant key approves the pending envelope scope request
 *  - the agent completes the ACP checkout, consuming the one-shot grant
 */
export async function POST(req: Request) {
  const env = bouquetEnv();
  if ('error' in env) {
    return NextResponse.json({ phase: 'error', error: env.error }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    requestId?: string;
    checkoutId?: string;
  };
  if (!body.requestId || !body.checkoutId) {
    return NextResponse.json(
      { phase: 'error', error: 'requestId and checkoutId are required' },
      { status: 400 }
    );
  }

  try {
    const tenant = tenantClient(env);
    const agent = agentClient(env);

    await tenant.decideScope(body.requestId, 'approve');

    const completed = await agent.sly.acp.completeCheckout(body.checkoutId, {
      shared_payment_token: `bouquet-spt-${Date.now().toString(36)}`,
      idempotency_key: `bouquet-idem-${body.checkoutId}`,
    });

    return NextResponse.json({
      phase: 'settled',
      status: completed.status,
      transferId: completed.transfer_id,
      totalAmount: completed.total_amount,
      currency: completed.currency,
      events: [
        {
          kind: 'scope.approved',
          protocol: 'AP2',
          label: 'Envelope scope approved by account owner',
        },
        {
          kind: 'checkout.completed',
          protocol: 'ACP',
          label: `Checkout completed at ${MERCHANT.name}`,
        },
        {
          kind: 'settlement.completed',
          protocol: 'MPP',
          label: `Settlement ${completed.status} — envelope grant consumed`,
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
