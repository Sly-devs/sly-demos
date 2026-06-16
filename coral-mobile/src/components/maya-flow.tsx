'use client';

import { useEffect, useState } from 'react';
import {
  MAYA,
  type DemoEvt,
  type MayaBorrowResponse,
  type MayaPositionResponse,
} from '@/lib/demo';

type Phase =
  | 'idle'
  | 'requesting'
  | 'awaiting_approval'
  | 'approving'
  | 'settled'
  | 'error';

/**
 * Maya's Savings & Credit flow — mirrors the shopping `AgentFlow`:
 *  - Borrow button → /api/maya/borrow (evaluate → deny → scope request).
 *  - Approve card  → /api/maya/approve (approve → re-evaluate → Compass → broadcast).
 * The deny→request→approve→execute steps render as a timeline.
 */
export function MayaFlow() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pending, setPending] = useState<MayaBorrowResponse | null>(null);
  const [events, setEvents] = useState<DemoEvt[]>([]);
  const [result, setResult] = useState<MayaBorrowResponse | null>(null);

  // Step 1–2: evaluate (denied) → agent requests compass:credit scope.
  async function start() {
    setPhase('requesting');
    setEvents([]);
    setResult(null);
    setPending(null);
    try {
      const res = await fetch('/api/maya/borrow', { method: 'POST' });
      const data: MayaBorrowResponse = await res.json();
      if (!res.ok || data.phase === 'error') {
        setResult(data);
        setPhase('error');
        return;
      }
      setPending(data);
      setEvents(data.events ?? []);
      setPhase('awaiting_approval');
    } catch (err) {
      setResult({ phase: 'error', error: String(err) });
      setPhase('error');
    }
  }

  // Step 3–6: owner approves the scope; agent borrows + broadcasts on Base.
  async function approve() {
    if (!pending?.requestId) return;
    setPhase('approving');
    try {
      const res = await fetch('/api/maya/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: pending.requestId }),
      });
      const data: MayaBorrowResponse = await res.json();
      if (!res.ok || data.phase === 'error') {
        setResult(data);
        setPhase('error');
        return;
      }
      setEvents((prev) => [...prev, ...(data.events ?? [])]);
      setResult(data);
      setPhase('settled');
    } catch (err) {
      setResult({ phase: 'error', error: String(err) });
      setPhase('error');
    }
  }

  const showTimeline = events.length > 0 && phase !== 'idle';

  return (
    <div className="px-5">
      {phase === 'idle' && (
        <button
          onClick={start}
          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-coral py-4 text-[15px] font-semibold text-white shadow-glow transition-all active:scale-[0.98]"
        >
          Borrow {MAYA.borrowAmount} {MAYA.borrowAsset} against savings
          <span className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      )}

      {phase === 'requesting' && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-surface/70 px-3.5 py-3 text-[13px] text-mute ring-1 ring-hairline">
          <Spinner /> Asking Sly to authorize the borrow…
        </div>
      )}

      {showTimeline && (
        <ol className="mt-5 space-y-2.5">
          {events.map((e, i) => (
            <li
              key={i}
              className="flex animate-fade-up items-start gap-2.5 rounded-2xl bg-surface/70 px-3.5 py-3 ring-1 ring-hairline"
            >
              <StepDot kind={e.kind} />
              <span className="text-[13.5px] leading-snug text-cloud/90">
                {e.label}
              </span>
            </li>
          ))}
          {phase === 'approving' && (
            <li className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-mute">
              <Spinner /> Approving scope & broadcasting on Base…
            </li>
          )}
        </ol>
      )}

      {(phase === 'awaiting_approval' ||
        phase === 'approving' ||
        phase === 'settled') &&
        pending && (
          <ScopeRequestPanel pending={pending} settled={phase === 'settled'} />
        )}

      {phase === 'settled' && result && <SettledCard result={result} />}

      {phase === 'error' && result && (
        <div className="mt-4 animate-fade-up rounded-3xl bg-coral-deep/15 p-4 text-[13px] text-coral-soft ring-1 ring-coral/30">
          <p className="font-semibold text-coral-soft">Borrow blocked</p>
          <p className="mt-1 break-words text-mute">
            {result.error ?? 'The agent could not complete this borrow.'}
          </p>
        </div>
      )}

      {phase === 'awaiting_approval' && pending && (
        <ApprovalSheet pending={pending} onApprove={approve} />
      )}
    </div>
  );
}

/** Real Epic-82 scope request — pending until Maya approves it. */
function ScopeRequestPanel({
  pending,
  settled,
}: {
  pending: MayaBorrowResponse;
  settled: boolean;
}) {
  return (
    <div className="mt-4 animate-fade-up rounded-3xl bg-surface p-4 ring-1 ring-hairline">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-mute">
          Credit scope request
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
            settled
              ? 'bg-mint/15 text-mint ring-mint/30'
              : 'bg-gold/15 text-gold ring-gold/30'
          }`}
        >
          {settled ? 'GRANTED · CONSUMED' : 'PENDING APPROVAL'}
        </span>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-cloud/85">
        {pending.purpose}
      </p>
      <div className="mt-3 space-y-1.5 text-[11.5px] text-mute">
        <Row label="Scope" value={`${pending.scope ?? MAYA.scope} · one-shot`} />
        <Row
          label="Borrow"
          value={`${pending.amount ?? MAYA.borrowAmount} ${pending.asset ?? MAYA.borrowAsset}`}
        />
        <Row label="Request" value={pending.requestId ?? '—'} mono />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-mute">
        Borrowing increases risk, so Sly requires a just-in-time grant. The
        agent cannot touch your collateral until you approve this request.
      </p>
    </div>
  );
}

function SettledCard({ result }: { result: MayaBorrowResponse }) {
  const href = result.txHash
    ? `https://basescan.org/tx/${result.txHash}`
    : undefined;
  return (
    <div className="mt-4 animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-mint/20 to-mint/[0.04] p-5 text-center ring-1 ring-mint/30">
      <div className="relative mx-auto h-14 w-14">
        <span className="absolute inset-0 rounded-full bg-mint/40 animate-pulse-ring" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-mint text-canvas shadow-[0_8px_24px_-8px_rgba(52,216,164,0.6)]">
          <Check />
        </div>
      </div>
      <p className="mt-4 text-[20px] font-semibold tracking-tight text-cloud">
        {result.amount ?? MAYA.borrowAmount} {result.asset ?? MAYA.borrowAsset}
      </p>
      <p className="mt-0.5 text-[13px] font-medium text-mint">
        ✓ Borrowed on Base mainnet · one-shot grant consumed
      </p>
      <div className="mt-4 space-y-1.5 rounded-2xl bg-canvas/40 px-4 py-3 text-left text-[12px]">
        <Row label="Asset" value={`${result.asset ?? MAYA.borrowAsset}`} />
        {result.blockNumber != null && String(result.blockNumber) !== '' && (
          <Row label="Block" value={String(result.blockNumber)} mono />
        )}
        <Row label="Tx hash" value={result.txHash ?? '—'} mono />
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-elevate py-3 text-[14px] font-semibold text-cloud ring-1 ring-hairline transition-colors hover:ring-mint/30"
        >
          View on Basescan
          <span className="text-mint">↗</span>
        </a>
      )}
    </div>
  );
}

export function ApprovalSheet({
  pending,
  onApprove,
  blurb,
  ctaLabel,
}: {
  pending: MayaBorrowResponse;
  onApprove: () => void;
  /** Optional override for the sub-headline. Default: "borrow against your Aave savings". */
  blurb?: React.ReactNode;
  /** Optional override for the button text. Default: "Approve & borrow". */
  ctaLabel?: string;
}) {
  const [scanning, setScanning] = useState(false);

  function handle() {
    setScanning(true);
    setTimeout(onApprove, 1100);
  }

  return (
    <div
      className="absolute inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Approve credit scope request"
    >
      <div className="absolute inset-0 animate-fade-up bg-black/60 backdrop-blur-md" />
      <div className="relative w-full animate-sheet-up rounded-t-[2.4rem] bg-gradient-to-b from-elevate to-surface px-6 pb-9 pt-3 ring-1 ring-white/10">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />

        <div className="mt-6 text-center">
          <FaceIdGlyph scanning={scanning} />
          <p className="mt-5 text-[12px] uppercase tracking-[0.2em] text-mute">
            Approve {pending.scope ?? MAYA.scope}
          </p>
          <p className="mt-2.5 text-[30px] font-semibold tracking-tight text-cloud">
            {pending.amount ?? MAYA.borrowAmount}{' '}
            <span className="text-[20px] text-mute">
              {pending.asset ?? MAYA.borrowAsset}
            </span>
          </p>
          <p className="mt-1 text-[14px] text-mute">
            {blurb ?? (
              <>
                borrow against your{' '}
                <span className="font-medium text-cloud/80">Aave savings</span>
              </>
            )}
          </p>
        </div>

        <div className="mt-5 space-y-1 rounded-2xl bg-canvas/40 px-4 py-3 text-[11px] text-mute">
          <div className="flex items-center justify-center gap-2">
            <ShieldMini /> One-shot credit grant · consumed on this borrow
          </div>
          <p className="truncate text-center font-mono text-[10px] text-mute/70">
            req {pending.requestId}
          </p>
        </div>

        <button
          onClick={handle}
          disabled={scanning}
          aria-label={`Approve ${pending.scope ?? MAYA.scope} to borrow ${pending.amount ?? MAYA.borrowAmount} ${pending.asset ?? MAYA.borrowAsset}`}
          className="mt-5 w-full rounded-2xl bg-coral py-4 text-[15px] font-semibold text-white shadow-glow transition-transform active:scale-[0.98] disabled:opacity-80"
        >
          {scanning ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> Approving with Coral ID…
            </span>
          ) : (
            ctaLabel ?? 'Approve & borrow'
          )}
        </button>
        <p className="mt-3 text-center text-[11px] text-mute">
          Double-click side button to confirm · demo tap
        </p>
      </div>
    </div>
  );
}

/* — savings position card (live) — */

export function SavingsCard() {
  const [pos, setPos] = useState<MayaPositionResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchPos = () => {
      fetch('/api/maya/position', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: MayaPositionResponse) => {
          if (alive) setPos(d);
        })
        .catch(() => {
          /* keep fallback */
        })
        .finally(() => {
          if (alive) setLoaded(true);
        });
    };
    fetchPos();
    // Other components (e.g. CreditCheckoutCard) emit this after a
    // settled on-chain operation so the position re-fetches without a
    // page reload — Aave subgraph indexers can lag the tx by ~5s, hence
    // the small delay before refetch.
    const onRefresh = () => setTimeout(fetchPos, 4_000);
    window.addEventListener('maya:position-refresh', onRefresh);
    return () => {
      alive = false;
      window.removeEventListener('maya:position-refresh', onRefresh);
    };
  }, []);

  const savings = pos?.suppliedUsdc ?? pos?.collateralUsd ?? MAYA.savingsUsd;
  const apy = pos?.supplyApy ?? MAYA.supplyApy;
  const debt = pos?.debt ?? [];

  return (
    <section className="card-sheen relative mx-5 mt-4 overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-[#1c6b4f] via-[#16513c] to-[#0e3328] p-5 shadow-card">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/70">
          Savings · Aave
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-bold tracking-wide text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" aria-hidden />
          USDC · Base
        </span>
      </div>
      <p
        className={`relative mt-4 text-[42px] font-semibold leading-none tracking-tight text-white tabnums transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-80'
        }`}
      >
        <span className="align-top text-[22px] text-white/70">$</span>
        {savings.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
      <p className="relative mt-2 text-[13px] text-white/75">
        Supplied to Aave · earning{' '}
        <span className="font-semibold text-mint">{apy.toFixed(2)}% APY</span>
      </p>
      <div className="relative mt-4 rounded-2xl bg-black/20 px-4 py-3 text-[12px] text-white/80 backdrop-blur">
        {debt.length === 0 ? (
          <span>No outstanding debt — your collateral is free.</span>
        ) : (
          <ul className="space-y-1">
            {debt.map((d, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-white/70">Borrowed</span>
                <span className="font-semibold tabnums text-white">
                  {d.amount.toLocaleString('en-US', {
                    maximumFractionDigits: 6,
                  })}{' '}
                  {d.symbol}
                </span>
              </li>
            ))}
          </ul>
        )}
        <LtvBar collateral={pos?.collateralUsd ?? savings} debt={debt.reduce((s, d) => s + d.amount, 0)} />
      </div>
      {pos?.safe && pos.safe.balance > 0 && (
        <div className="relative mt-2 rounded-2xl bg-black/25 px-4 py-3 text-[12px] text-white/85 backdrop-blur ring-1 ring-mint/20">
          <div className="flex items-center justify-between">
            <span className="text-white/70">In Compass Safe</span>
            <span className="font-semibold tabnums text-mint">
              {pos.safe.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {pos.safe.currency}
            </span>
          </div>
          <p className="mt-1 text-[10.5px] text-white/55">
            spendable · agent EOA is the Safe owner ·{' '}
            <span className="font-mono">
              {pos.safe.address.slice(0, 6)}…{pos.safe.address.slice(-4)}
            </span>
          </p>
        </div>
      )}
      {pos?.error && (
        <p className="relative mt-2 text-[11px] text-white/60">
          Showing seed values — live position unavailable.
        </p>
      )}

      {/* Repay action — appears when debt > 0; rides the standing
          compass:credit grant from onboarding, so no scope step-up needed. */}
      {debt.length > 0 && <RepayButton currentDebtUsdc={debt.reduce((s, d) => s + d.amount, 0)} />}
    </section>
  );
}

/* — LTV bar: filled portion = debt / collateral, capped at the Aave
   USDC cap (75% on Base). Beyond 60% the bar warns; beyond 70% it goes
   red. The white tick on the bar marks the 75% cap itself. — */

const AAVE_USDC_MAX_LTV = 0.75;

function LtvBar({ collateral, debt }: { collateral: number; debt: number }) {
  if (!collateral || collateral <= 0) return null;
  const ltv = debt / collateral;
  // Render against 100% so the visual cap matches the math; show the 75%
  // tick explicitly so the user can see how close they're getting.
  const fillPct = Math.min(ltv * 100, 100);
  const capPct = AAVE_USDC_MAX_LTV * 100;
  const tone =
    ltv >= AAVE_USDC_MAX_LTV
      ? 'bg-rose-400'
      : ltv >= 0.7
        ? 'bg-rose-300'
        : ltv >= 0.6
          ? 'bg-amber-300'
          : 'bg-mint';
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wider text-white/55">
        <span>Borrow used</span>
        <span className="font-mono text-white/75 normal-case tabnums">
          {(ltv * 100).toFixed(1)}% / {capPct.toFixed(0)}% cap
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${tone}`}
          style={{ width: `${fillPct}%` }}
        />
        <div
          className="absolute inset-y-[-3px] w-[1.5px] bg-white/40"
          style={{ left: `${capPct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

/* — Repay button: one-tap close-out of the USDC debt. Standing
   compass:credit grant covers it — no scope step-up. Click is consent. — */

function RepayButton({ currentDebtUsdc }: { currentDebtUsdc: number }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function repay() {
    setState('running');
    setError(null);
    try {
      const res = await fetch('/api/maya/repay', { method: 'POST' });
      const body = (await res.json()) as { phase: string; txHash?: string; error?: string; message?: string };
      if (body.phase === 'settled' && body.txHash) {
        setTxHash(body.txHash);
        setState('done');
        // Aave indexers take ~5s to surface the new debt — the listener
        // in SavingsCard delays by 4s already, so we just dispatch.
        window.dispatchEvent(new CustomEvent('maya:position-refresh'));
      } else if (body.phase === 'noop') {
        setError(body.message ?? 'Nothing to repay.');
        setState('error');
      } else {
        setError(body.error ?? 'Repay failed.');
        setState('error');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }

  return (
    <div className="relative mt-3">
      <button
        onClick={repay}
        disabled={state === 'running' || state === 'done'}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/12 px-3 py-2 text-[12px] font-semibold text-white ring-1 ring-white/15 backdrop-blur transition-all hover:bg-white/18 disabled:cursor-default disabled:opacity-70"
      >
        {state === 'idle' && (
          <>
            Repay {currentDebtUsdc.toLocaleString('en-US', { maximumFractionDigits: 6 })} USDC
            <span className="text-white/55">↻</span>
          </>
        )}
        {state === 'running' && (
          <>
            <Spinner /> Repaying on-chain…
          </>
        )}
        {state === 'done' && (
          <>
            <Check /> Debt cleared
          </>
        )}
        {state === 'error' && <>Retry repay</>}
      </button>
      {txHash && state === 'done' && (
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block text-center font-mono text-[10.5px] text-mint/80 hover:text-mint"
        >
          tx {txHash.slice(0, 10)}…{txHash.slice(-4)} ↗
        </a>
      )}
      {error && state === 'error' && (
        <p className="mt-1 rounded-md bg-rose-500/15 px-2 py-1 text-[10.5px] text-rose-200 ring-1 ring-rose-500/20">
          {error.slice(0, 160)}
        </p>
      )}
    </div>
  );
}

/* — glyphs / atoms (mirrors agent-flow.tsx) — */

function StepDot({ kind }: { kind: string }) {
  const tone =
    kind === 'intent.evaluated'
      ? 'bg-coral'
      : kind === 'scope.requested'
        ? 'bg-gold'
        : 'bg-mint';
  return <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} />;
}

function FaceIdGlyph({ scanning }: { scanning: boolean }) {
  return (
    <div className="relative mx-auto h-16 w-16">
      {scanning && (
        <span className="absolute inset-0 rounded-2xl bg-coral/40 animate-pulse-ring" />
      )}
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-coral/15 ring-1 ring-coral/40">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"
            stroke="#ff8b7d"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M9 10v1M15 10v1M10 15c.7.7 3.3.7 4 0"
            stroke="#ff8b7d"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        {scanning && (
          <span className="absolute inset-x-3 top-1/2 h-0.5 rounded-full bg-coral-soft shadow-[0_0_8px_#ff8b7d] animate-scan-line" />
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-mute">{label}</span>
      <span
        className={`max-w-[62%] truncate font-medium text-cloud/90 ${
          mono ? 'font-mono text-[11px]' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ShieldMini() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-mute/40 border-t-coral" />
  );
}

function Check() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
