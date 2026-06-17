/**
 * Crate catalog. Mirrors the SKU seeded by
 * apps/demo/_seed/seed-coral-demo.ts so the storefront and the Sly ledger
 * agree on product id / price.
 */

export interface CrateProduct {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  priceCents: number;
  currency: string;
  /** Real product photo (served from public/). Falls back to the SVG shot. */
  image?: string;
}

export const CRATE_MERCHANT_ID = 'coral:crate-merchant';
export const CRATE_MERCHANT_NAME = 'Crate';

export const CATALOG: CrateProduct[] = [
  {
    id: 'crate_sku_hoka_clifton_10',
    name: 'Hoka Clifton 10',
    tagline: 'The everyday cushioned cruiser',
    description:
      'Neutral road running shoe with a breathable engineered-mesh upper and balanced, plush cushioning. Built for long, comfortable miles.',
    category: 'footwear',
    priceCents: 14500,
    currency: 'USD',
    image: '/products/hoka-clifton-10.webp',
  },
  {
    id: 'crate_sku_field_tote',
    name: 'Waxed Field Tote',
    tagline: 'Hard-wearing everyday carry',
    description:
      'Waxed-canvas tote with a riveted leather base and brass hardware. Patinas with use.',
    category: 'bags',
    priceCents: 6800,
    currency: 'USD',
  },
  {
    id: 'crate_sku_steel_flask',
    name: 'Insulated Steel Flask',
    tagline: '24h cold · 12h hot',
    description:
      'Double-walled vacuum flask in brushed stainless. Leakproof, café-quality pour.',
    category: 'kitchen',
    priceCents: 4200,
    currency: 'USD',
  },
];

export function getProduct(id: string): CrateProduct | undefined {
  return CATALOG.find((p) => p.id === id);
}

export function formatPrice(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    cents / 100
  );
}
