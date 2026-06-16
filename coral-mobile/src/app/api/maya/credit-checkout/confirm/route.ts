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
  type ScopeDecideResult,
} from '@/lib/maya-flow';

/**
 * Credit-checkout confirm (steps 3-N — THIS BROADCASTS):
 *   1. Tenant key decides the pending treasury request → grant issued.
 *   2. Borrow against Aave  (evaluate-intent + execute-intent, CDP-signed).
 *   3. Withdraw Safe → EOA  (evaluate-intent + execute-intent, CDP-signed).
 *   4. Pay merchant         (wallet_transfer; src=external+coinbase
 *      routes through CDP signing — sly#172).
 *
 * Three bilateral receipts back, savings card auto-refreshes.
 */
export async function POST(req: Request) {
  const env = await mayaEnv();
  if ('error' in env) {
    return NextResponse.json({ phase: 'error', error: env.error }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { requestId?: string };
  if (!body.requestId) {
    return NextResponse.json({ phase: 'error', error: 'requestId is required' }, { status: 400 });
  }

  try {
    const merchant = await fetchMerchantEoa(env);
    if (!merchant) {
      return NextResponse.json(
        { phase: 'error', error: 'No merchant EOA available on this tenant.' },
        { status: 502 },
      );
    }
    const sourceWalletId = await fetchAgentExternalWalletId(env);
    if (!sourceWalletId) {
      return NextResponse.json(
        { phase: 'error', error: "Could not resolve Maya's external wallet id on Sly." },
        { status: 502 },
      );
    }

    const receipts: CheckoutStepReceipt[] = [];

    // ── Step 1: Borrow ────────────────────────────────────────────────
    // We DON'T decide the treasury grant yet. The borrow + withdraw
    // legs both require only tenant_write (which the agent's standing
    // compass:credit grants cover via per-action scope). Issuing the
    // treasury grant up-front would let the auth middleware pick it up
    // as the highest-tier elevation and CONSUME it on the first
    // requireScope check (the borrow leg) — eating Maya's approval
    // before it reaches the merchant payment. Decide it just-in-time
    // before wallet_transfer (step 3).
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

    // ── Step 2: Withdraw Safe → EOA ───────────────────────────────────
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

    // ── Step 2b: NOW decide the pending treasury request ─────────────
    // Just-in-time, so the elevated grant doesn't get consumed by the
    // borrow/withdraw legs above. Maya already approved it in the
    // preflight; this is the server-side decide that flips it to active.
    await slyPostOrThrow<ScopeDecideResult>(
      env,
      `/v1/organization/scopes/${body.requestId}/decide`,
      { token: env.tenantKey, body: { decision: 'approve' } },
    );

    // ── Step 3: Pay merchant ──────────────────────────────────────────
    // wallet_transfer with src=external+coinbase routes through CDP
    // signing (sly#172). Agent token carries the one_shot treasury
    // grant we just decided, so the scope gate passes.
    const payRes = await fetch(`${env.baseUrl}/v1/wallets/${sourceWalletId}/transfer`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.agentToken}`,
      },
      body: JSON.stringify({
        destinationAddress: merchant.eoa,
        amount: Number(CHECKOUT_PRODUCT.amount),
        currency: 'USDC',
        reference: `${CHECKOUT_PRODUCT.merchant} · ${CHECKOUT_PRODUCT.label}`,
      }),
    });
    const payRaw = await payRes.json().catch(() => ({}));
    if (!payRes.ok) {
      return NextResponse.json(
        {
          phase: 'error',
          step: 'merchant.pay',
          error: (payRaw as { error?: string })?.error ?? `wallet_transfer → ${payRes.status}`,
          details: payRaw,
          receipts,
        },
        { status: 502 },
      );
    }
    const payBody =
      payRaw && typeof payRaw === 'object' && 'data' in payRaw && (payRaw as { data?: unknown }).data
        ? (payRaw as { data: Record<string, unknown> }).data
        : (payRaw as Record<string, unknown>);
    const payTxHash =
      ((payBody as { onChainTxHash?: string }).onChainTxHash) ??
      ((payBody as { tx_hash?: string }).tx_hash) ??
      ((payBody as { transfer?: { tx_hash?: string } }).transfer?.tx_hash);
    receipts.push({
      label: `Step 3 · Paid ${CHECKOUT_PRODUCT.merchant} ${CHECKOUT_PRODUCT.amount} ${CHECKOUT_PRODUCT.asset}`,
      txHash: payTxHash,
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
        { kind: 'scope.approved', label: 'treasury approved by you · one_shot · consumed' },
        { kind: 'borrow.executed', label: `Borrowed ${BORROW.amount} ${BORROW.asset} against Aave collateral` },
        { kind: 'withdraw.executed', label: `Moved ${BORROW.amount} ${BORROW.asset} Safe → EOA` },
        { kind: 'merchant.paid', label: `Paid ${CHECKOUT_PRODUCT.merchant} ${CHECKOUT_PRODUCT.amount} USDC` },
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
