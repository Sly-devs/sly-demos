import Link from 'next/link';
import { CATALOG, formatPrice } from '@/lib/catalog';

export default function HomePage() {
  return (
    <div>
      <section className="border-b border-umber/10">
        <div className="mx-auto grid max-w-6xl gap-12 px-8 py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-28">
          <div className="animate-rise-in">
            <p className="flex items-center gap-3 text-[11px] uppercase tracking-editorial text-terra">
              <span className="h-px w-8 bg-terra/50" />
              Issue No. 14 — The Quiet House
            </p>
            <h1 className="mt-6 max-w-2xl font-display text-[clamp(2.6rem,5.5vw,4.25rem)] font-medium leading-[1.04] tracking-tight">
              Warm, well-made things for the rooms you live in.
            </h1>
            <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-umber/65">
              Lume keeps a small, edited catalog — lighting, textiles, ceramics.
              Each piece can be bought by your shopping agent. No card entry,
              just policy, settled through Sly.
            </p>
            <div className="mt-9 flex items-center gap-5">
              <Link
                href={`/products/${CATALOG[0]?.id ?? ''}`}
                className="rounded-sm bg-umber px-7 py-3.5 text-sm font-medium tracking-wide text-parch shadow-soft transition hover:bg-terra"
              >
                See the catalog
              </Link>
              <span className="text-[13px] text-sage">
                {CATALOG.length} pieces, carefully chosen
              </span>
            </div>
          </div>
          <div className="relative animate-rise-in border-l border-gilt/40 pl-8 text-sm leading-relaxed text-sage [animation-delay:120ms]">
            <p className="font-display text-lg text-umber">On agent checkout</p>
            <p className="mt-3">
              Every order placed by an agent is wrapped with Know-Your-Agent
              checks, your merchant policy, fraud scoring, and a signed audit
              anchor — before any money moves.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-umber/45">
              {['KYA', 'Policy', 'Fraud score', 'Audit anchor'].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-gilt/35 bg-parch/60 px-2.5 py-1"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-8 py-24">
        <div className="mb-14 flex items-end justify-between border-b border-umber/10 pb-5">
          <div>
            <p className="text-[11px] uppercase tracking-editorial text-sage">
              Curated
            </p>
            <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">
              The catalog
            </h2>
          </div>
          <span className="text-xs uppercase tracking-widest text-sage">
            {CATALOG.length} pieces
          </span>
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2">
          {CATALOG.map((p, i) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="group block animate-rise-in"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-sm border border-umber/10 bg-gradient-to-br from-parch via-clay/40 to-clay/70 transition duration-500 group-hover:border-gilt/60 group-hover:shadow-lift">
                <span className="font-display text-[5.5rem] text-umber/15 transition duration-500 group-hover:scale-105 group-hover:text-terra/35">
                  {p.motif}
                </span>
                <span className="absolute right-4 top-4 text-[10px] uppercase tracking-widest text-umber/35">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="mt-6 flex items-baseline justify-between gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-editorial text-sage">
                    {p.category}
                  </p>
                  <h3 className="mt-1.5 font-display text-xl font-medium tracking-tight transition group-hover:text-terra">
                    {p.name}
                  </h3>
                  <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-umber/50">
                    {p.tagline}
                  </p>
                </div>
                <p className="shrink-0 font-display text-lg tabular-nums">
                  {formatPrice(p.priceCents, p.currency)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
