import { notFound } from 'next/navigation';
import {
  Card,
  CrumbLink,
  IdentityBadge,
  KindPill,
  Stars,
  Eyebrow,
} from '@/components/ui';
import { fetchSeller, fetchVerifiedSplit, type SellerProfile } from '@/lib/sly';
import {
  FORUM_SARAH_ACCOUNT_ID,
  MIRA_ACCOUNT_ID,
  MIRA_AGENT_ID,
  LUME_FEE_ACCOUNT_ID,
  TAX_ACCOUNT_ID,
  MIRA_NET,
  FEE_AMOUNT,
  TAX_AMOUNT,
  GROSS,
  configReady,
  miraAgentToken,
} from '@/lib/config';

export const dynamic = 'force-dynamic';

const KNOWN: Record<
  string,
  { tenant: 'forum' | 'lume'; accountId: string; agentId?: string; hasSplit?: boolean }
> = {
  sarah: { tenant: 'forum', accountId: FORUM_SARAH_ACCOUNT_ID },
  mira: {
    tenant: 'lume',
    accountId: MIRA_ACCOUNT_ID,
    agentId: MIRA_AGENT_ID,
    hasSplit: true,
  },
};

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const key = id.toLowerCase();
  const cfg = KNOWN[key];
  if (!cfg) notFound();
  if (!configReady()) {
    return (
      <div className="mx-auto max-w-5xl px-7 py-16 text-[14px] text-slate">
        Forum demo env not configured. See .env.example.
      </div>
    );
  }

  let seller: SellerProfile | null = null;
  let netVerified: number | null = null;
  let error: string | undefined;
  try {
    seller = await fetchSeller({
      tenant: cfg.tenant,
      accountId: cfg.accountId,
      agentId: cfg.agentId,
    });
    if (cfg.hasSplit) {
      const v = await fetchVerifiedSplit(miraAgentToken(), {
        miraAccountId: MIRA_ACCOUNT_ID,
        feeAccountId: LUME_FEE_ACCOUNT_ID,
        taxAccountId: TAX_ACCOUNT_ID,
        gross: GROSS,
      }).catch(() => null);
      netVerified = v ? v.miraNet : null;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  if (error || !seller) {
    return (
      <div className="mx-auto max-w-5xl px-7 py-16">
        <Card className="border-gold/30 bg-gold/5 p-6 text-[13px] text-ink">
          Could not load seller: {error ?? 'unknown'}.
        </Card>
      </div>
    );
  }

  const isAgent = seller.kind === 'agent';
  const payouts = isAgent
    ? [
        {
          job: 'Invoice Reconciliation Run',
          gross: GROSS,
          net: MIRA_NET,
          fee: FEE_AMOUNT,
          tax: TAX_AMOUNT,
          when: 'just now · live',
          live: true,
        },
        { job: 'Invoice Reconciliation Run', gross: 100, net: 82, fee: 10, tax: 8, when: '2 days ago' },
        { job: 'Ledger exception sweep', gross: 60, net: 49.2, fee: 6, tax: 4.8, when: '5 days ago' },
      ]
    : [
        { job: 'Ops process audit', gross: 240, net: 196.8, fee: 24, tax: 19.2, when: '1 day ago' },
        { job: 'Vendor onboarding playbook', gross: 180, net: 147.6, fee: 18, tax: 14.4, when: '4 days ago' },
        { job: 'Quarterly close support', gross: 320, net: 262.4, fee: 32, tax: 25.6, when: '9 days ago' },
      ];

  return (
    <div className="mx-auto max-w-5xl px-7 py-12">
      <div className="mb-4 flex items-center justify-between">
        <CrumbLink href="/onboarding">Onboarding</CrumbLink>
        <div className="flex gap-2 text-[12px]">
          <a
            href="/sellers/sarah"
            className={`rounded-lg px-3 py-1.5 font-medium transition ${key === 'sarah' ? 'bg-ink text-white' : 'text-slate hover:bg-wash'}`}
          >
            Sarah (human)
          </a>
          <a
            href="/sellers/mira"
            className={`rounded-lg px-3 py-1.5 font-medium transition ${key === 'mira' ? 'bg-ink text-white' : 'text-slate hover:bg-wash'}`}
          >
            Mira (agent)
          </a>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-2">
        <Eyebrow>Seller profile · one trust signal</Eyebrow>
        <p className="max-w-2xl text-[14px] leading-relaxed text-slate">
          Same profile. Same trust math. Whether the seller is a human
          freelancer or an autonomous agent — buyers read one signal.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div
          className={`h-1.5 w-full ${isAgent ? 'bg-agent' : 'bg-human'}`}
        />
        <div className="flex flex-col gap-6 p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <span
                className={`grid h-16 w-16 place-items-center rounded-2xl text-[26px] font-semibold ${
                  isAgent
                    ? 'bg-agent/10 text-agent'
                    : 'bg-human/10 text-human'
                }`}
              >
                {seller.name.slice(0, 1)}
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-[30px] font-semibold text-ink">
                    {seller.name}
                  </h1>
                  <KindPill kind={seller.kind} />
                </div>
                <span className="text-[14px] text-slate">{seller.role}</span>
                <div className="flex items-center gap-3">
                  <Stars value={seller.reputation} />
                  <span className="text-[12px] text-mist">
                    · {seller.jobsDone.toLocaleString('en-US')} jobs · since{' '}
                    {seller.joined}
                  </span>
                </div>
              </div>
            </div>
            <IdentityBadge scheme={seller.identityScheme} tier={seller.tier} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: 'Reputation', v: seller.reputation.toFixed(1) },
              {
                k: 'Jobs',
                v: seller.jobsDone.toLocaleString('en-US'),
              },
              {
                k: 'Identity',
                v: `${seller.identityScheme} T${seller.tier}`,
              },
              {
                k: 'Verified net',
                v:
                  netVerified != null
                    ? `$${netVerified.toFixed(2)}`
                    : isAgent
                      ? 'pending'
                      : '—',
              },
            ].map((m) => (
              <div
                key={m.k}
                className="rounded-xl border border-line bg-canvas/50 p-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-mist">
                  {m.k}
                </div>
                <div className="mt-1.5 font-display text-[20px] font-semibold tabular text-ink">
                  {m.v}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-wash/60 px-4 py-3 text-[12px] leading-relaxed text-indigodark">
            Same profile. Same trust math. Whether the seller is a human
            freelancer or an autonomous agent, buyers read one signal — same
            reputation pool, same payout history shape, same trust badge. It
            is why Devon could hire in 30 seconds.
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>Payout history · split engine</Eyebrow>
          {netVerified != null ? (
            <span className="text-[11px] text-mist">
              ● Net verified live from Mira’s Sly transfer ledger
            </span>
          ) : null}
        </div>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-12 gap-2 border-b border-line bg-canvas/60 px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-mist">
            <span className="col-span-5">Job</span>
            <span className="col-span-2 text-right">Gross</span>
            <span className="col-span-2 text-right">Fee+Tax</span>
            <span className="col-span-2 text-right">Net</span>
            <span className="col-span-1 text-right">When</span>
          </div>
          {payouts.map((p, i) => (
            <div
              key={i}
              className={`grid grid-cols-12 items-center gap-2 px-6 py-4 text-[13px] ${
                p.live ? 'bg-ok/5' : ''
              }`}
            >
              <span className="col-span-5 flex items-center gap-2 font-medium text-ink">
                {p.job}
                {p.live ? (
                  <span className="rounded bg-ok/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-ok">
                    live
                  </span>
                ) : null}
              </span>
              <span className="col-span-2 text-right font-mono tabular text-slate">
                ${p.gross.toFixed(2)}
              </span>
              <span className="col-span-2 text-right font-mono tabular text-slate">
                ${(p.fee + p.tax).toFixed(2)}
              </span>
              <span className="col-span-2 text-right font-mono font-semibold tabular text-ok">
                ${p.net.toFixed(2)}
              </span>
              <span className="col-span-1 text-right text-[11px] text-mist">
                {p.when}
              </span>
            </div>
          ))}
        </Card>
        <p className="mt-3 text-[11px] text-mist">
          The “live” row is the real Sly cross-tenant transaction. Prior
          rows are illustrative history for the profile narrative.
        </p>
      </div>

      {/* Dispute / revision — light static-but-credible panel */}
      <Card className="mt-6 p-7">
        <div className="flex items-center justify-between">
          <Eyebrow>Dispute &amp; revision</Eyebrow>
          <span className="rounded-full bg-ok/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-ok">
            0 open · auto-resolved
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            {
              t: 'Revision requested',
              d: 'Buyer flags an exception in the report. Funds held in escrow; seller notified automatically.',
            },
            {
              t: 'Seller resubmits',
              d: 'Human or agent resubmits the corrected deliverable within the SLA window. Same flow either way.',
            },
            {
              t: 'Auto-release',
              d: 'On acceptance, escrow releases and the split engine settles. No human-intervention disputes this month.',
            },
          ].map((s, i) => (
            <div
              key={s.t}
              className="rounded-xl border border-line bg-canvas/50 p-4"
            >
              <div className="mb-1 font-mono text-[11px] text-mist">
                Step {i + 1}
              </div>
              <div className="text-[13px] font-semibold text-ink">
                {s.t}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-slate">
                {s.d}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-mist">
          Illustrative flow — escrow/dispute orchestration is a Sly platform
          capability; this demo does not fire a live dispute.
        </p>
      </Card>
    </div>
  );
}
