import { NextResponse } from 'next/server';
import {
  CHECKOUT_PRODUCT,
  fetchMerchantEoa,
  mayaEnv,
  slyPost,
  type ScopeRequestResult,
} from '@/lib/maya-flow';

/**
 * Credit-checkout preflight (steps 1-2 of the FREE half — no broadcast):
 *   1. Agent token requests a one_shot `treasury` scope grant — required
 *      for the final wallet_transfer (merchant pay) leg. The borrow +
 *      withdraw legs ride the standing compass:credit grant from
 *      onboarding, so this is the ONLY just-in-time approval Maya sees.
 *   2. Return { phase: 'awaiting_approval', requestId } so the UI can
 *      render the Coral ID approval sheet (Face-ID styled).
 *
 * /api/maya/credit-checkout/confirm picks up after Maya taps approve.
 * That's where the 3 real on-chain broadcasts happen.
 */
export async function POST() {
  const env = await mayaEnv();
  if ('error' in env) {
    return NextResponse.json({ phase: 'error', error: env.error }, { status: 500 });
  }

  try {
    const merchant = await fetchMerchantEoa(env);
    if (!merchant) {
      return NextResponse.json(
        { phase: 'error', error: 'No merchant EOA available on this tenant. Run `pnpm onboard` so an Operator agent exists.' },
        { status: 502 },
      );
    }

    const scope = await slyPost<ScopeRequestResult>(env, '/v1/auth/scopes/request', {
      token: env.agentToken,
      body: {
        scope: 'treasury',
        lifecycle: 'one_shot',
        purpose: `Maya: pay ${CHECKOUT_PRODUCT.merchant} ${CHECKOUT_PRODUCT.amount} ${CHECKOUT_PRODUCT.asset} (borrow + withdraw + send)`,
      },
    });
    if (!scope.ok) {
      return NextResponse.json(
        {
          phase: 'error',
          error:
            (scope.raw as { error?: string })?.error ??
            `scope request failed → ${scope.status}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      phase: 'awaiting_approval',
      requestId: scope.data.request_id,
      scope: 'treasury',
      // Displayed amount drives the approval-sheet hero number. The
      // real on-chain transfer is still CHECKOUT_PRODUCT.amount — only
      // the consumer-facing surface is scaled (see DEMO_SCALE). Two
      // decimals so the sheet reads "145.00 USDC", not "145 USDC".
      amount: Number(CHECKOUT_PRODUCT.displayAmount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      asset: CHECKOUT_PRODUCT.asset,
      merchant: CHECKOUT_PRODUCT.merchant,
      merchantAddress: merchant.eoa,
      purpose: `Pay ${CHECKOUT_PRODUCT.merchant} against your Aave credit`,
    });
  } catch (err) {
    return NextResponse.json(
      { phase: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
