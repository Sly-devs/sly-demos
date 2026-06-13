import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, formatPrice } from '@/lib/catalog';
import { ProductShot } from '@/components/product-shot';
import { BuyWithAgent } from './buy-with-agent';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();

  return (
    <div className="animate-fade-up">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink/45 transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> Back to catalog
      </Link>

      <div className="mt-7 grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-[2rem] border border-ink/[0.06] bg-gradient-to-b from-white to-sand shadow-soft">
            <ProductShot
              className="aspect-square w-full p-8"
              src={product.image}
              alt={product.name}
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-xl border border-ink/[0.06] bg-gradient-to-b from-white to-sand opacity-70"
                aria-hidden
              >
                <ProductShot
                  className="h-full w-full p-2"
                  src={product.image}
                  alt={product.name}
                />
              </div>
            ))}
          </div>
        </div>

        {/* details */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-clay">
            {product.category}
          </p>
          <h1 className="mt-2 text-[2.1rem] font-semibold leading-tight tracking-tight">
            {product.name}
          </h1>
          <p className="mt-2 text-[16px] text-ink/55">{product.tagline}</p>

          <div className="mt-5 flex items-center gap-3">
            <p className="text-[26px] font-semibold tabular-nums">
              {formatPrice(product.priceCents, product.currency)}
            </p>
            <span className="rounded-full bg-moss/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-moss">
              In stock
            </span>
          </div>

          <p className="mt-6 leading-relaxed text-ink/65">
            {product.description}
          </p>

          <ul className="mt-6 grid grid-cols-2 gap-3 text-[13px] text-ink/55">
            {[
              'Engineered-mesh upper',
              'Balanced max cushioning',
              'Free 30-day returns',
              'Carbon-neutral shipping',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check /> {f}
              </li>
            ))}
          </ul>

          <hr className="my-8 border-ink/[0.07]" />

          {/* agent checkout — the showcase moment */}
          <BuyWithAgent
            productId={product.id}
            productName={product.name}
            priceCents={product.priceCents}
            currency={product.currency}
          />

          <p className="mt-4 text-[12px] leading-relaxed text-ink/40">
            Or check out the conventional way — but why would you, when your
            agent can do it within policy?
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-full border border-ink/15 bg-white py-3 text-[14px] font-medium text-ink/55 transition-colors hover:border-ink/30 hover:text-ink/80"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 text-moss"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
