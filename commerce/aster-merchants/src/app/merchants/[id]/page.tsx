import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchMerchantDetail } from '@/lib/sly';
import { PolicyEditor } from './policy-editor';

export const dynamic = 'force-dynamic';

const TRUST_CHAIN = [
  {
    k: 'Identity',
    title: 'Agent identity verified',
    body: 'Sly resolves the ACP agent token to a registered agent and its parent account. Unknown or revoked tokens never reach policy.',
  },
  {
    k: 'Reputation',
    title: 'Reputation & cross-tenant history',
    body: 'The agent carries a portable reputation score and a count of settled transactions across other Sly tenants — history this merchant did not have to build itself.',
  },
  {
    k: 'Fraud',
    title: 'Risk score computed',
    body: 'A 0–100 risk score is derived from KYA tier, reputation and history. High-risk checkouts are routed to operator review even if policy passes.',
  },
  {
    k: 'Policy',
    title: 'Your auto-accept policy enforced',
    body: 'Every rule below is checked against the agent. Satisfy them all and the checkout settles automatically; miss one and it is held for review.',
  },
  {
    k: 'Audit',
    title: 'Signed audit anchor written',
    body: 'The decision, inputs and settlement transfer are written to a tamper-evident audit anchor the operator can replay.',
  },
];

export default async function MerchantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchMerchantDetail(id);
  if (!detail) notFound();
  const { merchant, live } = detail;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <Link
        href="/"
        className="group inline-flex items-center gap-1.5 text-sm text-mute transition hover:text-ink"
      >
        <span className="transition group-hover:-translate-x-0.5">←</span>
        Back to overview
      </Link>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-raised text-base font-semibold text-mute">
            {merchant.name.slice(0, 2)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {merchant.name}
            </h1>
            <p className="mt-1 text-sm text-mute">{merchant.blurb}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-faint">
              <span>{merchant.storefront}</span>
              <span className="text-line">·</span>
              <span className="tnum">KYB tier {merchant.verificationTier}</span>
              <span className="text-line">·</span>
              <span className="rounded bg-raised px-1.5 py-0.5 font-mono lowercase text-faint">
                {merchant.id}
              </span>
            </p>
          </div>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
            live
              ? 'border-ok/25 bg-ok/10 text-ok'
              : 'border-line bg-raised text-mute'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-ok' : 'bg-faint'}`}
          />
          {live ? 'Live Sly account' : 'Directory fallback'}
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <PolicyEditor
          merchantId={merchant.id}
          merchantName={merchant.name}
          initial={merchant.policy}
        />

        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-panel p-6 text-sm shadow-card">
            <h2 className="text-sm font-semibold tracking-tight">
              Trust chain
            </h2>
            <p className="mt-1 text-xs text-mute">
              What Sly evaluates on every checkout, in order.
            </p>
            <ol className="mt-5 space-y-0">
              {TRUST_CHAIN.map((step, i) => (
                <li
                  key={step.k}
                  className="relative flex gap-3.5 pb-5 last:pb-0"
                >
                  {i < TRUST_CHAIN.length - 1 ? (
                    <span className="absolute left-[11px] top-7 h-full w-px bg-line" />
                  ) : null}
                  <span className="relative z-10 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-[10px] font-semibold uppercase text-brand">
                    {i + 1}
                  </span>
                  <div className="pt-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-faint">
                      {step.k}
                    </p>
                    <p className="mt-0.5 font-medium text-ink">{step.title}</p>
                    <p className="mt-1 leading-relaxed text-mute">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-line bg-panel p-6 shadow-card">
            <h2 className="text-sm font-semibold tracking-tight">
              Current thresholds
            </h2>
            <p className="mt-1 text-xs text-mute">
              Read live from this account&apos;s Sly metadata.
            </p>
            <dl className="mt-4 space-y-0 text-sm">
              {[
                { k: 'Min KYA tier', v: `T${merchant.policy.minKyaTier}` },
                {
                  k: 'Min reputation',
                  v: merchant.policy.minReputation.toFixed(1),
                },
                {
                  k: 'Min cross-tenant tx',
                  v: String(merchant.policy.minCrossTenantTx),
                },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex items-center justify-between border-b border-line/60 py-2.5 last:border-0"
                >
                  <dt className="text-mute">{row.k}</dt>
                  <dd className="tnum text-ink">{row.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
