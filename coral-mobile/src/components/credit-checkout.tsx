'use client';

import { useEffect, useState } from 'react';

type Phase = 'idle' | 'running' | 'settled' | 'error';
type StepKey = 'borrow' | 'withdraw' | 'pay';

interface CheckoutReceipt {
  label: string;
  evaluationId?: string;
  txHash?: string;
  blockNumber?: string;
  policyDecisionId?: string;
}

interface CheckoutResponse {
  phase: 'settled' | 'error';
  receipts?: CheckoutReceipt[];
  events?: { kind: string; label: string }[];
  product?: { sku: string; label: string; merchant: string; amount: string; asset: string };
  merchant?: { name: string; address: string; agentName: string };
  error?: string;
  step?: string;
  details?: unknown;
}

/**
 * "Pay with Aave credit" — the Coral × Compass spending narrative.
 *
 * One click → borrow against Maya's Aave collateral → withdraw to her
 * EOA → pay the merchant. Three real on-chain txes on Base mainnet,
 * each Sly-gated. Refreshes the savings card via a window-level event
 * once settled so debt + available credit tick up immediately.
 */
export function CreditCheckoutCard() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeStep, setActiveStep] = useState<StepKey | null>(null);
  const [response, setResponse] = useState<CheckoutResponse | null>(null);

  // Walk through the steps optimistically while the server orchestrates —
  // the server response is the source of truth, but the eye-candy is real
  // (each step is sequential, each takes ~5-15s on Base mainnet).
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
    setPhase('running');
    setResponse(null);
    try {
      const res = await fetch('/api/maya/credit-checkout', { method: 'POST' });
      const body = (await res.json()) as CheckoutResponse;
      if (body.phase === 'settled') {
        setPhase('settled');
        setResponse(body);
        // Tell the savings card to refetch.
        window.dispatchEvent(new CustomEvent('maya:position-refresh'));
      } else {
        setPhase('error');
        setResponse(body);
      }
    } catch (e) {
      setPhase('error');
      setResponse({ phase: 'error', error: e instanceof Error ? e.message : String(e) });
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
        Compass Safe, and pays the merchant — all in one click. Debt ticks up,
        savings stay supplied.
      </p>

      <div className="mt-3 rounded-[1.6rem] bg-gradient-to-b from-surface to-surface/60 p-4 ring-1 ring-hairline">
        {/* product card */}
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral/15 text-[18px] ring-1 ring-coral/30">
            👟
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-cloud">{product.label}</p>
            <p className="mt-0.5 text-[12px] text-mute">{product.merchant} · {product.amount} {product.asset} / week</p>
          </div>
        </div>

        {/* steps */}
        {phase !== 'idle' && (
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
              label={`${product.amount} ${product.asset} ready to spend at your EOA`}
              hint="any USDC merchant · x402 · direct USDC.transfer"
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
              Settled · 2 bilateral receipts · collateral untouched.
            </p>
            <p className="mt-1 text-mute">
              Aave debt up by {product.amount} {product.asset} · {product.amount} {product.asset} now sitting at your EOA, ready for any USDC-accepting merchant.
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={start}
          disabled={phase === 'running'}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold text-canvas transition-all ${
            phase === 'running'
              ? 'bg-coral/60 cursor-wait'
              : phase === 'settled'
                ? 'bg-mint hover:brightness-110'
                : 'bg-coral hover:brightness-110'
          }`}
        >
          {phase === 'idle' && <>Pay with my Aave credit <Arrow /></>}
          {phase === 'running' && <>Settling on-chain <Spinner /></>}
          {phase === 'settled' && <>Run again <Replay /></>}
          {phase === 'error' && <>Retry</>}
        </button>
      </div>
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
