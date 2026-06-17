'use client';

import { useEffect, useState } from 'react';
import {
  AGENT,
  HOLDER,
  PORTFOLIO,
  shortHash,
  usd,
  type Trade,
} from '@/lib/demo';

interface Event {
  protocol: string;
  label: string;
}

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-cobalt/10 text-cobalt ring-cobalt/30',
  AP2: 'bg-amber/15 text-amber ring-amber/35',
  MPP: 'bg-emerald-soft text-emerald-deep ring-emerald/30',
};

interface RemoteState {
  navUsd: number;
  drawdownPct: number;
  perTradeCeilingUsd: number;
  bands: { usdc: number; eth: number; exp: number };
  kyaTier: number;
}

export default function QuartzHome() {
  const [state, setState] = useState<RemoteState | null>(null);
  const [trades, setTrades] = useState<Trade[]>([
    {
      id: 'tr_seed_1',
      ts: new Date(Date.now() - 7 * 86400e3).toISOString(),
      side: 'BUY',
      assetIn: 'USDC',
      assetOut: 'ETH',
      amountUsd: 250,
      policyDecisionId: 'pd_seed_1',
      txHash: '0x4f7a8d3c2e1b6790',
      status: 'allowed',
    },
    {
      id: 'tr_seed_2',
      ts: new Date(Date.now() - 14 * 86400e3).toISOString(),
      side: 'BUY',
      assetIn: 'USDC',
      assetOut: 'EXP',
      amountUsd: 100,
      policyDecisionId: 'pd_seed_2',
      txHash: '0x8c1e2a9b4d7f3450',
      status: 'allowed',
    },
  ]);
  const [pendingTrade, setPendingTrade] = useState(false);
  const [pendingRebalance, setPendingRebalance] = useState(false);
  const [denial, setDenial] = useState<{
    reason: string;
    decisionId: string;
  } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let alive = true;
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => alive && setState(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function runDCA() {
    setPendingTrade(true);
    setDenial(null);
    try {
      const res = await fetch('/api/trade', { method: 'POST' });
      const data = await res.json();
      setEvents(data.events ?? []);
      if (data.trade) setTrades((prev) => [data.trade, ...prev]);
    } finally {
      setPendingTrade(false);
    }
  }

  async function tryForceRebalance() {
    setPendingRebalance(true);
    setDenial(null);
    try {
      const res = await fetch('/api/rebalance', { method: 'POST' });
      const data = await res.json();
      setEvents(data.events ?? []);
      setDenial({ reason: data.reason, decisionId: data.policyDecisionId });
    } finally {
      setPendingRebalance(false);
    }
  }

  const navUsd = state?.navUsd ?? PORTFOLIO.navUsd;
  const bands = state?.bands ?? PORTFOLIO.bands;
  const holdings = [
    { asset: 'USDC', amountUsd: navUsd * bands.usdc, label: 'USDC · stable', color: '#0f9d6a', pct: bands.usdc },
    { asset: 'ETH', amountUsd: navUsd * bands.eth, label: 'ETH · large-cap', color: '#2a52c9', pct: bands.eth },
    { asset: 'EXP', amountUsd: navUsd * bands.exp, label: 'EXP · experimental', color: '#5a48d6', pct: bands.exp },
  ];

  // Stroke-dasharray donut math
  const C = 2 * Math.PI * 70; // r=70

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-mist pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald/10 ring-1 ring-emerald/30">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2 4 7v10l8 5 8-5V7l-8-5z" stroke="#0f9d6a" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M12 7v10M8 9.5l8 5M16 9.5l-8 5" stroke="#0f9d6a" strokeWidth="1.3" opacity="0.55" />
            </svg>
          </div>
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink">
              Quartz
            </h1>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ash">
              Self-driving portfolio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] text-ash">
              Held by
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-ink">
              {HOLDER.name}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-pearl">
            {HOLDER.initials}
          </div>
        </div>
      </header>

      {/* NAV + allocation donut */}
      <section className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ash">
            Portfolio NAV
          </p>
          <p className="display mt-2 text-[68px] leading-none text-ink tabnums">
            {usd(navUsd)}
          </p>
          <div className="mt-3 flex items-center gap-3 text-[13px] text-ash">
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                (state?.drawdownPct ?? PORTFOLIO.drawdownPct) >= 0
                  ? 'bg-emerald-soft text-emerald-deep'
                  : 'bg-ember/10 text-ember'
              }`}
            >
              {((state?.drawdownPct ?? PORTFOLIO.drawdownPct) >= 0 ? '+' : '')}
              {(state?.drawdownPct ?? PORTFOLIO.drawdownPct).toFixed(2)}%
            </span>
            <span>30-day drawdown</span>
            <span className="text-line">·</span>
            <span>{AGENT.trades30d} trades</span>
          </div>

          {/* Policy bands chart */}
          <div className="mt-8 rounded-2xl bg-pearl p-6 ring-1 ring-mist shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ash">
                Allocation bands
              </p>
              <p className="mono text-[11px] text-ash">enforced by sly</p>
            </div>
            <ul className="mt-4 space-y-3.5">
              {holdings.map((h) => (
                <li key={h.asset}>
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: h.color }}
                      />
                      <span className="font-semibold text-ink">{h.asset}</span>
                      <span className="text-ash">{h.label.replace(`${h.asset} · `, '')}</span>
                    </div>
                    <div className="flex items-center gap-3 mono tabnums">
                      <span className="text-ink">{usd(h.amountUsd)}</span>
                      <span className="text-ash">{(h.pct * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
                    <div
                      className="h-full"
                      style={{
                        width: `${h.pct * 100}%`,
                        background: h.color,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Donut + agent card */}
        <aside className="flex flex-col gap-6">
          <div className="rounded-2xl bg-pearl p-6 ring-1 ring-mist shadow-card">
            <div className="relative mx-auto h-44 w-44">
              <svg width="176" height="176" viewBox="0 0 176 176">
                <circle cx="88" cy="88" r="70" stroke="#e8edf3" strokeWidth="18" fill="none" />
                {(() => {
                  let off = 0;
                  return holdings.map((h) => {
                    const len = C * h.pct;
                    const el = (
                      <circle
                        key={h.asset}
                        cx="88"
                        cy="88"
                        r="70"
                        stroke={h.color}
                        strokeWidth="18"
                        fill="none"
                        strokeDasharray={`${len} ${C - len}`}
                        strokeDashoffset={-off}
                        transform="rotate(-90 88 88)"
                      />
                    );
                    off += len;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ash">
                  Target
                </p>
                <p className="mono mt-0.5 text-[13.5px] font-semibold text-ink">
                  60 / 30 / 10
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
              {holdings.map((h) => (
                <div key={h.asset}>
                  <p className="font-semibold text-ink">{h.asset}</p>
                  <p className="mono text-ash">{(h.pct * 100).toFixed(0)}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-ink p-5 text-pearl shadow-card">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-emerald-soft">
              Autopilot agent
            </p>
            <p className="mt-2 text-[15px] font-semibold">{AGENT.name}</p>
            <p className="mt-1 text-[12px] text-pearl/60">
              KYA Tier {AGENT.kyaTier} · ★ {AGENT.reputation.toFixed(1)} · {AGENT.trades30d} trades / 30d
            </p>
            <div className="mt-4 space-y-1 text-[11.5px] text-pearl/70">
              <Row k="Per-trade cap" v={usd(state?.perTradeCeilingUsd ?? PORTFOLIO.perTradeCeilingUsd)} />
              <Row k="Drawdown trigger" v={`${PORTFOLIO.drawdownPct}%`} />
              <Row k="Weekly DCA" v="Mon 09:00 PT · $250" />
            </div>
          </div>
        </aside>
      </section>

      {/* Controls */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-pearl p-6 ring-1 ring-mist shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald">
            On-policy trade
          </p>
          <h3 className="display mt-2 text-[26px] leading-tight text-ink">
            Run this week&rsquo;s DCA
          </h3>
          <p className="mt-2 text-[13px] text-ash">
            $250 USDC → ETH · keeps allocation within the 60/30/10 bands. Sly
            allows, Compass executes, signed receipt emitted.
          </p>
          <button
            onClick={runDCA}
            disabled={pendingTrade}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald px-5 py-2.5 text-[13px] font-semibold text-pearl shadow-soft transition hover:bg-emerald-deep disabled:opacity-50"
          >
            {pendingTrade ? <Spin /> : <Forward />}
            {pendingTrade ? 'Sly evaluating…' : 'Run DCA · $250'}
          </button>
        </article>

        <article className="rounded-2xl bg-pearl p-6 ring-1 ring-mist shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ember">
            Off-policy attempt
          </p>
          <h3 className="display mt-2 text-[26px] leading-tight text-ink">
            Try to rebalance to 100% ETH
          </h3>
          <p className="mt-2 text-[13px] text-ash">
            Far outside the policy bands. Sly should refuse before any swap is
            dispatched — receipts will show the denial reason.
          </p>
          <button
            onClick={tryForceRebalance}
            disabled={pendingRebalance}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-ember/40 bg-pearl px-5 py-2.5 text-[13px] font-semibold text-ember shadow-soft transition hover:bg-ember/5 disabled:opacity-50"
          >
            {pendingRebalance ? <Spin /> : <Stop />}
            {pendingRebalance ? 'Sly evaluating…' : 'Force rebalance · 100% ETH'}
          </button>
        </article>
      </section>

      {/* Denial banner */}
      {denial && (
        <section className="mt-6 animate-fade-up rounded-2xl border border-ember/40 bg-ember/5 px-6 py-5 shadow-deny">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ember">
                Sly denied this intent
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{denial.reason}</p>
              <p className="mt-1 mono text-[11px] text-ash">
                policyDecisionId · {denial.decisionId} · no Compass dispatch
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ember/15 ring-1 ring-ember/40">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 8v5M12 17h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" stroke="#d5474f" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </section>
      )}

      {/* Event timeline */}
      {events.length > 0 && (
        <section className="mt-8 rounded-2xl bg-pearl p-6 ring-1 ring-mist shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ash">
            What Sly did, in order
          </p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li
                key={i}
                className="flex animate-fade-up items-center gap-3 rounded-lg bg-sand px-3.5 py-2.5"
              >
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${
                    PROTOCOL_TONE[e.protocol] ??
                    'bg-mist text-ash ring-line'
                  }`}
                >
                  {e.protocol}
                </span>
                <span className="text-[13px] text-ink">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Trade ledger */}
      <section className="mt-8 rounded-2xl bg-pearl ring-1 ring-mist shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-mist px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ash">
            Trade ledger · signed receipts
          </p>
          <p className="mono text-[11px] text-ash">{trades.length} trades</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-mist bg-sand/40 text-[10.5px] uppercase tracking-[0.14em] text-ash">
              <th className="px-6 py-2.5 text-left">When</th>
              <th className="px-6 py-2.5 text-left">Pair</th>
              <th className="px-6 py-2.5 text-right">Amount</th>
              <th className="px-6 py-2.5 text-left">Decision</th>
              <th className="px-6 py-2.5 text-left">Tx</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr
                key={t.id}
                className="border-b border-mist/70 transition hover:bg-sand/50"
              >
                <td className="px-6 py-3 mono text-[12px] text-ash tabnums">
                  {new Date(t.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-3">
                  <span className="font-semibold text-ink">{t.assetIn} → {t.assetOut}</span>
                </td>
                <td className="px-6 py-3 mono text-right tabnums text-ink">
                  {usd(t.amountUsd)}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      t.status === 'allowed'
                        ? 'bg-emerald-soft text-emerald-deep'
                        : 'bg-ember/15 text-ember'
                    }`}
                  >
                    {t.status === 'allowed' ? '✓ allowed' : '✗ denied'}
                  </span>
                </td>
                <td className="px-6 py-3 mono text-[12px] text-cobalt">
                  {shortHash(t.txHash)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash">
        Quartz · Built on Sly · Demo
      </footer>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-pearl/55">{k}</span>
      <span className="mono text-pearl/85 tabnums">{v}</span>
    </div>
  );
}
function Forward() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Stop() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.1" />
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}
function Spin() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
  );
}
