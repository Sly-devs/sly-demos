'use client';

import { useState } from 'react';
import {
  BUYER,
  PEERS,
  PROVIDER,
  SESSION,
  type CallReceipt,
  type SessionState,
  shortHash,
  usd,
} from '@/lib/demo';

interface SessionEvent {
  protocol: string;
  label: string;
}

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-cyan/15 text-cyan ring-cyan/40',
  AP2: 'bg-amber/15 text-amber ring-amber/40',
  x402: 'bg-lime/15 text-lime ring-lime/40',
  MPP: 'bg-rust/15 text-rust ring-rust/40',
};

export default function LoomHome() {
  const [s, setS] = useState<SessionState>({
    phase: 'idle',
    callsMade: 0,
    centsSpent: 0,
    receipts: [],
  });
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [bundle, setBundle] = useState<{ hash: string; calls: number; cents: number } | null>(null);

  async function openSession() {
    setS({ phase: 'opening', callsMade: 0, centsSpent: 0, receipts: [] });
    setBundle(null);
    setEvents([]);
    try {
      const res = await fetch('/api/session', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'open failed');
      setEvents(data.events ?? []);
      setS((p) => ({ ...p, phase: 'open', sessionId: data.sessionId }));
    } catch (err) {
      setS((p) => ({ ...p, phase: 'error', errors: [String(err)] }));
    }
  }

  async function runBatch() {
    if (s.phase !== 'open') return;
    const targetCalls = SESSION.batchCalls;
    for (let k = 1; k <= targetCalls; k++) {
      // Stop if we'd cross the ceiling
      if (s.centsSpent + 2 > SESSION.ceilingCents) break;
      try {
        const res = await fetch('/api/call', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ callIndex: s.callsMade + k }),
        });
        const data = await res.json();
        const r: CallReceipt = {
          i: data.i,
          ts: data.ts,
          amountCents: data.amountCents,
          hash: data.hash,
        };
        // Throttle visually
        await new Promise((r) => setTimeout(r, 20));
        setS((prev) => ({
          ...prev,
          callsMade: prev.callsMade + 1,
          centsSpent: prev.centsSpent + r.amountCents,
          receipts: [r, ...prev.receipts].slice(0, 24),
        }));
      } catch {
        break;
      }
    }
  }

  async function closeSession() {
    if (s.phase !== 'open') return;
    setS((p) => ({ ...p, phase: 'closing' }));
    try {
      const res = await fetch('/api/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: s.sessionId,
          calls: s.callsMade,
          cents: s.centsSpent,
        }),
      });
      const data = await res.json();
      setEvents((prev) => [...prev, ...(data.events ?? [])]);
      setBundle({
        hash: data.bundleHash,
        calls: data.calls,
        cents: data.cents,
      });
      setS((p) => ({ ...p, phase: 'closed' }));
    } catch (err) {
      setS((p) => ({ ...p, phase: 'error', errors: [String(err)] }));
    }
  }

  const meterPct = Math.min(100, (s.centsSpent / SESSION.ceilingCents) * 100);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-wire pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate ring-1 ring-cyan/30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" stroke="#2dd4ff" strokeWidth="2" strokeLinecap="round" />
                <circle cx="6" cy="6" r="1.6" fill="#a3e635" />
                <circle cx="14" cy="12" r="1.6" fill="#a3e635" />
                <circle cx="10" cy="18" r="1.6" fill="#a3e635" />
              </svg>
            </div>
            <h1 className="text-[20px] font-semibold tracking-tight text-mist">Loom</h1>
            <span className="rounded-md bg-slate px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-graymute ring-1 ring-wire">
              Peer Compute Market
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-graymute">
            Agents rent metered resources from each other. Every call settles
            on Sly via x402 — per-call receipts, KYA-gated providers, single
            consolidated bill at session close.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-graymute">
            Buyer agent
          </p>
          <p className="mt-1 mono text-[14px] text-mist">{BUYER.name}</p>
          <p className="text-[11px] text-graymute">
            KYA T{BUYER.kyaTier} · ★ {BUYER.reputation.toFixed(1)}
          </p>
        </div>
      </header>

      {/* Two columns */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        {/* LEFT: Provider list */}
        <div className="rounded-2xl bg-slate p-5 shadow-card ring-1 ring-wire">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-graymute">
              Available providers
            </h2>
            <span className="mono text-[10px] text-graymute">
              {PEERS.filter((p) => p.status !== 'low-rep').length} surfaced · 1 hidden (low-rep)
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {PEERS.map((p) => (
              <li
                key={p.name}
                className={`flex items-center justify-between rounded-xl px-3.5 py-3 ring-1 transition ${
                  p.status === 'selected'
                    ? 'bg-cyan/10 ring-cyan/40'
                    : p.status === 'low-rep'
                      ? 'bg-rack/40 opacity-50 ring-rust/30 line-through'
                      : 'bg-rack ring-wire hover:bg-rack/70'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[14px] font-semibold text-mist">
                      {p.name}
                    </span>
                    {p.status === 'selected' && (
                      <span className="rounded-sm bg-cyan/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan">
                        selected
                      </span>
                    )}
                    {p.status === 'low-rep' && (
                      <span className="rounded-sm bg-rust/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rust">
                        rep gated by sly
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-graymute">
                    {p.role}
                  </p>
                </div>
                <div className="text-right">
                  <p className="mono text-[12px] font-semibold text-lime">
                    {p.price}
                  </p>
                  <p className="text-[10.5px] text-graymute">
                    ★ {p.rep.toFixed(1)} · {p.jobs} jobs
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-md bg-graphite/60 px-3 py-2.5 text-[11px] text-graymute ring-1 ring-wire">
            <span className="text-cyan">Sly</span> filters providers below your
            reputation floor before they reach this list.
          </div>
        </div>

        {/* RIGHT: Session console */}
        <div className="rounded-2xl bg-slate p-6 shadow-rack ring-1 ring-cyan/20">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan">
                Session · {BUYER.name} → {PROVIDER.name}
              </h2>
              <p className="mt-1 mono text-[13px] text-mist">
                {PROVIDER.endpointPath}
              </p>
              <p className="text-[11px] text-graymute">
                {PROVIDER.blurb} · {PROVIDER.region}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-graymute">
                Status
              </p>
              <p
                className={`mt-1 mono text-[12px] font-semibold ${
                  s.phase === 'open'
                    ? 'text-lime'
                    : s.phase === 'closed'
                      ? 'text-cyan'
                      : s.phase === 'opening' || s.phase === 'closing'
                        ? 'text-amber'
                        : s.phase === 'error'
                          ? 'text-rust'
                          : 'text-graymute'
                }`}
              >
                {s.phase.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Meter */}
          <div className="mt-5 rounded-xl bg-graphite p-4 ring-1 ring-wire">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-graymute">
                  Spent · session
                </p>
                <p className="mt-1 mono text-[32px] font-semibold leading-none text-mist tabnums">
                  {usd(s.centsSpent)}
                </p>
                <p className="mt-1 text-[11px] text-graymute">
                  of {usd(SESSION.ceilingCents)} ceiling · {s.callsMade} calls
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-graymute">
                  Per call
                </p>
                <p className="mono text-[16px] font-semibold text-lime">
                  ${(PROVIDER.pricePerCallCents / 100).toFixed(3)}
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-rack">
              <div
                className={`h-full transition-all duration-100 ${
                  s.phase === 'open' ? 'meter-shimmer animate-meter-flow' : 'bg-cyan'
                }`}
                style={{ width: `${meterPct}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {s.phase === 'idle' && (
              <button
                onClick={openSession}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan px-5 py-2.5 text-[13px] font-semibold text-graphite transition hover:bg-cyan-soft"
              >
                <Power /> Open session with {PROVIDER.name}
              </button>
            )}
            {s.phase === 'opening' && (
              <span className="mono text-[12px] text-amber">
                <Tick /> requesting mandate + scope…
              </span>
            )}
            {s.phase === 'open' && (
              <>
                <button
                  onClick={runBatch}
                  className="inline-flex items-center gap-2 rounded-lg bg-lime px-5 py-2.5 text-[13px] font-semibold text-graphite transition hover:bg-lime-deep"
                >
                  <Bolt /> Run {SESSION.batchCalls} inference calls
                </button>
                <button
                  onClick={closeSession}
                  className="inline-flex items-center gap-2 rounded-lg bg-rack px-4 py-2.5 text-[12.5px] font-semibold text-mist ring-1 ring-wire transition hover:bg-rack/70"
                >
                  Close session
                </button>
              </>
            )}
            {s.phase === 'closing' && (
              <span className="mono text-[12px] text-amber">
                <Tick /> sealing bundle receipt…
              </span>
            )}
            {s.phase === 'closed' && bundle && (
              <span className="mono text-[12px] text-cyan">
                <Check /> Bundle settled · {bundle.calls} calls · {usd(bundle.cents)}
              </span>
            )}
          </div>

          {/* Recent receipts */}
          {s.receipts.length > 0 && (
            <div className="mt-6">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-graymute">
                Recent per-call receipts (newest first)
              </p>
              <ul className="mono mt-2 max-h-44 space-y-1 overflow-y-auto pr-1 text-[11.5px]">
                {s.receipts.map((r) => (
                  <li
                    key={r.hash}
                    className="flex animate-fade-up items-center justify-between gap-3 rounded-md bg-rack px-3 py-1.5 text-mist/85 ring-1 ring-wire"
                  >
                    <span className="text-graymute">#{String(r.i).padStart(3, '0')}</span>
                    <span className="text-lime">${(r.amountCents / 100).toFixed(3)}</span>
                    <span className="text-graymute">{shortHash(r.hash)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bundle */}
          {bundle && (
            <div className="mt-6 rounded-xl bg-graphite p-4 ring-1 ring-cyan/30">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cyan">
                Bundle receipt
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-[12px]">
                <div>
                  <p className="text-graymute">Calls</p>
                  <p className="mono mt-0.5 text-mist">{bundle.calls}</p>
                </div>
                <div>
                  <p className="text-graymute">Settled</p>
                  <p className="mono mt-0.5 text-lime">{usd(bundle.cents)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-graymute">Hash</p>
                  <p className="mono mt-0.5 truncate text-cyan">{shortHash(bundle.hash)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Event timeline */}
      {events.length > 0 && (
        <section className="mt-8 rounded-2xl bg-slate p-5 shadow-card ring-1 ring-wire">
          <h2 className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-graymute">
            What Sly did, in order
          </h2>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li
                key={i}
                className="flex animate-fade-up items-center gap-3 rounded-md bg-rack px-3 py-2 ring-1 ring-wire"
              >
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${
                    PROTOCOL_TONE[e.protocol] ??
                    'bg-rack text-graymute ring-wire'
                  }`}
                >
                  {e.protocol}
                </span>
                <span className="text-[13px] text-mist/85">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-graymute">
        Loom · Built on Sly · Demo
      </footer>
    </main>
  );
}

function Power() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v8M5.5 7A8 8 0 1 0 18.5 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function Bolt() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 3 14h7v8l10-12h-7V2z" />
    </svg>
  );
}
function Tick() {
  return (
    <span className="inline-block h-2 w-2 animate-pulse-tick rounded-full bg-amber" />
  );
}
function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
