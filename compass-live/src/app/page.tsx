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

interface PickableAgent {
  id: string;
  name: string;
  status: string;
  kyaTier: number;
  hasWallet: boolean;
  walletProvider: string | null;
  walletAddress: string | null;
  hasCompassAllowlist: boolean;
  ethBalanceWei: string | null;
}

const PICKER_STORAGE_KEY = 'compass-live:selectedAgentId';

// Picker treats an agent as "needs gas" when the EOA holds < this much
// ETH. ~0.0003 ETH covers a Morpho deposit on Base. The "Fund agent"
// button shows up only on agents under this threshold.
const MIN_GAS_WEI = BigInt('300000000000000');
const WEI_PER_ETH = BigInt('1000000000000000000');

function isUnderGassed(a: PickableAgent | null): boolean {
  if (!a || !a.ethBalanceWei) return false;
  try { return BigInt(a.ethBalanceWei) < MIN_GAS_WEI; } catch { return false; }
}

function formatEth(wei: string | null): string {
  if (!wei) return '?';
  try {
    const w = BigInt(wei);
    const whole = w / WEI_PER_ETH;
    const frac = w % WEI_PER_ETH;
    return `${whole}.${frac.toString().padStart(18, '0').slice(0, 6)}`.replace(/0+$/, '').replace(/\.$/, '');
  } catch { return '?'; }
}

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
  const [agents, setAgents] = useState<PickableAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const esRef = useRef<EventSource | null>(null);

  // Fetch the tenant's agents once. The /api/agents proxy holds the
  // tenant key server-side and annotates each row with hasWallet +
  // hasCompassAllowlist for capability gating.
  useEffect(() => {
    let alive = true;
    void fetch('/api/agents')
      .then((r) => r.json())
      .then((d: { agents: PickableAgent[] }) => {
        if (!alive) return;
        setAgents(d.agents ?? []);
        // Restore previous selection or pick the first compatible agent.
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(PICKER_STORAGE_KEY) : null;
        const valid = (d.agents ?? []).find((a) => a.id === stored && a.hasWallet);
        const fallback = (d.agents ?? []).find((a) => a.hasWallet && a.status === 'active');
        setSelectedAgentId(valid?.id ?? fallback?.id ?? null);
      })
      .catch(() => { /* picker will show a "couldn't load agents" state */ })
      .finally(() => { if (alive) setAgentsLoading(false); });
    return () => { alive = false; };
  }, []);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  const selectAgent = useCallback((id: string) => {
    setSelectedAgentId(id);
    try { localStorage.setItem(PICKER_STORAGE_KEY, id); } catch { /* noop */ }
    setPickerOpen(false);
  }, []);

  // Funding state for the "Fund agent" CTA. `status` flips through
  // 'idle' → 'funding' → 'ok' / 'error'; an error message lands in
  // `message` for the inline toast. After a successful drip we re-fetch
  // /api/agents to refresh balances.
  const [fundingStatus, setFundingStatus] = useState<'idle' | 'funding' | 'ok' | 'error'>('idle');
  const [fundingMessage, setFundingMessage] = useState<string | null>(null);

  const fundAgent = useCallback(async () => {
    if (!selectedAgentId) return;
    setFundingStatus('funding');
    setFundingMessage(null);
    try {
      const res = await fetch('/api/fund-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: selectedAgentId }),
      });
      const body = (await res.json()) as { tx_hash?: string; error?: string; code?: string; hint?: string };
      if (!res.ok) {
        const detail = body.hint ?? body.error ?? 'Faucet failed.';
        setFundingStatus('error');
        setFundingMessage(`${body.code ?? 'ERROR'} · ${detail}`);
        return;
      }
      setFundingStatus('ok');
      setFundingMessage(`Drip broadcast — tx ${(body.tx_hash ?? '').slice(0, 10)}…`);
      // Wait ~3s for Base finality, then re-poll /api/agents so the
      // ethBalanceWei on the picker rows updates.
      setTimeout(() => {
        void fetch('/api/agents')
          .then((r) => r.json())
          .then((d: { agents: PickableAgent[] }) => setAgents(d.agents ?? []))
          .catch(() => {});
      }, 3500);
    } catch (e) {
      setFundingStatus('error');
      setFundingMessage(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [selectedAgentId]);

  // Per-scenario compatibility. For now: every scenario needs the picked
  // agent to have a wallet. (The runner re-stamps the allowlist, so the
  // partner doesn't need pre-configured venues — but no wallet = nothing
  // to gate.) Per-scenario refinements can layer on top of this later.
  const scenarioEnabled = useMemo(() => {
    const map: Record<string, { enabled: boolean; reason?: string }> = {};
    for (const s of SCENARIOS) {
      if (!selectedAgent) { map[s.id] = { enabled: false, reason: 'Pick an agent first' }; continue; }
      if (!selectedAgent.hasWallet) {
        map[s.id] = { enabled: false, reason: 'Selected agent has no wallet — provision one first.' };
        continue;
      }
      if (selectedAgent.status !== 'active') {
        // deny_kill_switch is the one scenario that intentionally suspends
        // the agent. If they're already suspended, run it anyway.
        if (s.id === 'deny_kill_switch') { map[s.id] = { enabled: true }; continue; }
        map[s.id] = { enabled: false, reason: `Agent is ${selectedAgent.status}. Reactivate it first.` };
        continue;
      }
      map[s.id] = { enabled: true };
    }
    return map;
  }, [selectedAgent]);

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
      if (!selectedAgentId) {
        setBanner({ kind: 'meta', pane: 'either', text: 'Pick an agent first.', ts: Date.now(), level: 'deny' });
        return;
      }
      reset();
      setRunning(scenario);
      try {
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario, agent_id: selectedAgentId }),
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
    [running, reset, closeStream, selectedAgentId],
  );

  useEffect(() => () => closeStream(), [closeStream]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <Header
        agents={agents}
        selectedAgent={selectedAgent}
        selectAgent={selectAgent}
        pickerOpen={pickerOpen}
        setPickerOpen={setPickerOpen}
        loading={agentsLoading}
        fundAgent={fundAgent}
        fundingStatus={fundingStatus}
        fundingMessage={fundingMessage}
      />

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
              disabled={(running !== null && running !== s.id) || !scenarioEnabled[s.id]?.enabled}
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
              disabled={(running !== null && running !== s.id) || !scenarioEnabled[s.id]?.enabled}
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
              disabled={(running !== null && running !== s.id) || !scenarioEnabled[s.id]?.enabled}
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

function Header({
  agents,
  selectedAgent,
  selectAgent,
  pickerOpen,
  setPickerOpen,
  loading,
  fundAgent,
  fundingStatus,
  fundingMessage,
}: {
  agents: PickableAgent[];
  selectedAgent: PickableAgent | null;
  selectAgent: (id: string) => void;
  pickerOpen: boolean;
  setPickerOpen: (b: boolean) => void;
  loading: boolean;
  fundAgent: () => void;
  fundingStatus: 'idle' | 'funding' | 'ok' | 'error';
  fundingMessage: string | null;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">Sly × Compass</div>
          <h1 className="mt-1 text-3xl font-semibold text-slate-100">Live governance demo</h1>
          <p className="mt-3 max-w-3xl text-slate-400 leading-relaxed">
            An AI agent calls a Compass DeFi action through an MCP wrapper. <span className="text-slate-200">Every state-changing call</span> is
            evaluated by Sly first — KYA tier, scope step-up, venue allowlist, spending caps, operator kill-switch.
            Compass only sees the action if Sly approves. Each scenario below runs the agent end-to-end against the
            local Sly API and the real Compass CLI.
          </p>
        </div>
        <AgentPicker
          agents={agents}
          selectedAgent={selectedAgent}
          selectAgent={selectAgent}
          open={pickerOpen}
          setOpen={setPickerOpen}
          loading={loading}
          fundAgent={fundAgent}
          fundingStatus={fundingStatus}
          fundingMessage={fundingMessage}
        />
      </div>
    </div>
  );
}

function AgentPicker({
  agents,
  selectedAgent,
  selectAgent,
  open,
  setOpen,
  loading,
  fundAgent,
  fundingStatus,
  fundingMessage,
}: {
  agents: PickableAgent[];
  selectedAgent: PickableAgent | null;
  selectAgent: (id: string) => void;
  open: boolean;
  setOpen: (b: boolean) => void;
  loading: boolean;
  fundAgent: () => void;
  fundingStatus: 'idle' | 'funding' | 'ok' | 'error';
  fundingMessage: string | null;
}) {
  const pickable = agents.filter((a) => a.hasWallet);
  const compassReady = pickable.filter((a) => a.hasCompassAllowlist);
  const other = pickable.filter((a) => !a.hasCompassAllowlist);
  const needsFunding = isUnderGassed(selectedAgent);

  return (
    <div className="relative shrink-0 mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 transition"
      >
        <div className="flex-1 min-w-[14rem]">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Demo agent</div>
          {loading ? (
            <div className="mt-0.5 text-sm text-slate-400">loading…</div>
          ) : selectedAgent ? (
            <>
              <div className="mt-0.5 text-sm text-slate-100 truncate">{selectedAgent.name}</div>
              <div className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                <span>T{selectedAgent.kyaTier}</span>
                <span>·</span>
                <span>{selectedAgent.status}</span>
                {selectedAgent.hasCompassAllowlist && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400">Compass-ready</span>
                  </>
                )}
                {selectedAgent.ethBalanceWei !== null && (
                  <>
                    <span>·</span>
                    <span className={needsFunding ? 'text-amber-400' : 'text-slate-400'}>
                      {formatEth(selectedAgent.ethBalanceWei)} ETH
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="mt-0.5 text-sm text-rose-400">no compatible agent</div>
          )}
        </div>
        <span className="text-slate-500 text-xs">▾</span>
      </button>

      {/* Fund-agent CTA — shows below the picker pill when the selected
          agent is under the gas threshold. Sly's cross-tenant faucet
          drips 0.001 ETH on click. Tenant must have the gas_faucet
          feature enabled (the endpoint surfaces a clean 403 → message
          when not). */}
      {selectedAgent && needsFunding && (
        <div className="absolute right-0 mt-1 w-full">
          <button
            type="button"
            onClick={fundAgent}
            disabled={fundingStatus === 'funding'}
            className="w-full rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-left transition hover:border-amber-600/60 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="text-[10px] uppercase tracking-widest text-amber-400">Needs gas</div>
            <div className="mt-0.5 text-sm text-slate-100">
              {fundingStatus === 'funding' ? 'Sending 0.001 ETH…' : 'Fund agent — Sly sponsors gas'}
            </div>
            {fundingMessage && (
              <div className={`mt-0.5 text-[11px] ${fundingStatus === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
                {fundingMessage}
              </div>
            )}
          </button>
        </div>
      )}

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-[22rem] max-h-[26rem] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {compassReady.length > 0 && (
            <Section label="Compass-ready agents">
              {compassReady.map((a) => (
                <AgentRow key={a.id} agent={a} selected={a.id === selectedAgent?.id} onClick={() => selectAgent(a.id)} />
              ))}
            </Section>
          )}
          {other.length > 0 && (
            <Section label="Other agents with a wallet">
              {other.map((a) => (
                <AgentRow key={a.id} agent={a} selected={a.id === selectedAgent?.id} onClick={() => selectAgent(a.id)} />
              ))}
            </Section>
          )}
          {pickable.length === 0 && (
            <div className="px-3 py-4 text-sm text-slate-400">
              No agents with wallets on this tenant. Run <code className="text-slate-300">seed-compass-demo.ts</code> first.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="pb-1">{children}</div>
    </div>
  );
}

function AgentRow({ agent, selected, onClick }: { agent: PickableAgent; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 hover:bg-slate-800/60 transition ${selected ? 'bg-slate-800/40' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-slate-100 truncate">{agent.name}</div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500 shrink-0">T{agent.kyaTier} · {agent.status}</div>
      </div>
      {agent.walletAddress && (
        <div className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">{agent.walletAddress}</div>
      )}
    </button>
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
