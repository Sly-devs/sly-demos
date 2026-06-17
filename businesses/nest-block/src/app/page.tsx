'use client';

import { useState } from 'react';
import { NEIGHBORS, POLICY, YOU, evaluateFavor, shortHash, usd, type FavorOffer, type Neighbor } from '@/lib/demo';

interface Event { protocol: string; label: string; }
interface Receipt { id: string; neighbor: string; offerTitle: string; amountCents: number; isFavor: boolean; hash: string; ts: string; }

const KIND_TONE: Record<FavorOffer['kind' ], string> = {
  tool: 'bg-mast text-ink',
  service: 'bg-mosssoft text-moss',
  meal: 'bg-sun/20 text-ink',
  pet: 'bg-sky/20 text-ink',
};

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-mosssoft text-moss ring-moss/30',
  AP2: 'bg-sun/20 text-ink ring-sun/40',
  ACP: 'bg-bricksoft text-brick ring-brick/30',
  A2A: 'bg-sky/20 text-ink ring-sky/40',
  x402: 'bg-mosssoft text-moss ring-moss/30',
};

export default function NestHome() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [denyById, setDenyById] = useState<Record<string, string[]>>({});

  async function borrow(offer: FavorOffer) {
    setPendingId(offer.id);
    try {
      const res = await fetch('/api/borrow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offerId: offer.id }) });
      const data = await res.json();
      setEvents(data.events ?? []);
      if (data.receipt) {
        setReceipts((p) => [data.receipt, ...p]);
        setDenyById((p) => { const n = { ...p }; delete n[offer.id]; return n; });
      } else if (data.reasons) {
        setDenyById((p) => ({ ...p, [offer.id]: data.reasons.map((r: { label: string }) => r.label) }));
      }
    } finally { setPendingId(null); }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-end justify-between border-b border-mast pb-5">
        <div>
          <p className="display text-[20px] leading-none text-sun">your block — governed by Sly</p>
          <h1 className="serif mt-1 text-[44px] font-bold leading-none italic text-ink">Nest<span className="text-moss">.</span></h1>
        </div>
        <div className="text-right text-[12px] text-ash">
          <p className="font-semibold text-ink">{YOU.name}</p>
          <p className="display text-[16px] leading-none text-ink">{YOU.house}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* the block map */}
        <div className="relative overflow-hidden rounded-3xl border border-mast bg-cream p-6 shadow-paper">
          <div className="flex items-center justify-between">
            <p className="display text-[18px] text-ink">Linden St · the block tonight</p>
            <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">A2A mesh · {NEIGHBORS.filter((n) => n.kyaTier >= POLICY.kyaFloor).length} verified</p>
          </div>

          {/* the map */}
          <div className="relative mt-3 h-[260px] rounded-2xl border border-mast bg-paper dotgrid overflow-hidden">
            {/* a "street" line */}
            <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-mast" />
            <p className="display absolute left-3 top-2 text-[14px] text-ash">Linden St</p>

            {/* YOU pin */}
            <div className="absolute" style={{ left: '50%', top: '52%', transform: 'translate(-50%, -50%)' }}>
              <span className="block h-3 w-3 rounded-full bg-brick ring-2 ring-paper" />
              <p className="display absolute left-1/2 top-4 -translate-x-1/2 text-[15px] text-brick whitespace-nowrap">{YOU.house}</p>
            </div>

            {/* neighbor pins */}
            {NEIGHBORS.map((n) => {
              const verified = n.kyaTier >= POLICY.kyaFloor && n.blockRep >= POLICY.repFloor;
              return (
                <div key={n.id}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="absolute animate-pin-drop"
                  style={{ left: `${n.pin.x}%`, top: `${n.pin.y}%`, transform: 'translate(-50%,-50%)' }}>
                  <span className={`block h-3 w-3 rounded-full ring-2 ring-paper ${verified ? 'bg-moss' : 'bg-brick/60'}`} />
                  <p className="display absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap text-[13px] text-ash">{n.handle.split(' · ')[0]}</p>
                </div>
              );
            })}
          </div>

          {/* hovered card */}
          {hovered && (() => {
            const n = NEIGHBORS.find((x) => x.id === hovered)!;
            return (
              <div className="mt-3 rounded-xl border border-mast bg-paper p-3 ring-1 ring-mast/40 animate-fade-up">
                <p className="serif italic text-[13px] text-ink">{n.handle} · in for {n.movedInYears} yrs · agent {n.agent}</p>
                <p className="mono mt-1 text-[10.5px] text-ash">KYA T{n.kyaTier} · block-rep {n.blockRep}</p>
              </div>
            );
          })()}
        </div>

        {/* policy + receipts */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-mast bg-paper p-5 shadow-paper">
            <p className="display text-[20px] text-sun">your Nest agent</p>
            <ul className="mt-2 space-y-1 text-[12.5px] text-ink/90">
              <li><span className="text-moss mono">·</span> only accepts neighbors at KYA T{POLICY.kyaFloor}+ and block-rep ≥ {POLICY.repFloor}</li>
              <li><span className="text-moss mono">·</span> per-favor ceiling {usd(POLICY.perFavorCeilingCents)}</li>
              <li><span className="text-moss mono">·</span> $0 favors return a Sly favor-token (logged, not paid)</li>
              <li><span className="text-moss mono">·</span> rotcat99 will be rejected at the rope</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-mast bg-paper p-5 shadow-paper">
            <p className="display text-[20px] text-moss">block ledger</p>
            <p className="serif mt-1 italic text-[12.5px] text-ash">{receipts.length} transactions · {receipts.filter((r) => r.isFavor).length} favors · {receipts.filter((r) => !r.isFavor).length} paid</p>
            {receipts.length === 0 && <p className="display mt-1 text-[15px] text-ash">tap a neighbor below to start</p>}
            <ul className="mt-2 space-y-1.5 text-[12px]">
              {receipts.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-md bg-cream px-2.5 py-1.5 ring-1 ring-mast">
                  <span className="truncate text-ink">{r.neighbor.split(' · ')[0]}</span>
                  <span className="mono text-moss">{r.isFavor ? 'favor' : usd(r.amountCents)}</span>
                  <span className="mono text-ash">{shortHash(r.hash)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <p className="display text-[20px] text-ink">tonight on the block</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NEIGHBORS.flatMap((n) => n.offers.map((o) => ({ n, o }))).map(({ n, o }) => {
            const evalRes = evaluateFavor(n, o);
            const denied = denyById[o.id];
            return (
              <li key={o.id}
                className={`relative rounded-2xl bg-paper p-4 shadow-paper ring-1 transition ${denied ? 'ring-brick/40' : evalRes.decision === 'deny' ? 'ring-mast opacity-80' : 'ring-mast hover:-rotate-1 hover:ring-moss/40'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`serif inline-flex h-9 w-9 items-center justify-center rounded-md text-[20px] ${KIND_TONE[o.kind]}`}>{o.icon}</span>
                  <span className="mono text-[10.5px] text-ash">{n.house}</span>
                </div>
                <p className="serif mt-2 text-[15px] text-ink">{o.title}</p>
                <p className="display text-[16px] text-ash">— {n.handle.split(' · ')[0]}</p>
                <p className="mt-1 text-[12px] italic text-ash">{o.pitch}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <Pill k="KYA" v={`T${n.kyaTier}`} tone={n.kyaTier >= POLICY.kyaFloor ? 'moss' : 'brick'} />
                  <Pill k="★" v={n.blockRep.toFixed(1)} tone={n.blockRep >= POLICY.repFloor ? 'sun' : 'brick'} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="serif text-[18px] text-ink tabnums">{o.rateCents === 0 ? <span className="text-moss">favor</span> : usd(o.rateCents)}</p>
                  <button onClick={() => borrow(o)} disabled={pendingId === o.id}
                    className={`mono inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider ring-1 transition disabled:opacity-60 ${evalRes.decision === 'allow' ? 'bg-moss text-paper ring-moss hover:bg-ink' : 'bg-bricksoft text-brick ring-brick/40 hover:bg-brick/15'}`}>
                    {pendingId === o.id ? <Spin /> : evalRes.decision === 'allow' ? 'ask' : 'ask (deny)'}
                  </button>
                </div>
                {denied && (
                  <p className="mt-2 text-[10.5px] text-brick animate-fade-up">{denied.join(' · ')}</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {events.length > 0 && (
        <section className="mt-6 rounded-2xl border border-mast bg-paper p-5 shadow-paper">
          <p className="display text-[18px] text-sun">last beat · what Sly did</p>
          <ol className="mt-2 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-cream px-3.5 py-2 ring-1 ring-mast">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-cream text-ash ring-mast'}`}>{e.protocol}</span>
                <span className="text-[12.5px] text-ink">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash/70">Nest · Built on Sly · Demo</footer>
    </main>
  );
}

function Pill({ k, v, tone }: { k: string; v: string; tone: 'moss' | 'sun' | 'brick' }) {
  const cls = {
    moss: 'bg-mosssoft text-moss ring-moss/40',
    sun: 'bg-sun/15 text-ink ring-sun/40',
    brick: 'bg-bricksoft text-brick ring-brick/40',
  }[tone];
  return (<span className={`mono inline-flex items-center gap-1 rounded-md px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-wider ring-1 ${cls}`}><span className="opacity-70">{k}</span><span>{v}</span></span>);
}
function Spin() { return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
