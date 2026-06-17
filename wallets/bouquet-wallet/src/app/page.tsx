'use client';

import { useState } from 'react';
import {
  AGENT,
  ENVELOPE_CENTS,
  GIFT,
  MERCHANT,
  RECIPIENT,
  WALLET,
  usd,
  type AgentBuyResponse,
  type DemoEvt,
} from '@/lib/demo';

type Phase =
  | 'idle'
  | 'requesting'
  | 'discovered'
  | 'approving'
  | 'sealed'
  | 'error';

const PROTOCOL_TONE: Record<string, string> = {
  AP2: 'bg-butter/25 text-bark ring-butter/50',
  ACP: 'bg-blush-soft text-blush-deep ring-blush/40',
  MPP: 'bg-sage-soft text-sage-deep ring-sage/40',
};

export default function BouquetHome() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pending, setPending] = useState<AgentBuyResponse | null>(null);
  const [events, setEvents] = useState<DemoEvt[]>([]);
  const [result, setResult] = useState<AgentBuyResponse | null>(null);

  async function send() {
    setPhase('requesting');
    setEvents([]);
    setResult(null);
    try {
      const res = await fetch('/api/agent/buy', { method: 'POST' });
      const data: AgentBuyResponse = await res.json();
      if (!res.ok || data.phase === 'error') {
        setResult(data);
        setPhase('error');
        return;
      }
      setPending(data);
      setEvents(data.events ?? []);
      setPhase('discovered');
    } catch (err) {
      setResult({ phase: 'error', error: String(err) });
      setPhase('error');
    }
  }

  async function approve() {
    if (!pending?.requestId || !pending?.checkoutId) return;
    setPhase('approving');
    try {
      const res = await fetch('/api/agent/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestId: pending.requestId,
          checkoutId: pending.checkoutId,
        }),
      });
      const data: AgentBuyResponse = await res.json();
      if (!res.ok || data.phase === 'error') {
        setResult(data);
        setPhase('error');
        return;
      }
      setEvents((prev) => [...prev, ...(data.events ?? [])]);
      setResult(data);
      setPhase('sealed');
    } catch (err) {
      setResult({ phase: 'error', error: String(err) });
      setPhase('error');
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden>
            <circle cx="16" cy="16" r="15" fill="#e8a298" opacity="0.18" />
            <path d="M16 8c-2 3-2 6 0 9 2-3 2-6 0-9z" fill="#cc7e72" />
            <path d="M11 14c1 3 3 5 5 5-1-3-3-5-5-5z" fill="#7a9b76" />
            <path d="M21 14c-1 3-3 5-5 5 1-3 3-5 5-5z" fill="#7a9b76" />
            <circle cx="16" cy="20" r="1.5" fill="#f0c878" />
          </svg>
          <span className="text-[20px] font-semibold tracking-tight text-ink">
            Bouquet
          </span>
          <span className="rounded-full bg-cream px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bark/70">
            Agentic Gifting
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-bark/70">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper">
            {WALLET.holder
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <span className="font-medium">{WALLET.holder}</span>
        </div>
      </header>

      {/* Greeting-card hero */}
      <section className="mt-10 sm:mt-14">
        <p className="script text-[28px] leading-tight text-bark/80">For</p>
        <h1 className="mt-1 script text-[72px] sm:text-[96px] leading-none tracking-tight text-ink">
          {RECIPIENT.name}
        </h1>
        <div className="mt-4 flex items-center gap-3 text-[13px] uppercase tracking-[0.18em] text-bark/60">
          <span className="h-px w-10 bg-bark/30" />
          <span>{RECIPIENT.occasion}</span>
          <span className="h-px w-10 bg-bark/30" />
        </div>
      </section>

      {/* Envelope card */}
      <section className="mt-10 grid gap-6 sm:grid-cols-[1.2fr_1fr]">
        {/* Envelope */}
        <article className="paper-card relative animate-fade-up rounded-3xl bg-ivory p-7 ring-1 ring-whisper shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-bark/60">
                Gift envelope
              </p>
              <p className="mt-2 script text-[44px] leading-none text-ink">
                {usd(ENVELOPE_CENTS)}
              </p>
              <p className="mt-2 text-[13.5px] text-bark/70">
                Spending cap for this one gift, enforced by Sly before any
                money moves.
              </p>
            </div>
            <div
              className="wax-seal flex h-14 w-14 items-center justify-center rounded-full shadow-soft ring-2 ring-ivory"
              aria-hidden
            >
              <span className="script text-[28px] font-semibold text-paper/95">
                B
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl bg-cream/70 px-4 py-3 text-[12.5px] text-bark">
            <span className="flex items-center gap-2">
              <SealIcon /> One-shot mandate · grant drawn once
            </span>
            <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[11px] font-semibold text-sage-deep ring-1 ring-sage/30">
              Sly-enforced
            </span>
          </div>
        </article>

        {/* Agent card */}
        <aside className="animate-fade-up rounded-3xl bg-ivory p-6 ring-1 ring-whisper shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-bark/60">
            Personal shopper
          </p>
          <div className="mt-4 flex items-start gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-blush-soft text-[22px] ring-2 ring-ivory shadow-soft">
              💐
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-sage ring-2 ring-ivory"
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink">
                {AGENT.name}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-bark/70">
                Picks within the envelope · gift-receipt formatted
              </p>
              <div className="mt-2.5 flex items-center gap-2 text-[11px]">
                <span className="rounded-full bg-sage/15 px-2 py-0.5 font-semibold text-sage-deep ring-1 ring-sage/30">
                  KYA Tier {AGENT.kyaTier}
                </span>
                <span className="rounded-full bg-butter/20 px-2 py-0.5 font-semibold text-bark ring-1 ring-butter/40">
                  ★ {AGENT.reputation.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* Send CTA */}
      {phase === 'idle' && (
        <section className="mt-10 animate-fade-up rounded-3xl border border-dashed border-blush/40 bg-ivory/60 p-8 text-center">
          <p className="text-[14px] text-bark/75">
            Hand the envelope to Bouquet. It will find something thoughtful at a
            verified gift merchant within{' '}
            <span className="font-semibold text-ink">{usd(ENVELOPE_CENTS)}</span>{' '}
            and ask before it pays.
          </p>
          <button
            onClick={send}
            className="group mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[14px] font-semibold tracking-wide text-paper shadow-soft transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <span>Send the envelope</span>
            <span className="text-blush-soft transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </button>
        </section>
      )}

      {phase === 'requesting' && (
        <section className="mt-8 animate-fade-up rounded-3xl bg-ivory p-6 text-center text-[14px] text-bark shadow-soft ring-1 ring-whisper">
          <Spinner /> Bouquet is browsing Petal Lane and requesting permission to spend…
        </section>
      )}

      {/* Discovered gift */}
      {(phase === 'discovered' || phase === 'approving') && pending && (
        <section className="mt-10 animate-fade-up grid gap-6 sm:grid-cols-[1.1fr_1fr]">
          <article className="overflow-hidden rounded-3xl bg-ivory ring-1 ring-whisper shadow-card">
            <div className="h-44 bg-gradient-to-br from-blush-soft via-cream to-sage-soft" aria-hidden />
            <div className="p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-bark/60">
                Bouquet found
              </p>
              <h3 className="mt-2 text-[20px] font-semibold leading-tight text-ink">
                {GIFT.name}
              </h3>
              <p className="mt-1 text-[13px] text-bark/70">{GIFT.blurb}</p>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="script text-[34px] leading-none text-ink">
                  {usd(GIFT.priceCents)}
                </span>
                <span className="text-[12px] text-bark/70">at {MERCHANT.name}</span>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-sage/15 px-3 py-1.5 text-[12px] font-medium text-sage-deep ring-1 ring-sage/30">
                <CheckSm /> Within your {usd(ENVELOPE_CENTS)} envelope
              </div>
            </div>
          </article>

          <aside className="flex flex-col justify-between rounded-3xl bg-ink p-6 text-paper shadow-card">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blush-soft">
                Treasury scope request
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-paper/85">
                {pending.purpose}
              </p>
              <div className="mt-4 space-y-1 text-[12px] text-stone">
                <p>Scope · treasury · one-shot</p>
                <p className="truncate font-mono text-[10.5px]">
                  req {pending.requestId}
                </p>
              </div>
            </div>
            <button
              onClick={approve}
              disabled={phase === 'approving'}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-blush px-6 py-3.5 text-[14px] font-semibold text-ink shadow-envelope transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60"
              aria-label={`Approve ${usd(GIFT.priceCents)} for ${MERCHANT.name}`}
            >
              {phase === 'approving' ? (
                <>
                  <Spinner /> Sealing the envelope…
                </>
              ) : (
                <>
                  Approve {usd(GIFT.priceCents)}
                  <span>→</span>
                </>
              )}
            </button>
          </aside>
        </section>
      )}

      {/* Sealed receipt */}
      {phase === 'sealed' && result && (
        <section className="mt-10 animate-bloom overflow-hidden rounded-3xl bg-ivory shadow-card ring-1 ring-sage/30">
          <div className="bg-sage-soft px-8 py-7 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage shadow-soft ring-4 ring-ivory">
              <SealIcon big />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-sage-deep">
              Envelope sealed · gift sent
            </p>
            <h3 className="mt-2 script text-[42px] leading-none text-ink">
              {usd(GIFT.priceCents)}
            </h3>
            <p className="mt-1 text-[13px] text-bark">
              {GIFT.name} — on its way to {RECIPIENT.name}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 px-7 py-6 text-[12.5px] text-bark">
            <RowFmt label="Merchant" value={MERCHANT.name} />
            <RowFmt
              label="Status"
              value={result.status ?? 'settled'}
              tone="sage"
            />
            <RowFmt
              label="Transfer"
              value={result.transferId ?? '—'}
              mono
            />
            <RowFmt label="Currency" value={result.currency ?? 'USDC'} />
          </div>
        </section>
      )}

      {/* Timeline */}
      {events.length > 0 && phase !== 'idle' && (
        <section className="mt-10">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-bark/60">
            What Sly did, in order
          </h2>
          <ol className="mt-4 space-y-3">
            {events.map((e, i) => (
              <li
                key={i}
                className="flex animate-fade-up items-start gap-3 rounded-2xl bg-ivory px-4 py-3 ring-1 ring-whisper shadow-soft"
              >
                {e.protocol ? (
                  <ProtocolBadge protocol={e.protocol} />
                ) : (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sage" />
                )}
                <span className="text-[13.5px] leading-snug text-ink/90">
                  {e.label}
                </span>
              </li>
            ))}
            {phase === 'approving' && (
              <li className="flex items-center gap-2 px-4 py-2 text-[12.5px] text-bark/70">
                <Spinner /> Sealing the envelope on Sly…
              </li>
            )}
          </ol>
        </section>
      )}

      {/* Error */}
      {phase === 'error' && result && (
        <section className="mt-10 animate-fade-up rounded-3xl border border-rose/40 bg-rose/5 p-6 text-rose">
          <p className="text-[14px] font-semibold">Bouquet stopped before paying</p>
          <p className="mt-1 text-[13px] text-bark/80">
            {result.error ?? 'The agent could not complete this gift.'}
          </p>
        </section>
      )}

      <footer className="mt-16 text-center text-[11px] uppercase tracking-[0.22em] text-bark/40">
        Bouquet · Built on Sly · Demo
      </footer>
    </main>
  );
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  const tone =
    PROTOCOL_TONE[protocol] ?? 'bg-cream text-bark ring-whisper';
  return (
    <span
      className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${tone}`}
    >
      {protocol}
    </span>
  );
}

function SealIcon({ big = false }: { big?: boolean }) {
  const size = big ? 28 : 14;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={big ? '#fbf6ee' : 'none'}
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckSm() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
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
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone/30 border-t-ink" />
  );
}

function RowFmt({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'sage';
}) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bark/55">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-[13px] ${
          tone === 'sage' ? 'text-sage-deep font-semibold' : 'text-ink'
        } ${mono ? 'font-mono text-[11px]' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
