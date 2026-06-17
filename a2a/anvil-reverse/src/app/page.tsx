'use client';

import { useState } from 'react';
import { ANVIL_AGENT, BUYER, INCOMING_BIDS, INTENT, scoreBid, shortHash, usd, type Scored } from '@/lib/demo';

interface Event { protocol: string; label: string; }

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-cyan/15 text-cyan ring-cyan/40',
  A2A: 'bg-spark/15 text-spark ring-spark/40',
  AP2: 'bg-weld/15 text-weld ring-weld/40',
  ACP: 'bg-green/15 text-green ring-green/40',
};

export default function AnvilHome() {
  const [scored, setScored] = useState<Scored[]>(INCOMING_BIDS.map((b) => scoreBid(b)));
  const [winner, setWinner] = useState<{ seller: string; priceCents: number; hash: string } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [pending, setPending] = useState(false);

  async function award() {
    setPending(true);
    try {
      const res = await fetch('/api/bid', { method: 'POST' });
      const data = await res.json();
      // Animate the re-rank
      const sortedScored: Scored[] = data.scored ?? [];
      sortedScored.sort((a, b) => b.score - a.score);
      setScored(sortedScored);
      await new Promise((r) => setTimeout(r, 600));
      setEvents(data.events ?? []);
      if (data.winner) setWinner({ seller: data.winner.seller, priceCents: data.winner.priceCents, hash: data.txHash });
    } finally { setPending(false); }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-end justify-between border-b border-line pb-6">
        <div>
          <p className="mono text-[10.5px] uppercase tracking-[0.22em] text-gunmetal">reverse marketplace · KYA-bonded · Sly</p>
          <h1 className="mt-2 text-[44px] font-bold leading-none tracking-tight text-chalk">
            Anvil<span className="text-weld">.</span>
          </h1>
        </div>
        <div className="text-right text-[12px] text-gunmetal">
          <p className="font-semibold text-chalk">{BUYER.name}</p>
          <p className="mono">{BUYER.org}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-slate p-6 shadow-plate">
          <div className="gridbg absolute inset-0 opacity-50" />
          <div className="relative">
            <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-gunmetal">posted intent</p>
            <p className="mt-2 text-[22px] font-semibold tracking-tight text-chalk">{INTENT.title}</p>
            <p className="mt-2 text-[13px] text-gunmetal">{INTENT.rubric}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px]">
              <Chip k="ceiling" v={usd(INTENT.ceilingCents)} tone="weld" />
              <Chip k="deadline" v={`${INTENT.deadlineDays} days`} tone="spark" />
              <Chip k="picker" v={`Anvil KYA T${ANVIL_AGENT.kyaTier} · rep floor ${ANVIL_AGENT.repFloor}`} tone="cyan" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-plate p-6 shadow-plate">
          <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-gunmetal">picker policy</p>
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-chalk/90">
            <li><span className="text-weld mono">•</span> KYA tier ≥ T{ANVIL_AGENT.kyaFloor} (below = no rank)</li>
            <li><span className="text-weld mono">•</span> Reputation ≥ {ANVIL_AGENT.repFloor}</li>
            <li><span className="text-weld mono">•</span> Price ≤ ceiling · delivery ≤ deadline</li>
            <li><span className="text-weld mono">•</span> Score = 35·priceFit + 30·rep + 20·KYA + 10·speed + 5·bond</li>
          </ul>
          <button onClick={award} disabled={pending || !!winner}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-weld px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider text-steel shadow-weld transition hover:bg-spark hover:text-steel disabled:opacity-60">
            {pending ? <Spin /> : <Hammer />}
            {pending ? 'Anvil ranking…' : winner ? 'Awarded' : 'Send to Anvil'}
          </button>
        </div>
      </section>

      <section className="mt-6">
        <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-gunmetal">incoming bids · ranked</p>
        <ul className="mt-3 space-y-2.5">
          {scored.map((b, i) => {
            const isWinner = winner && winner.seller === b.seller;
            return (
              <li key={b.id}
                className={`flex animate-fade-up items-center gap-4 rounded-xl px-4 py-3 shadow-plate transition ${isWinner ? 'bg-weld/10 ring-2 ring-weld' : b.eligible ? 'bg-slate ring-1 ring-line' : 'bg-slate/50 ring-1 ring-line opacity-60'}`}
                style={{ animationDelay: `${i * 60}ms` }}>
                <span className={`mono inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[14px] font-bold ${isWinner ? 'bg-weld text-steel' : b.eligible ? 'bg-plate text-chalk ring-1 ring-line' : 'bg-plate/50 text-gunmetal ring-1 ring-line'}`}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-[14px] font-semibold text-chalk truncate">{b.seller}</p>
                    <Chip k="KYA" v={`T${b.kyaTier}`} tone={b.kyaTier >= ANVIL_AGENT.kyaFloor ? 'cyan' : 'gun'} small />
                    <Chip k="★" v={b.rep ? b.rep.toFixed(1) : '—'} tone={b.rep >= ANVIL_AGENT.repFloor ? 'spark' : 'gun'} small />
                    <Chip k="bond" v={usd(b.bondCents)} tone="gun" small />
                  </div>
                  <p className="mt-0.5 text-[12px] text-gunmetal italic truncate">{b.pitch}</p>
                  {b.reasons.length > 0 && (
                    <p className="mt-1 text-[11px] text-weld">rejected · {b.reasons.join(' · ')}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`mono text-[16px] font-bold tabnums ${isWinner ? 'text-weld' : 'text-chalk'}`}>{usd(b.priceCents)}</p>
                  <p className="mono text-[10.5px] text-gunmetal">{b.deliveryDays}d · score {b.score.toFixed(1)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {events.length > 0 && (
        <section className="mt-6 rounded-2xl bg-slate p-5 ring-1 ring-line shadow-plate">
          <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-gunmetal">what Sly did, in order</p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-plate px-3.5 py-2.5 ring-1 ring-line">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-plate text-gunmetal ring-line'}`}>{e.protocol}</span>
                <span className="text-[13px] text-chalk/90">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {winner && (
        <section className="relative mt-6 overflow-hidden rounded-2xl border-2 border-weld bg-weld/8 p-6 shadow-weld">
          <span className="mono absolute right-6 top-6 rounded-md border border-weld px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-weld">
            settled · {shortHash(winner.hash)}
          </span>
          <p className="mono text-[10.5px] uppercase tracking-[0.16em] text-gunmetal">awarded</p>
          <p className="mt-2 text-[28px] font-bold tracking-tight text-chalk">{winner.seller}</p>
          <p className="mono mt-1 text-[14px] text-weld">{usd(winner.priceCents)} · ACP checkout signed</p>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-gunmetal/70">Anvil · Built on Sly · Demo</footer>
    </main>
  );
}

function Chip({ k, v, tone, small }: { k: string; v: string; tone: 'weld' | 'spark' | 'cyan' | 'gun'; small?: boolean }) {
  const cls = {
    weld: 'bg-weld/15 text-weld ring-weld/40',
    spark: 'bg-spark/15 text-spark ring-spark/40',
    cyan: 'bg-cyan/15 text-cyan ring-cyan/40',
    gun: 'bg-plate text-gunmetal ring-line',
  }[tone];
  const sz = small ? 'text-[9.5px] px-1.5 py-[2px]' : 'text-[10.5px] px-2 py-0.5';
  return (
    <span className={`mono inline-flex items-center gap-1 rounded-md font-bold uppercase tracking-wider ring-1 ${cls} ${sz}`}>
      <span className="opacity-70">{k}</span>
      <span>{v}</span>
    </span>
  );
}
function Hammer() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 4l6 6-3 3-6-6 3-3zM11 7l-7 7v4h4l7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Spin() { return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
