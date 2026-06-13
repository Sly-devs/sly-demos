'use client';

import { useState } from 'react';

type Phase = 'idle' | 'working' | 'done' | 'error';

interface CheckoutResult {
  status: string;
  transferId?: string;
  totalAmount?: number;
  currency?: string;
  events?: { kind: string; label: string; protocol?: string }[];
  error?: string;
}

export function BuyWithAgent({
  productId,
  productName,
  priceCents,
  currency,
}: {
  productId: string;
  productName: string;
  priceCents: number;
  currency: string;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CheckoutResult | null>(null);

  async function run() {
    setPhase('working');
    setResult(null);
    try {
      const res = await fetch('/api/acp/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, productName, priceCents, currency }),
      });
      const data: CheckoutResult = await res.json();
      if (!res.ok || data.error) {
        setResult(data);
        setPhase('error');
        return;
      }
      setResult(data);
      setPhase('done');
    } catch (err) {
      setResult({ status: 'error', error: String(err) });
      setPhase('error');
    }
  }

  const events = result?.events ?? [];

  return (
    <div>
      <button
        onClick={run}
        disabled={phase === 'working'}
        aria-label={`Buy ${productName} with your shopping agent`}
        className="group relative w-full overflow-hidden rounded-sm bg-umber px-9 py-4 text-sm font-medium tracking-wide text-parch shadow-soft transition hover:bg-terra disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex items-center justify-center gap-2.5">
          {phase === 'working' ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-parch/30 border-t-parch" />
              Asking your agent…
            </>
          ) : phase === 'done' ? (
            <>Bought with your agent ✓</>
          ) : phase === 'error' ? (
            <>Try again</>
          ) : (
            <>Buy with Agent</>
          )}
        </span>
      </button>

      {phase === 'idle' ? (
        <p className="mt-3 text-center text-[11px] text-sage">
          No card entry — your agent presents an ACP mandate, Sly enforces
          policy.
        </p>
      ) : null}

      {phase === 'working' && events.length === 0 ? (
        <ol className="mt-7 space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-gilt/40" />
              <span className="h-2.5 w-40 animate-pulse rounded-full bg-umber/10" />
            </li>
          ))}
        </ol>
      ) : null}

      {events.length ? (
        <ol className="mt-7 space-y-0">
          {events.map((e, i) => {
            const last = i === events.length - 1;
            return (
              <li
                key={i}
                className="relative flex animate-rise-in gap-4 pb-5 last:pb-0"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {!last ? (
                  <span className="absolute left-[5px] top-3 h-full w-px bg-gilt/35" />
                ) : null}
                <span
                  className={`relative z-10 mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full ${
                    last && phase === 'done'
                      ? 'bg-terra ring-4 ring-terra/15'
                      : 'bg-gilt'
                  }`}
                />
                <div className="flex flex-1 items-center gap-2.5">
                  {e.protocol ? (
                    <span className="rounded-sm bg-umber px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-parch">
                      {e.protocol}
                    </span>
                  ) : null}
                  <span className="text-sm text-umber/75">{e.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {phase === 'done' && result ? (
        <div className="mt-6 animate-rise-in rounded-sm border border-terra/25 bg-terra/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-terra">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-terra text-[11px] text-parch">
              ✓
            </span>
            Settled {result.status}
          </p>
          {result.transferId ? (
            <p className="mt-2 break-all font-mono text-[11px] text-umber/55">
              transfer {result.transferId}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === 'error' && result ? (
        <p className="mt-5 rounded-sm border border-terra/30 bg-terra/[0.06] p-3 text-sm text-terra">
          {result.error ?? 'Checkout failed.'}
        </p>
      ) : null}
    </div>
  );
}
