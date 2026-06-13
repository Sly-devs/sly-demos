'use client';

import { useState } from 'react';
import { KID_AGENT, LISTINGS, PARENT, coins, evaluate, shortHash, usd, type Listing } from '@/lib/demo';

interface Event { protocol: string; label: string; }
interface Receipt { id: string; listing: string; seller: string; priceCents: number; mechanic: string; hash: string; ts: string; }

const RARITY_TONE: Record<Listing['rarity'], string> = {
  common: 'ring-common/40 text-common',
  rare: 'ring-rare/40 text-rare',
  legendary: 'ring-legendary/40 text-legendary',
};

const MECH_LABEL: Record<Listing['mechanic'], string> = {
  direct: 'direct buy',
  'loot-box': 'loot box',
  'random-pull': 'random pull',
  'a2a-peer': 'peer trade',
};

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-sky/15 text-sky ring-sky/40',
  AP2: 'bg-magenta/15 text-magenta ring-magenta/40',
  ACP: 'bg-lime/15 text-lime ring-lime/40',
  A2A: 'bg-coin/15 text-coin ring-coin/40',
};

export default function PocketHome() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [denyAt, setDenyAt] = useState<string | null>(null);

  const spentCents = receipts.reduce((acc, r) => acc + r.priceCents, 0);

  async function buy(l: Listing) {
    setPendingId(l.id);
    try {
      const res = await fetch('/api/buy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ listingId: l.id, spentCents }) });
      const data = await res.json();
      setEvents(data.events ?? []);
      if (data.receipt) {
        setReceipts((p) => [data.receipt, ...p]);
        setDenyAt(null);
      } else {
        setDenyAt(l.id);
        window.setTimeout(() => setDenyAt((id) => id === l.id ? null : id), 700);
      }
    } finally { setPendingId(null); }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-end justify-between border-b border-line pb-5">
        <div className="flex items-center gap-3">
          <span className="display inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-magenta/15 text-[14px] text-magenta ring-2 ring-magenta/40 animate-bob">P</span>
          <div>
            <p className="mono text-[10.5px] uppercase tracking-[0.22em] text-ash">in-game wallet · governed by Sly</p>
            <h1 className="display mt-1 text-[28px] leading-none text-magenta">POCKET<span className="text-sky">.</span></h1>
          </div>
        </div>
        <div className="text-right">
          <p className="display text-[10px] text-sky">parent: {PARENT.name}</p>
          <p className="mono text-[10.5px] text-ash">kid · {PARENT.kid}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        {/* Kid HUD */}
        <div className="relative overflow-hidden rounded-2xl bg-deep p-6 shadow-hud ring-1 ring-line bg-scan">
          <div className="flex items-center justify-between">
            <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">stratos · player HUD</p>
            <p className="mono text-[10.5px] text-sky">@zeke11</p>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="display inline-flex h-12 w-12 items-center justify-center rounded-full bg-coin/15 text-[14px] text-coin animate-sparkle ring-2 ring-coin/40">$</span>
            <div>
              <p className="display text-[28px] leading-none text-coin">{coins(1240 - Math.round(spentCents / 100 * 100))}</p>
              <p className="mono text-[10.5px] text-ash">coin balance · {usd((1240 - Math.round(spentCents / 100 * 100)) / 100 * 100)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[10.5px]">
            <Stat label="spent today" value={usd(spentCents)} sub={`of ${usd(KID_AGENT.dailyCapCents)} cap`} tone="magenta" />
            <Stat label="per item max" value={usd(KID_AGENT.perItemCapCents)} sub="set by parent" tone="sky" />
            <Stat label="items" value={`${receipts.length}`} sub="bought today" tone="lime" />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg ring-1 ring-line">
            <div className="h-full bg-gradient-to-r from-coin via-magenta to-sky transition-all" style={{ width: `${Math.min(100, (spentCents / KID_AGENT.dailyCapCents) * 100)}%` }} />
          </div>
        </div>

        {/* Parent guardrails panel */}
        <div className="rounded-2xl border border-line bg-lane/30 p-6 ring-1 ring-line">
          <p className="display text-[12px] text-sky">PARENT GUARDRAILS</p>
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-bone/90">
            <li><span className="text-lime mono">·</span> daily cap {usd(KID_AGENT.dailyCapCents)}</li>
            <li><span className="text-lime mono">·</span> per item ≤ {usd(KID_AGENT.perItemCapCents)}</li>
            <li><span className="text-lime mono">·</span> mechanic blocklist: <span className="mono text-deny">loot-box · random-pull</span></li>
            <li><span className="text-lime mono">·</span> peer trades require KYA T{KID_AGENT.counterpartyKyaFloor}+ seller</li>
            <li><span className="text-lime mono">·</span> no real-money top-ups without {PARENT.name.split(' ')[0]}'s tap</li>
          </ul>
          <p className="mono mt-3 text-[10px] text-ash">Sly enforces these between {KID_AGENT.name} and every Stratos checkout.</p>
        </div>
      </section>

      <section className="mt-8">
        <p className="display text-[12px] text-lime">SHOP + PEER MARKET</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LISTINGS.map((l) => {
            const evalRes = evaluate(l, spentCents);
            const isShaking = denyAt === l.id;
            return (
              <li key={l.id}
                className={`flex flex-col gap-2 rounded-2xl bg-deep p-4 ring-2 transition ${RARITY_TONE[l.rarity]} ${evalRes.verdict === 'deny' ? 'opacity-90' : ''} ${isShaking ? 'animate-shake shadow-denyglow' : ''}`}>
                <div className="flex items-start justify-between">
                  <span className={`display inline-flex h-12 w-12 items-center justify-center rounded-xl bg-bg text-[26px] ring-1 ${l.rarity === 'legendary' ? 'text-legendary ring-legendary/30' : l.rarity === 'rare' ? 'text-rare ring-rare/30' : 'text-common ring-line'}`}>{l.art}</span>
                  <span className={`mono rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ${l.rarity === 'legendary' ? 'bg-legendary/15 text-legendary ring-legendary/40' : l.rarity === 'rare' ? 'bg-rare/15 text-rare ring-rare/40' : 'bg-common/15 text-common ring-line'}`}>{l.rarity}</span>
                </div>
                <p className="text-[14px] font-semibold text-bone">{l.title}</p>
                <p className="text-[11.5px] text-ash">{l.blurb}</p>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="mono text-ash">{l.seller} · <span className={l.sellerKyaTier >= KID_AGENT.counterpartyKyaFloor ? 'text-lime' : 'text-deny'}>KYA T{l.sellerKyaTier}</span></span>
                  <span className={`mono rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${KID_AGENT.blockedMechanics.includes(l.mechanic as typeof KID_AGENT.blockedMechanics[number]) ? 'bg-deny/15 text-deny ring-deny/40' : l.mechanic === 'a2a-peer' ? 'bg-coin/15 text-coin ring-coin/40' : 'bg-lane text-ash ring-line'}`}>{MECH_LABEL[l.mechanic]}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="display text-[14px] text-coin">{coins(l.priceCoins)}<span className="mono text-[10px] text-ash"> · {usd(evalRes.priceCents)}</span></p>
                  <button disabled={pendingId === l.id}
                    onClick={() => buy(l)}
                    className={`mono inline-flex items-center gap-1 rounded-md px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider ring-1 transition disabled:opacity-60 ${evalRes.verdict === 'allow' ? 'bg-lime text-bg ring-lime hover:bg-coin' : 'bg-deny/15 text-deny ring-deny/40'}`}>
                    {pendingId === l.id ? <Spin /> : evalRes.verdict === 'allow' ? 'buy' : 'sly will block'}
                  </button>
                </div>
                {evalRes.verdict === 'deny' && (
                  <p className="mono text-[10px] text-deny">{evalRes.reasons.map((r) => r.label).join(' · ')}</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {events.length > 0 && (
        <section className="mt-6 rounded-2xl bg-deep p-5 ring-1 ring-line shadow-hud">
          <p className="display text-[10px] text-sky">LAST DECISION · WHAT SLY DID</p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-lane/40 px-3.5 py-2.5 ring-1 ring-line">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-lane text-ash ring-line'}`}>{e.protocol}</span>
                <span className="text-[13px] text-bone/90">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {receipts.length > 0 && (
        <section className="mt-6 rounded-2xl bg-deep p-5 ring-1 ring-line">
          <p className="display text-[10px] text-coin">INVENTORY · {receipts.length} ITEMS</p>
          <ul className="mt-3 space-y-1.5">
            {receipts.map((r) => (
              <li key={r.id} className="flex animate-fade-up items-center justify-between rounded-lg bg-lane/40 px-3 py-2 ring-1 ring-line">
                <span className="truncate text-[12.5px] text-bone">{r.listing} <span className="text-ash">— {r.seller}</span></span>
                <span className="mono text-[10.5px] text-coin">{usd(r.priceCents)}</span>
                <span className="mono text-[10.5px] text-ash">{shortHash(r.hash)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash/60">Pocket · Built on Sly · Demo</footer>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'magenta' | 'sky' | 'lime' }) {
  const t = tone === 'magenta' ? 'text-magenta' : tone === 'sky' ? 'text-sky' : 'text-lime';
  return (
    <div className="rounded-md bg-bg px-2 py-1.5 ring-1 ring-line">
      <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-ash">{label}</p>
      <p className={`mono mt-0.5 text-[12px] tabnums font-bold ${t}`}>{value}</p>
      <p className="text-[9px] text-ash">{sub}</p>
    </div>
  );
}
function Spin() { return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
