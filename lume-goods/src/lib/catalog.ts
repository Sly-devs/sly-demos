/**
 * Lume Goods catalog. Mirrors the SKUs seeded for the "Lume Goods" merchant by
 * apps/demo/_seed/seed-aster-demo.ts so the storefront and the Sly ledger
 * agree on product id / price. Keep in sync with that seed.
 */

export interface LumeProduct {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  priceCents: number;
  currency: string;
  /** Decorative motif glyph — Lume has no product photography in the demo. */
  motif: string;
}

/**
 * Stable cross-tenant merchant key (metadata.invu_merchant_id) the Sly ACP
 * resolver matches on — set in seed-aster-demo.ts. The buyer agent (Velo)
 * lives in the Aster tenant; Lume Goods is its own tenant, so settlement
 * resolves the merchant globally by this key (not a per-tenant account id).
 */
export const LUME_MERCHANT_ID = 'aster:lume-goods-merchant';
export const LUME_MERCHANT_NAME = 'Lume Goods';

export const CATALOG: LumeProduct[] = [
  {
    id: 'lume_sku_aero_runner',
    name: 'Lume Aero Runner',
    tagline: 'Featherweight everyday running shoe',
    description:
      'An engineered-knit upper over a recycled-foam midsole — light, breathable, and quietly cushioned. The everyday pair you forget you are wearing.',
    category: 'Footwear',
    priceCents: 8700,
    currency: 'USD',
    motif: '➶',
  },
  {
    id: 'lume_sku_ember_table_lamp',
    name: 'Ember Table Lamp',
    tagline: 'A low, warm glow for the end of the day',
    description:
      'Hand-turned ash base with a linen-wrapped shade. A warm, dimmable LED and a satisfying brass pull-switch. Made in small batches; the grain is never the same twice.',
    category: 'Lighting',
    priceCents: 18900,
    currency: 'USD',
    motif: '✦',
  },
  {
    id: 'lume_sku_terra_throw_blanket',
    name: 'Terra Throw Blanket',
    tagline: 'Stonewashed merino-cotton, fringed by hand',
    description:
      'Woven in a small Portuguese mill from a merino-cotton blend, then stonewashed for an immediate softness. Generous enough for two on a low sofa.',
    category: 'Textiles',
    priceCents: 12400,
    currency: 'USD',
    motif: '≋',
  },
  {
    id: 'lume_sku_kiln_ceramic_carafe',
    name: 'Kiln Ceramic Carafe',
    tagline: 'Reactive-glaze stoneware, 1.1 litres',
    description:
      'A weighty stoneware carafe finished in a reactive speckled glaze. Each piece fires uniquely — no two share the same surface. Water, wine, or a single stem.',
    category: 'Ceramics',
    priceCents: 8600,
    currency: 'USD',
    motif: '◑',
  },
];

export function getProduct(id: string): LumeProduct | undefined {
  return CATALOG.find((p) => p.id === id);
}

export function formatPrice(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    cents / 100
  );
}
