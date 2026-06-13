'use client';

import { useMemo, useState } from 'react';
import { AGENT, OWNER, REASON_LABEL, SUBS, shortHash, usd, type Sub } from '@/lib/demo';

interface Event { protocol: string; label: string; }
interface CancelReceipt { id: string; subId: string; merchant: string; action: 'cancel' | 'downgrade'; savedCents: number; hash: string; ts: string; }

const REC_TONE: Record<Sub['rec'], string> = {
  cancel: 'bg-rosesoft text-rose ring-rose/30',
  downgrade: 'bg-lemon/30 text-ink ring-lemon/60',
  keep: 'bg-leafsoft text-leaf ring-leaf/30',
  flag: 'bg-chartsoft text-chart ring-chart/30',
};
const REC_LABEL: Record<Sub['rec'], string> = {
  cancel: 'CANCEL',
  downgrade: 'DOWNGRADE',
  keep: 'KEEP',
  flag: 'FLAG',
};

const PROTOCOL_TONE: Record<string, string> = {
  KYA: 'bg-chartsoft text-chart ring-chart/30',
  AP2: 'bg-lemon/30 text-ink ring-lemon/60',
  ACP: 'bg-leafsoft text-leaf ring-leaf/30',
};

export default function TrimHome() {
  const [selected, setSelected] = useState<Set<string>>(new Set(SUBS.filter((s) => s.rec === 'cancel' || s.rec === 'downgrade').map((s) => s.id)));
  const [executed, setExecuted] = useState<Set<string>>(new Set());
  const [receipts, setReceipts] = useState<CancelReceipt[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [pending, setPending] = useState(false);

  const proposedSavingsCents = useMemo(() => {
    return SUBS.filter((s) => selected.has(s.id)).reduce((acc, s) => acc + (s.monthlyCents - (s.proposedMonthlyCents ?? 0)), 0);
  }, [selected]);
  const totalBillCents = SUBS.reduce((acc, s) => acc + s.monthlyCents, 0);
  const realizedSavingsCents = receipts.reduce((acc, r) => acc + r.savedCents, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function execute() {
    setPending(true);
    try {
      const res = await fetch('/api/cancel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subIds: Array.from(selected) }) });
      const data = await res.json();
      setEvents(data.events ?? []);
      if (data.receipts) {
        setReceipts((p) => [...data.receipts, ...p]);
        setExecuted((p) => new Set([...p, ...data.receipts.map((r: { subId: string }) => r.subId)]));
        setSelected(new Set());
      }
    } finally { setPending(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-end justify-between border-b border-line pb-5">
        <div>
          <p className="display text-[12px] italic text-ash">subscription autopilot · governed by Sly</p>
          <h1 className="mt-1 flex items-baseline gap-2">
            <span className="display text-[44px] font-bold leading-none text-ink">Trim</span>
            <span className="display text-[28px] italic text-leaf">.</span>
          </h1>
        </div>
        <div className="text-right text-[12px] text-ash">
          <p className="font-semibold text-ink">{OWNER.name}</p>
          <p className="mono">{OWNER.city}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl bg-paper p-6 shadow-card ring-1 ring-line">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ash">monthly subscription bill</p>
            <p className="mono text-[11px] text-ash">{SUBS.length} recurring</p>
          </div>
          <p className="display mt-2 text-[44px] font-bold leading-none tabnums text-ink">{usd(totalBillCents)}<span className="text-[16px] font-normal text-ash"> /mo</span></p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
            <Stat label="Trim found" value={`${SUBS.filter((s) => s.rec === 'cancel' || s.rec === 'downgrade').length}`} sub="actions" tone="rose" />
            <Stat label="If you approve" value={usd(proposedSavingsCents)} sub="saved/mo" tone="leaf" />
            <Stat label="Already executed" value={usd(realizedSavingsCents)} sub="locked in" tone="chart" />
          </div>
        </div>

        <div className="rounded-2xl bg-paper p-6 shadow-card ring-1 ring-line">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ash">trim policy</p>
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-ink/90">
            <li><span className="text-leaf mono">·</span> Unilateral cancel ≤ {usd(AGENT.unilateralCapCents)}/mo total impact</li>
            <li><span className="text-leaf mono">·</span> Above that → escalate to you</li>
            <li><span className="text-leaf mono">·</span> Keeps anything family-essential or active in last 30d</li>
            <li><span className="text-leaf mono">·</span> Never cancels without a Sly signed receipt</li>
          </ul>
          <button
            disabled={pending || selected.size === 0}
            onClick={execute}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-leaf px-4 py-2.5 text-[13px] font-semibold text-white shadow-save transition hover:bg-leaf/85 disabled:opacity-60"
          >
            {pending ? <Spin /> : <Check />}
            Approve {selected.size} · save {usd(proposedSavingsCents)}/mo
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-paper shadow-card ring-1 ring-line overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ash">trim cleanup report · {SUBS.length} subscriptions</p>
          <p className="mono text-[11px] text-ash">tap to (de)select</p>
        </div>
        <ul>
          {SUBS.map((s) => {
            const isExec = executed.has(s.id);
            const isSel = selected.has(s.id);
            const interactive = s.rec === 'cancel' || s.rec === 'downgrade';
            return (
              <li key={s.id}
                onClick={() => interactive && !isExec && toggle(s.id)}
                className={`relative grid grid-cols-[42px_2.5fr_1fr_1fr_120px] items-center gap-3 border-b border-line/60 px-5 py-3 text-[13px] ${interactive && !isExec ? 'cursor-pointer hover:bg-snow' : ''} ${isExec ? 'bg-leafsoft/30' : ''}`}>
                <span className="display text-[20px] text-ink/70">{s.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{s.merchant}</p>
                  <p className="text-[11.5px] text-ash">{s.category} · <span className="display italic">{s.notes}</span></p>
                </div>
                <div className="text-right">
                  <p className="mono tabnums text-ink">{usd(s.monthlyCents)}<span className="text-[10px] text-ash">/mo</span></p>
                  {s.proposedMonthlyCents !== undefined && (
                    <p className="mono text-[10.5px] text-leaf">→ {usd(s.proposedMonthlyCents)}/mo</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.reasons.map((r) => (
                    <span key={r} className="rounded-md bg-snow px-1.5 py-[1px] mono text-[9.5px] uppercase tracking-wider text-ash ring-1 ring-line">{REASON_LABEL[r]}</span>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className={`rounded-md px-2 py-0.5 mono text-[10px] font-bold uppercase tracking-wider ring-1 ${REC_TONE[s.rec]}`}>{REC_LABEL[s.rec]}</span>
                  {interactive && (
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md ring-1 ${isExec ? 'bg-leaf text-white ring-leaf' : isSel ? 'bg-leaf text-white ring-leaf' : 'bg-paper ring-line text-paper'}`}>
                      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden><path d="M2 6.5l2.4 2.4L10 3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                    </span>
                  )}
                </div>
                {isExec && <span className="absolute left-[42px] right-5 top-1/2 h-px origin-left animate-strike bg-leaf/50" />}
              </li>
            );
          })}
        </ul>
      </section>

      {events.length > 0 && (
        <section className="mt-6 rounded-2xl bg-paper p-5 shadow-card ring-1 ring-line">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ash">what Sly did, in order</p>
          <ol className="mt-3 space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex animate-fade-up items-center gap-3 rounded-lg bg-snow px-3.5 py-2.5 ring-1 ring-line">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 mono text-[9.5px] font-bold uppercase tracking-wider ring-1 ${PROTOCOL_TONE[e.protocol] ?? 'bg-snow text-ash ring-line'}`}>{e.protocol}</span>
                <span className="text-[13px] text-ink">{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {receipts.length > 0 && (
        <section className="mt-6 rounded-2xl bg-paper shadow-card ring-1 ring-line overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ash">cancellation receipts · signed</p>
            <p className="mono text-[11px] text-leaf">−{usd(realizedSavingsCents)}/mo locked in</p>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-snow text-[10.5px] uppercase tracking-[0.14em] text-ash">
                <th className="px-5 py-2 text-left">Merchant</th>
                <th className="px-5 py-2 text-left">Action</th>
                <th className="px-5 py-2 text-right">Saved /mo</th>
                <th className="px-5 py-2 text-left">Tx</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-b border-line/40">
                  <td className="px-5 py-2.5 font-semibold">{r.merchant}</td>
                  <td className="px-5 py-2.5"><span className={`rounded-md px-2 py-0.5 mono text-[10px] font-bold uppercase tracking-wider ring-1 ${r.action === 'cancel' ? 'bg-rosesoft text-rose ring-rose/30' : 'bg-lemon/30 text-ink ring-lemon/60'}`}>{r.action}</span></td>
                  <td className="px-5 py-2.5 mono text-right tabnums text-leaf">{usd(r.savedCents)}</td>
                  <td className="px-5 py-2.5 mono text-chart">{shortHash(r.hash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="mt-12 text-center mono text-[10px] uppercase tracking-[0.22em] text-ash/60">Trim · Built on Sly · Demo</footer>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'rose' | 'leaf' | 'chart' }) {
  const t = tone === 'rose' ? 'text-rose' : tone === 'leaf' ? 'text-leaf' : 'text-chart';
  return (
    <div className="rounded-lg bg-snow px-3 py-2 ring-1 ring-line">
      <p className="text-[9.5px] uppercase tracking-[0.16em] text-ash">{label}</p>
      <p className={`display mt-0.5 text-[20px] font-bold tabnums ${t}`}>{value}</p>
      <p className="text-[10.5px] text-ash">{sub}</p>
    </div>
  );
}
function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2.5 7.5l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
  );
}
function Spin() { return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
