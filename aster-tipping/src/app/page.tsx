'use client';

import { useState } from 'react';
import {
  AGENT,
  CREATORS,
  FAN,
  shortHash,
  usd,
  type Creator,
  type Tip,
} from '@/lib/demo';

interface Event {
  protocol: string;
  label: string;
}

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-lavender/20 text-lavender ring-lavender/40',
  AP2: 'bg-gold/20 text-gold ring-gold/40',
  x402: 'bg-mint/20 text-mint ring-mint/40',
};

export default function TippingHome() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [denial, setDenial] = useState<{ creator: Creator; reason: string } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [animatingFor, setAnimatingFor] = useState<string | null>(null);

  const spentCents = tips.reduce((acc, t) => acc + (t.status === 'allowed' ? t.amountCents : 0), 0);
  const tipsCount = tips.filter((t) => t.status === 'allowed').length;
  const remainingPct = Math.max(0, 100 - (spentCents / AGENT.weeklyCapCents) * 100);

  async function tip(c: Creator) {
    setDenial(null);
    setAnimatingFor(c.id);
    setTimeout(() => setAnimatingFor(null), 900);
    try {
      const res = await fetch('/api/tip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creatorId: c.id, spentCents }),
      });
      const data = await res.json();
      setEvents(data.events ?? []);
      if (data.decision === 'deny') {
        setDenial({ creator: c, reason: data.reason });
      } else if (data.tip) {
        setTips((prev) => [data.tip, ...prev]);
      }
    } catch (err) {
      setDenial({ creator: c, reason: String(err) });
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-magenta/20 ring-1 ring-magenta/40">
            <Heart />
          </div>
          <div>
            <h1 className="display text-[24px] font-semibold leading-none text-cream">
              Aster
            </h1>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-smoke">
              Creator tipping · agent-driven
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-deep/60 px-3 py-1.5 text-[11px] text-smoke ring-1 ring-edge">
            <span className="mono text-cream">{tipsCount}</span> tips this week ·{' '}
            <span className="mono text-mint">{usd(spentCents)}</span> of {usd(AGENT.weeklyCapCents)}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-peach text-[11.5px] font-semibold text-dusk">
              {FAN.initials}
            </div>
            <span className="text-[12.5px] text-smoke">{FAN.name}</span>
          </div>
        </div>
      </header>

      {/* Cap meter */}
      <section className="mt-6 rounded-2xl bg-deep/60 p-5 ring-1 ring-edge backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-smoke">
              Weekly tipping budget · enforced by Sly
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <p className="display text-[34px] leading-none text-cream tabnums">
                {usd(AGENT.weeklyCapCents - spentCents)}
              </p>
              <p className="text-[12px] text-smoke">remaining</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11.5px] text-smoke">
            <div>
              <p>Per tip</p>
              <p className="mono text-cream">{usd(AGENT.perTipCents)}</p>
            </div>
            <div>
              <p>Rep floor</p>
              <p className="mono text-cream">★ {AGENT.reputationFloor.toFixed(1)}</p>
            </div>
            <div>
              <p>Agent</p>
              <p className="mono text-cream">KYA T{AGENT.kyaTier}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-plum">
          <div
            className="h-full bg-gradient-to-r from-mint via-lavender to-magenta transition-all"
            style={{ width: `${100 - remainingPct}%` }}
          />
        </div>
      </section>

      {/* Creator feed */}
      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
        {CREATORS.map((c) => (
          <article
            key={c.id}
            className={`group relative overflow-hidden rounded-3xl bg-deep p-0 ring-1 transition ${
              c.blocked
                ? 'opacity-65 ring-magenta/30'
                : 'ring-edge shadow-creator hover:ring-magenta/30'
            }`}
          >
            <div className={`relative h-32 bg-gradient-to-br ${c.art}`}>
              {c.blocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-dusk/70 backdrop-blur">
                  <span className="rounded-full bg-magenta/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream ring-1 ring-magenta/60">
                    Sly · rep below floor
                  </span>
                </div>
              )}
              {animatingFor === c.id && !c.blocked && (
                <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 animate-tip-pop display text-[42px] font-bold text-cream drop-shadow-[0_4px_12px_rgba(252,211,77,0.6)]">
                  +{usd(AGENT.perTipCents)}
                </span>
              )}
            </div>
            <div className="px-5 pt-4 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-semibold leading-tight text-cream">
                    {c.name}
                  </p>
                  <p className="mono text-[11px] text-smoke">{c.handle}</p>
                </div>
                <div className="text-right text-[11px] text-smoke">
                  <p className={`mono ${c.reputation >= AGENT.reputationFloor ? 'text-mint' : 'text-magenta'}`}>
                    ★ {c.reputation.toFixed(1)}
                  </p>
                  <p>{c.followers} followers</p>
                </div>
              </div>
              <p className="mt-2 text-[12.5px] leading-snug text-smoke">{c.blurb}</p>
              <button
                onClick={() => tip(c)}
                disabled={!!c.blocked}
                className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold transition ${
                  c.blocked
                    ? 'cursor-not-allowed bg-plum text-smoke ring-1 ring-edge'
                    : 'bg-gold text-dusk shadow-tip hover:bg-peach'
                }`}
              >
                <Coin />
                {c.blocked ? 'Sly blocked this tip' : `Tip ${usd(AGENT.perTipCents)}`}
              </button>
            </div>
          </article>
        ))}
      </section>

      {/* Denial banner */}
      {denial && (
        <section className="mt-6 animate-fade-up rounded-2xl border border-magenta/40 bg-magenta/10 px-5 py-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-magenta">
            Sly refused this tip
          </p>
          <p className="mt-1 text-[13.5px] text-cream">
            <span className="font-semibold">{denial.creator.handle}</span> — {denial.reason}
          </p>
        </section>
      )}

      {/* Event timeline */}
      {events.length > 0 && (
        <section className="mt-8 rounded-2xl bg-deep/60 p-5 ring-1 ring-edge backdrop-blur">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-smoke">
            What Sly did, in order
          </p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-dusk/60 px-3.5 py-2 ring-1 ring-edge">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-plum text-smoke ring-edge'}`}>
                  {e.protocol}
                </span>
                <span className="text-[13px] text-cream/90">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Recent tips */}
      {tips.length > 0 && (
        <section className="mt-8 rounded-2xl bg-deep/60 p-5 ring-1 ring-edge backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-smoke">
              Tip receipts · signed
            </p>
            <p className="mono text-[11px] text-smoke">{tips.length} tips</p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {tips.map((t) => {
              const c = CREATORS.find((x) => x.id === t.creatorId);
              return (
                <li key={t.id} className="flex animate-fade-up items-center justify-between rounded-lg bg-dusk/60 px-3.5 py-2 mono text-[12px] ring-1 ring-edge">
                  <span className="text-cream">{c?.handle ?? t.creatorId}</span>
                  <span className="text-gold">{usd(t.amountCents)}</span>
                  <span className="text-smoke">{shortHash(t.hash)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-smoke/70">
        Aster · Built on Sly · Demo
      </footer>
    </main>
  );
}

function Heart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 20s-7-4.4-7-10a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 21 10c0 5.6-7 10-7 10" stroke="#ec4899" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function Coin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="700" fill="#15101c">$</text>
    </svg>
  );
}
