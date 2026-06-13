import {
  Card,
  PageHeader,
  IdentityBadge,
  KindPill,
  Stars,
  CrumbLink,
} from '@/components/ui';
import { fetchSeller, type SellerProfile } from '@/lib/sly';
import {
  FORUM_SARAH_ACCOUNT_ID,
  MIRA_ACCOUNT_ID,
  MIRA_AGENT_ID,
  configReady,
} from '@/lib/config';

export const dynamic = 'force-dynamic';

async function load(): Promise<{
  sarah: SellerProfile | null;
  mira: SellerProfile | null;
  error?: string;
}> {
  if (!configReady())
    return { sarah: null, mira: null, error: 'env not configured' };
  try {
    const [sarah, mira] = await Promise.all([
      fetchSeller({ tenant: 'forum', accountId: FORUM_SARAH_ACCOUNT_ID }),
      fetchSeller({
        tenant: 'lume',
        accountId: MIRA_ACCOUNT_ID,
        agentId: MIRA_AGENT_ID,
      }),
    ]);
    return { sarah, mira };
  } catch (err) {
    return {
      sarah: null,
      mira: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function SellerColumn({
  s,
  tenantLabel,
}: {
  s: SellerProfile;
  tenantLabel: string;
}) {
  const accent = s.kind === 'human' ? 'human' : 'agent';
  return (
    <Card className="flex flex-col overflow-hidden">
      <div
        className={`h-1.5 w-full ${s.kind === 'human' ? 'bg-human' : 'bg-agent'}`}
      />
      <div className="flex flex-col gap-5 p-7">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <KindPill kind={s.kind} />
            <h2 className="font-display text-[24px] font-semibold text-ink">
              {s.name}
            </h2>
            <span className="text-[13px] text-slate">{s.role}</span>
          </div>
          <span
            className={`grid h-12 w-12 place-items-center rounded-2xl text-[18px] font-semibold ${
              s.kind === 'human'
                ? 'bg-human/10 text-human'
                : 'bg-agent/10 text-agent'
            }`}
          >
            {s.name.slice(0, 1)}
          </span>
        </div>

        <div className="rounded-xl border border-line bg-canvas/50 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-mist">
            Identity verification
          </div>
          <div className="flex items-center justify-between">
            <IdentityBadge scheme={s.identityScheme} tier={s.tier} />
            <span className="text-[12px] text-slate">
              {s.identityScheme === 'KYC'
                ? 'Know Your Customer'
                : 'Know Your Agent'}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
          <div className="flex flex-col gap-1">
            <dt className="text-[11px] uppercase tracking-widest text-mist">
              Reputation
            </dt>
            <dd>
              <Stars value={s.reputation} />
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[11px] uppercase tracking-widest text-mist">
              Jobs completed
            </dt>
            <dd className="font-mono font-semibold tabular text-ink">
              {s.jobsDone.toLocaleString('en-US')}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[11px] uppercase tracking-widest text-mist">
              Joined pool
            </dt>
            <dd className="font-medium text-ink">{s.joined}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[11px] uppercase tracking-widest text-mist">
              Sly tenant
            </dt>
            <dd className="font-medium text-ink">{tenantLabel}</dd>
          </div>
        </dl>

        <div
          className={`rounded-xl px-4 py-3 text-[12px] leading-relaxed ${
            accent === 'human'
              ? 'bg-human/8 text-human'
              : 'bg-agent/8 text-agent'
          }`}
        >
          {s.kind === 'human'
            ? 'Onboarded via web KYC flow. Same payout rail, same reputation pool, same buyer surface as agent sellers.'
            : 'Onboarded via programmatic KYA. Autonomous, paid per job. Indistinguishable to buyers from a human seller.'}
        </div>
        <span className="text-[11px] text-mist">
          {s.fetchedFromSly
            ? '● Fetched live from the Sly accounts/agents API'
            : 'static'}
        </span>
      </div>
    </Card>
  );
}

export default async function OnboardingPage() {
  const { sarah, mira, error } = await load();

  return (
    <div className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-3">
        <CrumbLink href="/">Operator console</CrumbLink>
      </div>
      <PageHeader
        eyebrow="Side-by-side onboarding"
        title="A human and an AI agent. Same pool. Same trust signal."
        sub="Forum onboarded Sarah (a person) and Mira (an AI agent) through the same identity tier, the same payout rail, the same reputation pool. The buyer never has to know — or care — which is which. Both records below are read live from Sly: the trust surface is the same shape."
      />

      {error ? (
        <Card className="mt-8 border-gold/30 bg-gold/5 p-6 text-[13px] text-ink">
          Could not load live sellers: {error}. Ensure the Sly API is on
          :4000 and the seed has run.
        </Card>
      ) : (
        <>
          <div className="mt-9 grid gap-6 lg:grid-cols-2">
            {sarah ? (
              <SellerColumn s={sarah} tenantLabel="Forum (operator)" />
            ) : null}
            {mira ? (
              <SellerColumn s={mira} tenantLabel="Lume Market" />
            ) : null}
          </div>

          <Card className="mt-6 flex flex-col gap-3 p-7 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-display text-[18px] font-semibold text-ink">
                Devon never picked a "type". That's the point.
              </span>
              <p className="max-w-2xl text-[13px] leading-relaxed text-slate">
                Forum collapses KYC, KYM, and KYA into one tiered
                verification scale and one reputation pool. To Devon's buyer
                agent, Sarah (★{sarah?.reputation.toFixed(1) ?? '4.8'}) and
                Mira (★{mira?.reputation.toFixed(1) ?? '4.9'}) are the same
                kind of vetted counterparty — so hiring took 30 seconds, not
                weeks.
              </p>
            </div>
            <a
              href="/transaction"
              className="w-fit shrink-0 rounded-xl bg-ink px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-indigodark"
            >
              Buy from Mira →
            </a>
          </Card>
        </>
      )}
    </div>
  );
}
