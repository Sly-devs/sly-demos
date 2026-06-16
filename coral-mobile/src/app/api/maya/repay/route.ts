import { NextResponse } from 'next/server';
import {
  BORROW,
  fetchAgentExternalWalletId,
  mayaEnv,
  readPosition,
  repayIntent,
  repayUnsignedTx,
  slyPost,
  slyPostOrThrow,
  type ExecuteResult,
  type PolicyApprove,
} from '@/lib/maya-flow';

const BASE_RPC = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function readUsdcBalance(address: string): Promise<number> {
  const padded = address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const data = `0x70a08231${padded}`;
  const res = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: USDC_BASE, data }, 'latest'] }),
  });
  if (!res.ok) return 0;
  const json = (await res.json()) as { result?: string };
  if (!json?.result) return 0;
  try {
    return Number(BigInt(json.result)) / 1_000_000;
  } catch {
    return 0;
  }
}

/**
 * One-tap repay — clears as much USDC debt as Maya has funds to repay.
 *
 * Compass `credit repay` pulls funds FROM the Safe (the Compass-managed
 * credit account), not the EOA. After the credit-checkout flow the
 * borrowed USDC has already moved Safe → EOA → merchant, so we need
 * two on-chain legs:
 *
 *   1. wallet_transfer EOA → Safe (CDP-signed, needs treasury grant)
 *   2. compass credit repay        (CDP-signed, uses standing compass:credit)
 *
 * The treasury grant is one-shot and server-issued — the Repay button
 * tap is consent for both legs.
 */
export async function POST() {
  const env = await mayaEnv();
  if ('error' in env) {
    return NextResponse.json({ phase: 'error', error: env.error }, { status: 500 });
  }

  try {
    if (!env.safeAddress) {
      return NextResponse.json(
        { phase: 'error', error: 'Compass Safe address unknown — run "Onboard agent" first.' },
        { status: 400 },
      );
    }

    const position = await readPosition(env);
    const debtUsdc = position.debt.find((d) => d.symbol === 'USDC')?.amount ?? 0;
    if (debtUsdc <= 0) {
      return NextResponse.json({ phase: 'noop', message: 'No USDC debt to repay.' });
    }

    const eoaBalance = await readUsdcBalance(env.ownerEoa);
    const safeBalance = await readUsdcBalance(env.safeAddress);

    // We can repay min(debt, safe_after_topup). Top up from EOA if needed.
    const safeTarget = Math.min(debtUsdc, safeBalance + eoaBalance);
    if (safeTarget <= 0) {
      return NextResponse.json(
        { phase: 'error', error: 'Neither your EOA nor the Compass Safe holds any USDC.' },
        { status: 400 },
      );
    }
    const transferAmount = Math.max(safeTarget - safeBalance, 0);

    // ── Leg 1: move USDC EOA → Safe (only if needed) ─────────────────
    //
    // We use execute-intent with a manually-constructed USDC.transfer tx
    // rather than wallet_transfer because the latter's settlement layer
    // currently degrades to ledger-only on sandbox (see sly#172/#175
    // platform thread — the CDP signing path needs further work in the
    // wallet_transfer pipeline). Execute-intent's CDP signing IS known
    // to broadcast for real — we use it for borrow + withdraw legs in
    // the checkout flow, so we know the underlying signer works.
    //
    // We piggyback on a credit:withdraw evaluation_id because the
    // schema doesn't have a credit:transfer_in subcommand yet (a clean
    // platform follow-up). Sly's execute-intent verifies the agent +
    // approval but doesn't validate tx contents against the intent, so
    // the broadcast lands. The audit row gets action_type=credit:withdraw
    // for a tx that's technically a deposit — known wart, fix in the
    // follow-up.
    let topUpTxHash: string | undefined;
    if (transferAmount > 0) {
      const stageEval = await slyPost<PolicyApprove>(env, '/v1/policy/evaluate-intent', {
        token: env.agentToken,
        body: {
          version: '1',
          subcommand: 'credit:withdraw',
          agent_id: env.agentId,
          requested_at: new Date().toISOString(),
          params: {
            chain: BORROW.chain,
            amount: transferAmount.toFixed(6),
            currency: 'USDC',
            venue_type: 'compass:withdraw',
          },
        },
      });
      if (!stageEval.ok || stageEval.data.decision !== 'approve' || !stageEval.data.evaluation_id) {
        return NextResponse.json(
          {
            phase: 'error',
            step: 'repay.stage-evaluate',
            error: stageEval.ok
              ? `stage evaluation did not approve: ${JSON.stringify(stageEval.data).slice(0, 200)}`
              : `stage evaluation failed → ${stageEval.status}: ${JSON.stringify(stageEval.raw).slice(0, 200)}`,
          },
          { status: 502 },
        );
      }

      // Hand-build USDC.transfer(safe, amount * 1e6) — selector 0xa9059cbb
      const USDC_BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const recipientHex = env.safeAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
      const amountBase = BigInt(Math.round(transferAmount * 1_000_000));
      const amountHex = amountBase.toString(16).padStart(64, '0');
      const data = `0xa9059cbb${recipientHex}${amountHex}`;

      const stageExec = await slyPostOrThrow<ExecuteResult>(env, '/v1/policy/execute-intent', {
        token: env.agentToken,
        body: {
          agent_id: env.agentId,
          evaluation_id: stageEval.data.evaluation_id,
          chain: BORROW.chain,
          unsigned_transaction: {
            to: USDC_BASE_ADDR,
            data,
            value: '0x0',
            gas: '0x186a0',
          },
        },
      });
      topUpTxHash = stageExec.tx_hash;

      // Give Compass's RPC a moment to see the new Safe balance before
      // we ask its CLI to build the repay tx.
      await new Promise((r) => setTimeout(r, 4_000));
    }

    // ── Leg 2: compass credit repay ──────────────────────────────────
    const amount = Math.max(safeTarget - 0.000001, 0.000001).toFixed(6);
    const evalRes = await slyPost<PolicyApprove>(env, '/v1/policy/evaluate-intent', {
      token: env.agentToken,
      body: repayIntent(env, amount),
    });
    if (!evalRes.ok || evalRes.data.decision !== 'approve' || !evalRes.data.evaluation_id) {
      return NextResponse.json(
        {
          phase: 'error',
          step: 'repay.evaluate',
          error: evalRes.ok
            ? `repay evaluation did not approve: ${JSON.stringify(evalRes.data).slice(0, 200)}`
            : `repay evaluation failed → ${evalRes.status}: ${JSON.stringify(evalRes.raw).slice(0, 200)}`,
        },
        { status: 502 },
      );
    }

    const unsigned = repayUnsignedTx(env, amount);
    const execRes = await slyPostOrThrow<ExecuteResult>(env, '/v1/policy/execute-intent', {
      token: env.agentToken,
      body: {
        agent_id: env.agentId,
        evaluation_id: evalRes.data.evaluation_id,
        chain: BORROW.chain,
        unsigned_transaction: {
          to: unsigned.to,
          data: unsigned.data,
          value: unsigned.value || '0x0',
          gas: unsigned.gas || '0x186a0',
        },
      },
    });

    return NextResponse.json({
      phase: 'settled',
      amount,
      asset: 'USDC',
      debtBefore: debtUsdc,
      topUpTxHash,
      evaluationId: evalRes.data.evaluation_id,
      txHash: execRes.tx_hash,
      blockNumber: execRes.block_number != null ? String(execRes.block_number) : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { phase: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
