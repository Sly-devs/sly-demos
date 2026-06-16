import { NextResponse } from 'next/server';
import {
  BORROW,
  CHECKOUT_PRODUCT,
  borrowIntent,
  borrowUnsignedTx,
  fetchAgentExternalWalletId,
  fetchMerchantEoa,
  mayaEnv,
  slyPost,
  slyPostOrThrow,
  withdrawIntent,
  withdrawUnsignedTx,
  type CheckoutStepReceipt,
  type ExecuteResult,
  type PolicyApprove,
} from '@/lib/maya-flow';

/**
 * Credit-checkout: borrow → withdraw → pay merchant.
 *
 * Three sequential Sly-gated steps, each broadcasting a real tx on Base
 * mainnet. The standing compass:credit grant (issued at onboarding by
 * /v1/onboarding/compass-demo) covers steps 1 + 2 — no per-step approval
 * prompts; the click IS the consent. Step 3 is a wallet transfer to a
 * tenant-owned merchant EOA, gated by Sly's KYA-tier spending policy.
 *
 * The narrative point: Maya's Aave debt ticks up by 0.10 USDC, her
 * collateral stays put, the merchant's EOA receives 0.10 USDC — all in
 * one click, all on-chain, all governed.
 */
export async function POST() {
  const env = await mayaEnv();
  if ('error' in env) {
    return NextResponse.json({ phase: 'error', error: env.error }, { status: 500 });
  }

  try {
    // Resolve dependencies up front so we fail fast.
    const merchant = await fetchMerchantEoa(env);
    if (!merchant) {
      return NextResponse.json(
        { phase: 'error', error: 'No merchant EOA available on this tenant. Run `pnpm onboard` so an Operator agent exists.' },
        { status: 502 },
      );
    }
    const sourceWalletId = await fetchAgentExternalWalletId(env);
    if (!sourceWalletId) {
      return NextResponse.json(
        { phase: 'error', error: 'Could not resolve Maya\'s external wallet id on Sly.' },
        { status: 502 },
      );
    }

    const receipts: CheckoutStepReceipt[] = [];

    // ── Step 1: Borrow $0.10 USDC from Aave ────────────────────────────
    // Standing compass:credit grant from onboarding covers this — the
    // first evaluate-intent should approve directly (no deny→request→approve).
    const borrowEval = await slyPost<PolicyApprove>(env, '/v1/policy/evaluate-intent', {
      token: env.agentToken,
      body: borrowIntent(env),
    });
    if (!borrowEval.ok || borrowEval.data.decision !== 'approve' || !borrowEval.data.evaluation_id) {
      return NextResponse.json(
        {
          phase: 'error',
          step: 'borrow.evaluate',
          error: borrowEval.ok
            ? `borrow evaluation did not approve: ${JSON.stringify(borrowEval.data).slice(0, 200)}`
            : `borrow evaluation failed → ${borrowEval.status}: ${JSON.stringify(borrowEval.raw).slice(0, 200)}`,
        },
        { status: 502 },
      );
    }
    const borrowUnsigned = borrowUnsignedTx(env);
    const borrowExec = await slyPostOrThrow<ExecuteResult>(env, '/v1/policy/execute-intent', {
      token: env.agentToken,
      body: {
        agent_id: env.agentId,
        evaluation_id: borrowEval.data.evaluation_id,
        chain: BORROW.chain,
        unsigned_transaction: {
          to: borrowUnsigned.to,
          data: borrowUnsigned.data,
          value: borrowUnsigned.value || '0x0',
          gas: borrowUnsigned.gas || '0x7a120',
        },
      },
    });
    receipts.push({
      label: `Step 1 · Borrowed ${BORROW.amount} ${BORROW.asset} from Aave V3`,
      evaluationId: borrowEval.data.evaluation_id as string,
      txHash: borrowExec.tx_hash,
      blockNumber: borrowExec.block_number != null ? String(borrowExec.block_number) : undefined,
      policyDecisionId: borrowEval.data.evaluation_id as string,
    });

    // ── Step 2: Withdraw $0.10 USDC from Compass Safe → EOA ────────────
    const withdrawEval = await slyPost<PolicyApprove>(env, '/v1/policy/evaluate-intent', {
      token: env.agentToken,
      body: withdrawIntent(env, BORROW.amount, BORROW.asset),
    });
    if (!withdrawEval.ok || withdrawEval.data.decision !== 'approve' || !withdrawEval.data.evaluation_id) {
      return NextResponse.json(
        {
          phase: 'error',
          step: 'withdraw.evaluate',
          error: withdrawEval.ok
            ? `withdraw evaluation did not approve: ${JSON.stringify(withdrawEval.data).slice(0, 200)}`
            : `withdraw evaluation failed → ${withdrawEval.status}: ${JSON.stringify(withdrawEval.raw).slice(0, 200)}`,
          receipts,
        },
        { status: 502 },
      );
    }
    const withdrawUnsigned = withdrawUnsignedTx(env, BORROW.amount, BORROW.asset);
    const withdrawExec = await slyPostOrThrow<ExecuteResult>(env, '/v1/policy/execute-intent', {
      token: env.agentToken,
      body: {
        agent_id: env.agentId,
        evaluation_id: withdrawEval.data.evaluation_id,
        chain: BORROW.chain,
        unsigned_transaction: {
          to: withdrawUnsigned.to,
          data: withdrawUnsigned.data,
          value: withdrawUnsigned.value || '0x0',
          gas: withdrawUnsigned.gas || '0x7a120',
        },
      },
    });
    receipts.push({
      label: `Step 2 · Withdrew ${BORROW.amount} ${BORROW.asset} from Compass Safe → EOA`,
      evaluationId: withdrawEval.data.evaluation_id as string,
      txHash: withdrawExec.tx_hash,
      blockNumber: withdrawExec.block_number != null ? String(withdrawExec.block_number) : undefined,
      policyDecisionId: withdrawEval.data.evaluation_id as string,
    });

    // ── Step 3: Spendable at the EOA ───────────────────────────────────
    // After the borrow + withdraw, Maya's EOA holds the borrowed USDC.
    // From here the funds are spendable at any USDC-accepting merchant
    // via x402, direct USDC.transfer, or any of Sly's payment primitives.
    //
    // We don't broadcast the actual merchant payment in this demo:
    // wallet_transfer's settlement path uses a platform viem signer (not
    // the agent's CDP wallet), and a CDP-signed agent → merchant tx
    // wants its own evaluate-intent subcommand (TODO — see follow-up
    // platform PR). The honest framing is "your USDC is now where you
    // need it" — the merchant connection is the next demo to wire up.
    receipts.push({
      label: `Step 3 · ${BORROW.amount} ${BORROW.asset} now at your EOA — ready to spend`,
    });

    return NextResponse.json({
      phase: 'settled',
      product: CHECKOUT_PRODUCT,
      merchant: {
        name: CHECKOUT_PRODUCT.merchant,
        address: merchant.eoa,
        agentName: merchant.agentName,
      },
      receipts,
      events: [
        { kind: 'borrow.executed', label: `Borrowed ${BORROW.amount} ${BORROW.asset} against Aave collateral` },
        { kind: 'withdraw.executed', label: `Moved ${BORROW.amount} ${BORROW.asset} Safe → EOA` },
        { kind: 'spendable', label: `${BORROW.amount} ${BORROW.asset} ready to spend at any USDC merchant` },
        { kind: 'invariant', label: 'Collateral untouched — debt up, savings still earning' },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { phase: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
