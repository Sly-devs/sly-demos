'use client';

import { useState } from 'react';
import {
  AGENT,
  HOKA,
  MERCHANT,
  usd,
  type AgentBuyResponse,
  type DemoEvt,
} from '@/lib/demo';

type Phase =
  | 'idle'
  | 'requesting'
  | 'discovered'
  | 'approve'
  | 'approving'
  | 'done'
  | 'error';

const PROTOCOL_TONE: Record<string, string> = {
  AP2: 'bg-gold/15 text-gold ring-gold/30',
  ACP: 'bg-coral/15 text-coral-soft ring-coral/30',
  MPP: 'bg-mint/15 text-mint ring-mint/30',
};

export function AgentFlow({ prompt }: { prompt: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pending, setPending] = useState<AgentBuyResponse | null>(null);
  const [events, setEvents] = useState<DemoEvt[]>([]);
  const [result, setResult] = useState<AgentBuyResponse | null>(null);

  // Step 1–2: create checkout + agent requests treasury scope.
  async function start() {
    setPhase('requesting');
    setEvents([]);
    setResult(null);
    try {
      const res = await fetch('/api/agent/buy', { method: 'POST' });
      const data: AgentBuyResponse = await res.json();
      if (!res.ok || data.phase === 'error') {
        setResult(data);
        setPhase('error');
        return;
      }
      setPending(data);
      setEvents(data.events ?? []);
      setPhase('discovered');
    } catch (err) {
      setResult({ phase: 'error', error: String(err) });
      setPhase('error');
    }
  }

  // The agent surfaces the item it found; the owner taps to continue to
  // the scoped-payment approval.
  function proceedToApproval() {
    setPhase('approve');
  }

  // Step 3–4: owner approves the scope request; agent completes payment.
  async function approve() {
    if (!pending?.requestId || !pending?.checkoutId) return;
    setPhase('approving');
    try {
      const res = await fetch('/api/agent/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestId: pending.requestId,
          checkoutId: pending.checkoutId,
        }),
      });
      const data: AgentBuyResponse = await res.json();
      if (!res.ok || data.phase === 'error') {
        setResult(data);
        setPhase('error');
        return;
      }
      setEvents((prev) => [...prev, ...(data.events ?? [])]);
      setResult(data);
      setPhase('done');
    } catch (err) {
      setResult({ phase: 'error', error: String(err) });
      setPhase('error');
    }
  }

  const showTimeline = events.length > 0 && phase !== 'idle';

  return (
    <div className="px-5">
      {/* prompt bubble */}
      <div className="ml-auto mt-1 flex max-w-[82%] flex-col items-end">
        <div className="rounded-3xl rounded-br-md bg-coral px-4 py-3 text-[15px] font-medium text-white shadow-glow">
          {prompt}
        </div>
        <span className="mt-1 pr-1 text-[10.5px] text-mute">You · just now</span>
      </div>

      {phase === 'idle' && (
        <button
          onClick={start}
          className="group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-elevate py-4 text-[15px] font-semibold text-cloud ring-1 ring-hairline transition-all hover:ring-coral/30 active:scale-[0.98]"
        >
          Send to {AGENT.name}
          <span className="text-coral transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      )}

      {phase === 'requesting' && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-surface/70 px-3.5 py-3 text-[13px] text-mute ring-1 ring-hairline">
          <Spinner /> Agent is finding the item and requesting permission to pay…
        </div>
      )}

      {showTimeline && (
        <ol className="mt-5 space-y-2.5">
          {events.map((e, i) => (
            <li
              key={i}
              className="flex animate-fade-up items-start gap-2.5 rounded-2xl bg-surface/70 px-3.5 py-3 ring-1 ring-hairline"
            >
              {e.protocol ? (
                <ProtocolBadge protocol={e.protocol} />
              ) : (
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-mint" />
              )}
              <span className="text-[13.5px] leading-snug text-cloud/90">
                {e.label}
              </span>
            </li>
          ))}
          {phase === 'approving' && (
            <li className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-mute">
              <Spinner /> Approving scope & settling…
            </li>
          )}
        </ol>
      )}

      {phase === 'discovered' && (
        <ProductDiscoveredCard onApprove={proceedToApproval} />
      )}

      {(phase === 'approve' || phase === 'approving' || phase === 'done') &&
        pending && <ScopeRequestPanel pending={pending} settled={phase === 'done'} />}

      {phase === 'done' && result && (
        <div className="mt-4 animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-mint/20 to-mint/[0.04] p-5 text-center ring-1 ring-mint/30">
          <div className="relative mx-auto h-14 w-14">
            <span className="absolute inset-0 rounded-full bg-mint/40 animate-pulse-ring" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-mint text-canvas shadow-[0_8px_24px_-8px_rgba(52,216,164,0.6)]">
              <Check />
            </div>
          </div>
          <p className="mt-4 text-[20px] font-semibold tracking-tight text-cloud">
            {usd(HOKA.priceCents)}
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-mint">
            Settled in {result.currency ?? 'USD'} · one-shot grant consumed
          </p>
          <div className="mt-4 space-y-1.5 rounded-2xl bg-canvas/40 px-4 py-3 text-left text-[12px]">
            <Row label="Merchant" value={MERCHANT.name} />
            <Row label="Item" value={HOKA.name} />
            <Row
              label={result.transferId ? 'Transfer' : 'Status'}
              value={result.transferId ?? result.status ?? '—'}
              mono
            />
          </div>
        </div>
      )}

      {phase === 'error' && result && (
        <div className="mt-4 animate-fade-up rounded-3xl bg-coral-deep/15 p-4 text-[13px] text-coral-soft ring-1 ring-coral/30">
          <p className="font-semibold text-coral-soft">Checkout failed</p>
          <p className="mt-1 text-mute">
            {result.error ?? 'The agent could not complete this purchase.'}
          </p>
        </div>
      )}

      {phase === 'approve' && pending && (
        <ApprovalSheet
          amount={usd(HOKA.priceCents)}
          merchant={MERCHANT.name}
          requestId={pending.requestId ?? ''}
          onApprove={approve}
        />
      )}
    </div>
  );
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  const tone =
    PROTOCOL_TONE[protocol] ?? 'bg-white/10 text-cloud/70 ring-white/15';
  return (
    <span
      className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${tone}`}
    >
      {protocol}
    </span>
  );
}

/** The item the agent discovered — shown before any money moves. */
function ProductDiscoveredCard({ onApprove }: { onApprove: () => void }) {
  const inBudget = HOKA.priceCents <= 15000;
  return (
    <div className="mt-4 animate-fade-up rounded-3xl bg-surface p-4 ring-1 ring-hairline">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-mute">
        Your agent found a match
      </span>
      <div className="mt-3 flex gap-3.5">
        <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HOKA.image}
            alt={HOKA.name}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-cloud">
            {HOKA.name}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-mute">
            {HOKA.blurb}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[16px] font-semibold text-cloud">
              {usd(HOKA.priceCents)}
            </span>
            <span className="text-[11.5px] text-mute">
              at {MERCHANT.name}
            </span>
          </div>
        </div>
      </div>
      {inBudget && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-mint/10 px-3.5 py-2.5 text-[12px] font-medium text-mint ring-1 ring-mint/25">
          <Check />
          In budget — under your $150 limit
        </div>
      )}
      <button
        onClick={onApprove}
        className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-coral py-3.5 text-[15px] font-semibold text-white shadow-glow transition-transform active:scale-[0.98]"
      >
        Approve payment
        <span>→</span>
      </button>
      <p className="mt-2 text-center text-[11px] text-mute">
        The agent can&rsquo;t pay until you approve.
      </p>
    </div>
  );
}

/** Real Epic-82 scope request — pending until the owner approves it. */
function ScopeRequestPanel({
  pending,
  settled,
}: {
  pending: AgentBuyResponse;
  settled: boolean;
}) {
  return (
    <div className="mt-4 animate-fade-up rounded-3xl bg-surface p-4 ring-1 ring-hairline">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-mute">
          Treasury scope request
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
        <Row label="Scope" value="treasury · one-shot" />
        <Row label="Request" value={pending.requestId ?? '—'} mono />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-mute">
        Epic-82: every elevation traces to a human approver. The agent cannot
        move funds until you approve this request.
      </p>
    </div>
  );
}

function ApprovalSheet({
  amount,
  merchant,
  requestId,
  onApprove,
}: {
  amount: string;
  merchant: string;
  requestId: string;
  onApprove: () => void;
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
      aria-label="Approve treasury scope request"
    >
      <div className="absolute inset-0 animate-fade-up bg-black/60 backdrop-blur-md" />
      <div className="relative w-full animate-sheet-up rounded-t-[2.4rem] bg-gradient-to-b from-elevate to-surface px-6 pb-9 pt-3 ring-1 ring-white/10">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />

        <div className="mt-6 text-center">
          <FaceIdGlyph scanning={scanning} />
          <p className="mt-5 text-[12px] uppercase tracking-[0.2em] text-mute">
            Approve treasury scope
          </p>
          <p className="mt-2.5 text-[30px] font-semibold tracking-tight text-cloud">
            {amount}
          </p>
          <p className="mt-1 text-[14px] text-mute">
            so your agent can pay{' '}
            <span className="font-medium text-cloud/80">{merchant}</span>
          </p>
        </div>

        <div className="mt-5 space-y-1 rounded-2xl bg-canvas/40 px-4 py-3 text-[11px] text-mute">
          <div className="flex items-center justify-center gap-2">
            <ShieldMini /> One-shot treasury grant · consumed on this payment
          </div>
          <p className="truncate text-center font-mono text-[10px] text-mute/70">
            req {requestId}
          </p>
        </div>

        <button
          onClick={handle}
          disabled={scanning}
          aria-label={`Approve treasury scope of ${amount} for ${merchant}`}
          className="mt-5 w-full rounded-2xl bg-coral py-4 text-[15px] font-semibold text-white shadow-glow transition-transform active:scale-[0.98] disabled:opacity-80"
        >
          {scanning ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> Approving with Coral ID…
            </span>
          ) : (
            `Approve ${amount}`
          )}
        </button>
        <p className="mt-3 text-center text-[11px] text-mute">
          Double-click side button to confirm · demo tap
        </p>
      </div>
    </div>
  );
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
