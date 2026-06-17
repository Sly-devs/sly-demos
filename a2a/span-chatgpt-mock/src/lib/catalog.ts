/**
 * Outpost Outdoors catalog. Mirrors the SKU seeded by
 * apps/demo/_seed/seed-span-demo.ts so the ChatGPT-side storefront and the
 * Sly ledger agree on product id / price.
 */

export interface OutpostProduct {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  priceCents: number;
  currency: string;
}

export const OUTPOST_MERCHANT_ID = 'span:outpost-merchant';
export const OUTPOST_MERCHANT_NAME = 'Outpost Outdoors';

export const HOKA: OutpostProduct = {
  id: 'outpost_sku_hoka_clifton_10',
  name: 'Hoka Clifton 10',
  tagline: 'The everyday cushioned cruiser',
  description:
    'Neutral road running shoe with a breathable engineered-mesh upper and balanced, plush cushioning. Built for long, comfortable miles on road and light trail.',
  category: 'Footwear',
  priceCents: 13500,
  currency: 'USD',
};

export function formatPrice(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    cents / 100
  );
}
