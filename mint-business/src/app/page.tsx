'use client';

import { useState } from 'react';
import { OWNER, SEED_JOBS, SHOP, marginPct, shortHash, usd, type Job } from '@/lib/demo';

interface Event { protocol: string; label: string; }
interface ExtJob extends Job { rejectReasons?: string[] }

const STATUS_TONE: Record<JobStatus, string> = {
  queued: 'bg-plate text-ash ring-line',
  sourcing: 'bg-ledger/15 text-ledger ring-ledger/40',
  'in-progress': 'bg-gain/15 text-gain ring-gain/40 animate-pulse',
  shipped: 'bg-gain/15 text-gain ring-gain/40',
  failed: 'bg-loss/15 text-loss ring-loss/40',
};
type JobStatus = Job['status'];

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-gain/15 text-gain ring-gain/30',
  AP2: 'bg-ledger/15 text-ledger ring-ledger/40',
  ACP: 'bg-gain/15 text-gain ring-gain/30',
};

export default function MintHome() {
  const [jobs, setJobs] = useState<ExtJob[]>(SEED_JOBS);
  const [events, setEvents] = useState<Event[]>([]);
  const [pending, setPending] = useState(false);
  const [tickedOnce, setTickedOnce] = useState(false);

  const revenueCents = jobs.filter((j) => j.status === 'shipped').reduce((acc, j) => acc + j.priceCents, 0);
  const costCents = jobs.filter((j) => j.status === 'shipped').reduce((acc, j) => acc + j.costCents, 0);
  const netCents = revenueCents - costCents;
  const dividendCents = Math.round(netCents * SHOP.dividendPct);
  const retainedCents = netCents - dividendCents;

  async function tick() {
    setPending(true);
    try {
      const res = await fetch('/api/tick', { method: 'POST' });
      const data = await res.json();
      setEvents(data.events ?? []);
      const incoming: ExtJob[] = data.decisions ?? [];
      // Stagger reveal
      for (const j of incoming) {
        await new Promise((r) => setTimeout(r, 400));
        setJobs((p) => [j, ...p]);
      }
      setTickedOnce(true);
    } finally { setPending(false); }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-end justify-between border-b border-line pb-6">
        <div>
          <p className="mono text-[10.5px] uppercase tracking-[0.22em] text-ash">agent-run micro-business · governed by Sly</p>
          <h1 className="display mt-1 text-[44px] font-bold italic leading-none text-bone">{SHOP.name}<span className="text-gain">.</span></h1>
          <p className="display text-[18px] italic text-ledger">{SHOP.blurb}</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-semibold text-bone">{OWNER.name}</p>
          <p className="mono text-[10.5px] text-ash">{OWNER.org}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-4">
        <Stat label="Revenue today"  value={usd(revenueCents)} sub={`${jobs.filter((j) => j.status === 'shipped').length} shipped`} tone="bone" />
        <Stat label="Sourcing cost"  value={`−${usd(costCents)}`} sub={`avg ${jobs.length > 0 ? Math.round(costCents / Math.max(1, jobs.filter((j) => j.status === 'shipped').length) / 100) : 0}/job`} tone="loss" />
        <Stat label="Net profit"     value={usd(netCents)} sub={`margin ${Math.round((netCents / Math.max(1, revenueCents)) * 100)}%`} tone="gain" />
        <Stat label="Owner dividend" value={usd(dividendCents)} sub={`${SHOP.dividendPct * 100}% Fri payout · ${usd(retainedCents)} retained`} tone="ledger" />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl bg-deck p-6 shadow-card ring-1 ring-line">
          <div className="flex items-center justify-between">
            <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">work-in-progress · live</p>
            <button onClick={tick} disabled={pending || tickedOnce}
              className="mono inline-flex items-center gap-2 rounded-md bg-gain px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink shadow-gain transition hover:bg-bone disabled:opacity-60">
              {pending ? <Spin /> : '▸'} next tick
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {jobs.map((j) => {
              const margin = marginPct(j.priceCents, j.costCents);
              return (
                <li key={j.id} className={`flex animate-fade-up items-center gap-3 rounded-xl bg-plate px-3.5 py-2.5 ring-1 ${j.status === 'failed' ? 'ring-loss/30 opacity-80' : j.status === 'shipped' ? 'ring-gain/20' : 'ring-line'}`}>
                  {(j.status === 'in-progress' || j.status === 'sourcing') && (
                    <span className="relative inline-flex h-2 w-2 shrink-0">
                      <span className="absolute inset-0 rounded-full bg-gain animate-pulse-dot" />
                      <span className="absolute inset-0 rounded-full bg-gain" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="mono text-[10.5px] text-ash">{j.id}</p>
                      <p className="text-[13px] font-semibold text-bone truncate">{j.client}</p>
                      <span className="mono text-[9.5px] text-ash">KYA T{j.clientKyaTier}</span>
                    </div>
                    <p className="text-[11.5px] text-ash truncate">{j.description}</p>
                    {j.rejectReasons && j.rejectReasons.length > 0 && (
                      <p className="mono text-[10.5px] text-loss">rejected · {j.rejectReasons.join(' · ')}</p>
                    )}
                    {j.status !== 'failed' && (
                      <p className="mono text-[10.5px] text-ash">sourced from <span className="text-ledger">{j.sourcedFrom}</span></p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="mono text-[12px] tabnums text-bone">{usd(j.priceCents)}<span className="text-ash"> in</span></p>
                    <p className="mono text-[10.5px] tabnums text-loss">−{usd(j.costCents)}<span className="text-ash"> out</span></p>
                    <p className={`mono text-[10.5px] tabnums ${margin >= SHOP.minMarginPct ? 'text-gain' : 'text-loss'}`}>{Math.round(margin * 100)}% margin</p>
                  </div>
                  <span className={`mono shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${STATUS_TONE[j.status]}`}>{j.status}</span>
                  {j.txHash && <span className="mono shrink-0 text-[10px] text-ledger">{shortHash(j.txHash)}</span>}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl bg-deck p-5 shadow-card ring-1 ring-line">
            <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">shop policy</p>
            <ul className="mt-2 space-y-1 text-[12.5px] text-bone/90">
              <li><span className="text-gain mono">·</span> refuse jobs under {SHOP.minMarginPct * 100}% margin</li>
              <li><span className="text-gain mono">·</span> source cost ≤ ${SHOP.maxSourceCostCents / 100}/job</li>
              <li><span className="text-gain mono">·</span> client KYA ≥ T2</li>
              <li><span className="text-gain mono">·</span> Friday: {SHOP.dividendPct * 100}% net to owner · {SHOP.reservePct * 100}% reserve</li>
            </ul>
            <p className="mono mt-3 text-[10px] text-ash">all on-Sly · no human at the wheel</p>
          </div>

          <div className="rounded-2xl bg-deck p-5 shadow-card ring-1 ring-line">
            <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">dividend schedule</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="display text-[36px] font-bold tabnums text-ledger">{usd(dividendCents)}</p>
              <p className="mono text-[11px] text-ash">next Fri · {OWNER.name.split(' ')[0]}</p>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-plate">
              <div className="bg-ledger" style={{ width: `${SHOP.dividendPct * 100}%` }} />
              <div className="bg-gainsoft" style={{ width: `${SHOP.reservePct * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between mono text-[10px] text-ash">
              <span>owner {SHOP.dividendPct * 100}%</span>
              <span>reserve {SHOP.reservePct * 100}%</span>
            </div>
          </div>
        </div>
      </section>

      {events.length > 0 && (
        <section className="mt-6 rounded-2xl bg-deck p-5 ring-1 ring-line shadow-card">
          <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">last tick · what Sly did</p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-plate px-3.5 py-2.5 ring-1 ring-line">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-plate text-ash ring-line'}`}>{e.protocol}</span>
                <span className="text-[13px] text-bone/90">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash/60">Mint · Built on Sly · Demo</footer>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'gain' | 'loss' | 'ledger' | 'bone' }) {
  const t = tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : tone === 'ledger' ? 'text-ledger' : 'text-bone';
  return (
    <div className="rounded-2xl bg-deck p-5 shadow-card ring-1 ring-line">
      <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">{label}</p>
      <p className={`display mt-1 text-[32px] font-bold leading-none tabnums ${t}`}>{value}</p>
      <p className="mt-1 mono text-[10.5px] text-ash">{sub}</p>
    </div>
  );
}
function Spin() { return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
