'use client';

/**
 * Sly × Compass live demo page (local-only).
 *
 * Two side-by-side terminal panes:
 *   • Left:  what the agent sees — verbatim stdout from
 *            demo-agent-client.mjs (MCP wrapper → governed tool call →
 *            policy result + Compass payload).
 *   • Right: what the platform sees — curated event stream of every
 *            policy stage that fires inside Sly, plus the signed
 *            audit_log row that lands afterwards.
 *
 * Four scenario buttons. Click → POST /api/compass-demo/run, subscribe
 * to /api/compass-demo/stream/:id over SSE, paint events into the panes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SCENARIOS, type ScenarioId } from '@/lib/scenarios';

type Level = 'info' | 'good' | 'warn' | 'deny' | 'dim';
type Pane = 'left' | 'right' | 'either';
interface DemoEvent {
  kind: 'agent' | 'api' | 'meta' | 'done';
  ts: number;
  pane: Pane;
  text: string;
  detail?: Record<string, unknown>;
  level?: Level;
}

type Scenario = ScenarioId;

// Single-action approves stay in the top row; multi-step scenarios get
// their own row because they tell a longer story (rebalance / borrow-
// then-pay / etc.). Denies stay in their own row regardless.
const APPROVE_SCENARIOS = SCENARIOS.filter((s) => s.expected === 'approve' && !s.steps);
const MULTI_SCENARIOS = SCENARIOS.filter((s) => Boolean(s.steps));
const DENY_SCENARIOS = SCENARIOS.filter((s) => s.expected === 'deny');

const LEVEL_CLASS: Record<Level, string> = {
  info: 'text-slate-200',
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  deny: 'text-rose-300',
  dim:  'text-slate-500',
};

export default function CompassDemoPage() {
  const [running, setRunning] = useState<Scenario | null>(null);
  const [leftLines, setLeftLines] = useState<DemoEvent[]>([]);
  const [rightLines, setRightLines] = useState<DemoEvent[]>([]);
  const [banner, setBanner] = useState<DemoEvent | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    setLeftLines([]);
    setRightLines([]);
    setBanner(null);
  }, []);

  const closeStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const runScenario = useCallback(
    async (scenario: Scenario) => {
      if (running) return;
      reset();
      setRunning(scenario);
      try {
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          setBanner({ kind: 'meta', pane: 'either', text: `run failed (${res.status}) ${t.slice(0, 200)}`, ts: Date.now(), level: 'deny' });
          setRunning(null);
          return;
        }
        const { session_id } = (await res.json()) as { session_id: string };
        const es = new EventSource(`/api/stream/${encodeURIComponent(session_id)}`);
        esRef.current = es;

        const handle = (e: MessageEvent) => {
          try {
            const ev = JSON.parse(e.data) as DemoEvent;
            if (ev.kind === 'meta') {
              setBanner(ev);
              return;
            }
            if (ev.kind === 'done') {
              closeStream();
              setRunning(null);
              return;
            }
            if (ev.pane === 'left') setLeftLines((prev) => [...prev, ev]);
            else if (ev.pane === 'right') setRightLines((prev) => [...prev, ev]);
          } catch {
            /* ignore parse errors */
          }
        };
        es.addEventListener('agent', handle as EventListener);
        es.addEventListener('api', handle as EventListener);
        es.addEventListener('meta', handle as EventListener);
        es.addEventListener('done', handle as EventListener);
        es.onerror = () => {
          closeStream();
          setRunning(null);
        };
      } catch (e) {
        setBanner({ kind: 'meta', pane: 'either', text: `network error: ${(e as Error).message}`, ts: Date.now(), level: 'deny' });
        setRunning(null);
      }
    },
    [running, reset, closeStream],
  );

  useEffect(() => () => closeStream(), [closeStream]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <Header />

      <div className="mx-auto max-w-6xl mt-8">
        <SectionLabel tone="good">Compass surfaces — approved & dispatched</SectionLabel>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {APPROVE_SCENARIOS.map((s) => (
            <ScenarioButton
              key={s.id}
              label={s.label}
              sub={s.sub}
              tone={s.tone}
              isRunning={running === s.id}
              disabled={running !== null && running !== s.id}
              onClick={() => runScenario(s.id)}
            />
          ))}
        </div>
        <SectionLabel tone="good" className="mt-6">
          Multi-step flows — sequenced governed actions
        </SectionLabel>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MULTI_SCENARIOS.map((s) => (
            <ScenarioButton
              key={s.id}
              label={s.label}
              sub={s.sub}
              tone={s.tone}
              isRunning={running === s.id}
              disabled={running !== null && running !== s.id}
              onClick={() => runScenario(s.id)}
            />
          ))}
        </div>
        <SectionLabel tone="deny" className="mt-6">
          Governance denials — Sly stops the call before it reaches Compass
        </SectionLabel>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DENY_SCENARIOS.map((s) => (
            <ScenarioButton
              key={s.id}
              label={s.label}
              sub={s.sub}
              tone={s.tone}
              isRunning={running === s.id}
              disabled={running !== null && running !== s.id}
              onClick={() => runScenario(s.id)}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl mt-6">
        <BannerStrip banner={banner} />
      </div>

      <div className="mx-auto max-w-6xl mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TerminalPane
          title="Agent view  ·  MCP tool call"
          subtitle="verbatim stdout from demo-agent-client.mjs (stdio MCP client → @sly_ai/mcp-compass → Sly + Compass)"
          lines={leftLines}
        />
        <TerminalPane
          title="Platform view  ·  every gate + the Compass CLI we shell out to"
          subtitle="curated Sly policy stream, signed audit_log row, and the exact `compass …` invocation Diego's team can review"
          lines={rightLines}
        />
      </div>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-widest text-slate-500">Sly × Compass</div>
      <h1 className="mt-1 text-3xl font-semibold text-slate-100">Live governance demo</h1>
      <p className="mt-3 max-w-3xl text-slate-400 leading-relaxed">
        An AI agent calls a Compass DeFi action through an MCP wrapper. <span className="text-slate-200">Every state-changing call</span> is
        evaluated by Sly first — KYA tier, scope step-up, venue allowlist, spending caps, operator kill-switch.
        Compass only sees the action if Sly approves. Each scenario below runs the agent end-to-end against the
        local Sly API and the real Compass CLI.
      </p>
    </div>
  );
}

interface ScenarioButtonProps {
  label: string;
  sub: string;
  tone: 'good' | 'deny';
  isRunning: boolean;
  disabled: boolean;
  onClick: () => void;
}
function ScenarioButton({ label, sub, tone, isRunning, disabled, onClick }: ScenarioButtonProps) {
  const toneRing = tone === 'good' ? 'ring-emerald-700/40 hover:border-emerald-500/40' : 'ring-rose-700/40 hover:border-rose-500/40';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group text-left rounded-lg border border-slate-800 bg-slate-900/60 ring-1 ${toneRing} px-4 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-slate-100">{label}</div>
        {isRunning ? <Spinner /> : <span className={`text-[10px] uppercase tracking-widest ${tone === 'good' ? 'text-emerald-400' : 'text-rose-400'}`}>{tone === 'good' ? 'approve' : 'deny'}</span>}
      </div>
      <div className="mt-1 text-xs text-slate-400 leading-snug">{sub}</div>
    </button>
  );
}

function Spinner() {
  return <span className="h-3 w-3 rounded-full border border-slate-300 border-t-transparent animate-spin inline-block" aria-hidden />;
}

function SectionLabel({ tone, children, className = '' }: { tone: 'good' | 'deny'; children: React.ReactNode; className?: string }) {
  const cls = tone === 'good' ? 'text-emerald-400/80' : 'text-rose-400/80';
  return <div className={`text-[10px] uppercase tracking-[0.18em] ${cls} ${className}`}>{children}</div>;
}

function BannerStrip({ banner }: { banner: DemoEvent | null }) {
  if (!banner) return <div className="h-6" />;
  const level = banner.level ?? 'info';
  const cls = LEVEL_CLASS[level];
  return (
    <div className={`text-sm font-mono ${cls}`}>{banner.text}</div>
  );
}

interface TerminalPaneProps {
  title: string;
  subtitle: string;
  lines: DemoEvent[];
}
function TerminalPane({ title, subtitle, lines }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastLen = useRef(0);

  useEffect(() => {
    if (containerRef.current && lines.length !== lastLen.current) {
      lastLen.current = lines.length;
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const sorted = useMemo(() => lines, [lines]);

  return (
    <section className="rounded-lg border border-slate-800 bg-black/60 overflow-hidden">
      <header className="px-4 py-2 border-b border-slate-800 flex flex-col gap-0.5">
        <div className="text-xs text-slate-300 font-medium">{title}</div>
        <div className="text-[11px] text-slate-500">{subtitle}</div>
      </header>
      <div
        ref={containerRef}
        className="font-mono text-[12.5px] leading-relaxed px-4 py-3 h-[460px] overflow-y-auto whitespace-pre-wrap"
      >
        {sorted.length === 0 ? (
          <div className="text-slate-600">{`# idle — pick a scenario above`}</div>
        ) : (
          sorted.map((ev, i) => <TerminalLine key={i} ev={ev} />)
        )}
      </div>
    </section>
  );
}

function TerminalLine({ ev }: { ev: DemoEvent }) {
  const isExec = ev.text.startsWith('[exec]') || ev.text.startsWith('[exec-blocked]');
  if (isExec) return <ExecLine ev={ev} />;
  const cls = LEVEL_CLASS[ev.level ?? 'info'];
  return (
    <div className={cls}>
      <span className="text-slate-700 mr-2 select-none">{fmtTime(ev.ts)}</span>
      <span>{ev.text}</span>
      {ev.detail ? <DetailBlock detail={ev.detail} /> : null}
    </div>
  );
}

function ExecLine({ ev }: { ev: DemoEvent }) {
  const blocked = ev.text.startsWith('[exec-blocked]');
  // Strip the prefix ('[exec] $ ' or '[exec-blocked] $ ') to surface the
  // bare CLI for easy copy-paste / screenshot.
  const cmd = ev.text.replace(/^\[exec(?:-blocked)?\]\s*\$\s*/, '');
  const tone = blocked
    ? 'border-rose-700/40 bg-rose-950/40'
    : 'border-emerald-700/40 bg-emerald-950/30';
  const labelTone = blocked ? 'text-rose-400' : 'text-emerald-400';
  const label = blocked ? 'WOULD HAVE RUN — blocked by Sly before reaching Compass' : 'Compass CLI invocation';
  return (
    <div className="my-2">
      <div className="flex items-baseline gap-2">
        <span className="text-slate-700 select-none">{fmtTime(ev.ts)}</span>
        <span className={`text-[10px] uppercase tracking-widest ${labelTone}`}>{label}</span>
      </div>
      <pre className={`mt-1 ml-12 px-3 py-2 rounded border ${tone} text-slate-100 text-[12px] whitespace-pre-wrap break-all`}>
        <span className="text-slate-500 select-none">$ </span>
        <span>{cmd}</span>
      </pre>
    </div>
  );
}

function DetailBlock({ detail }: { detail: Record<string, unknown> }) {
  return (
    <pre className="ml-12 mt-0.5 mb-1 text-[11px] text-slate-500 overflow-x-auto">{JSON.stringify(detail, null, 2)}</pre>
  );
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function Footer() {
  return (
    <div className="mx-auto max-w-6xl mt-10 text-[11px] text-slate-600">
      Agent → MCP wrapper (<code className="text-slate-500">@sly_ai/mcp-compass</code>) → Sly policy gate (<code className="text-slate-500">/v1/policy/evaluate-intent</code>) → Compass CLI.
      Decisions are signed (Ed25519) and anchored on Base every batch.
      Local-only demo against the seeded Compass Demo tenant.
    </div>
  );
}
