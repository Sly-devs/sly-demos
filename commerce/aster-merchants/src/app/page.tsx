import Link from 'next/link';
import { fetchMerchants } from '@/lib/sly';
import { TxFeed } from '@/components/tx-feed';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const { merchants, live } = await fetchMerchants();

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-faint">
            Aster commerce platform
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
            Operator overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Every agentic checkout across your merchants — wrapped by Sly with
            KYA verification, your auto-accept policy, fraud scoring, and a
            signed audit anchor before a cent settles.
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] text-mute">
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-ok' : 'bg-faint'}`}
          />
          {merchants.length} merchants · {live ? 'live from Sly' : 'directory'}
        </span>
      </div>

      <TxFeed />

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Merchant directory
          </h2>
          <span className="text-[11px] text-faint">
            Open a merchant to inspect its trust chain and edit policy
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {merchants.map((m, i) => (
            <Link
              key={m.id}
              href={`/merchants/${m.id}`}
              style={{ animationDelay: `${i * 50}ms` }}
              className="group animate-fade-in rounded-xl border border-line bg-panel p-5 shadow-card transition hover:border-brand/50 hover:bg-raised/40"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-raised text-sm font-semibold text-mute transition group-hover:border-brand/40 group-hover:text-ink">
                    {m.name.slice(0, 2)}
                  </span>
                  <div>
                    <h3 className="font-medium text-ink">{m.name}</h3>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-faint">
                      {m.storefront}
                    </p>
                  </div>
                </div>
                <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 text-[11px] tnum text-mute">
                  KYB T{m.verificationTier}
                </span>
              </div>
              <p className="mt-3.5 text-sm leading-relaxed text-mute">
                {m.blurb}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] text-faint">
                <span className="rounded-md border border-line/70 bg-raised px-2 py-1">
                  Min KYA{' '}
                  <span className="tnum text-mute">T{m.policy.minKyaTier}</span>
                </span>
                <span className="rounded-md border border-line/70 bg-raised px-2 py-1">
                  Rep ≥{' '}
                  <span className="tnum text-mute">
                    {m.policy.minReputation.toFixed(1)}
                  </span>
                </span>
                <span className="rounded-md border border-line/70 bg-raised px-2 py-1">
                  ≥{' '}
                  <span className="tnum text-mute">
                    {m.policy.minCrossTenantTx}
                  </span>{' '}
                  cross-tenant
                </span>
              </div>
              <span className="mt-4 flex items-center gap-1 text-[11px] text-faint transition group-hover:text-brand">
                Inspect &amp; edit policy
                <span className="transition group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
