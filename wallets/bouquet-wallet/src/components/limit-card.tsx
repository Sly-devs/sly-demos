'use client';

import { useEffect, useState } from 'react';

interface LimitState {
  dailyLimit: number;
  spentToday: number;
  remaining: number;
  error?: string;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function LimitCard() {
  const [s, setS] = useState<LimitState | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await fetch('/api/agent/limit');
      setS(await r.json());
    } catch (e) {
      setS({ dailyLimit: 0, spentToday: 0, remaining: 0, error: String(e) });
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    const v = Number(draft);
    if (!Number.isFinite(v) || v <= 0) return;
    setSaving(true);
    try {
      const r = await fetch('/api/agent/limit', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dailyLimit: v }),
      });
      setS(await r.json());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const pct = s && s.dailyLimit > 0
    ? Math.min(100, Math.round((s.spentToday / s.dailyLimit) * 100))
    : 0;
  const near = pct >= 80;

  return (
    <section className="mt-6 px-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-mute">
          Agent daily limit
        </h2>
        {!editing && s && !s.error && (
          <button
            onClick={() => {
              setDraft(String(s.dailyLimit));
              setEditing(true);
            }}
            className="text-[12px] font-semibold text-coral transition-colors hover:text-coral-soft"
          >
            Adjust
          </button>
        )}
      </div>

      <div className="mt-3 rounded-[1.6rem] bg-gradient-to-b from-surface to-surface/60 p-4 ring-1 ring-hairline">
        {!s ? (
          <p className="py-4 text-center text-[13px] text-mute">Loading…</p>
        ) : s.error ? (
          <p className="py-3 text-[12.5px] text-coral-soft">{s.error}</p>
        ) : editing ? (
          <div>
            <label className="text-[12px] text-mute">
              Set the most this agent can spend per day
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[18px] font-semibold text-cloud">$</span>
              <input
                autoFocus
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full rounded-xl bg-canvas/50 px-3 py-2.5 text-[18px] font-semibold text-cloud outline-none ring-1 ring-hairline focus:ring-coral/40"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-xl bg-coral py-2.5 text-[13px] font-semibold text-white shadow-glow active:scale-[0.98] disabled:opacity-70"
              >
                {saving ? 'Saving…' : 'Save limit'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-mute ring-1 ring-hairline"
              >
                Cancel
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-mute">
              Saved to the agent on Sly — the platform enforces it on every
              purchase.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[12px] text-mute">Spent today</p>
                <p className="text-[22px] font-semibold tracking-tight text-cloud tabnums">
                  {fmt(s.spentToday)}
                  <span className="text-[14px] text-mute">
                    {' '}
                    / {fmt(s.dailyLimit)}
                  </span>
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
                  near
                    ? 'bg-gold/15 text-gold ring-gold/30'
                    : 'bg-mint/15 text-mint ring-mint/30'
                }`}
              >
                {fmt(s.remaining)} left
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-elevate">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${
                  near
                    ? 'bg-gradient-to-r from-gold to-gold/70'
                    : 'bg-gradient-to-r from-coral to-coral-soft'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-mute">
              You control this from here. The agent can never spend more than
              your daily limit — enforced by Sly.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
