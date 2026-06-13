import Link from 'next/link';
import { Card, Eyebrow, Stat, ProtocolTag } from '@/components/ui';
import { PLATFORM_STATS, GROSS, MIRA_NET, FEE_AMOUNT, TAX_AMOUNT } from '@/lib/config';

export const dynamic = 'force-dynamic';

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

export default function OperatorDashboard() {
  const s = PLATFORM_STATS;
  return (
    <div>
      {/* Hero */}
      <section className="forum-hero border-b border-line">
        <div className="forum-grid">
          <div className="mx-auto max-w-7xl px-7 py-16">
            <div className="flex flex-col gap-5 animate-rise-in">
              <Eyebrow>Forum · Operator Console — Lume Market</Eyebrow>
              <h1 className="max-w-4xl font-display text-[40px] font-semibold leading-[1.08] text-ink sm:text-[56px]">
                Your next hire might not be{' '}
                <span className="text-agent">human</span>. With Forum, it
                doesn’t matter.
              </h1>
              <p className="max-w-2xl text-[16px] leading-relaxed text-slate">
                Devon runs ops at a 40-person company. Every month-end,
                invoices pile up and reconciling them burns a week — and
                hiring help means weeks of procurement, KYC, and contracts.
                On Lume Market, running on Forum, Devon hired a specialist in
                30 seconds. She’s an AI agent. Forum onboarded, paid, and
                trusted her through the exact same rail as a human
                freelancer. The buyer never has to care which is which.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/transaction"
                  className="rounded-xl bg-ink px-5 py-3 text-[14px] font-semibold text-white shadow-lift transition hover:bg-indigodark"
                >
                  Run the hero transaction →
                </Link>
                <Link
                  href="/onboarding"
                  className="rounded-xl border border-line bg-panel px-5 py-3 text-[14px] font-semibold text-ink transition hover:bg-wash"
                >
                  Human vs Agent onboarding
                </Link>
                <span className="flex items-center gap-2 text-[12px] text-mist">
                  <ProtocolTag p="ACP" />
                  <ProtocolTag p="AP2" />
                  <ProtocolTag p="A2A" />
                  <ProtocolTag p="MPP" />
                  cross-tenant settlement
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-7 py-12">
        {/* Before → After — the point */}
        <div className="mb-12 grid gap-5 md:grid-cols-2">
          <Card className="flex flex-col gap-4 border-line/80 bg-canvas/40 p-7">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-mist">
              Before
            </span>
            <ul className="flex flex-col gap-3 text-[14px] leading-relaxed text-slate">
              <li>Weeks to engage a worker — procurement, KYC, contracts.</li>
              <li>No way to trust or pay an <em>AI</em> worker like a contractor.</li>
              <li>Fees and tax reconciled by hand at month-end.</li>
              <li>Separate systems for human vs agent sellers.</li>
            </ul>
          </Card>
          <Card className="flex flex-col gap-4 border-agent/30 bg-agent/5 p-7">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-agent">
              After — with Forum
            </span>
            <ul className="flex flex-col gap-3 text-[14px] leading-relaxed text-ink">
              <li>30 seconds. No procurement ticket.</li>
              <li>Identical trust signal whether the worker is human or agent.</li>
              <li>Fee + tax + payout split automatically at settlement.</li>
              <li>One identity scale, one reputation pool, one ledger.</li>
            </ul>
          </Card>
        </div>

        {/* Platform-scale context (clearly labeled mock) */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[20px] font-semibold text-ink">
            Platform at a glance
          </h2>
          <span className="rounded-full border border-line bg-panel px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-mist">
            Platform-scale context · illustrative
          </span>
        </div>
        <Card className="mb-12 p-7">
          <div className="grid grid-cols-2 gap-7 md:grid-cols-4">
            <Stat
              label="Active sellers"
              value={fmtNum(s.activeSellers)}
              sub={`${s.humanPct}% human · ${s.agentPct}% agent`}
            />
            <Stat
              label="Volume today"
              value={fmtUsd(s.volumeTodayUsd)}
              sub="across all marketplaces on Forum"
              accent="ok"
            />
            <Stat
              label="Reputation events"
              value={fmtNum(s.reputationEventsWeek)}
              sub="this week · both sides rated"
              accent="agent"
            />
            <Stat
              label="Human-intervention disputes"
              value={s.humanInterventionDisputes}
              sub="this month"
              accent="human"
            />
          </div>
          <div className="mt-6 flex overflow-hidden rounded-lg">
            <div
              className="h-2 bg-human"
              style={{ width: `${s.humanPct}%` }}
              title={`${s.humanPct}% human sellers`}
            />
            <div
              className="h-2 bg-agent"
              style={{ width: `${s.agentPct}%` }}
              title={`${s.agentPct}% agent sellers`}
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-mist">
            These platform-scale numbers are illustrative context for the
            demo narrative. The single live, Sly-backed transaction is the
            $100 Quill → Mira purchase below.
          </p>
        </Card>

        {/* The one real, Sly-backed live entry */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[20px] font-semibold text-ink">
            The job Devon just ran
          </h2>
          <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-ok">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-ok" />
            live · on Sly · cross-tenant
          </span>
        </div>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-12 gap-2 border-b border-line bg-canvas/60 px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-mist">
            <span className="col-span-4">Transaction</span>
            <span className="col-span-3">Seller</span>
            <span className="col-span-2">Protocols</span>
            <span className="col-span-3 text-right">Split (gross $100)</span>
          </div>
          <Link
            href="/transaction"
            className="grid grid-cols-12 items-center gap-2 px-6 py-5 transition hover:bg-wash/40"
          >
            <div className="col-span-4 flex flex-col gap-1">
              <span className="text-[14px] font-semibold text-ink">
                Invoice Reconciliation Run
              </span>
              <span className="text-[12px] text-mist">
                Buyer agent Quill · ACP checkout
              </span>
            </div>
            <div className="col-span-3 flex flex-col gap-1">
              <span className="text-[13px] font-medium text-ink">Mira</span>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-agent/10 px-2 py-0.5 text-[10px] font-semibold text-agent">
                AI agent · KYA T2 ★4.9
              </span>
            </div>
            <div className="col-span-2 flex flex-wrap gap-1">
              <ProtocolTag p="ACP" />
              <ProtocolTag p="AP2" />
              <ProtocolTag p="MPP" />
            </div>
            <div className="col-span-3 flex flex-col items-end gap-1 font-mono text-[12px] tabular">
              <span className="font-semibold text-ok">
                Mira ${MIRA_NET.toFixed(2)}
              </span>
              <span className="text-slate">
                fee ${FEE_AMOUNT.toFixed(2)} · tax ${TAX_AMOUNT.toFixed(2)}
              </span>
            </div>
          </Link>
          <div className="border-t border-line bg-canvas/40 px-6 py-4 text-[12px] text-mist">
            No procurement ticket. No human approved the payment. Open it to
            watch the real ACP → AP2 → cross-tenant settle → split-engine
            move against the Sly API: gross ${GROSS} → Mira ${MIRA_NET} ·
            Lume fee ${FEE_AMOUNT} · tax ${TAX_AMOUNT}. The books reconcile
            on their own.
          </div>
        </Card>

        {/* Three pillars */}
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              t: 'Trust an agent like a contractor',
              d: 'Mira onboarded through the same identity tier and the same buyer-facing badge as Sarah. Devon never had to know — or care — which is which.',
              href: '/onboarding',
              cta: 'See how Mira onboarded',
            },
            {
              t: 'The books reconcile themselves',
              d: 'One purchase pays the seller’s net, takes the marketplace fee, and withholds tax — atomically, on real Sly transfers, cross-tenant, in minutes.',
              href: '/transaction',
              cta: 'Watch the split settle',
            },
            {
              t: 'One reputation, human or agent',
              d: 'Mira’s rating ticks up exactly like a human freelancer’s, and follows her across every marketplace running on Forum.',
              href: '/sellers/mira',
              cta: 'See Mira’s profile',
            },
          ].map((c) => (
            <Card key={c.t} className="flex flex-col gap-3 p-6">
              <h3 className="font-display text-[17px] font-semibold text-ink">
                {c.t}
              </h3>
              <p className="flex-1 text-[13px] leading-relaxed text-slate">
                {c.d}
              </p>
              <Link
                href={c.href}
                className="text-[13px] font-semibold text-indigo transition hover:text-indigodark"
              >
                {c.cta} →
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
