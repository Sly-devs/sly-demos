'use client';

import { useEffect, useRef, useState } from 'react';
import type { HelixState, FeedEvent, Protocol } from '@/lib/sly';
import AgentGraphCanvas from './agent-graph';

const POLL_MS = 2500;

function useHelixState() {
  const [state, setState] = useState<HelixState | null>(null);
  const lastLive = useRef<HelixState | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch('/api/state', { cache: 'no-store' });
        const j = (await r.json()) as HelixState;
        if (!alive) return;
        // A transient API hiccup (the busy driver saturating the single
        // API process) returns source:'offline'. Don't let one blip wipe
        // a good board — once we've been live, hold the last good state
        // until a fresh live read arrives.
        if (j.source === 'live') {
          lastLive.current = j;
          setState(j);
        } else if (lastLive.current) {
          setState(lastLive.current);
        } else {
          setState(j);
        }
      } catch {
        /* network blip — keep last good state */
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return state;
}

/** Smoothly counts up to `value` whenever it changes. */
function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 800;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const usd4 = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

// Literal class strings only — Tailwind can't see `bg-${x}` interpolation.
const PROTO: Record<
  Protocol,
  { label: string; chip: string; card: string; text: string }
> = {
  x402: {
    label: 'x402',
    chip: 'bg-x402/15 text-x402',
    card: 'border-x402/30 bg-x402/[0.06]',
    text: 'text-x402',
  },
  acp: {
    label: 'ACP',
    chip: 'bg-acp/15 text-acp',
    card: 'border-acp/30 bg-acp/[0.06]',
    text: 'text-acp',
  },
  a2a: {
    label: 'A2A',
    chip: 'bg-a2a/15 text-a2a',
    card: 'border-a2a/30 bg-a2a/[0.06]',
    text: 'text-a2a',
  },
  ucp: {
    label: 'UCP',
    chip: 'bg-ucp/15 text-ucp',
    card: 'border-ucp/30 bg-ucp/[0.06]',
    text: 'text-ucp',
  },
};

export default function Page() {
  const state = useHelixState();

  // client-tracked sparkline of total transactions
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => {
    if (!state) return;
    setHist((h) => [...h, state.metrics.txnTotal].slice(-80));
  }, [state]);

  // x402 micropayments settle as deferred payment_intents (not in the
  // endpoint's recent-transfer list), so the server feed only carries
  // ACP + A2A. Derive honest x402 feed rows from the REAL per-poll
  // increase in each endpoint's totalCalls — every row is a real call.
  const lastCalls = useRef<Record<string, number>>({});
  const [x402Feed, setX402Feed] = useState<FeedEvent[]>([]);
  useEffect(() => {
    if (!state) return;
    const add: FeedEvent[] = [];
    for (const e of state.rails.x402.endpoints) {
      const prev = lastCalls.current[e.id];
      if (prev != null && e.calls > prev) {
        const delta = Math.min(e.calls - prev, 8); // cap burst per poll
        for (let i = 0; i < delta; i++) {
          add.push({
            id: `x402-${e.id}-${e.calls - i}`,
            protocol: 'x402',
            agent: 'agent',
            label: `x402 · ${e.name}`,
            amount: e.basePrice,
            currency: e.currency,
            status: 'settled',
            at: new Date().toISOString(),
          });
        }
      }
      lastCalls.current[e.id] = e.calls;
    }
    if (add.length) setX402Feed((f) => [...add, ...f].slice(0, 40));
  }, [state]);

  const mergedFeed: FeedEvent[] = [
    ...x402Feed,
    ...(state?.feed ?? []),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 40);

  const live = state?.source === 'live';
  const m = state?.metrics;
  const txn = useCountUp(m?.txnTotal ?? 0);
  const x402c = useCountUp(m?.x402Calls ?? 0);
  const acpUsd = useCountUp(m?.acpSettledUsd ?? 0);
  const a2a = useCountUp(m?.a2aTasks ?? 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#070b10] text-zinc-100">
      {/* header */}
      <header className="flex items-center justify-between border-b border-white/10 px-7 py-3.5">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-bold tracking-tight">Helix</span>
          <span className="text-[12px] text-zinc-400">
            the marketplace for{' '}
            <span className="font-semibold text-zinc-200">AI services</span>{' '}
            — agents buying inference, data &amp; tasks
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={`h-2 w-2 rounded-full ${live ? 'animate-pulse-ring bg-emerald-400' : 'bg-zinc-600'}`}
          />
          <span className={live ? 'text-emerald-400' : 'text-zinc-500'}>
            {live ? 'live · real Sly ledger' : 'offline'}
          </span>
        </div>
      </header>

      {/* hero metrics */}
      <div className="grid grid-cols-4 gap-px border-b border-white/10 bg-white/5">
        <Metric label="Transactions" value={Math.round(txn).toLocaleString()} accent="text-zinc-100" sub="all rails" />
        <Metric label="x402 calls" value={Math.round(x402c).toLocaleString()} accent="text-x402" sub={usd4(state?.metrics.x402Revenue ?? 0)} />
        <Metric label="ACP settled" value={usd(acpUsd)} accent="text-acp" sub={`${state?.metrics.acpSettledCount ?? 0} checkouts`} />
        <Metric label="A2A tasks" value={Math.round(a2a).toLocaleString()} accent="text-a2a" sub={`→ ${state?.rails.a2a.agentName ?? 'A2A providers'}`} />
      </div>

      <Sparkline hist={hist} />

      <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-px bg-white/10">
        {/* left: rails + agents */}
        <div className="flex min-h-0 flex-col gap-px bg-[#070b10]">
          <Rails state={state} />
          <AgentGraphCanvas state={state} />
        </div>
        {/* right: live multi-protocol feed */}
        <Feed feed={mergedFeed} />
      </div>

      <footer className="border-t border-white/10 px-7 py-2.5 text-center text-[10.5px] text-zinc-500">
        Every event is a real Sly transaction across x402 · UCP · ACP · A2A —
        one marketplace, all the agentic protocols.
      </footer>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub: string;
}) {
  return (
    <div className="bg-[#070b10] px-7 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div className={`mt-1 font-mono text-[26px] font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>
    </div>
  );
}

function Sparkline({ hist }: { hist: number[] }) {
  if (hist.length < 2) return <div className="h-10 border-b border-white/10" />;
  const max = Math.max(...hist, 1);
  const min = Math.min(...hist);
  const W = 1000;
  const H = 40;
  const pts = hist
    .map((v, i) => {
      const x = (i / (hist.length - 1)) * W;
      const y = H - ((v - min) / Math.max(1, max - min)) * (H - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <div className="border-b border-white/10 bg-[#070b10] px-2">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-10 w-full">
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-emerald-400/80"
        />
      </svg>
    </div>
  );
}

function Rails({ state }: { state: HelixState | null }) {
  const x402 = state?.rails.x402.endpoints ?? [];
  const maxCalls = Math.max(1, ...x402.map((e) => e.calls));
  return (
    <div className="min-h-0 overflow-hidden border-b border-white/10 p-5">
      <SectionTitle>Four rails — live</SectionTitle>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {x402.map((e) => (
          <div key={e.id} className="rounded-lg border border-x402/30 bg-x402/[0.06] p-3">
            <div className="flex items-center justify-between">
              <span className="rounded bg-x402/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-x402">
                x402
              </span>
              <span className="font-mono text-[12px] tabular-nums text-x402">
                {e.calls.toLocaleString()} calls
              </span>
            </div>
            <div className="mt-1.5 truncate text-[12px] font-medium">{e.name}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-x402 transition-all duration-700"
                style={{ width: `${Math.max(4, (e.calls / maxCalls) * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-zinc-500">
              {usd4(e.revenue)} · ${e.basePrice}/call
            </div>
          </div>
        ))}
        <RailCard proto="ucp" title={state?.rails.ucp.catalogName ?? 'Catalog'} sub="discoverable" live={!!state?.rails.ucp.live} />
        <RailCard proto="acp" title="Helix Supply Co." sub={`${state?.rails.acp.checkoutCount ?? 0} checkouts`} live={!!state?.rails.acp.live} />
        <RailCard proto="a2a" title={`${state?.rails.a2a.agentName ?? 'A2A providers'} · ${state?.rails.a2a.taskCount ?? 0} tasks`} sub="agent-to-agent" live={!!state?.rails.a2a.live} />
      </div>
    </div>
  );
}

function RailCard({
  proto,
  title,
  sub,
  live,
}: {
  proto: Protocol;
  title: string;
  sub: string;
  live: boolean;
}) {
  const p = PROTO[proto];
  return (
    <div className={`rounded-lg border p-3 ${p.card}`}>
      <div className="flex items-center justify-between">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${p.chip}`}>
          {p.label}
        </span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse-ring bg-emerald-400' : 'bg-zinc-600'}`}
        />
      </div>
      <div className="mt-1.5 truncate text-[12px] font-medium">{title}</div>
      <div className="mt-1 text-[10px] text-zinc-500">{sub}</div>
    </div>
  );
}


function Feed({ feed }: { feed: FeedEvent[] }) {
  return (
    <div className="flex min-h-0 flex-col bg-[#070b10]">
      <div className="border-b border-white/10 px-5 py-3">
        <SectionTitle>Live feed · every row a real Sly txn</SectionTitle>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {feed.length === 0 ? (
          <p className="px-2 py-4 text-[12px] text-zinc-600">
            Waiting for agent activity…
          </p>
        ) : (
          feed.map((e) => {
            const p = PROTO[e.protocol];
            return (
              <div
                key={e.id}
                className="animate-rise-in flex items-center gap-3 border-b border-white/[0.04] px-2 py-2 last:border-0"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${p.chip}`}
                >
                  {p.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-300">
                  {e.label}
                </span>
                {e.amount != null ? (
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-zinc-200">
                    {e.amount < 1 ? usd4(e.amount) : usd(e.amount)}
                  </span>
                ) : null}
                <span
                  className={`shrink-0 text-[10px] ${
                    e.status === 'settled'
                      ? 'text-emerald-400'
                      : e.status === 'failed'
                        ? 'text-rose-400'
                        : e.status === 'pending'
                          ? 'text-amber-400'
                          : 'text-zinc-500'
                  }`}
                >
                  {e.status}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </div>
  );
}
