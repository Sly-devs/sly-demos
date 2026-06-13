/**
 * Anvil — reverse marketplace. PRD #32.
 *
 * Buyer posts an intent. Seller agents bid. Anvil agent ranks bids by a
 * weighted score (KYA tier × reputation × price-fit × delivery), then
 * settles to the winner via ACP. Bid bonds + KYA gating prevent spam.
 */
export const BUYER = { name: 'Wren Halberd', initials: 'WH', org: 'Sundial Studio' };
export const ANVIL_AGENT = {
  name: 'Anvil Bid-Picker',
  kyaTier: 2,
  kyaFloor: 2,        // sellers below this don't reach the picker
  repFloor: 4.0,
  ceilingCents: 50000, // $500 ceiling for the intent
};

export const INTENT = {
  title: 'Brand identity refresh — logo + 6 brand-token swatches',
  ceilingCents: 50000,
  deadlineDays: 5,
  rubric: 'Must be vector · 3 rounds of revisions · sketches by day 2',
};

export interface Bid {
  id: string;
  seller: string;
  kyaTier: 0 | 1 | 2 | 3;
  rep: number;
  priceCents: number;
  deliveryDays: number;
  pitch: string;
  bondCents: number; // posted as good-faith bond
}

export const INCOMING_BIDS: Bid[] = [
  { id: 'b-1', seller: 'Forge Studio',  kyaTier: 3, rep: 4.9, priceCents: 48000, deliveryDays: 5, pitch: 'In-house brand vault; 14yr operating; ref Petal Lane & Lume.', bondCents: 1500 },
  { id: 'b-2', seller: 'Plum & Co',     kyaTier: 2, rep: 4.6, priceCents: 38000, deliveryDays: 6, pitch: 'Boutique 2-person agency; soft mark specialist.', bondCents: 1000 },
  { id: 'b-3', seller: 'Pyre Labs',     kyaTier: 1, rep: 3.8, priceCents: 22000, deliveryDays: 3, pitch: 'Cheapest fast. Will deliver something good.', bondCents: 250 },
  { id: 'b-4', seller: 'Atelier Nine',  kyaTier: 3, rep: 4.8, priceCents: 45000, deliveryDays: 4, pitch: 'Award-winning team; on Sly since 2024.', bondCents: 1500 },
  { id: 'b-5', seller: 'Quickwerk',     kyaTier: 0, rep: 0,   priceCents: 12000, deliveryDays: 2, pitch: 'New here! Trust me.', bondCents: 0 },
];

export interface Scored extends Bid {
  reasons: string[];
  score: number;       // higher is better
  eligible: boolean;
}

export function scoreBid(b: Bid, intent = INTENT, anvil = ANVIL_AGENT): Scored {
  const reasons: string[] = [];
  let score = 0;

  if (b.kyaTier < anvil.kyaFloor) reasons.push(`KYA T${b.kyaTier} below floor T${anvil.kyaFloor}`);
  if (b.rep < anvil.repFloor) reasons.push(`rep ${b.rep || '—'} below floor ${anvil.repFloor}`);
  if (b.priceCents > intent.ceilingCents) reasons.push(`price over ${intent.ceilingCents / 100} ceiling`);
  if (b.deliveryDays > intent.deadlineDays) reasons.push(`delivery ${b.deliveryDays}d past deadline ${intent.deadlineDays}d`);
  const eligible = reasons.length === 0;

  if (eligible) {
    // weighted multi-factor score (out of 100):
    const priceFit = 35 * (1 - b.priceCents / intent.ceilingCents);
    const repWeight = 30 * (b.rep / 5);
    const kyaWeight = 20 * (b.kyaTier / 3);
    const deliveryWeight = 10 * (1 - b.deliveryDays / intent.deadlineDays);
    const bondWeight = 5 * Math.min(1, b.bondCents / 1500);
    score = priceFit + repWeight + kyaWeight + deliveryWeight + bondWeight;
  }

  return { ...b, reasons, score: Math.round(score * 10) / 10, eligible };
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}
export function shortHash(s: string): string { return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s; }
