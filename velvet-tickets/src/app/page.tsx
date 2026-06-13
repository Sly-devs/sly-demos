'use client';

import { useState } from 'react';
import { DROP, HOLDER, QUEUE, evaluate, shortHash, usd, type Decision, type QueueAgent } from '@/lib/demo';

interface Event { protocol: string; label: string; }

const FLAVOR_TONE: Record<QueueAgent['flavor'], string> = {
  fan: 'text-gold',
  casual: 'text-electric',
  group: 'text-electric',
  scalper: 'text-flame',
  bot: 'text-flame',
};

const FLAVOR_LABEL: Record<QueueAgent['flavor'], string> = {
  fan: 'verified fan',
  casual: 'first-timer',
  group: 'group-buyer',
  scalper: 'flagged scalper',
  bot: 'bot ring',
};

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-gold/15 text-gold ring-gold/40',
  AP2: 'bg-neon/15 text-neon ring-neon/40',
  ACP: 'bg-electric/15 text-electric ring-electric/40',
};

export default function VelvetHome() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [remaining, setRemaining] = useState(DROP.totalTickets);
  const [pending, setPending] = useState(false);
  const [opened, setOpened] = useState(false);

  async function openDrop() {
    setPending(true);
    setOpened(true);
    try {
      const res = await fetch('/api/buy', { method: 'POST' });
      const data = await res.json();
      // Reveal decisions with a stagger
      const all: Decision[] = data.decisions ?? [];
      for (const d of all) {
        await new Promise((r) => setTimeout(r, 220));
        setDecisions((prev) => [...prev, d]);
      }
      await new Promise((r) => setTimeout(r, 350));
      setEvents(data.events ?? []);
      setRemaining(data.remainingTickets);
    } finally { setPending(false); }
  }

  // Pair queue order with revealed decisions (sorted by KYA priority)
  const sorted = [...QUEUE].sort((a, b) => {
    if (b.kyaTier !== a.kyaTier) return b.kyaTier - a.kyaTier;
    if (b.rep !== a.rep) return b.rep - a.rep;
    return a.queuedAt.localeCompare(b.queuedAt);
  });

  const minted = decisions.filter((d) => d.verdict === 'mint');
  const blocked = decisions.filter((d) => d.verdict === 'block');

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-start justify-between border-b border-rope pb-6">
        <div>
          <p className="mono text-[10.5px] uppercase tracking-[0.24em] text-gold/80">KYA-gated drop · governed by Sly</p>
          <h1 className="display mt-2 text-[56px] font-bold italic leading-none text-bone">Velvet<span className="text-gold">.</span></h1>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-semibold text-bone">{HOLDER.name}</p>
          <p className="mono text-[10.5px] text-ash">@iris_d · KYA T3</p>
        </div>
      </header>

      {/* poster */}
      <section className="relative mt-8 overflow-hidden rounded-3xl border border-rope bg-plum p-8 shadow-poster bg-velvety">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gold/20 blur-2xl animate-glow" />
        <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-neon/15 blur-3xl animate-glow" />
        <div className="relative grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.22em] text-gold/80">tonight's drop</p>
            <p className="display mt-2 text-[64px] font-bold italic leading-none text-bone">{DROP.artist}</p>
            <p className="display mt-1 text-[20px] uppercase tracking-[0.18em] text-bone/80">{DROP.title}</p>
            <p className="mt-4 text-[14px] text-ash">{DROP.venue} · <span className="text-bone/90">{DROP.date}</span></p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px]">
              <Pill k="face" v={usd(DROP.faceCents)} tone="gold" />
              <Pill k="cap" v={`${DROP.totalTickets} mints`} tone="electric" />
              <Pill k="per-agent" v={`max ${DROP.perAgentMax}`} tone="electric" />
              <Pill k="floor" v={`KYA T${DROP.kyaFloor} · rep ${DROP.repFloor}`} tone="gold" />
            </div>
          </div>

          <div className="relative rounded-2xl border border-rope bg-deep/70 p-5">
            <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">drop status</p>
            <p className="display mt-1 text-[44px] font-bold tabnums leading-none text-gold">{remaining}</p>
            <p className="mono text-[11px] text-ash">of {DROP.totalTickets} remaining</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-velvet">
              <div className="h-full bg-gradient-to-r from-gold via-neon to-electric transition-all" style={{ width: `${((DROP.totalTickets - remaining) / DROP.totalTickets) * 100}%` }} />
            </div>
            <button onClick={openDrop} disabled={pending || opened}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider text-ink shadow-gold transition hover:bg-flame hover:text-bone disabled:opacity-60">
              {pending ? <Spin /> : <Ticket />}
              {pending ? 'Sly verifying queue…' : opened ? 'Drop open' : 'Open the velvet rope'}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* queue */}
        <div className="rounded-2xl border border-rope bg-velvet p-5">
          <div className="flex items-center justify-between">
            <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">queue · 08:00 PM cutoff · {QUEUE.length} agents</p>
            <p className="mono text-[10.5px] text-gold">KYA-prioritized</p>
          </div>
          <ul className="mt-3 space-y-2">
            {sorted.map((a, i) => {
              const dec = decisions.find((d) => d.agentId === a.id);
              const evalRes = evaluate(a);
              const isMinted = dec?.verdict === 'mint';
              const isBlocked = dec?.verdict === 'block';
              return (
                <li key={a.id}
                  className={`flex animate-fade-up items-start gap-3 rounded-xl border px-3.5 py-2.5 transition ${isMinted ? 'border-gold/50 bg-gold/8' : isBlocked ? 'border-flame/40 bg-flame/5 opacity-80' : evalRes.verdict === 'block' ? 'border-rope bg-velvet/40' : 'border-rope bg-velvet/40'}`}
                  style={{ animationDelay: `${i * 60}ms` }}>
                  <span className={`mono mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ring-1 ${isMinted ? 'bg-gold text-ink ring-gold' : isBlocked ? 'bg-flame/15 text-flame ring-flame/40 line-through' : 'bg-plum text-bone ring-rope'}`}>#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className={`mono text-[13px] truncate ${a.flavor === 'bot' || a.flavor === 'scalper' ? 'text-flame' : 'text-bone'}`}>{a.handle}</p>
                      <Pill k="KYA" v={`T${a.kyaTier}`} tone={a.kyaTier >= DROP.kyaFloor ? 'gold' : 'flame'} small />
                      <Pill k="★" v={a.rep ? a.rep.toFixed(1) : '—'} tone={a.rep >= DROP.repFloor ? 'electric' : 'flame'} small />
                      <span className={`mono text-[10px] uppercase tracking-wider ${FLAVOR_TONE[a.flavor]}`}>{FLAVOR_LABEL[a.flavor]}</span>
                    </div>
                    <p className="display mt-0.5 text-[12.5px] italic text-ash">{a.notes}</p>
                    {dec && dec.verdict === 'block' && (
                      <p className="mt-1 text-[11px] text-flame">blocked · {dec.reasons.join(' · ')}</p>
                    )}
                    {dec && dec.verdict === 'mint' && (
                      <p className="mt-1 text-[11px] text-gold">minted {dec.mintIds?.length}× · {dec.mintIds?.join(', ')} · {shortHash(dec.txHash ?? '')}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-[11px]">
                    <p className="mono text-bone">qty {a.qty}</p>
                    <p className="mono text-[10px] text-ash">{a.queuedAt}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-5">
          {/* tally */}
          <div className="rounded-2xl border border-rope bg-velvet p-5">
            <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">drop tally</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Minted" value={`${minted.reduce((acc, d) => acc + (d.mintIds?.length ?? 0), 0)}`} sub="real fans" tone="gold" />
              <Stat label="Blocked" value={`${blocked.length}`} sub="bots / flagged" tone="flame" />
            </div>
          </div>

          {/* events */}
          {events.length > 0 && (
            <div className="rounded-2xl border border-rope bg-velvet p-5">
              <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">what Sly did</p>
              <ol className="mt-3 space-y-2">
                {events.map((e, i) => (
                  <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-deep/60 px-3 py-2 ring-1 ring-rope">
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-deep text-ash ring-rope'}`}>{e.protocol}</span>
                    <span className="text-[12px] text-bone/90">{e.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* iris's tickets */}
          {decisions.find((d) => d.agentId === 'a-iris' && d.verdict === 'mint') && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-gold bg-gold/8 p-5 shadow-gold">
              <span className="display animate-stamp absolute right-5 top-5 rounded-md border-2 border-gold/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
                your tickets
              </span>
              <p className="mono text-[10.5px] uppercase tracking-[0.16em] text-ash">@iris_d · KYA T3 verified</p>
              <p className="display mt-1 text-[28px] font-bold italic text-bone">{DROP.artist}</p>
              <p className="mono mt-2 text-[12px] text-gold">{decisions.find((d) => d.agentId === 'a-iris')?.mintIds?.join(' · ')}</p>
              <p className="display mt-1 text-[12px] italic text-ash">resale gated to KYA T{DROP.resaleKyaFloor}+ only · no scalper market</p>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash/60">Velvet · Built on Sly · Demo</footer>
    </main>
  );
}

function Pill({ k, v, tone, small }: { k: string; v: string; tone: 'gold' | 'electric' | 'flame' | 'neon'; small?: boolean }) {
  const cls = {
    gold: 'bg-gold/15 text-gold ring-gold/40',
    electric: 'bg-electric/12 text-electric ring-electric/40',
    flame: 'bg-flame/15 text-flame ring-flame/40',
    neon: 'bg-neon/15 text-neon ring-neon/40',
  }[tone];
  const sz = small ? 'text-[9.5px] px-1.5 py-[2px]' : 'text-[10.5px] px-2 py-0.5';
  return (<span className={`mono inline-flex items-center gap-1 rounded-md font-bold uppercase tracking-wider ring-1 ${cls} ${sz}`}>
    <span className="opacity-70">{k}</span><span>{v}</span>
  </span>);
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'gold' | 'flame' }) {
  const t = tone === 'gold' ? 'text-gold' : 'text-flame';
  return (
    <div className="rounded-lg bg-deep/60 px-3 py-2 ring-1 ring-rope">
      <p className="mono text-[9.5px] uppercase tracking-[0.16em] text-ash">{label}</p>
      <p className={`display mt-0.5 text-[26px] font-bold tabnums ${t}`}>{value}</p>
      <p className="text-[10.5px] text-ash">{sub}</p>
    </div>
  );
}
function Ticket() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M1 6a1 1 0 0 0 1-1V3h12v2a1 1 0 0 0 0 2v2a1 1 0 0 0 0 2v2H2v-2a1 1 0 0 0 0-2V7a1 1 0 0 0-1-1zM6 4v8M9 4v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>
  );
}
function Spin() { return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
