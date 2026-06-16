'use client';

import { useEffect, useState } from 'react';
import { ApprovalSheet } from './maya-flow';

type Phase = 'idle' | 'awaiting_approval' | 'running' | 'settled' | 'error';
type StepKey = 'borrow' | 'withdraw' | 'pay';

interface CheckoutReceipt {
  label: string;
  evaluationId?: string;
  txHash?: string;
  blockNumber?: string;
  policyDecisionId?: string;
}

interface PreflightResponse {
  phase: 'awaiting_approval' | 'error';
  requestId?: string;
  scope?: string;
  amount?: string;
  asset?: string;
  merchant?: string;
  merchantAddress?: string;
  purpose?: string;
  error?: string;
}

interface ConfirmResponse {
  phase: 'settled' | 'error';
  receipts?: CheckoutReceipt[];
  events?: { kind: string; label: string }[];
  product?: { sku: string; label: string; merchant: string; amount: string; asset: string };
  merchant?: { name: string; address: string; agentName: string };
  error?: string;
  step?: string;
}

/**
 * Pay-with-Aave-credit card.
 *
 * Two-stage UX matches the existing borrow flow:
 *   1. Click "Pay with my Aave credit" → server requests a one_shot
 *      treasury grant → Face-ID approval sheet rises from the bottom.
 *   2. Approve → server runs borrow + withdraw + merchant payment.
 *      Three real on-chain txes on Base mainnet. Refreshes the savings
 *      card via a window event when settled.
 */
export function CreditCheckoutCard() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pending, setPending] = useState<PreflightResponse | null>(null);
  const [activeStep, setActiveStep] = useState<StepKey | null>(null);
  const [response, setResponse] = useState<ConfirmResponse | null>(null);

  useEffect(() => {
    if (phase !== 'running') return;
    setActiveStep('borrow');
    const t1 = setTimeout(() => setActiveStep('withdraw'), 14_000);
    const t2 = setTimeout(() => setActiveStep('pay'), 28_000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  async function start() {
    setResponse(null);
    setPending(null);
    try {
      const res = await fetch('/api/maya/credit-checkout', { method: 'POST' });
      const body = (await res.json()) as PreflightResponse;
      if (body.phase === 'awaiting_approval' && body.requestId) {
        setPending(body);
        setPhase('awaiting_approval');
      } else {
        setResponse({ phase: 'error', error: body.error ?? 'preflight failed' });
        setPhase('error');
      }
    } catch (e) {
      setResponse({ phase: 'error', error: e instanceof Error ? e.message : String(e) });
      setPhase('error');
    }
  }

  async function confirm() {
    if (!pending?.requestId) return;
    setPhase('running');
    try {
      const res = await fetch('/api/maya/credit-checkout/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: pending.requestId }),
      });
      const body = (await res.json()) as ConfirmResponse;
      if (body.phase === 'settled') {
        setPhase('settled');
        setResponse(body);
        window.dispatchEvent(new CustomEvent('maya:position-refresh'));
      } else {
        setResponse(body);
        setPhase('error');
      }
    } catch (e) {
      setResponse({ phase: 'error', error: e instanceof Error ? e.message : String(e) });
      setPhase('error');
    }
  }

  const product = response?.product ?? {
    sku: 'trail-runner-weekly',
    label: 'Trail Runner Subscription',
    merchant: 'TrailCo',
    amount: '0.10',
    asset: 'USDC',
  };

  return (
    <section className="mt-6 px-5">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-mute">
        Spend without breaking savings
      </h2>
      <p className="mt-1 text-[12px] leading-snug text-mute/90">
        Your agent borrows against your Aave collateral, routes it through your
        Compass Safe, and pays the merchant — all gated by a one-shot{' '}
        <span className="font-mono text-cloud/80">treasury</span> grant from you.
      </p>

      <div className="mt-3 rounded-[1.6rem] bg-gradient-to-b from-surface to-surface/60 p-4 ring-1 ring-hairline">
        {/* product card — shoe is the focal visual now */}
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-coral/25 via-coral/15 to-coral/5 text-[44px] ring-1 ring-coral/30 shadow-[0_8px_28px_-12px_rgba(255,114,90,0.45)]">
            👟
          </div>
          <div className="min-w-0 flex-1 self-center">
            <p className="truncate text-[16px] font-semibold text-cloud">{product.label}</p>
            <p className="mt-0.5 text-[12px] text-mute">{product.merchant}</p>
            <p className="mt-1 text-[18px] font-semibold tracking-tight text-cloud tabnums">
              {product.amount} <span className="text-[12px] font-medium text-mute">{product.asset} / week</span>
            </p>
          </div>
        </div>

        {/* steps */}
        {(phase === 'running' || phase === 'settled') && (
          <ol className="mt-4 space-y-2 text-[12px]">
            <StepLine
              k="borrow"
              activeStep={activeStep}
              phase={phase}
              receipt={response?.receipts?.[0]}
              label={`Borrow ${product.amount} ${product.asset} against Aave`}
              hint="evaluate-intent · credit:borrow · execute via CDP"
            />
            <StepLine
              k="withdraw"
              activeStep={activeStep}
              phase={phase}
              receipt={response?.receipts?.[1]}
              label="Move funds Compass Safe → your EOA"
              hint="evaluate-intent · credit:withdraw · execute via CDP"
            />
            <StepLine
              k="pay"
              activeStep={activeStep}
              phase={phase}
              receipt={response?.receipts?.[2]}
              label={`Pay ${product.merchant} ${product.amount} ${product.asset}`}
              hint="wallet_transfer · treasury one-shot · CDP-signed USDC.transfer"
            />
          </ol>
        )}

        {/* error pane */}
        {phase === 'error' && response?.error && (
          <p className="mt-3 rounded-md bg-rose-500/10 px-3 py-2 text-[11px] leading-snug text-rose-300 ring-1 ring-rose-500/20">
            <span className="font-semibold">
              {response.step ? `${response.step}: ` : 'Checkout failed: '}
            </span>
            {response.error}
          </p>
        )}

        {/* settled summary */}
        {phase === 'settled' && response?.receipts && (
          <div className="mt-3 rounded-md bg-mint/8 px-3 py-2.5 text-[11px] leading-snug text-mint/95 ring-1 ring-mint/20">
            <p className="font-semibold tracking-tight">
              Settled · 3 bilateral receipts · collateral untouched.
            </p>
            <p className="mt-1 text-mute">
              Aave debt up by {product.amount} {product.asset} · {product.merchant} paid{' '}
              {response.merchant?.address ? (
                <span className="font-mono text-cloud/80">
                  {response.merchant.address.slice(0, 6)}…{response.merchant.address.slice(-4)}
                </span>
              ) : null}
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={start}
          disabled={phase === 'running' || phase === 'awaiting_approval'}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold text-canvas transition-all ${
            phase === 'running' || phase === 'awaiting_approval'
              ? 'bg-coral/60 cursor-wait'
              : phase === 'settled'
                ? 'bg-mint hover:brightness-110'
                : 'bg-coral hover:brightness-110'
          }`}
        >
          {phase === 'idle' && <>Pay with my Aave credit <Arrow /></>}
          {phase === 'awaiting_approval' && <>Awaiting your approval <Spinner /></>}
          {phase === 'running' && <>Settling on-chain <Spinner /></>}
          {phase === 'settled' && <>Run again <Replay /></>}
          {phase === 'error' && <>Retry</>}
        </button>
      </div>

      {/* Face-ID-styled approval sheet (reuses the same component as the
          borrow flow). Renders fixed-positioned so it overlays the whole
          viewport; closes on approve. */}
      {phase === 'awaiting_approval' && pending && pending.requestId && (
        <ApprovalSheet
          pending={{
            phase: 'awaiting_approval',
            requestId: pending.requestId,
            scope: pending.scope ?? 'treasury',
            amount: pending.amount,
            asset: pending.asset,
            purpose: pending.purpose,
          }}
          onApprove={confirm}
          blurb={
            <>
              pay{' '}
              <span className="font-medium text-cloud/80">{pending.merchant ?? 'merchant'}</span>{' '}
              from your Aave credit line
            </>
          }
          ctaLabel="Approve & pay"
        />
      )}
    </section>
  );
}

function StepLine({
  k,
  activeStep,
  phase,
  receipt,
  label,
  hint,
}: {
  k: StepKey;
  activeStep: StepKey | null;
  phase: Phase;
  receipt?: CheckoutReceipt;
  label: string;
  hint: string;
}) {
  const order: StepKey[] = ['borrow', 'withdraw', 'pay'];
  const idx = order.indexOf(k);
  const activeIdx = activeStep ? order.indexOf(activeStep) : -1;
  const done = Boolean(receipt?.txHash) || (phase === 'settled' && idx <= activeIdx);
  const current = phase === 'running' && idx === activeIdx && !done;
  const pending = !done && !current;

  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
          done
            ? 'bg-mint text-canvas'
            : current
              ? 'bg-coral text-canvas animate-pulse'
              : 'bg-white/[0.06] text-mute ring-1 ring-hairline'
        }`}
      >
        {done ? '✓' : idx + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className={pending ? 'text-mute' : 'text-cloud'}>{label}</p>
        <p className="text-[10.5px] text-mute/80">{hint}</p>
        {receipt?.txHash && (
          <a
            href={`https://basescan.org/tx/${receipt.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-block font-mono text-[10.5px] text-mint/80 hover:text-mint"
          >
            tx {receipt.txHash.slice(0, 10)}…{receipt.txHash.slice(-4)} ↗
          </a>
        )}
      </div>
    </li>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Replay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4v6h6M20 20v-6h-6M5 10a8 8 0 0 1 14-3M19 14a8 8 0 0 1-14 3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
