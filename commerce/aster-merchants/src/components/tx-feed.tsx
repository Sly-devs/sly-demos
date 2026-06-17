'use client';

import { useEffect, useState } from 'react';
import {
  formatUsd,
  summarize,
  type FeedResponse,
  type FeedTx,
  type TxStatus,
} from '@/lib/data';

const STATUS_STYLE: Record<TxStatus, string> = {
  completed: 'text-ok bg-ok/10 border-ok/25',
  review: 'text-warn bg-warn/10 border-warn/25',
  blocked: 'text-bad bg-bad/10 border-bad/25',
};

const STATUS_DOT: Record<TxStatus, string> = {
  completed: 'bg-ok',
  review: 'bg-warn',
  blocked: 'bg-bad',
};

const STATUS_LABEL: Record<TxStatus, string> = {
  completed: 'Settled',
  review: 'Held for review',
  blocked: 'Blocked',
};

function fraudTone(score: number): string {
  if (score >= 55) return 'text-bad';
  if (score >= 30) return 'text-warn';
  return 'text-mute';
}

function fraudBar(score: number): string {
  if (score >= 55) return 'bg-bad';
  if (score >= 30) return 'bg-warn';
  return 'bg-ok/70';
}

function relTime(iso: string): string {
  const diff = Date.now() - +new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-panel p-5 shadow-card transition hover:border-brand/40">
      <p className="text-[11px] uppercase tracking-wider text-faint">{label}</p>
      <p
        className={`mt-2 text-[28px] font-semibold leading-none tracking-tight tnum ${
          accent ? 'text-brand' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {sub ? <p className="mt-2 text-xs text-mute">{sub}</p> : null}
      <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-brand/5 opacity-0 transition group-hover:opacity-100" />
    </div>
  );
}

export function TxFeed() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch('/api/feed', { cache: 'no-store' });
        const data: FeedResponse = await res.json();
        if (alive) {
          setFeed(data);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(String(e));
      }
    }
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (error && !feed) {
    return (
      <p className="rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">
        Feed unavailable: {error}
      </p>
    );
  }

  if (!feed) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[104px] animate-pulse rounded-xl border border-line bg-panel"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-line bg-panel" />
      </div>
    );
  }

  const txs = feed.transactions;
  const s = summarize(txs);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Active merchants"
          value={String(s.merchants)}
          sub="ACP-enabled storefronts"
        />
        <Kpi
          label="Real ACP checkouts"
          value={String(s.realTx)}
          sub={`of ${s.totalTx} shown · live from Sly`}
        />
        <Kpi
          label="Settled volume"
          value={formatUsd(s.volumeCents, 'USD')}
          sub="Completed checkouts"
        />
        <Kpi
          label="Auto-accept rate"
          value={`${s.autoAcceptRate}%`}
          sub="Cleared policy without review"
          accent
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight">
              Live transaction feed
            </h2>
            <span className="rounded-full border border-line bg-raised px-2 py-0.5 text-[10px] tnum text-mute">
              {txs.length}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-1 rounded-sm bg-brand" />
              Real Sly checkout
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-1 rounded-sm bg-line" />
              Synthetic platform volume
            </span>
            <span className="flex items-center gap-1.5">
              {feed.source === 'sly-api' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                  Sly API · live · 8s
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                  Sly API unreachable · synthetic only
                </>
              )}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-faint">
                <th className="px-5 py-2.5 font-medium">Time</th>
                <th className="px-5 py-2.5 font-medium">Agent</th>
                <th className="px-5 py-2.5 font-medium">KYA</th>
                <th className="px-5 py-2.5 font-medium">Reputation</th>
                <th className="px-5 py-2.5 font-medium">Fraud</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                <th className="px-5 py-2.5 font-medium">Merchant</th>
                <th className="px-5 py-2.5 font-medium">Policy verdict</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">Audit</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t: FeedTx) => (
                <tr
                  key={t.id}
                  className={`group relative border-b border-line/50 transition last:border-0 hover:bg-raised/50 ${
                    t.synthetic ? 'opacity-[0.78]' : 'bg-brand/[0.035]'
                  }`}
                >
                  <td className="relative whitespace-nowrap py-3 pl-5 pr-5 text-[13px] tnum text-mute">
                    <span
                      className={`absolute left-0 top-0 h-full w-[3px] ${
                        t.synthetic ? 'bg-transparent' : 'bg-brand'
                      }`}
                    />
                    {relTime(t.at)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-ink">{t.agent}</span>
                      {!t.synthetic ? (
                        <span className="rounded border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-brand">
                          Real
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 text-[11px] tnum text-mute">
                      T{t.kyaTier}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5 tnum text-mute">
                      <span className="text-warn">★</span>
                      {t.reputation.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <span className="h-1 w-12 overflow-hidden rounded-full bg-line">
                        <span
                          className={`block h-full rounded-full ${fraudBar(t.fraudScore)}`}
                          style={{
                            width: `${Math.min(100, t.fraudScore)}%`,
                          }}
                        />
                      </span>
                      <span
                        className={`w-6 text-right tnum text-[13px] ${fraudTone(t.fraudScore)}`}
                      >
                        {t.fraudScore}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium tnum text-ink">
                    {formatUsd(t.amountCents, t.currency)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-raised text-[10px] font-semibold text-mute">
                        {t.merchant.slice(0, 2)}
                      </span>
                      <span className="text-mute">{t.merchant}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${
                        t.verdict.pass
                          ? 'border-ok/25 bg-ok/10 text-ok'
                          : 'border-warn/25 bg-warn/10 text-warn'
                      }`}
                      title={t.verdict.checks
                        .map(
                          (c) =>
                            `${c.label}: ${c.actual} (need ${c.required}) ${c.pass ? 'OK' : 'FAIL'}`,
                        )
                        .join(' · ')}
                    >
                      {t.verdict.pass ? 'Auto-accept' : 'Policy review'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${STATUS_STYLE[t.status]}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status]}`}
                      />
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded bg-raised/60 px-1.5 py-0.5 font-mono text-[11px] text-faint transition group-hover:text-mute">
                      {t.auditAnchor}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
