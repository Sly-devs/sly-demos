'use client';

import { useEffect, useRef, useState } from 'react';
import { AGENT, JOB_QUEUE, OWNER, evaluateJob, shortHash, tok, usd, type JobTemplate } from '@/lib/demo';
import { MODEL_CHOICES, PRICING, formatCost } from '@/lib/openrouter';

interface Event { protocol: string; label: string; }
interface Receipt {
  id: string;
  hash: string;
  payoutCents: number;
  buyer: string;
  kind: string;
  model: string;            // real model string from OpenRouter
  requestedModel: string;   // what we asked for
  tokensIn: number;
  tokensOut: number;
  costMicros: number;
  latencyMs: number;
  output: string;
  ts: string;
}
interface Reject { job: JobTemplate; reasons: string[] }

const KIND_TONE: Record<JobTemplate['kind'], string> = {
  summarize: 'text-glow',
  translate: 'text-cyan',
  classify:  'text-glow',
  extract:   'text-signal',
  review:    'text-glow',
  compose:   'text-signal',
};

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-cyan/15 text-cyan ring-cyan/40',
  AP2: 'bg-signal/15 text-signal ring-signal/40',
  x402: 'bg-glow/15 text-glow ring-glow/40',
};

const FAMILY_TONE: Record<string, string> = {
  auto: 'bg-glow/15 text-glow ring-glow/40',
  local: 'bg-glow/25 text-glow ring-glow/50',
  anthropic: 'bg-signal/15 text-signal ring-signal/40',
  openai: 'bg-cyan/15 text-cyan ring-cyan/40',
  google: 'bg-cyan/15 text-cyan ring-cyan/40',
  meta: 'bg-glow/15 text-glow ring-glow/40',
  mistral: 'bg-signal/15 text-signal ring-signal/40',
  unknown: 'bg-slab text-ash ring-line',
};

function modelLabel(id: string): string {
  if (id in PRICING) return PRICING[id].label;
  // Try to find by short form
  const short = id.split('/').slice(-1)[0];
  return short;
}
function modelFamily(id: string): string {
  if (id in PRICING) return PRICING[id].family;
  const fam = id.split('/')[0];
  return ['anthropic', 'openai', 'google', 'meta', 'meta-llama', 'mistral', 'mistralai'].includes(fam)
    ? (fam === 'meta-llama' ? 'meta' : fam === 'mistralai' ? 'mistral' : fam)
    : 'unknown';
}

interface RealReceipt {
  id: string;
  ts: string;
  payer: string;
  payerShort: string;
  paidMicroUsdc: number;
  paidUsdc: string;
  network: string;
  model: string;
  provider: 'local' | 'cloud';
  promptPreview: string;
  outputPreview: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  onChain: boolean;
  settlementTxHash: string | null;
  facilitator: string;
}

export default function HumHome() {
  const [running, setRunning] = useState(false);
  const [battery, setBattery] = useState(94);
  const [queueIdx, setQueueIdx] = useState(0);
  const [inFlight, setInFlight] = useState<JobTemplate[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [rejects, setRejects] = useState<Reject[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [modelOverride, setModelOverride] = useState<string>('auto');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [realReceipts, setRealReceipts] = useState<RealReceipt[]>([]);
  const [lastRealId, setLastRealId] = useState<string | null>(null);
  const earnedCents = receipts.reduce((acc, r) => acc + r.payoutCents, 0);
  const cloudSpentMicros = receipts.reduce((acc, r) => acc + r.costMicros, 0);
  const netMicros = earnedCents * 10_000 - cloudSpentMicros;
  const tickerRef = useRef<number | null>(null);
  const realSinceRef = useRef<string | null>(null);

  // Stats derived from REAL receipts (what the dashboard headlines).
  const realEarnedUsdc = realReceipts.reduce((acc, r) => acc + r.paidMicroUsdc, 0) / 1_000_000;
  const realTokens = realReceipts.reduce((acc, r) => acc + r.promptTokens + r.completionTokens, 0);
  const realOnChain = realReceipts.filter((r) => r.onChain).length;
  const realAvgMs = realReceipts.length > 0
    ? Math.round(realReceipts.reduce((acc, r) => acc + r.latencyMs, 0) / realReceipts.length)
    : 0;

  // Battery drain while running
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setBattery((b) => Math.max(0, b - 1)), 4000);
    return () => window.clearInterval(id);
  }, [running]);

  // Poll for REAL x402 calls landing on /api/x402-inference. Runs always
  // (not gated on the simulated "earning" toggle) so real-world buyers
  // surface even when the simulator is paused.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const url = realSinceRef.current
          ? `/api/recent?since=${encodeURIComponent(realSinceRef.current)}`
          : '/api/recent';
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        const fresh: RealReceipt[] = data.receipts ?? [];
        if (fresh.length === 0) return;
        realSinceRef.current = fresh[0].ts; // newest first
        setRealReceipts((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const merged = [...fresh.filter((r) => !seen.has(r.id)), ...prev].slice(0, 25);
          return merged;
        });
        setLastRealId(fresh[0].id);
        window.setTimeout(() => setLastRealId((id) => (id === fresh[0].id ? null : id)), 1200);
      } catch {
        /* ignore — keep polling */
      }
    }
    tick();
    const id = window.setInterval(tick, 2500);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  // Pull next job offer
  useEffect(() => {
    if (!running) return;
    if (queueIdx >= JOB_QUEUE.length) return;
    const tid = window.setTimeout(async () => {
      const job = JOB_QUEUE[queueIdx];
      let data: { decision: 'accept' | 'reject'; receipt?: Receipt; reasons?: Array<{ label: string }>; events?: Event[] };
      try {
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jobId: job.id, battery, inFlight: inFlight.length, earnedCents, cloudSpentMicros, modelOverride }),
        });
        data = await res.json();
      } catch (e) {
        data = { decision: 'reject', reasons: [{ label: 'fetch failed' }], events: [{ protocol: 'AP2', label: 'fetch failed' }] };
      }
      setEvents(data.events ?? []);

      if (data.decision === 'accept' && data.receipt) {
        const r = data.receipt;
        setInFlight((f) => [...f, job]);
        // Brief in-flight display, then settle.
        window.setTimeout(() => {
          setInFlight((f) => f.filter((j) => j.id !== job.id));
          setReceipts((rs) => [r, ...rs]);
          setLastReceiptId(r.id);
          window.setTimeout(() => setLastReceiptId((id) => id === r.id ? null : id), 800);
        }, Math.max(200, Math.min(1500, r.latencyMs)));
      } else {
        setRejects((rs) => [{ job, reasons: (data.reasons ?? []).map((r) => r.label) }, ...rs].slice(0, 5));
      }
      setQueueIdx((idx) => idx + 1);
    }, 1400);
    return () => window.clearTimeout(tid);
  }, [running, queueIdx, battery, inFlight.length, earnedCents, cloudSpentMicros, modelOverride]);

  // smooth earnings ticker
  const [tickerCents, setTickerCents] = useState(0);
  useEffect(() => {
    if (tickerCents === earnedCents) return;
    if (tickerRef.current) window.cancelAnimationFrame(tickerRef.current);
    const start = tickerCents;
    const end = earnedCents;
    const t0 = performance.now();
    const dur = 700;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setTickerCents(Math.round(start + (end - start) * eased));
      if (p < 1) tickerRef.current = window.requestAnimationFrame(step);
    };
    tickerRef.current = window.requestAnimationFrame(step);
    return () => { if (tickerRef.current) window.cancelAnimationFrame(tickerRef.current); };
  }, [earnedCents, tickerCents]);

  const startEarning = () => {
    setRunning(true);
    if (queueIdx >= JOB_QUEUE.length) {
      setReceipts([]); setRejects([]); setQueueIdx(0); setTickerCents(0); setBattery(94);
    }
  };
  const pause = () => setRunning(false);

  const totalTokens = receipts.reduce((acc, r) => acc + r.tokensIn + r.tokensOut, 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-[460px] flex-col px-4 py-6">
      <section className="relative overflow-hidden rounded-[36px] bg-deepwell phone-frame shadow-phone ring-1 ring-line">
        {/* status bar */}
        <div className="flex items-center justify-between px-5 pt-4 text-[10.5px]">
          <span className="mono text-bone/70">5:24 PM</span>
          <span className="display text-bone/80">●</span>
          <span className="mono flex items-center gap-1.5 text-bone/70">
            <Signal /><Wifi /><BatteryBars pct={battery} />
            <span className="tabnums">{battery}%</span>
          </span>
        </div>

        {/* header */}
        <header className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-glow/10 ring-1 ring-glow/40">
              <span className="absolute inset-0 rounded-2xl bg-glow/30 animate-pulse" />
              <span className="relative display text-[14px] font-bold text-glow">H</span>
            </div>
            <div>
              <p className="display text-[18px] font-bold tracking-tight text-bone">Hum</p>
              <p className="mono text-[9.5px] uppercase tracking-[0.18em] text-ash">phone · earning real inference</p>
            </div>
          </div>
          <div className="text-right">
            <p className="mono text-[10px] text-ash">{OWNER.name}</p>
            <p className="mono text-[9.5px] text-ash/70">{OWNER.device}</p>
          </div>
        </header>

        {/* model picker */}
        <div className="px-5">
          <label className="mono text-[9.5px] uppercase tracking-[0.18em] text-ash">Model routing</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {MODEL_CHOICES.map((c) => {
              const selected = modelOverride === c.id;
              return (
                <button key={c.id}
                  onClick={() => setModelOverride(c.id)}
                  className={`mono text-[10.5px] rounded-full px-2.5 py-1 ring-1 transition ${selected ? FAMILY_TONE[c.family] + ' font-bold' : 'bg-slab text-ash ring-line hover:text-bone'}`}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* earnings hero — driven by REAL receipts (server-pushed) */}
        <div className="px-5 mt-4">
          <div className="relative overflow-hidden rounded-2xl bg-slab p-5 ring-1 ring-line">
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-ash">Real revenue · paid via x402</p>
            <div className="mt-1 flex items-end gap-2">
              <p className="display text-[44px] font-bold leading-none tabnums text-glow">${realEarnedUsdc.toFixed(6)}</p>
              <p className="mb-1 text-[12px] text-ash">USDC</p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">
              <Stat label="Calls" value={String(realReceipts.length)} sub="signed + settled" />
              <Stat label="Tokens" value={tok(realTokens) || '—'} sub={`${realOnChain} on-chain`} />
              <Stat label="Latency" value={realAvgMs > 0 ? `${realAvgMs}ms` : '—'} sub="avg per call" />
            </div>
          </div>
        </div>

        {/* status row — always listening, no toggle needed */}
        <div className="mt-4 flex items-center justify-between px-5">
          <div className="flex items-center gap-2 text-[10.5px] text-ash">
            <span className="mono inline-flex items-center gap-1 rounded-full bg-deepwell px-2 py-1 ring-1 ring-line text-glow">
              <span className="block h-1.5 w-1.5 rounded-full bg-glow relative">
                <span className="absolute inset-0 rounded-full bg-glow animate-ring" />
              </span>
              LISTENING · /api/x402-inference
            </span>
            <span className="mono inline-flex items-end gap-[2px]">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="block h-2 w-[2.5px] origin-bottom bg-glow animate-bar" style={{ animationDelay: `${i * 110}ms` }} />
              ))}
            </span>
          </div>
        </div>

        {/* LIVE inbound x402 from real buyers (OpenClaw, Diego's script, etc.) */}
        {realReceipts.length > 0 && (
          <div className="mt-4 px-5">
            <div className="flex items-center justify-between">
              <p className="mono text-[9.5px] uppercase tracking-[0.18em] text-glow">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-glow animate-pulse mr-1.5"></span>
                LIVE x402 · real buyers
              </p>
              <p className="mono text-[9.5px] text-ash">{realReceipts.length} signed</p>
            </div>
            <ul className="mt-2 space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {realReceipts.map((r) => {
                const family = modelFamily(r.model);
                return (
                  <li
                    key={r.id}
                    className={`rounded-xl bg-slab/80 px-3 py-2 ring-1 ring-glow/35 cursor-pointer ${r.id === lastRealId ? 'animate-flash' : 'animate-fade-up'}`}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11.5px] text-bone mono">
                        {r.payerShort}
                        <span className="ml-1.5 mono text-[9px] uppercase text-glow tracking-wider">
                          {r.onChain ? '⛓ on-chain' : 'pending'}
                        </span>
                      </p>
                      <span className="mono shrink-0 text-[12.5px] tabnums font-bold text-glow">+${r.paidUsdc}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 mono text-[9.5px]">
                      <span className={`truncate rounded-md px-1.5 py-[1px] ring-1 ${FAMILY_TONE[family] ?? FAMILY_TONE.unknown}`}>{modelLabel(r.model)}</span>
                      <span className="shrink-0 text-cyan/90 tabnums">{r.promptTokens}→{r.completionTokens} tok</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 mono text-[9px] text-ash">
                      <span className="tabnums">{r.network} · {r.latencyMs}ms</span>
                      {r.settlementTxHash && (
                        <a
                          href={`https://${r.network === 'base' ? '' : 'sepolia.'}basescan.org/tx/${r.settlementTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-cyan/80 hover:text-cyan"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.settlementTxHash.slice(0, 6)}…{r.settlementTxHash.slice(-4)}
                        </a>
                      )}
                    </div>
                    {expandedId === r.id ? (
                      <div className="mt-2 space-y-1.5">
                        <div className="rounded-md bg-deepwell px-2.5 py-2 ring-1 ring-line/60">
                          <p className="mono text-[9px] uppercase tracking-wider text-ash mb-1">prompt</p>
                          <p className="text-[11.5px] text-bone/90 whitespace-pre-wrap">{r.promptPreview}</p>
                        </div>
                        <div className="rounded-md bg-deepwell px-2.5 py-2 ring-1 ring-line/60">
                          <p className="mono text-[9px] uppercase tracking-wider text-ash mb-1">output</p>
                          <p className="text-[11.5px] text-bone/90 whitespace-pre-wrap">{r.outputPreview}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 truncate text-[10.5px] text-bone/60 italic">&ldquo;{r.promptPreview.slice(0, 80)}{r.promptPreview.length > 80 ? '…' : ''}&rdquo;</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* empty state — no real x402 calls have landed yet */}
        {realReceipts.length === 0 && (
          <div className="mt-4 px-5 pb-6">
            <div className="rounded-xl bg-slab/30 px-4 py-6 text-center ring-1 ring-line/60">
              <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">Waiting for buyers</p>
              <p className="mt-2 text-[12px] text-bone/70 leading-relaxed">
                Hum is published on Sly&apos;s x402 directory.<br/>
                Any agent calling{' '}
                <code className="mono text-glow">/api/x402-inference</code>{' '}
                with a signed payment header settles here.
              </p>
              <p className="mt-3 mono text-[9.5px] text-ash/70">
                Try: <code className="text-cyan">npx github:haxaco/try-hum-x402</code>
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-line px-5 py-3 text-center">
          <p className="mono text-[9px] uppercase tracking-[0.22em] text-ash/60">Hum · Built on Sly · Demo</p>
        </div>
      </section>

      <p className="mt-6 px-2 text-center text-[12.5px] text-ash">
        Hum brokers your <span className="mono text-glow">OpenRouter</span> quota to buyer agents.<br />
        Each receipt is a real call: model, tokens, ms, cost — all from the response.
      </p>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'glow' | 'warn' }) {
  const t = tone === 'warn' ? 'text-warn' : 'text-bone';
  return (
    <div className="rounded-md bg-deepwell px-2 py-1.5 ring-1 ring-line/60">
      <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-ash">{label}</p>
      <p className={`mono mt-0.5 text-[12px] tabnums font-bold ${t}`}>{value}</p>
      <p className="text-[8.5px] text-ash truncate">{sub}</p>
    </div>
  );
}
function Signal() { return (<svg width="11" height="9" viewBox="0 0 11 9" aria-hidden><rect x="0" y="6" width="2" height="3" rx="0.4" fill="currentColor" /><rect x="3" y="4" width="2" height="5" rx="0.4" fill="currentColor" /><rect x="6" y="2" width="2" height="7" rx="0.4" fill="currentColor" /><rect x="9" y="0" width="2" height="9" rx="0.4" fill="currentColor" /></svg>); }
function Wifi() { return (<svg width="12" height="9" viewBox="0 0 12 9" aria-hidden fill="none"><path d="M1 3.5C2.7 1.8 4.3 1 6 1c1.7 0 3.3.8 5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /><path d="M3 5.5c1.1-1 2-1.5 3-1.5s1.9.5 3 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /><circle cx="6" cy="7.5" r="0.8" fill="currentColor" /></svg>); }
function BatteryBars({ pct }: { pct: number }) {
  const w = Math.round(Math.max(0, Math.min(100, pct)) / 100 * 15);
  const tone = pct < 25 ? '#ff6a5b' : pct < 50 ? '#ffcb39' : '#3effb0';
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden>
      <rect x="0.5" y="0.5" width="19" height="9" rx="2" fill="none" stroke="currentColor" />
      <rect x="20.5" y="3" width="1.2" height="4" rx="0.5" fill="currentColor" />
      <rect x="2" y="2" width={w} height="6" fill={tone} />
    </svg>
  );
}
