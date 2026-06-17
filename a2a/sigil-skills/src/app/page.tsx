'use client';

import { useEffect, useState } from 'react';
import { CATALOG, POLICY, RENTER, RENTER_AGENT, evaluateRental, shortHash, usd, type Grant, type Skill } from '@/lib/demo';

interface Event { protocol: string; label: string; }

const TIER_TONE: Record<Skill['tier'], string> = {
  staff: 'bg-rune/15 text-rune ring-rune/40',
  senior: 'bg-arc/15 text-arc ring-arc/40',
  mid: 'bg-carbon text-ash ring-line',
};

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-rune/15 text-rune ring-rune/40',
  AP2: 'bg-gold/15 text-gold ring-gold/40',
  ACP: 'bg-arc/15 text-arc ring-arc/40',
};

export default function SigilHome() {
  const [windows, setWindows] = useState<Record<string, number>>(() => Object.fromEntries(CATALOG.map((s) => [s.id, 2])));
  const [grants, setGrants] = useState<Grant[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [denyById, setDenyById] = useState<Record<string, string[]>>({});
  const [now, setNow] = useState(Date.now());

  // 1s heartbeat for countdowns & auto-revoke
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      setGrants((prev) => prev.map((g) => {
        if (g.status === 'active' && new Date(g.expiryTs).getTime() <= Date.now()) {
          // Auto-revoke; emit synthetic event
          setEvents([{ protocol: 'ACP', label: `auto-revoke · grant ${g.id.slice(-8)} expired` }]);
          return { ...g, status: 'expired' };
        }
        return g;
      }));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const spentCents = grants.reduce((acc, g) => acc + g.costCents, 0);

  async function rent(skill: Skill) {
    setPendingId(skill.id);
    try {
      const res = await fetch('/api/rent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id, windowHours: windows[skill.id], spentCents }),
      });
      const data = await res.json();
      setEvents(data.events ?? []);
      if (data.grant) {
        // For the demo, shorten the window so revokes fire visibly: 8 sec per "hour"
        const fastExpiry = new Date(Date.now() + windows[skill.id] * 8 * 1000).toISOString();
        setGrants((p) => [{ ...data.grant, expiryTs: fastExpiry }, ...p]);
        setDenyById((p) => { const n = { ...p }; delete n[skill.id]; return n; });
      } else if (data.reasons) {
        setDenyById((p) => ({ ...p, [skill.id]: data.reasons.map((r: { label: string }) => r.label) }));
      }
    } finally { setPendingId(null); }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-end justify-between border-b border-line pb-6">
        <div className="flex items-center gap-3">
          <span className="mono inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rune/10 text-[28px] text-rune ring-1 ring-rune/40 animate-rune-spin">⟁</span>
          <div>
            <p className="mono text-[10.5px] uppercase tracking-[0.22em] text-ash">A2A skill rental · governed by Sly</p>
            <h1 className="display mt-1 text-[44px] font-bold leading-none text-bone">Sigil<span className="text-rune">.</span></h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-semibold text-bone">{RENTER.name}</p>
          <p className="mono text-[10.5px] text-ash">{RENTER_AGENT.name} · KYA T{RENTER_AGENT.kyaTier}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl bg-cell p-6 shadow-card ring-1 ring-line">
          <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">Sigil broker · today</p>
          <p className="display mt-1 text-[34px] font-bold tabnums text-bone">{usd(spentCents)}<span className="text-[14px] text-ash"> /{usd(POLICY.dailyCapCents)} cap</span></p>
          <p className="mt-1 text-[12.5px] text-ash">{grants.filter((g) => g.status === 'active').length} active grants · {grants.filter((g) => g.status === 'expired').length} auto-revoked · {grants.filter((g) => g.status === 'revoked').length} early-revoked</p>
        </div>
        <div className="rounded-2xl bg-cell p-6 shadow-card ring-1 ring-line">
          <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">policy</p>
          <ul className="mt-2 space-y-1 text-[12.5px] text-bone/90">
            <li><span className="text-rune mono">·</span> per-rental ceiling {usd(POLICY.perRentalCeilingCents)}</li>
            <li><span className="text-rune mono">·</span> daily cap {usd(POLICY.dailyCapCents)} across all skills</li>
            <li><span className="text-rune mono">·</span> owner KYA ≥ T2, rep ≥ 4.0</li>
            <li><span className="text-rune mono">·</span> windows capped by each skill owner's policy</li>
            <li><span className="text-rune mono">·</span> Sly auto-revokes at expiry · no leftover access</li>
          </ul>
          <p className="mt-3 mono text-[10px] text-ash">demo · 1h grant ≈ 8s of wall clock to show revoke flow</p>
        </div>
      </section>

      <section className="mt-6">
        <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">skill catalog · {CATALOG.length} listings</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {CATALOG.map((s) => {
            const win = windows[s.id];
            const evalRes = evaluateRental(s, win, spentCents);
            const blocked = denyById[s.id];
            return (
              <li key={s.id} className={`rounded-2xl bg-cell p-5 shadow-card ring-1 transition ${blocked ? 'ring-warn/40' : evalRes.decision === 'deny' ? 'ring-line opacity-80' : 'ring-line hover:ring-rune/40'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mono shrink-0 mt-1 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-void text-[20px] text-rune ring-1 ring-rune/30">{s.rune}</span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-bone truncate">{s.name}</p>
                      <p className="text-[11.5px] text-ash">{s.owner} · {s.domain}</p>
                    </div>
                  </div>
                  <span className={`mono shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${TIER_TONE[s.tier]}`}>{s.tier}</span>
                </div>
                <p className="mt-3 text-[12px] text-bone/80 italic">{s.pitch}</p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                  <Pill k="KYA" v={`T${s.ownerKyaTier}`} tone={s.ownerKyaTier >= 2 ? 'rune' : 'warn'} />
                  <Pill k="★" v={s.ownerRep ? s.ownerRep.toFixed(1) : '—'} tone={s.ownerRep >= 4 ? 'arc' : 'warn'} />
                  <Pill k="/hr" v={usd(s.pricePerHourCents)} tone="gold" />
                  <Pill k="max win" v={`${s.maxWindowHours}h`} tone="ash" />
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <label className="mono text-[10.5px] uppercase tracking-wider text-ash">window</label>
                  <input
                    type="range" min={1} max={Math.max(s.maxWindowHours + 4, 12)} step={1} value={win}
                    onChange={(e) => setWindows((p) => ({ ...p, [s.id]: Number(e.target.value) }))}
                    className="flex-1 accent-rune"
                  />
                  <span className="mono text-[12px] tabnums text-bone w-12 text-right">{win}h</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="mono text-[10.5px] text-ash">cost <span className="text-rune">{usd(evalRes.costCents)}</span></p>
                  <button
                    disabled={pendingId === s.id}
                    onClick={() => rent(s)}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider transition disabled:opacity-60 ${evalRes.decision === 'allow' ? 'bg-rune text-void hover:bg-runelite' : 'bg-warn/15 text-warn ring-1 ring-warn/40 hover:bg-warn/25'}`}
                  >
                    {pendingId === s.id ? <Spin /> : evalRes.decision === 'allow' ? '⟁ Mint grant' : '⟁ Mint (will deny)'}
                  </button>
                </div>
                {blocked && (
                  <p className="mt-2 text-[10.5px] text-warn animate-fade-up">denied · {blocked.join(' · ')}</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {grants.length > 0 && (
        <section className="mt-6">
          <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">active + past grants</p>
          <ul className="mt-3 space-y-2">
            {grants.map((g) => {
              const remainingMs = new Date(g.expiryTs).getTime() - now;
              const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
              const totalSec = Math.ceil(g.windowHours * 8);
              const pct = Math.max(0, Math.min(100, (remainingMs / (totalSec * 1000)) * 100));
              return (
                <li key={g.id} className={`flex animate-fade-up items-center gap-4 rounded-xl bg-cell px-4 py-3 shadow-card ring-1 ${g.status === 'active' ? 'ring-rune/40' : 'ring-line opacity-70'}`}>
                  <span className={`mono shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md text-[20px] ring-1 ${g.status === 'active' ? 'bg-rune/15 text-rune ring-rune/40' : 'bg-carbon text-ash ring-line'}`}>{g.skill.rune}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13.5px] truncate ${g.status === 'active' ? 'text-bone' : 'text-ash line-through'}`}>{g.skill.name}</p>
                    <p className="mono text-[10.5px] text-ash">granted by {g.skill.owner} · {g.windowHours}h window · {shortHash(g.hash)}</p>
                  </div>
                  <div className="w-28 text-right">
                    <p className={`mono text-[12.5px] tabnums ${g.status === 'active' ? 'text-rune' : 'text-ash'}`}>{g.status === 'active' ? `${remaining}s left` : g.status.toUpperCase()}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-void">
                      <div className={`h-full transition-all ${g.status === 'active' ? 'bg-rune' : 'bg-ash/30'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="mono shrink-0 text-[12px] tabnums text-bone">{usd(g.costCents)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-6 rounded-2xl bg-cell p-5 shadow-card ring-1 ring-line">
          <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-ash">last decision · what Sly did</p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-void px-3.5 py-2.5 ring-1 ring-line">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-void text-ash ring-line'}`}>{e.protocol}</span>
                <span className="text-[13px] text-bone/90">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash/60">Sigil · Built on Sly · Demo</footer>
    </main>
  );
}

function Pill({ k, v, tone }: { k: string; v: string; tone: 'rune' | 'arc' | 'gold' | 'warn' | 'ash' }) {
  const cls = {
    rune: 'bg-rune/15 text-rune ring-rune/40',
    arc: 'bg-arc/15 text-arc ring-arc/40',
    gold: 'bg-gold/15 text-gold ring-gold/40',
    warn: 'bg-warn/15 text-warn ring-warn/40',
    ash: 'bg-carbon text-ash ring-line',
  }[tone];
  return (<span className={`mono inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[9.5px] font-bold uppercase tracking-wider ring-1 ${cls}`}><span className="opacity-70">{k}</span><span>{v}</span></span>);
}
function Spin() { return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
