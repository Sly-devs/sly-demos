'use client';

import { useEffect, useState } from 'react';
import { AGENT, FEED, USER, evaluate, shortHash, usd, type BrandOffer } from '@/lib/demo';

interface Event { protocol: string; label: string; }
interface Receipt { id: string; hash: string; payoutCents: number; brand: string; ts: string; }

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-iris/15 text-iris ring-iris/40',
  AP2: 'bg-sand/30 text-graphite ring-sand/60',
  x402: 'bg-mint/15 text-mint ring-mint/40',
};

export default function EchoHome() {
  const [queue, setQueue] = useState<BrandOffer[]>(FEED);
  const [decisions, setDecisions] = useState<Array<{ offer: BrandOffer; decision: 'accept' | 'reject'; reasons: string[] }>>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const earned = receipts.reduce((acc, r) => acc + r.payoutCents, 0);
  const [autoEvalIdx, setAutoEvalIdx] = useState<number | null>(null);

  // Auto-evaluate offers one by one when Run is pressed
  useEffect(() => {
    if (autoEvalIdx === null) return;
    if (autoEvalIdx >= FEED.length) { setAutoEvalIdx(null); return; }
    const tid = window.setTimeout(async () => {
      const o = FEED[autoEvalIdx];
      const res = await fetch('/api/offer', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offerId: o.id, earnedCents: earned }) });
      const data = await res.json();
      setEvents(data.events ?? []);
      setQueue((prev) => prev.filter((q) => q.id !== o.id));
      if (data.decision === 'accept' && data.receipt) {
        setReceipts((p) => [data.receipt, ...p]);
        setDecisions((p) => [...p, { offer: o, decision: 'accept', reasons: [] }]);
      } else {
        setDecisions((p) => [...p, { offer: o, decision: 'reject', reasons: (data.reasons ?? []).map((r: { label: string }) => r.label) }]);
      }
      setAutoEvalIdx(autoEvalIdx + 1);
    }, 850);
    return () => window.clearTimeout(tid);
  }, [autoEvalIdx, earned]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-end justify-between border-b border-mist pb-6">
        <div>
          <p className="display text-[12px] italic text-ash">attention, on your terms — governed by Sly</p>
          <h1 className="display mt-1 text-[44px] font-bold leading-none text-graphite">Echo</h1>
        </div>
        <div className="text-right text-[12px] text-ash">
          <p className="font-semibold text-graphite">{USER.name}</p>
          <p className="mono">parent of Echo · {USER.city}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
        <Stat
          label="Earned this week"
          big={usd(earned)}
          sub={`of ${usd(AGENT.weeklyCapCents)} weekly cap`}
          accent="mint"
        />
        <Stat
          label="Echo policy"
          big={`≥ ${AGENT.minPayoutCents}¢`}
          sub={`brand rep ≥ ${AGENT.brandRepFloor} · KYA T2+ · blocklist: ${AGENT.topicBlocklist.join(', ')}`}
          accent="iris"
        />
        <Stat
          label="This session"
          big={`${decisions.length}/${FEED.length} reviewed`}
          sub={`${decisions.filter((d) => d.decision === 'accept').length} accepted · ${decisions.filter((d) => d.decision === 'reject').length} rejected`}
          accent="sand"
        />
      </section>

      <section className="mt-6 rounded-2xl bg-white p-6 shadow-card ring-1 ring-mist">
        <div className="flex items-center justify-between">
          <div>
            <p className="display text-[20px] text-graphite">Incoming offers</p>
            <p className="text-[12.5px] text-ash">Six brand agents have pinged Echo this minute. Run Echo to filter and settle.</p>
          </div>
          <button
            disabled={autoEvalIdx !== null}
            onClick={() => { setDecisions([]); setReceipts([]); setEvents([]); setQueue(FEED); setAutoEvalIdx(0); }}
            className="inline-flex items-center gap-2 rounded-full bg-graphite px-4 py-2 text-[13px] font-semibold text-veil shadow-card transition hover:bg-iris disabled:opacity-60"
          >
            {autoEvalIdx === null ? <Wave /> : <Spin />}
            {autoEvalIdx === null ? 'Run Echo on this batch' : 'Echo deciding…'}
          </button>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {queue.map((o, idx) => {
            const evalRes = evaluate(o);
            const isCurrent = autoEvalIdx === FEED.findIndex((f) => f.id === o.id);
            return (
              <li
                key={o.id}
                className={`flex flex-col gap-2 rounded-xl bg-veil px-4 py-3 ring-1 ring-mist transition ${isCurrent ? 'animate-slide-out' : ''}`}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13.5px] font-semibold text-graphite">{o.brand}</p>
                    <p className="text-[11.5px] text-ash">{o.topic}</p>
                  </div>
                  <span className="mono text-[12.5px] tabnums font-bold text-mint">{usd(o.payoutCents)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                  <span className="rounded-md bg-iris/10 px-1.5 py-0.5 mono text-iris ring-1 ring-iris/30">KYA T{o.brandKyaTier}</span>
                  <span className="rounded-md bg-chrome px-1.5 py-0.5 mono text-ash ring-1 ring-mist">★ {o.brandRep}</span>
                  <span className="rounded-md bg-chrome px-1.5 py-0.5 mono text-ash ring-1 ring-mist">{o.format}</span>
                  {evalRes.decision === 'reject' && (
                    <span className="rounded-md bg-coral/15 px-1.5 py-0.5 mono text-coral ring-1 ring-coral/40">will reject</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {decisions.length > 0 && (
        <section className="mt-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-mist">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ash">Echo decision ledger</p>
            <ul className="mt-3 space-y-2">
              {decisions.map((d, i) => (
                <li key={i}
                  className={`flex animate-fade-up items-start gap-3 rounded-xl px-3.5 py-2.5 ring-1 ${d.decision === 'accept' ? 'bg-mint/8 ring-mint/40' : 'bg-coral/6 ring-coral/30'}`}>
                  <span className={`mono mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${d.decision === 'accept' ? 'bg-mint text-white' : 'bg-coral text-white'}`}>{d.decision}</span>
                  <div className="flex-1">
                    <p className="text-[13.5px] font-semibold text-graphite">{d.offer.brand} · {usd(d.offer.payoutCents)}</p>
                    {d.reasons.length > 0 ? (
                      <p className="display mt-0.5 text-[12px] italic text-coral/80">{d.reasons.join(' · ')}</p>
                    ) : (
                      <p className="display mt-0.5 text-[12px] italic text-mint">policy match · x402 micropay credited</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-graphite p-5 text-veil shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mint">x402 receipts · signed</p>
            <p className="display mt-2 text-[28px] font-bold">{usd(earned)}</p>
            <p className="text-[11.5px] text-mist">{receipts.length} micropays · this week</p>
            <ul className="mt-3 space-y-1.5 text-[11.5px]">
              {receipts.map((r) => (
                <li key={r.id} className="flex animate-fade-up items-center justify-between rounded-lg bg-graphite/60 px-2.5 py-1.5 ring-1 ring-white/5">
                  <span>{r.brand}</span>
                  <span className="mono text-mint">{usd(r.payoutCents)}</span>
                  <span className="mono text-mist">{shortHash(r.hash)}</span>
                </li>
              ))}
              {receipts.length === 0 && <li className="text-[11.5px] italic text-mist/70">Receipts will land here as Echo accepts.</li>}
            </ul>
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-mist">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ash">Last decision · what Sly did</p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-veil px-3.5 py-2.5 ring-1 ring-mist">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-chrome text-ash ring-mist'}`}>{e.protocol}</span>
                <span className="text-[13px] text-graphite">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash/70">Echo · Built on Sly · Demo</footer>
    </main>
  );
}

function Stat({ label, big, sub, accent }: { label: string; big: string; sub: string; accent: 'mint' | 'iris' | 'sand' }) {
  const tone =
    accent === 'mint' ? 'border-mint/40 bg-mint/8'
    : accent === 'iris' ? 'border-iris/40 bg-iris/6'
    : 'border-sand/60 bg-sand/15';
  return (
    <div className={`rounded-2xl border ${tone} p-5 shadow-card`}>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ash">{label}</p>
      <p className="display mt-1.5 text-[32px] font-bold text-graphite">{big}</p>
      <p className="mt-1 text-[11.5px] text-ash">{sub}</p>
    </div>
  );
}
function Wave() {
  return (
    <span className="inline-flex items-end gap-[2px]">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="h-3 w-[3px] bg-current animate-wave" style={{ animationDelay: `${i * 120}ms`, transformOrigin: 'bottom' }} />
      ))}
    </span>
  );
}
function Spin() { return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
