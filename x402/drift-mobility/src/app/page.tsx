'use client';

import { useState } from 'react';
import { AGENT, DRIVER, PROVIDERS, shortHash, usd, type Provider, type Receipt } from '@/lib/demo';

interface Event { protocol: string; label: string; }

const TYPE_GLYPHS: Record<Provider['type'], string> = { parking: '🅿', toll: '⇄', charging: '⚡' };
const TYPE_TONE: Record<Provider['type'], string> = {
  parking: 'bg-ev/15 text-ev ring-ev/40',
  toll: 'bg-signal/15 text-signal ring-signal/40',
  charging: 'bg-green/15 text-green ring-green/40',
};

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-ev/15 text-ev-soft ring-ev/30',
  AP2: 'bg-signal/15 text-signal ring-signal/30',
  x402: 'bg-green/15 text-green ring-green/30',
};

export default function DriftHome() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const spentCents = receipts.reduce((acc, r) => acc + r.amountCents, 0);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function tap(p: Provider) {
    setPendingId(p.id);
    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerId: p.id, spentCents, tag: 'business' }),
      });
      const data = await res.json();
      setEvents(data.events ?? []);
      if (data.receipt) setReceipts((prev) => [data.receipt, ...prev]);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-ev/15 ring-1 ring-ev/40">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 17l1.5-7h11L19 17M5 17v2h2v-2M19 17v2h-2v-2M5 17h14M7 13h10" stroke="#16a4ff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-green ring-2 ring-midnight" />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">Drift</h1>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-ash">Mobility micropay · agent-governed</p>
          </div>
        </div>
        <div className="text-right text-[12px] text-ash">
          <p className="font-medium text-ink">{DRIVER.name}</p>
          <p className="mono">{DRIVER.vehicle}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl bg-nav p-6 shadow-card ring-1 ring-line">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ash">Today · daily mobility cap</p>
            <p className="mono text-[11px] text-ash">enforced by sly</p>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-[44px] font-semibold tabnums text-ink">{usd(spentCents)}</p>
            <p className="text-[13px] text-ash">of {usd(AGENT.dailyCapCents)}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-deck">
            <div className="h-full bg-gradient-to-r from-ev via-green to-signal" style={{ width: `${Math.min(100, (spentCents / AGENT.dailyCapCents) * 100)}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-[11.5px]">
            <Pill k="Agent" v={`KYA T${AGENT.kyaTier}`} />
            <Pill k="Per-tap max" v={usd(AGENT.perTapCents)} />
            <Pill k="Receipts" v={`${receipts.length} signed`} />
          </div>
        </div>

        <div className="rounded-2xl bg-nav p-6 shadow-card ring-1 ring-line">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ash">Active stations near you</p>
          <ul className="mt-3 space-y-2.5">
            {PROVIDERS.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl bg-deck/80 px-4 py-3 ring-1 ring-line">
                <div className="flex items-center gap-3">
                  <span className="text-[22px]">{p.icon}</span>
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">{p.name}</p>
                    <p className="text-[11px] text-ash">{p.city} · <span className={`rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase ring-1 ${TYPE_TONE[p.type]}`}>{TYPE_GLYPHS[p.type]} {p.type}</span></p>
                  </div>
                </div>
                <button onClick={() => tap(p)} disabled={pendingId === p.id} className="inline-flex items-center gap-2 rounded-full bg-ev px-3.5 py-2 text-[12.5px] font-semibold text-midnight shadow-card transition hover:bg-ev-soft disabled:opacity-60">
                  {pendingId === p.id ? <Spin /> : <Tap />}
                  Tap · {usd(p.perTapCents)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {events.length > 0 && (
        <section className="mt-6 rounded-2xl bg-nav p-5 ring-1 ring-line shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ash">What Sly did, in order</p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-deck px-3.5 py-2.5 ring-1 ring-line">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-deck text-ash ring-line'}`}>{e.protocol}</span>
                <span className="text-[13px] text-ink/90">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {receipts.length > 0 && (
        <section className="mt-6 rounded-2xl bg-nav ring-1 ring-line shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ash">Reimbursable receipts · signed</p>
            <p className="mono text-[11px] text-ash">{receipts.length} taps · {usd(spentCents)}</p>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line/60 bg-deck/50 text-[10.5px] uppercase tracking-[0.14em] text-ash">
                <th className="px-5 py-2 text-left">When</th>
                <th className="px-5 py-2 text-left">Where</th>
                <th className="px-5 py-2 text-right">Amount</th>
                <th className="px-5 py-2 text-left">Tag</th>
                <th className="px-5 py-2 text-left">Tx</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => {
                const p = PROVIDERS.find((x) => x.id === r.providerId);
                return (
                  <tr key={r.id} className="border-b border-line/30 hover:bg-deck/40">
                    <td className="px-5 py-2.5 mono text-[11.5px] text-ash tabnums">{new Date(r.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-2.5">{p?.name ?? r.providerId}</td>
                    <td className="px-5 py-2.5 mono text-right tabnums text-ev-soft">{usd(r.amountCents)}</td>
                    <td className="px-5 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${r.reimbursableTag === 'business' ? 'bg-signal/15 text-signal' : 'bg-ash/20 text-ash'}`}>{r.reimbursableTag}</span></td>
                    <td className="px-5 py-2.5 mono text-[11px] text-ev">{shortHash(r.hash)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash/70">Drift · Built on Sly · Demo</footer>
    </main>
  );
}

function Pill({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-deck px-3 py-2 ring-1 ring-line">
      <p className="text-[9.5px] uppercase tracking-[0.16em] text-ash">{k}</p>
      <p className="mono mt-0.5 text-ink">{v}</p>
    </div>
  );
}
function Tap() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <path d="M3 12a9 9 0 0 1 9-9M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function Spin() { return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
