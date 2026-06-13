'use client';

import { useState } from 'react';
import { BUYER, BUYER_AGENT, ITEM, SELLER, SELLER_AGENT, shortHash, usd, type Round } from '@/lib/demo';

interface Event { protocol: string; label: string; }

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-moss/15 text-moss ring-moss/40',
  A2A: 'bg-clay/15 text-clay ring-clay/40',
  AP2: 'bg-spice/15 text-spice ring-spice/40',
  ACP: 'bg-terra/15 text-terra ring-terra/40',
};

const KIND_LABEL: Record<Round['kind'], string> = {
  offer: 'opening offer',
  counter: 'counter',
  accept: 'accepted',
  walk: 'walked away',
};

export default function BarterHome() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [settled, setSettled] = useState<{ cents: number; txHash: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function haggle() {
    setPending(true);
    setRounds([]); setEvents([]); setSettled(null);
    try {
      const res = await fetch('/api/haggle', { method: 'POST' });
      const data = await res.json();
      const all: Round[] = data.rounds ?? [];
      // Reveal rounds with a staggered animation
      for (let i = 0; i < all.length; i++) {
        await new Promise((r) => setTimeout(r, 550));
        setRounds((prev) => [...prev, all[i]]);
      }
      await new Promise((r) => setTimeout(r, 400));
      setEvents(data.events ?? []);
      if (data.settled) setSettled({ cents: data.finalCents, txHash: data.txHash });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-end justify-between border-b border-rope pb-6">
        <div>
          <p className="serif text-[12px] italic text-ash">an agent-to-agent bazaar — governed by Sly</p>
          <h1 className="serif mt-1 text-[44px] font-bold leading-none text-ink">Barter</h1>
        </div>
        <div className="text-right text-[12px] text-ash">
          <p className="font-semibold text-ink">{BUYER.name}</p>
          <p className="mono">parent of Cinder</p>
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <Party label="Buyer side" agent={BUYER_AGENT.name} kyaTier={BUYER_AGENT.kyaTier}
          line1={`Ceiling ${usd(BUYER_AGENT.ceilingCents)}`}
          line2={`Walk-away above ${usd(BUYER_AGENT.walkAwayCents)} · floor not disclosed`}
          tone="moss" />
        <Party label="Seller side" agent={SELLER_AGENT.name} kyaTier={SELLER_AGENT.kyaTier}
          line1={`Ask ${usd(SELLER_AGENT.askCents)}`}
          line2={`Floor ${usd(SELLER_AGENT.floorCents)} · not disclosed to buyer`}
          tone="clay" />
      </section>

      <section className="mt-6 rounded-2xl border border-rope bg-bone/70 p-6 shadow-woven bg-weave">
        <div className="flex items-center justify-between">
          <div>
            <p className="serif text-[20px] text-ink">{ITEM.title}</p>
            <p className="mt-1 text-[13px] text-ash">{ITEM.spec}</p>
          </div>
          <p className="mono text-[11px] text-ash">
            market band {usd(ITEM.marketLowCents)} – {usd(ITEM.marketHighCents)}
          </p>
        </div>
        <button onClick={haggle} disabled={pending}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-terra px-5 py-2.5 text-[13.5px] font-semibold text-bone shadow-deal transition hover:bg-clay disabled:opacity-60">
          {pending ? <Spin /> : <Hand />}
          {pending ? 'agents haggling…' : 'Send Cinder to haggle'}
        </button>
      </section>

      {rounds.length > 0 && (
        <section className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ash">A2A negotiation feed</p>
          <ul className="mt-3 space-y-2.5">
            {rounds.map((r, i) => (
              <li key={i}
                className={`flex animate-fade-up items-start gap-3 rounded-xl border border-rope bg-bone/80 px-4 py-3 shadow-woven ${r.kind === 'accept' ? 'ring-2 ring-moss/50' : ''}`}>
                <span className={`mono mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ${r.side === 'buyer' ? 'bg-moss/15 text-moss ring-moss/40' : 'bg-clay/15 text-clay ring-clay/40'}`}>{r.side === 'buyer' ? 'B' : 'S'}</span>
                <div className="flex-1">
                  <p className="text-[13.5px] text-ink">
                    <span className="font-semibold">{r.side === 'buyer' ? BUYER_AGENT.name.split(' · ')[0] : SELLER_AGENT.name.split(' · ')[0]}</span> ·{' '}
                    <span className={`mono text-[12px] ${r.kind === 'accept' ? 'text-moss' : 'text-spice'}`}>{KIND_LABEL[r.kind]} {usd(r.cents)}</span>
                  </p>
                  <p className="serif mt-0.5 text-[12.5px] italic text-ash">{r.rationale}</p>
                </div>
                <span className="mono text-[10.5px] text-ash">#{r.n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-6 rounded-2xl border border-rope bg-bone/80 p-5 shadow-woven">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ash">What Sly did, in order</p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-sand/60 px-3.5 py-2.5 ring-1 ring-rope">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-sand text-ash ring-rope'}`}>{e.protocol}</span>
                <span className="text-[13px] text-ink/90">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {settled && (
        <section className="relative mt-6 overflow-hidden rounded-2xl border-2 border-moss bg-moss/5 p-6 shadow-deal">
          <span className="serif animate-stamp absolute right-6 top-6 rounded-md border-2 border-moss/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-moss">
            settled · {shortHash(settled.txHash)}
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ash">Deal done</p>
          <p className="serif mt-2 text-[36px] font-bold text-ink">{usd(settled.cents)}</p>
          <p className="mt-1 text-[13px] text-ash">{SELLER.name} · 24-hour turnaround</p>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash/70">
        Barter · Built on Sly · Demo
      </footer>
    </main>
  );
}

function Party({ label, agent, kyaTier, line1, line2, tone }:
  { label: string; agent: string; kyaTier: number; line1: string; line2: string; tone: 'moss' | 'clay' }) {
  const cls = tone === 'moss'
    ? 'border-moss/40 bg-moss/5'
    : 'border-clay/40 bg-clay/5';
  return (
    <div className={`rounded-2xl border-2 ${cls} p-5 shadow-woven`}>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ash">{label}</p>
      <p className="serif mt-1 text-[22px] font-semibold text-ink">{agent}</p>
      <p className="mono mt-2 text-[11px] text-ash">KYA T{kyaTier} · verified by Sly</p>
      <div className="mt-3 space-y-0.5 text-[12.5px]">
        <p className="text-ink/90">{line1}</p>
        <p className="serif italic text-ash">{line2}</p>
      </div>
    </div>
  );
}
function Hand() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12V8a1 1 0 1 1 2 0v4M7 12V6a1 1 0 1 1 2 0v6M9 12V5a1 1 0 1 1 2 0v7M11 12V6a1 1 0 1 1 2 0v6M13 9c1-2 4-1 4 1l-1 6c-.4 2.4-2.5 4-5 4H8c-2 0-3-1-4-3l-2-4c-.4-1 .3-2 1.4-1.9L5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Spin() { return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
