'use client';

import { useState } from 'react';
import { ProtocolTag, MoneyChip } from '@/components/ui';

interface Step {
  kind: string;
  protocol: string;
  label: string;
  detail?: string;
}
interface VerifiedAmt {
  /** Mira's verified NET ($82) — gross x402 credit − fee − tax. */
  miraSellerAccount: number | null;
  miraGrossIn: number | null;
  platformFeeAccount: number | null;
  taxAccount: number | null;
  completed?: boolean;
}
interface Result {
  status: string;
  error?: string;
  a2aTaskId?: string | null;
  x402TransferId?: string | null;
  x402Status?: string;
  split?: {
    gross: number;
    miraNet: number;
    platformFee: number;
    platformFeePct: number;
    tax: number;
    taxPct: number;
    feeTransferId: string;
    feeTransferStatus: string;
    taxTransferId: string;
    taxTransferStatus: string;
  };
  verified?: VerifiedAmt;
  steps?: Step[];
}

function amt(n: number | null | undefined) {
  return typeof n === 'number' ? `$${n.toFixed(2)}` : '—';
}

export function RunCheckout({
  gross,
  miraNet,
  fee,
  feePct,
  tax,
  taxPct,
}: {
  gross: number;
  miraNet: number;
  fee: number;
  feePct: number;
  tax: number;
  taxPct: number;
}) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>(
    'idle',
  );
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setState('running');
    setResult(null);
    try {
      const res = await fetch('/api/forum/checkout', { method: 'POST' });
      const json = (await res.json()) as Result;
      setResult(json);
      setState(json.status === 'completed' ? 'done' : 'error');
    } catch (err) {
      setResult({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      setState('error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl2 border border-line bg-panel p-7 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-mist">
            Hero transaction
          </span>
          <span className="font-display text-[20px] font-semibold text-ink">
            Quill buys “Invoice Reconciliation Run” from Mira
          </span>
          <span className="text-[13px] text-slate">
            Devon’s buyer agent, one $100 job, no invoice, no human
            approval. Real Sly A2A hire + x402 settlement + Forum split —
            idempotent, one real payment.
          </span>
        </div>
        <button
          onClick={run}
          disabled={state === 'running'}
          className="w-fit shrink-0 rounded-xl bg-ink px-6 py-3 text-[14px] font-semibold text-white shadow-lift transition hover:bg-indigodark disabled:opacity-50"
        >
          {state === 'running'
            ? 'Settling…'
            : state === 'done'
              ? 'Re-run (idempotent)'
              : `Pay $${gross.toFixed(2)} →`}
        </button>
      </div>

      {state === 'done' ? (
        <div className="rounded-xl2 border border-ok/30 bg-ok/5 p-6 text-[14px] leading-relaxed text-ink">
          <span className="font-display text-[16px] font-semibold text-ink">
            Done.
          </span>{' '}
          Mira keeps{' '}
          <span className="font-mono font-semibold text-ok">
            ${miraNet.toFixed(2)}
          </span>
          , Lume earns its{' '}
          <span className="font-mono font-semibold">${fee.toFixed(2)}</span>{' '}
          marketplace fee,{' '}
          <span className="font-mono font-semibold">${tax.toFixed(2)}</span>{' '}
          tax is withheld — split and settled cross-tenant in one move. No
          invoice was sent. No human approved it. The ledger already
          reconciles, and Mira’s reputation ticks up exactly like a human
          freelancer’s.
        </div>
      ) : null}

      {/* Projected / verified split waterfall */}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="rounded-xl2 border border-line bg-panel p-7 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <span className="font-display text-[16px] font-semibold text-ink">
                Split-engine waterfall
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                  state === 'done'
                    ? 'bg-ok/10 text-ok'
                    : state === 'error'
                      ? 'bg-gold/15 text-gold'
                      : 'bg-wash text-indigodark'
                }`}
              >
                {state === 'done'
                  ? 'verified on-ledger'
                  : state === 'running'
                    ? 'settling'
                    : 'projected'}
              </span>
            </div>

            <Row
              label="Gross — buyer pays"
              tone="gross"
              amount={gross}
              note="x402 settlement · Quill → Mira"
            />
            <Bar />
            <Row
              label={`Lume platform fee · ${feePct}%`}
              tone="fee"
              amount={-fee}
              note={
                result?.split
                  ? `transfer ${result.split.feeTransferId.slice(0, 12)}… · ${result.split.feeTransferStatus}`
                  : 'Mira account → Lume fee account'
              }
            />
            <Row
              label={`Tax withholding · ${taxPct}%`}
              tone="tax"
              amount={-tax}
              note={
                result?.split
                  ? `transfer ${result.split.taxTransferId.slice(0, 12)}… · ${result.split.taxTransferStatus}`
                  : 'Mira account → tax account'
              }
            />
            <Bar />
            <Row
              label="Mira net payout"
              tone="net"
              amount={miraNet}
              note="settles in Mira’s wallet — same pool as human sellers"
              emphatic
            />
          </div>
        </div>

        {/* Verified balances read back from Sly */}
        <div className="lg:col-span-2">
          <div className="h-full rounded-xl2 border border-line bg-panel p-7 shadow-card">
            <span className="font-display text-[16px] font-semibold text-ink">
              Verified balances
            </span>
            <p className="mt-1 text-[12px] text-mist">
              Read back from the Sly API after settlement (Lume tenant).
            </p>
            <div className="mt-5 flex flex-col divide-y divide-line">
              {[
                {
                  k: 'Gross settled to Mira',
                  v: result?.verified?.miraGrossIn,
                },
                {
                  k: 'Mira net (after split)',
                  v: result?.verified?.miraSellerAccount,
                },
                {
                  k: 'Lume platform-fee account',
                  v: result?.verified?.platformFeeAccount,
                },
                { k: 'Tax-withholding account', v: result?.verified?.taxAccount },
              ].map((r) => (
                <div
                  key={r.k}
                  className="flex items-center justify-between py-3"
                >
                  <span className="text-[12px] text-slate">{r.k}</span>
                  <span className="font-mono text-[14px] font-semibold tabular text-ink">
                    {state === 'done' || state === 'error' ? amt(r.v) : '—'}
                  </span>
                </div>
              ))}
            </div>
            {result?.x402Status ? (
              <div className="mt-4 rounded-lg bg-canvas/60 px-3 py-2 text-[11px] text-slate">
                x402 settlement:{' '}
                <span className="font-semibold text-ink">
                  {result.x402Status}
                </span>
                {result.x402TransferId
                  ? ` · transfer ${result.x402TransferId.slice(0, 14)}…`
                  : ''}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Protocol event trace */}
      {result?.steps?.length ? (
        <div className="rounded-xl2 border border-line bg-panel p-7 shadow-card">
          <span className="font-display text-[16px] font-semibold text-ink">
            Protocol trace
          </span>
          <ol className="mt-5 flex flex-col gap-0">
            {result.steps.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-3 border-l-2 border-line py-3 pl-5 last:border-transparent"
                style={{
                  borderColor:
                    s.kind === 'error' ? '#b58a2b' : undefined,
                }}
              >
                <span className="-ml-[1.7rem] mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-panel">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      s.kind === 'error' ? 'bg-gold' : 'bg-ok'
                    }`}
                  />
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <ProtocolTag p={s.protocol} />
                    <span className="text-[13px] font-medium text-ink">
                      {s.label}
                    </span>
                  </div>
                  {s.detail ? (
                    <span className="font-mono text-[11px] text-mist">
                      {s.detail}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {result?.error && state === 'error' ? (
        <div className="rounded-xl2 border border-gold/30 bg-gold/5 p-5 text-[13px] text-ink">
          <span className="font-semibold">Flow reported an error:</span>{' '}
          <span className="font-mono text-[12px]">{result.error}</span>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  amount,
  tone,
  note,
  emphatic,
}: {
  label: string;
  amount: number;
  tone: 'gross' | 'fee' | 'tax' | 'net';
  note?: string;
  emphatic?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span
          className={`text-[14px] ${emphatic ? 'font-display text-[18px] font-semibold text-ink' : 'font-medium text-slate'}`}
        >
          {label}
        </span>
        {note ? (
          <span className="font-mono text-[11px] text-mist">{note}</span>
        ) : null}
      </div>
      <MoneyChip amount={Math.abs(amount)} tone={tone} />
    </div>
  );
}

function Bar() {
  return <div className="my-1 h-px w-full bg-line" />;
}
