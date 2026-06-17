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

const PROTOCOL_TONE: Record<string, string> = {
  ACP: 'bg-clay/12 text-clay-deep',
  AP2: 'bg-amber-500/12 text-amber-700',
  MPP: 'bg-moss/12 text-moss',
};

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

  const settled = phase === 'done' && result;

  return (
    <div>
      {/* the standout CTA */}
      <button
        onClick={run}
        disabled={phase === 'working' || phase === 'done'}
        aria-label={`Buy ${productName} with your Coral agent`}
        className="group relative w-full overflow-hidden rounded-full bg-gradient-to-r from-clay to-clay-deep px-8 py-[18px] text-[15px] font-semibold text-cream shadow-cta transition-all duration-300 hover:shadow-[0_2px_4px_rgba(200,98,58,0.3),0_22px_48px_-12px_rgba(200,98,58,0.6)] active:scale-[0.99] disabled:cursor-default disabled:opacity-95"
      >
        {phase === 'idle' && (
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        )}
        <span className="relative flex items-center justify-center gap-2.5">
          {phase === 'working' ? (
            <>
              <Spinner /> Your agent is checking out…
            </>
          ) : phase === 'done' ? (
            <>
              <CheckCircle /> Bought with your Coral agent
            </>
          ) : (
            <>
              <SparkIcon />
              Buy with Agent
              <span className="ml-1 rounded-full bg-cream/20 px-2 py-0.5 text-[11px] font-bold tracking-wide">
                ACP
              </span>
            </>
          )}
        </span>
      </button>

      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12px] text-ink/40">
        <LockIcon /> Policy-gated · no card entry · settles in stablecoin
      </p>

      {/* event timeline */}
      {result?.events?.length ? (
        <ol className="mt-6 space-y-0 rounded-2xl border border-ink/[0.07] bg-white p-1 shadow-soft">
          {result.events.map((e, i) => {
            const last = i === result.events!.length - 1;
            return (
              <li
                key={i}
                className="animate-fade-up flex items-center gap-3 px-4 py-3"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="relative flex flex-col items-center self-stretch">
                  <span
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      settled ? 'bg-moss' : 'bg-clay'
                    }`}
                  />
                  {!last && (
                    <span className="mt-1 w-px flex-1 bg-ink/10" aria-hidden />
                  )}
                </span>
                <span className="flex flex-1 items-center gap-2.5">
                  {e.protocol ? (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        PROTOCOL_TONE[e.protocol] ?? 'bg-ink/8 text-ink/55'
                      }`}
                    >
                      {e.protocol}
                    </span>
                  ) : null}
                  <span className="text-[13.5px] leading-snug text-ink/70">
                    {e.label}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {/* settlement success */}
      {settled ? (
        <div className="animate-scale-in mt-4 overflow-hidden rounded-2xl border border-moss/20 bg-gradient-to-br from-moss/[0.08] to-moss/[0.02] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-moss text-cream">
              <CheckCircle large />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">
                Settled {result.status}
              </p>
              <p className="text-[12.5px] text-ink/50">
                Paid in {result.currency ?? 'USDC'} from the Coral wallet — no
                card touched.
              </p>
            </div>
          </div>
          {result.transferId ? (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-white/70 px-3.5 py-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink/40">
                Transfer
              </span>
              <span className="font-mono text-[12.5px] text-ink/65">
                {result.transferId}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === 'error' && result ? (
        <div className="animate-fade-up mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <p className="font-semibold">Checkout could not complete</p>
          <p className="mt-0.5 text-red-600/80">
            {result.error ?? 'Checkout failed.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream"
      aria-hidden
    />
  );
}

function SparkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v4M12 17v4M5 12H3M21 12h-2M6.5 6.5 5 5M19 19l-1.5-1.5M17.5 6.5 19 5M5 19l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3.4" fill="currentColor" />
    </svg>
  );
}

function CheckCircle({ large }: { large?: boolean }) {
  const s = large ? 20 : 17;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="24"
        className="animate-draw-check"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
