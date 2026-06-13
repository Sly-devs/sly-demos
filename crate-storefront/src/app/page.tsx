import Link from 'next/link';
import { CATALOG, formatPrice } from '@/lib/catalog';
import { ProductShot } from '@/components/product-shot';

export default function HomePage() {
  return (
    <div>
      <section className="animate-fade-up">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-clay">
          The agentic storefront
        </p>
        <h1 className="mt-4 max-w-3xl text-[2.6rem] font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
          Considered goods,
          <br className="hidden sm:block" /> ready for your agent.
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink/55">
          Crate sells a tiny, opinionated catalog. Every product can be bought
          by your Coral shopping agent — no card entry, no checkout forms. Just
          policy.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ink/45">
          <span className="flex items-center gap-2">
            <Dot /> ACP-native checkout
          </span>
          <span className="flex items-center gap-2">
            <Dot /> Settles in USDC on Base
          </span>
          <span className="flex items-center gap-2">
            <Dot /> Free returns within 30 days
          </span>
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-6 flex items-baseline justify-between border-b border-ink/[0.07] pb-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink/50">
            The catalog
          </h2>
          <span className="text-xs text-ink/35">
            {CATALOG.length} {CATALOG.length === 1 ? 'product' : 'products'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((p, i) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="group animate-fade-up rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-b from-sand to-[#efe8db]">
                <ProductShot
                  className="aspect-square w-full transition-transform duration-500 group-hover:scale-105"
                  src={p.image}
                  alt={p.name}
                />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink/40">
                    {p.category}
                  </p>
                  <h3 className="mt-1.5 text-[17px] font-medium tracking-tight">
                    {p.name}
                  </h3>
                  <p className="mt-1 text-[13.5px] text-ink/50">{p.tagline}</p>
                </div>
                <p className="shrink-0 text-[16px] font-semibold tabular-nums">
                  {formatPrice(p.priceCents, p.currency)}
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-clay">
                View product
                <span className="transition-transform duration-300 group-hover:translate-x-1">
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

function Dot() {
  return (
    <span className="h-1.5 w-1.5 rounded-full bg-clay/60" aria-hidden />
  );
}
