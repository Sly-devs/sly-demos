import { NextResponse } from 'next/server';
import {
  BORROW,
  borrowIntent,
  borrowUnsignedTx,
  mayaEnv,
  slyPost,
  slyPostOrThrow,
  type ExecuteResult,
  type PolicyApprove,
  type ScopeDecideResult,
} from '@/lib/maya-flow';

/**
 * Steps 3–6 of the proven Compass-credit handshake, run when Maya taps
 * Approve. THIS BROADCASTS A REAL TRANSACTION on Base mainnet:
 *   3. tenant/owner approves the pending scope request → { status, grant_id }.
 *   4. agent re-evaluates `credit:borrow` → now { decision:'approve', evaluation_id }.
 *   5. Compass CLI builds the unsigned borrow tx → { to, data, value, gas }.
 *   6. agent executes the intent → signs via CDP + broadcasts → { tx_hash, block_number }.
 */
export async function POST(req: Request) {
  const env = mayaEnv();
  if ('error' in env) {
    return NextResponse.json({ phase: 'error', error: env.error }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { requestId?: string };
  if (!body.requestId) {
    return NextResponse.json(
      { phase: 'error', error: 'requestId is required' },
      { status: 400 },
    );
  }

  try {
    // Step 3 — owner approves the pending scope request.
    const decided = await slyPostOrThrow<ScopeDecideResult>(
      env,
      `/v1/organization/scopes/${body.requestId}/decide`,
      { token: env.tenantKey, body: { decision: 'approve' } },
    );

    // Step 4 — re-evaluate; the grant now exists so Sly approves.
    const reeval = await slyPost<PolicyApprove>(env, '/v1/policy/evaluate-intent', {
      token: env.agentToken,
      body: borrowIntent(env),
    });
    if (!reeval.ok || reeval.data.decision !== 'approve' || !reeval.data.evaluation_id) {
      return NextResponse.json(
        {
          phase: 'error',
          error: reeval.ok
            ? `re-evaluation did not approve: ${JSON.stringify(reeval.data)}`
            : `re-evaluation failed → ${reeval.status}`,
        },
        { status: 502 },
      );
    }
    const evaluationId = reeval.data.evaluation_id;

    // Step 5 — Compass builds the unsigned borrow transaction.
    const tx = borrowUnsignedTx(env);

    // Step 6 — execute: Sly signs via CDP and broadcasts on Base mainnet.
    const executed = await slyPostOrThrow<ExecuteResult>(
      env,
      '/v1/policy/execute-intent',
      {
        token: env.agentToken,
        body: {
          agent_id: env.agentId,
          evaluation_id: evaluationId,
          chain: BORROW.chain,
          unsigned_transaction: {
            to: tx.to,
            data: tx.data,
            value: tx.value || '0x0',
            gas: tx.gas || '0x7a120',
          },
        },
      },
    );

    return NextResponse.json({
      phase: 'settled',
      txHash: executed.tx_hash,
      blockNumber: executed.block_number,
      asset: BORROW.asset,
      amount: BORROW.amount,
      grantId: decided.grant_id,
      events: [
        {
          kind: 'scope.approved',
          label: 'compass:credit approved by you',
        },
        {
          kind: 'borrow.executed',
          label: 'Borrow signed via CDP + broadcast on Base',
        },
        {
          kind: 'receipt',
          label: 'Bilateral receipt: decision ⇄ tx',
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { phase: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
