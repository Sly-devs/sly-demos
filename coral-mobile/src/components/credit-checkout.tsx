'use client';

import { useEffect, useState } from 'react';
import { ApprovalSheet } from './maya-flow';

type Phase =
  | 'idle'                 // agent message visible, no work in flight
  | 'requesting_approval'  // preflight in flight — request scope grant
  | 'awaiting_approval'    // approval sheet visible, waiting for tap
  | 'running'              // confirm in flight — three legs broadcasting
  | 'settled'              // done, receipts shown
  | 'error';

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
 * Pay-with-Aave-credit, framed as Maya's agent surfacing a spend.
 *
 * The agent opens the conversation ("found this for you · pay from your
 * Aave credit?"), the product is inline (not a hero), and her tap is the
 * consent. Server runs preflight → confirm. Each click flips the CTA to
 * a loading state so it's clear something is happening behind the scenes
 * (preflight takes ~3-5s while Sly issues the scope request).
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
    setPhase('requesting_approval');
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

  function reset() {
    setPhase('idle');
    setPending(null);
    setResponse(null);
    setActiveStep(null);
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
        From your DeFi agent
      </h2>

      {/* Agent message — chat-bubble style. The agent surfaces the
          spend, Maya taps to consent. */}
      <div className="mt-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral/15 text-[16px] ring-1 ring-coral/30">
          🏦
          <span
            className="absolute -mt-7 ml-6 h-2 w-2 rounded-full bg-mint ring-2 ring-canvas"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-[13px] font-semibold text-cloud">Maya's DeFi Agent</p>
            <span className="text-[10.5px] text-mute">just now</span>
          </div>

          {/* Agent bubble */}
          <div className="mt-2 rounded-[1.2rem] rounded-tl-[6px] bg-surface px-4 py-3 ring-1 ring-hairline">
            {phase === 'settled' ? (
              <p className="text-[13px] leading-relaxed text-cloud">
                Done — paid <span className="font-semibold">{product.merchant}</span> {product.amount} {product.asset} from your Aave credit line. Your dollar of collateral is{' '}
                <span className="font-semibold text-mint">still earning</span>. The bar above shows the debt I just took on for you.
              </p>
            ) : phase === 'error' ? (
              <p className="text-[13px] leading-relaxed text-cloud">
                That didn't go through — see the details below. Want me to try again?
              </p>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-cloud">
                  Found your weekly subscription. Want me to cover it with your{' '}
                  <span className="font-semibold text-coral">Aave credit line</span>?
                  Your $1 collateral keeps earning — I'll just take on a small loan against it.
                </p>
                <ProductPill product={product} />
              </>
            )}
          </div>

          {/* Step receipts (running / settled / error) */}
          {(phase === 'running' || phase === 'settled') && (
            <ol className="mt-3 space-y-2 text-[11.5px]">
              <StepLine
                k="borrow"
                activeStep={activeStep}
                phase={phase}
                receipt={response?.receipts?.[0]}
                label={`Borrow ${product.amount} ${product.asset} from Aave`}
              />
              <StepLine
                k="withdraw"
                activeStep={activeStep}
                phase={phase}
                receipt={response?.receipts?.[1]}
                label="Move funds Safe → your EOA"
              />
              <StepLine
                k="pay"
                activeStep={activeStep}
                phase={phase}
                receipt={response?.receipts?.[2]}
                label={`Pay ${product.merchant} ${product.amount} ${product.asset}`}
              />
            </ol>
          )}

          {phase === 'error' && response?.error && (
            <p className="mt-2 rounded-md bg-rose-500/10 px-3 py-2 text-[11px] leading-snug text-rose-300 ring-1 ring-rose-500/20">
              <span className="font-semibold">
                {response.step ? `${response.step}: ` : 'Checkout failed: '}
              </span>
              {response.error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={phase === 'settled' || phase === 'error' ? reset : start}
            disabled={
              phase === 'requesting_approval' || phase === 'awaiting_approval' || phase === 'running'
            }
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13.5px] font-semibold text-canvas transition-all ${
              phase === 'requesting_approval' || phase === 'awaiting_approval' || phase === 'running'
                ? 'bg-coral/60 cursor-wait'
                : phase === 'settled'
                  ? 'bg-mint hover:brightness-110'
                  : phase === 'error'
                    ? 'bg-coral/85 hover:brightness-110'
                    : 'bg-coral hover:brightness-110'
            }`}
          >
            {phase === 'idle' && (
              <>
                Yes — pay with Aave credit <Arrow />
              </>
            )}
            {phase === 'requesting_approval' && (
              <>
                <Spinner /> Asking Sly for permission…
              </>
            )}
            {phase === 'awaiting_approval' && (
              <>
                <Spinner /> Waiting for your tap
              </>
            )}
            {phase === 'running' && (
              <>
                <Spinner /> Settling on-chain
              </>
            )}
            {phase === 'settled' && (
              <>
                <Check /> Done · run another?
              </>
            )}
            {phase === 'error' && <>Try again</>}
          </button>
        </div>
      </div>

      {/* Face-ID-styled approval sheet — overlays the whole device
          frame; tapping Approve fires confirm(). */}
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

function ProductPill({
  product,
}: {
  product: { label: string; merchant: string; amount: string; asset: string };
}) {
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-canvas/40 px-3 py-2 ring-1 ring-white/[0.04]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral/15 text-[20px] ring-1 ring-coral/25">
        👟
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-cloud">{product.label}</p>
        <p className="text-[10.5px] text-mute">
          {product.merchant} · {product.amount} {product.asset} / week
        </p>
      </div>
    </div>
  );
}

function StepLine({
  k,
  activeStep,
  phase,
  receipt,
  label,
}: {
  k: StepKey;
  activeStep: StepKey | null;
  phase: Phase;
  receipt?: CheckoutReceipt;
  label: string;
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
        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8.5px] font-bold ${
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
        {receipt?.txHash && (
          <a
            href={`https://basescan.org/tx/${receipt.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] text-mint/80 hover:text-mint"
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
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12 5 5L20 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
