'use client';

import { useCallback, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Protocol = 'ACP' | 'AP2' | 'UCP' | 'x402' | 'A2A' | 'MPP';

interface BrokerEvent {
  kind: string;
  label: string;
  protocol: Protocol | null;
  at: string;
}

interface PaymentMethod {
  label: string;
  brand?: string;
  last4?: string;
  type?: string;
  handler?: string;
}

interface ProductInfo {
  name: string;
  description: string;
  price: number;
  currency: string;
  image: string;
  merchant: string;
}

interface PrepResult {
  status: string;
  checkoutId: string;
  requestId: string;
  product: ProductInfo;
  paymentMethod: PaymentMethod;
  events?: BrokerEvent[];
  error?: string;
}

interface RunResult {
  status: string;
  orderId?: string | null;
  checkoutId?: string;
  totalAmount?: number;
  currency?: string;
  paymentMethod?: PaymentMethod;
  events?: BrokerEvent[];
  error?: string;
}

type Phase =
  | 'idle'
  | 'preparing'
  | 'awaiting_approval'
  | 'buying'
  | 'done'
  | 'error';

interface TimelineStep {
  id: string;
  protocol: Protocol;
  title: string;
  fromKinds?: string[];
  syntheticDetail?: string;
}

const TIMELINE: TimelineStep[] = [
  {
    id: 'verify',
    protocol: 'A2A',
    title: 'Agent identity verified',
    syntheticDetail:
      'Claude Shopping Agent — KYA Tier 2 (Verified). Cross-ecosystem handshake accepted by Outpost Outdoors.',
  },
  {
    id: 'policy',
    protocol: 'AP2',
    title: 'Spend policy evaluated',
    syntheticDetail:
      'AP2 mandate $150 ceiling · order $135.00 · within limit. Per-tx, daily and monthly caps clear.',
  },
  {
    id: 'checkout-opened',
    protocol: 'UCP',
    title: 'UCP checkout opened',
    fromKinds: ['checkout.created'],
  },
  {
    id: 'scope-requested',
    protocol: 'AP2',
    title: 'Approval requested',
    fromKinds: ['scope.requested'],
  },
  {
    id: 'scope-approved',
    protocol: 'AP2',
    title: 'You approved in the Claude widget',
    fromKinds: ['scope.approved'],
  },
  {
    id: 'checkout-completed',
    protocol: 'UCP',
    title: 'UCP checkout completed',
    fromKinds: ['checkout.completed'],
  },
  {
    id: 'settlement',
    protocol: 'UCP',
    title: 'Settled to tokenized card',
    fromKinds: ['settlement.completed', 'settlement.pending'],
  },
];

/** Steps revealed during phase 1 (prepare); the rest unlock after Buy. */
const PREPARE_STEPS = 4;
const STAGGER_MS = 950;

const PROTOCOL_STYLES: Record<Protocol, { ring: string; text: string }> = {
  ACP: { ring: 'border-span-acp/40 bg-span-acp/10', text: 'text-span-acp' },
  AP2: { ring: 'border-span-ap2/40 bg-span-ap2/10', text: 'text-span-ap2' },
  UCP: { ring: 'border-span-ucp/40 bg-span-ucp/10', text: 'text-span-ucp' },
  MPP: { ring: 'border-span-mpp/40 bg-span-mpp/10', text: 'text-span-mpp' },
  A2A: { ring: 'border-span-a2a/40 bg-span-a2a/10', text: 'text-span-a2a' },
  x402: { ring: 'border-span-x402/40 bg-span-x402/10', text: 'text-span-x402' },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtTime(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtMoney(amount?: number, currency = 'USD'): string {
  if (amount == null) return '$135.00';
  const isIso = /^[A-Z]{3}$/.test(currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: isIso ? currency : 'USD',
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Page() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealed, setRevealed] = useState(0);
  const [serverEvents, setServerEvents] = useState<BrokerEvent[]>([]);
  const [prep, setPrep] = useState<PrepResult | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }, []);

  const stage = useCallback(
    (from: number, to: number, onLast: () => void) => {
      for (let i = from; i <= to; i++) {
        const step = i;
        const t = setTimeout(
          () => {
            setRevealed(step);
            if (step === to) onLast();
          },
          (i - from + 1) * STAGGER_MS,
        );
        timers.current.push(t);
      }
    },
    [],
  );

  // Phase 1 — Sly opens the UCP checkout + the agent requests approval.
  const run = useCallback(async () => {
    clearTimers();
    setPhase('preparing');
    setRevealed(0);
    setServerEvents([]);
    setPrep(null);
    setResult(null);

    let data: PrepResult;
    try {
      const res = await fetch('/api/broker/prepare', { method: 'POST' });
      data = (await res.json()) as PrepResult;
      if (!res.ok || data.error || data.status === 'error') {
        setResult({ status: 'error', error: data.error });
        setPhase('error');
        return;
      }
    } catch (err) {
      setResult({ status: 'error', error: String(err) });
      setPhase('error');
      return;
    }

    setPrep(data);
    setServerEvents(data.events ?? []);
    stage(1, PREPARE_STEPS, () => setPhase('awaiting_approval'));
  }, [clearTimers, stage]);

  // Phase 2 — the human clicked Buy in the Claude widget.
  const buy = useCallback(async () => {
    if (!prep) return;
    clearTimers();
    setPhase('buying');

    let data: RunResult;
    try {
      const res = await fetch('/api/broker/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          checkoutId: prep.checkoutId,
          requestId: prep.requestId,
        }),
      });
      data = (await res.json()) as RunResult;
      if (!res.ok || data.error || data.status === 'error') {
        setResult(data);
        setPhase('error');
        return;
      }
    } catch (err) {
      setResult({ status: 'error', error: String(err) });
      setPhase('error');
      return;
    }

    setResult(data);
    setServerEvents([...(prep.events ?? []), ...(data.events ?? [])]);
    stage(PREPARE_STEPS + 1, TIMELINE.length, () => setPhase('done'));
  }, [prep, clearTimers, stage]);

  const eventFor = useCallback(
    (step: TimelineStep): BrokerEvent | undefined => {
      if (!step.fromKinds) return undefined;
      return serverEvents.find((e) => step.fromKinds!.includes(e.kind));
    },
    [serverEvents],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar phase={phase} result={result} onRun={run} />

      <main className="grid flex-1 grid-cols-1 gap-px bg-span-border lg:grid-cols-[1fr_1.3fr_1fr]">
        <ClaudeColumn
          phase={phase}
          revealed={revealed}
          prep={prep}
          result={result}
          onBuy={buy}
        />
        <BrokerColumn
          phase={phase}
          revealed={revealed}
          steps={TIMELINE}
          eventFor={eventFor}
          result={result}
        />
        <ChatGptColumn phase={phase} revealed={revealed} result={result} />
      </main>

      <footer className="flex items-center justify-center gap-2 border-t border-span-border bg-span-rail px-6 py-4 text-center text-[11px] text-span-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-span-ucp/70" />
        Span is a Sly platform demo. Buyer agent lives in the Claude ecosystem,
        seller surface is a ChatGPT mock — Sly is the neutral broker. No real
        orders are fulfilled · sandbox.
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

function TopBar({
  phase,
  result,
  onRun,
}: {
  phase: Phase;
  result: RunResult | null;
  onRun: () => void;
}) {
  const busy = phase === 'preparing' || phase === 'buying';
  const awaiting = phase === 'awaiting_approval';
  return (
    <header className="flex items-center justify-between gap-6 border-b border-span-border bg-span-rail/90 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-span-line bg-gradient-to-br from-span-cardhi to-span-card">
          <span className="span-breathe absolute inset-0 rounded-xl bg-span-glow/10" />
          <span className="relative text-base font-bold tracking-tight">S</span>
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[15px] font-semibold tracking-tight">Span</h1>
            <span className="rounded-md border border-span-line bg-span-card px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-span-faint">
              Broker console
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-span-muted">
            <span className="text-span-claude">Claude</span>
            <FlowGlyph />
            <span className="font-medium text-span-text">Sly</span>
            <FlowGlyph />
            <span className="text-span-chatgpt">ChatGPT</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <StatusPill phase={phase} result={result} />
        <button
          onClick={onRun}
          disabled={busy || awaiting}
          className="relative overflow-hidden rounded-full border border-span-line bg-span-text px-7 py-2.5 text-sm font-semibold text-span-bg shadow-lg shadow-black/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <span className="span-shimmer absolute inset-0" />
              <span className="relative inline-flex items-center gap-2">
                <span className="span-pulse h-1.5 w-1.5 rounded-full bg-span-bg" />
                {phase === 'preparing' ? 'Preparing…' : 'Settling…'}
              </span>
            </>
          ) : awaiting ? (
            'Awaiting your approval'
          ) : phase === 'done' ? (
            'Run demo again'
          ) : phase === 'error' ? (
            'Retry demo'
          ) : (
            'Run demo'
          )}
        </button>
      </div>
    </header>
  );
}

function FlowGlyph() {
  return (
    <span className="inline-flex items-center" aria-hidden="true">
      <span className="h-px w-4 bg-gradient-to-r from-span-line to-span-faint" />
      <span className="-ml-0.5 text-span-faint">›</span>
    </span>
  );
}

function StatusPill({
  phase,
  result,
}: {
  phase: Phase;
  result: RunResult | null;
}) {
  if (phase === 'done' && result?.status === 'completed') {
    return (
      <span className="hidden items-center gap-2 rounded-full border border-span-ucp/30 bg-span-ucp/10 px-3 py-1.5 font-mono text-[11px] text-span-ucp md:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-span-ucp" />
        settled · {result.paymentMethod?.label ?? 'card'}
      </span>
    );
  }
  if (phase === 'awaiting_approval') {
    return (
      <span className="hidden items-center gap-2 rounded-full border border-span-ap2/30 bg-span-ap2/10 px-3 py-1.5 text-[11px] text-span-ap2 md:inline-flex">
        <span className="span-pulse h-1.5 w-1.5 rounded-full bg-span-ap2" />
        awaiting approval
      </span>
    );
  }
  if (phase === 'preparing' || phase === 'buying') {
    return (
      <span className="hidden items-center gap-2 rounded-full border border-span-line bg-span-card px-3 py-1.5 text-[11px] text-span-muted md:inline-flex">
        <span className="span-pulse h-1.5 w-1.5 rounded-full bg-span-acp" />
        brokering
      </span>
    );
  }
  if (phase === 'error') {
    return (
      <span className="hidden items-center gap-2 rounded-full border border-span-x402/30 bg-span-x402/10 px-3 py-1.5 text-[11px] text-span-x402 md:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-span-x402" />
        rejected
      </span>
    );
  }
  return (
    <span className="hidden items-center gap-2 rounded-full border border-span-line bg-span-card px-3 py-1.5 text-[11px] text-span-faint md:inline-flex">
      <span className="h-1.5 w-1.5 rounded-full bg-span-faint" />
      idle
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Left — Claude buyer agent transcript + interactive checkout widget   */
/* ------------------------------------------------------------------ */

function ClaudeColumn({
  phase,
  revealed,
  prep,
  result,
  onBuy,
}: {
  phase: Phase;
  revealed: number;
  prep: PrepResult | null;
  result: RunResult | null;
  onBuy: () => void;
}) {
  const started = phase !== 'idle';
  return (
    <section className="flex flex-col bg-span-panel">
      <ColumnHeader
        dot="bg-span-claude"
        eyebrow="Buyer ecosystem"
        title="Claude"
        subtitle="Maya's shopping agent"
      />
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {!started ? (
          <Placeholder text="Maya hasn't asked yet. Hit Run demo to start the conversation." />
        ) : (
          <>
            <Bubble side="user" name="Maya" delay={0}>
              I need new road running shoes — the Hoka Clifton 10 in my size.
              Budget around $150. Can you just buy them?
            </Bubble>
            <Bubble side="agent" name="Claude Shopping Agent" delay={1}>
              On it. Outpost Outdoors carries the Clifton 10 at{' '}
              <strong>$135.00</strong>. They&apos;re a ChatGPT-side merchant, so
              I&apos;ll route the purchase through Sly. Here&apos;s a checkout —
              tap Buy to authorize it.
            </Bubble>

            {prep && (phase === 'awaiting_approval' || phase === 'buying') ? (
              <CheckoutWidget
                prep={prep}
                buying={phase === 'buying'}
                onBuy={onBuy}
              />
            ) : null}

            {phase === 'done' && result ? (
              <>
                <CheckoutWidget prep={prep} buying={false} purchased />
                <Bubble side="agent" name="Claude Shopping Agent" delay={0}>
                  ✅ Order confirmed — <strong>1 × Hoka Clifton 10</strong> for{' '}
                  <strong>
                    {fmtMoney(result.totalAmount, result.currency)}
                  </strong>
                  , paid with{' '}
                  <strong>
                    {result.paymentMethod?.label ?? 'a tokenized card'}
                  </strong>
                  {result.orderId ? (
                    <>
                      {' '}
                      · Outpost order{' '}
                      <span className="font-mono text-[12px]">
                        {result.orderId}
                      </span>
                    </>
                  ) : null}
                  . Settled via Sly.
                </Bubble>
              </>
            ) : null}

            {phase === 'error' ? (
              <Bubble side="agent" name="Claude Shopping Agent" delay={0}>
                I couldn&apos;t complete the purchase — the broker rejected the
                flow. Nothing was charged.
              </Bubble>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/* The interactive HTML checkout widget Claude renders inline. The Buy
 * button is the human approval that authorizes settlement. */
function CheckoutWidget({
  prep,
  buying,
  onBuy,
  purchased,
}: {
  prep: PrepResult | null;
  buying: boolean;
  onBuy?: () => void;
  purchased?: boolean;
}) {
  if (!prep) return null;
  const { product, paymentMethod } = prep;
  return (
    <div className="span-rise overflow-hidden rounded-2xl border border-span-claude/30 bg-span-card shadow-span-card">
      <div className="flex items-center justify-between gap-2 border-b border-span-border bg-span-claude/10 px-4 py-2">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-span-claude">
          <span className="h-1.5 w-1.5 rounded-full bg-span-claude" />
          Interactive checkout · rendered by Claude
        </span>
        {purchased ? (
          <span className="rounded-full bg-span-ucp/15 px-2 py-0.5 text-[10px] font-semibold text-span-ucp">
            PAID
          </span>
        ) : null}
      </div>

      <div className="flex gap-4 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.name}
          className="h-20 w-20 shrink-0 rounded-xl border border-span-line bg-white object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{product.name}</p>
          <p className="mt-0.5 text-xs text-span-muted">
            {product.description}
          </p>
          <p className="mt-1 text-[11px] text-span-faint">
            {product.merchant} · ChatGPT-side merchant
          </p>
          <p className="mt-1.5 font-mono text-base font-semibold text-span-text">
            {fmtMoney(product.price, product.currency)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-span-border px-4 py-3 text-[11px]">
        <span className="text-span-faint">Pay with</span>
        <span className="flex items-center gap-1.5 font-medium text-span-text">
          <span className="rounded bg-span-bg px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-span-ucp">
            {paymentMethod.brand}
          </span>
          {paymentMethod.label}
        </span>
      </div>

      <div className="px-4 pb-4">
        {purchased ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-span-ucp/30 bg-span-ucp/10 py-3 text-sm font-semibold text-span-ucp">
            <CheckGlyph />
            Purchased — settled via Sly
          </div>
        ) : (
          <>
            <button
              onClick={onBuy}
              disabled={buying}
              className="relative w-full overflow-hidden rounded-xl bg-span-text py-3 text-sm font-semibold text-span-bg shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {buying ? (
                <span className="inline-flex items-center gap-2">
                  <span className="span-pulse h-1.5 w-1.5 rounded-full bg-span-bg" />
                  Authorizing &amp; settling…
                </span>
              ) : (
                `Buy now · ${fmtMoney(product.price, product.currency)}`
              )}
            </button>
            <p className="mt-2 text-center text-[10px] text-span-faint">
              You are approving this purchase. Sly won&apos;t settle until you
              tap Buy.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Middle — Sly broker timeline (THE HERO)                              */
/* ------------------------------------------------------------------ */

function BrokerColumn({
  phase,
  revealed,
  steps,
  eventFor,
  result,
}: {
  phase: Phase;
  revealed: number;
  steps: TimelineStep[];
  eventFor: (s: TimelineStep) => BrokerEvent | undefined;
  result: RunResult | null;
}) {
  const started = phase !== 'idle';
  const inFlight = phase === 'preparing' || phase === 'buying';
  const settled = phase === 'done';

  return (
    <section className="relative flex flex-col bg-span-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-span-glow/[0.06] to-transparent"
      />
      <ColumnHeader
        dot="bg-span-text"
        eyebrow="Trust & settlement"
        title="Sly"
        subtitle="Neutral cross-ecosystem broker"
        emphatic
      />
      <div className="relative flex-1 overflow-y-auto p-6">
        {!started ? (
          <Placeholder text="The broker timeline appears here — identity, policy, checkout, your approval, then settlement." />
        ) : phase === 'error' ? (
          <div className="span-rise rounded-xl border border-span-x402/40 bg-span-x402/10 p-5 text-sm text-span-x402">
            <p className="flex items-center gap-2 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-span-x402" />
              Broker rejected the flow
            </p>
            <p className="mt-1.5 break-words text-span-x402/80">
              {result?.error ?? 'Unknown broker error.'}
            </p>
          </div>
        ) : (
          <>
            <ol className="relative space-y-2.5">
              {steps.map((step, i) => {
                const shown = revealed > i;
                const active = inFlight && revealed === i + 1;
                const ev = eventFor(step);
                return (
                  <li
                    key={step.id}
                    className={
                      shown
                        ? 'span-rise'
                        : 'pointer-events-none h-0 overflow-hidden opacity-0'
                    }
                  >
                    {shown ? (
                      <TimelineCard
                        step={step}
                        event={ev}
                        active={active}
                        done={revealed > i + 1 || settled}
                        last={i === steps.length - 1}
                        result={result}
                      />
                    ) : null}
                  </li>
                );
              })}
              {phase === 'awaiting_approval' ? (
                <li className="flex items-center gap-2.5 pl-7 pt-1 text-xs text-span-ap2">
                  <span className="span-pulse h-1.5 w-1.5 rounded-full bg-span-ap2" />
                  waiting for the human to tap Buy in the Claude widget…
                </li>
              ) : inFlight && revealed < steps.length ? (
                <li className="flex items-center gap-2.5 pl-7 pt-1 text-xs text-span-faint">
                  <span className="span-pulse h-1.5 w-1.5 rounded-full bg-span-acp" />
                  brokering next step…
                </li>
              ) : null}
            </ol>

            {settled && result?.status === 'completed' ? (
              <SettlementSummary result={result} />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function SettlementSummary({ result }: { result: RunResult }) {
  return (
    <div className="span-settle relative mt-5 overflow-hidden rounded-2xl border border-span-ucp/30 bg-gradient-to-br from-span-ucp/[0.08] to-span-card p-5 shadow-span-active">
      <span
        aria-hidden="true"
        className="span-burst absolute -left-6 -top-6 h-24 w-24 rounded-full bg-span-ucp/20"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-span-ucp">
            <CheckGlyph />
            Settlement complete
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-span-text">
            {fmtMoney(result.totalAmount, result.currency)}
          </p>
          <p className="mt-1 text-xs text-span-muted">
            Cross-ecosystem UCP trade brokered &amp; settled by Sly
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-span-faint">
            Paid with
          </p>
          <p className="mt-1 font-mono text-[11px] text-span-ucp">
            {result.paymentMethod?.label ?? 'tokenized card'}
          </p>
          {result.orderId ? (
            <>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-span-faint">
                Order
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-span-text">
                {result.orderId}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CheckGlyph() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-span-ucp/20">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-2.5 w-2.5"
        aria-hidden="true"
      >
        <path d="m5 13 4 4L19 7" />
      </svg>
    </span>
  );
}

function TimelineCard({
  step,
  event,
  active,
  done,
  last,
  result,
}: {
  step: TimelineStep;
  event?: BrokerEvent;
  active: boolean;
  done: boolean;
  last: boolean;
  result: RunResult | null;
}) {
  const ps = PROTOCOL_STYLES[step.protocol];
  const detail = event?.label ?? step.syntheticDetail ?? '';
  const ts = fmtTime(event?.at);

  const settlementExtra =
    last && result?.status === 'completed'
      ? `${fmtMoney(result.totalAmount, result.currency)} · ${result.paymentMethod?.label ?? 'card'}${result.orderId ? ` · ${result.orderId}` : ''}`
      : undefined;

  return (
    <div className="relative pl-7">
      <span
        className={`absolute left-[5px] top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 transition ${
          active
            ? 'span-halo border-span-acp bg-span-acp'
            : done
              ? 'border-span-ucp bg-span-ucp'
              : 'border-span-line bg-span-card'
        }`}
      >
        {done && !active ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-2 w-2 text-span-bg"
            aria-hidden="true"
          >
            <path d="m5 13 4 4L19 7" />
          </svg>
        ) : null}
      </span>
      {!last ? (
        <span
          className={`absolute left-[11px] top-5 h-[calc(100%+0.625rem)] w-0.5 rounded-full ${
            active ? 'span-flow' : done ? 'span-rail-done' : 'bg-span-line'
          }`}
        />
      ) : null}

      <div
        className={`rounded-xl border p-4 transition ${
          active
            ? 'border-span-acp/40 bg-span-cardhi shadow-span-active'
            : 'border-span-border bg-span-card/80 shadow-span-card'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`relative overflow-hidden rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-widest ${ps.ring} ${ps.text} ${
                active ? 'span-sheen' : ''
              }`}
            >
              {step.protocol}
            </span>
            <span className="text-sm font-semibold">{step.title}</span>
          </div>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-span-faint">
            {ts}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-span-muted">{detail}</p>
        {settlementExtra ? (
          <p className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-span-ucp">
            <span className="rounded bg-span-ucp/10 px-1.5 py-0.5">
              {settlementExtra}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Right — ChatGPT / Outpost Outdoors seller confirmation              */
/* ------------------------------------------------------------------ */

function ChatGptColumn({
  phase,
  revealed,
  result,
}: {
  phase: Phase;
  revealed: number;
  result: RunResult | null;
}) {
  const started = phase !== 'idle';
  const inventoryChecked = revealed >= 3 || phase === 'awaiting_approval';
  const priceConfirmed = revealed >= 3 || phase === 'awaiting_approval';
  const orderConfirmed = phase === 'done';

  return (
    <section className="flex flex-col bg-span-panel">
      <ColumnHeader
        dot="bg-span-chatgpt"
        eyebrow="Seller ecosystem"
        title="ChatGPT"
        subtitle="Outpost Outdoors"
      />
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {!started ? (
          <Placeholder text="Outpost Outdoors confirms inventory and price here once the broker reaches it." />
        ) : (
          <>
            <ProductCard />
            <SellerLine done={inventoryChecked} delay={1}>
              {inventoryChecked
                ? 'Inventory check: Hoka Clifton 10 in stock ✓'
                : 'Checking inventory…'}
            </SellerLine>
            <SellerLine done={priceConfirmed} delay={0}>
              {priceConfirmed
                ? 'Price confirmed: $135.00 USD ✓'
                : 'Awaiting price confirmation…'}
            </SellerLine>
            <SellerLine done={orderConfirmed} delay={0}>
              {orderConfirmed
                ? 'Order confirmed — fulfillment queued ✓'
                : 'Awaiting the buyer to approve & settle…'}
            </SellerLine>
            {orderConfirmed ? (
              <div className="span-fade rounded-xl border border-span-chatgpt/40 bg-span-chatgpt/10 p-4">
                <p className="text-sm font-semibold text-span-chatgpt">
                  Thanks for shopping with Outpost Outdoors
                </p>
                <p className="mt-1 text-xs text-span-muted">
                  {fmtMoney(result?.totalAmount, result?.currency)} · 1 × Hoka
                  Clifton 10 · paid by{' '}
                  {result?.paymentMethod?.label ?? 'tokenized card'} via Sly
                </p>
              </div>
            ) : null}
            {phase === 'error' ? (
              <SellerLine done={false} delay={0} error>
                Order not placed — broker did not settle.
              </SellerLine>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function ProductCard() {
  return (
    <div className="span-fade flex gap-4 rounded-xl border border-span-border bg-span-card p-4 shadow-span-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/products/hoka-clifton-10.webp"
        alt="Hoka Clifton 10"
        className="h-16 w-16 shrink-0 rounded-lg border border-span-line bg-white object-contain"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-span-bg px-2 py-0.5 text-[10px] font-medium text-span-faint">
            Footwear
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold">Hoka Clifton 10</p>
        <p className="mt-0.5 text-xs text-span-muted">
          Neutral road running shoe · breathable mesh
        </p>
        <p className="mt-1.5 font-mono text-sm font-semibold text-span-text">
          $135.00 USD
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function ColumnHeader({
  dot,
  eyebrow,
  title,
  subtitle,
  emphatic,
}: {
  dot: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  emphatic?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-b px-6 py-4 ${
        emphatic
          ? 'border-span-line bg-gradient-to-b from-span-cardhi/60 to-transparent'
          : 'border-span-border'
      }`}
    >
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {emphatic ? (
          <span className={`span-pulse absolute h-2.5 w-2.5 rounded-full ${dot} opacity-40`} />
        ) : null}
        <span className={`h-2 w-2 rounded-full ${dot}`} />
      </span>
      <div>
        <p
          className={`text-[10px] font-semibold uppercase tracking-widest ${
            emphatic ? 'text-span-acp' : 'text-span-faint'
          }`}
        >
          {eyebrow}
        </p>
        <p className="text-sm font-semibold leading-tight">
          {title}{' '}
          <span className="font-normal text-span-muted">· {subtitle}</span>
        </p>
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="max-w-[16rem] text-center text-xs leading-relaxed text-span-faint">
        {text}
      </p>
    </div>
  );
}

function Bubble({
  side,
  name,
  delay,
  children,
}: {
  side: 'user' | 'agent';
  name: string;
  delay: number;
  children: React.ReactNode;
}) {
  const isUser = side === 'user';
  return (
    <div className="span-fade" style={{ animationDelay: `${delay * 90}ms` }}>
      <p
        className={`mb-1 text-[10px] font-semibold uppercase tracking-widest ${
          isUser ? 'text-span-faint' : 'text-span-claude'
        }`}
      >
        {name}
      </p>
      <div
        className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'border-span-border bg-span-card text-span-text'
            : 'border-span-claude/30 bg-span-claude/10 text-span-text'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function SellerLine({
  done,
  delay,
  error,
  children,
}: {
  done: boolean;
  delay: number;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="span-fade flex items-center gap-2.5 text-xs"
      style={{ animationDelay: `${delay * 90}ms` }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          error
            ? 'bg-span-x402'
            : done
              ? 'bg-span-chatgpt'
              : 'span-pulse bg-span-faint'
        }`}
      />
      <span
        className={
          error
            ? 'text-span-x402'
            : done
              ? 'text-span-text'
              : 'text-span-muted'
        }
      >
        {children}
      </span>
    </div>
  );
}
