import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, formatPrice } from '@/lib/catalog';
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
    <div className="mx-auto max-w-6xl px-8 py-12">
      <nav className="flex items-center gap-2 text-[12px] text-sage">
        <Link href="/" className="transition hover:text-umber">
          Catalog
        </Link>
        <span className="text-umber/25">/</span>
        <span className="text-umber/45">{product.category}</span>
        <span className="text-umber/25">/</span>
        <span className="text-umber/70">{product.name}</span>
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-16 lg:grid-cols-2">
        <div className="animate-rise-in lg:sticky lg:top-28 lg:self-start">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-sm border border-umber/10 bg-gradient-to-br from-parch via-clay/40 to-clay/70 shadow-soft">
            <span className="font-display text-[12rem] text-umber/15">
              {product.motif}
            </span>
            <span className="absolute left-6 top-6 text-[10px] uppercase tracking-editorial text-umber/35">
              Lume — {product.category}
            </span>
          </div>
        </div>

        <div className="flex animate-rise-in flex-col [animation-delay:100ms]">
          <p className="flex items-center gap-3 text-[11px] uppercase tracking-editorial text-terra">
            <span className="h-px w-6 bg-terra/50" />
            {product.category}
          </p>
          <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.08] tracking-tight">
            {product.name}
          </h1>
          <p className="mt-3 text-[15px] italic text-umber/55">
            {product.tagline}
          </p>

          <div className="mt-8 flex items-baseline gap-4">
            <p className="font-display text-3xl tabular-nums">
              {formatPrice(product.priceCents, product.currency)}
            </p>
            <span className="text-[11px] uppercase tracking-widest text-sage">
              {product.currency} · ships in 1–2 weeks
            </span>
          </div>

          <div className="mt-8 h-px lume-rule" />

          <p className="mt-8 max-w-md leading-[1.75] text-umber/70">
            {product.description}
          </p>

          <div className="mt-10 rounded-sm border border-umber/10 bg-parch/60 p-7 shadow-soft">
            <p className="text-[11px] uppercase tracking-editorial text-sage">
              Checkout
            </p>
            <p className="mt-2 font-display text-lg text-umber">
              Let your agent buy this
            </p>
            <div className="mt-5">
              <BuyWithAgent
                productId={product.id}
                productName={product.name}
                priceCents={product.priceCents}
                currency={product.currency}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
