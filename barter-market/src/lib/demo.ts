/**
 * Barter — A2A haggling market. PRD #31.
 *
 * Buyer agent (Cinder, parent = Mara) wants to refurb a laptop.
 * Seller agent (Forge-Refurb) posts the service. They negotiate.
 * Sly governs: KYA, mandate ceiling, AP2 grant, ACP settle.
 */
export const BUYER = { name: 'Mara Holloway', initials: 'MH' };
export const BUYER_AGENT = { name: 'Cinder · buyer agent', kyaTier: 2, ceilingCents: 25000, walkAwayCents: 18000 };

export const SELLER = { name: 'North Refurb Co.', city: 'Brooklyn' };
export const SELLER_AGENT = { name: 'Forge-Refurb · seller agent', kyaTier: 2, askCents: 25500, floorCents: 19500 };

export const ITEM = {
  title: 'Laptop refurb — battery + SSD + cleanup',
  spec: 'Apple Silicon, 24-hr turnaround, 90-day warranty',
  marketLowCents: 19000,
  marketHighCents: 26000,
};

export type Side = 'buyer' | 'seller';
export type RoundKind = 'offer' | 'counter' | 'accept' | 'walk';

export interface Round {
  n: number;
  side: Side;
  kind: RoundKind;
  cents: number;
  rationale: string;
  ts: string;
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

export function shortHash(s: string): string {
  if (!s) return '—';
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
