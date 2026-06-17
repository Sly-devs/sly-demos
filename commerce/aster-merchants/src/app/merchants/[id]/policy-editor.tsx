'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AutoAcceptPolicy } from '@/lib/data';

const KYA_LABELS = ['Registered', 'Declared', 'Verified', 'Trusted'];

interface SaveResult {
  ok: boolean;
  persisted: boolean;
  before: AutoAcceptPolicy | null;
  after: AutoAcceptPolicy;
}

export function PolicyEditor({
  merchantId,
  merchantName,
  initial,
}: {
  merchantId: string;
  merchantName: string;
  initial: AutoAcceptPolicy;
}) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<AutoAcceptPolicy>(initial);
  const [policy, setPolicy] = useState<AutoAcceptPolicy>(initial);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    policy.minKyaTier !== baseline.minKyaTier ||
    policy.minReputation !== baseline.minReputation ||
    policy.minCrossTenantTx !== baseline.minCrossTenantTx;

  function set<K extends keyof AutoAcceptPolicy>(
    key: K,
    value: AutoAcceptPolicy[K],
  ) {
    setPolicy((p) => ({ ...p, [key]: value }));
    setResult(null);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/merchants/${merchantId}/policy`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ policy }),
      });
      const data = await res.json();
      if (!res.ok || !data.persisted) {
        setError(data.error ?? 'Failed to persist policy to Sly');
      } else {
        setResult(data as SaveResult);
        setBaseline((data as SaveResult).after);
        setPolicy((data as SaveResult).after);
        // Refresh server components so the thresholds panel re-reads Sly.
        router.refresh();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-card">
      <div className="border-b border-line px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Auto-accept policy
          </h2>
          {dirty ? (
            <span className="flex items-center gap-1.5 rounded-full border border-warn/25 bg-warn/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warn">
              <span className="h-1.5 w-1.5 rounded-full bg-warn" />
              Unsaved
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-2 py-0.5 text-[10px] uppercase tracking-wider text-faint">
              Synced
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-mute">
          Persisted to{' '}
          <span className="font-medium text-mute">{merchantName}</span>&apos;s
          Sly account metadata. Checkouts satisfying every rule settle
          automatically; anything below a threshold is held for review.
        </p>
      </div>

      <div className="space-y-7 px-6 py-6">
        <div>
          <label
            htmlFor="kya-tier"
            className="flex items-center justify-between text-sm font-medium"
          >
            <span>Minimum KYA tier</span>
            <span className="flex items-center gap-2 text-mute">
              <span className="tnum">T{policy.minKyaTier}</span>
              <span className="rounded border border-line bg-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-faint">
                {KYA_LABELS[policy.minKyaTier]}
              </span>
            </span>
          </label>
          <input
            id="kya-tier"
            type="range"
            min={0}
            max={3}
            step={1}
            value={policy.minKyaTier}
            onChange={(e) =>
              set(
                'minKyaTier',
                Number(e.target.value) as AutoAcceptPolicy['minKyaTier'],
              )
            }
            className="mt-3 w-full accent-brand"
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-faint">
            <span>T0 Registered</span>
            <span>T1 Declared</span>
            <span>T2 Verified</span>
            <span>T3 Trusted</span>
          </div>
        </div>

        <div className="h-px bg-line" />

        <div>
          <label
            htmlFor="min-rep"
            className="flex items-center justify-between text-sm font-medium"
          >
            <span>Minimum reputation</span>
            <span className="flex items-center gap-1.5 tnum text-mute">
              <span className="text-warn">★</span>
              {policy.minReputation.toFixed(1)}
            </span>
          </label>
          <input
            id="min-rep"
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={policy.minReputation}
            onChange={(e) =>
              set('minReputation', Math.round(Number(e.target.value) * 10) / 10)
            }
            className="mt-3 w-full accent-brand"
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-faint">
            <span>0.0</span>
            <span>2.5</span>
            <span>5.0</span>
          </div>
        </div>

        <div className="h-px bg-line" />

        <div>
          <label htmlFor="min-xtenant" className="block text-sm font-medium">
            Minimum cross-tenant transactions
          </label>
          <p className="mt-1 text-xs text-mute">
            How much verifiable history the agent must have outside this
            tenant.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="min-xtenant"
              type="number"
              min={0}
              value={policy.minCrossTenantTx}
              onChange={(e) =>
                set('minCrossTenantTx', Math.max(0, Number(e.target.value)))
              }
              className="w-28 rounded-md border border-line bg-raised px-3 py-2 text-sm tnum text-ink outline-none transition focus:border-brand focus:ring-1 focus:ring-brand/40"
            />
            <span className="text-xs text-faint">settled transactions</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-raised/30 px-6 py-4">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-brand-dim disabled:shadow-none"
        >
          {saving ? 'Persisting to Sly…' : 'Save policy'}
        </button>
        <button
          onClick={() => {
            setPolicy(baseline);
            setResult(null);
            setError(null);
          }}
          disabled={!dirty || saving}
          className="rounded-md border border-line px-4 py-2 text-sm text-mute transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
        {error ? (
          <span className="text-xs text-bad">{error}</span>
        ) : result ? (
          <span className="flex items-center gap-1.5 text-xs text-ok">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-ok/15 text-[10px]">
              ✓
            </span>
            Persisted &amp; re-read from Sly
          </span>
        ) : null}
      </div>

      {result ? (
        <div className="border-t border-line bg-base/40 px-6 py-4">
          <p className="text-[10px] uppercase tracking-wider text-faint">
            Round-trip proof — re-fetched from Sly account metadata
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            {(
              [
                ['Min KYA tier', 'minKyaTier', (v: number) => `T${v}`],
                [
                  'Min reputation',
                  'minReputation',
                  (v: number) => v.toFixed(1),
                ],
                [
                  'Min cross-tenant',
                  'minCrossTenantTx',
                  (v: number) => String(v),
                ],
              ] as const
            ).map(([label, key, fmt]) => {
              const before = result.before
                ? result.before[key]
                : undefined;
              const after = result.after[key];
              const changed = before !== undefined && before !== after;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-line bg-panel p-3"
                >
                  <p className="text-[10px] uppercase tracking-wider text-faint">
                    {label}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 tnum">
                    <span className="text-faint line-through">
                      {before !== undefined ? fmt(before) : '—'}
                    </span>
                    <span className="text-faint">→</span>
                    <span
                      className={changed ? 'text-ok' : 'text-mute'}
                    >
                      {fmt(after)}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
