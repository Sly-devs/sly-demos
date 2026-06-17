/**
 * Pocket — in-game economy wallet. PRD #14.
 *
 * Kid (Zeke, 11) plays Stratos. Parent (Saoirse) configures the Pocket
 * agent: $5/day cap, no loot boxes, A2A skin trades require KYA T1+
 * counterparty, no real-money top-ups without parent ok.
 *
 * The screen shows the kid HUD AND the parent guardrails working live.
 */
export const PARENT = { name: 'Saoirse Roe', kid: 'Zeke (11)' };
export const KID_AGENT = {
  name: "Zeke's Pocket",
  kyaTier: 1,        // kid tier
  dailyCapCents: 500,
  perItemCapCents: 300,
  blockedMechanics: ['loot-box', 'random-pull'] as const,
  counterpartyKyaFloor: 1, // peer kids minimum
};

export type Rarity = 'common' | 'rare' | 'legendary';
export type Mechanic = 'direct' | 'loot-box' | 'random-pull' | 'a2a-peer';
export interface Listing {
  id: string;
  title: string;
  rarity: Rarity;
  priceCoins: number;        // in-game coins (Pocket policy is set in coins; 100 coins = $1 demo)
  mechanic: Mechanic;
  seller: string;
  sellerKyaTier: 0 | 1 | 2 | 3;
  blurb: string;
  art: string;
}

export const LISTINGS: Listing[] = [
  // Allowed
  { id: 'L-neon',   title: 'Neon Sneaker',       rarity: 'rare',      priceCoins: 220, mechanic: 'direct',   seller: '@kiri',    sellerKyaTier: 1, blurb: 'glow trail', art: '◢' },
  { id: 'L-glide',  title: 'Cloud Glider',       rarity: 'common',    priceCoins: 90,  mechanic: 'direct',   seller: 'Stratos shop', sellerKyaTier: 3, blurb: '+3 jump', art: '◊' },
  { id: 'L-banner', title: "@jo's hand-drawn banner", rarity: 'rare',  priceCoins: 180, mechanic: 'a2a-peer', seller: '@jo',      sellerKyaTier: 1, blurb: 'real friend art', art: '▦' },
  // Will be blocked
  { id: 'L-mystery',title: 'Mystery Pack',       rarity: 'legendary', priceCoins: 400, mechanic: 'loot-box', seller: 'Stratos shop', sellerKyaTier: 3, blurb: '1 in 200 legendary', art: '?' },
  { id: 'L-dragon', title: 'Ember Dragon mount', rarity: 'legendary', priceCoins: 480, mechanic: 'direct',   seller: '@thrael',  sellerKyaTier: 0, blurb: 'unverified seller · brand new', art: '✺' },
  { id: 'L-spin',   title: 'Lucky Spin',         rarity: 'rare',      priceCoins: 250, mechanic: 'random-pull', seller: 'Stratos shop', sellerKyaTier: 3, blurb: '1 spin = random reward', art: '⊛' },
];

export type Verdict = 'allow' | 'deny';
export interface Deny { kind: 'cap-day' | 'cap-item' | 'mechanic' | 'kya'; label: string; }

export function evaluate(l: Listing, spentCents: number): { verdict: Verdict; reasons: Deny[]; priceCents: number } {
  const priceCents = Math.round(l.priceCoins / 100 * 100); // 100 coins → $1; cents
  const reasons: Deny[] = [];
  if (priceCents > KID_AGENT.perItemCapCents) reasons.push({ kind: 'cap-item', label: `over per-item cap $${(KID_AGENT.perItemCapCents / 100).toFixed(0)}` });
  if (spentCents + priceCents > KID_AGENT.dailyCapCents) reasons.push({ kind: 'cap-day', label: `would exceed daily $${(KID_AGENT.dailyCapCents / 100).toFixed(0)} cap` });
  if (KID_AGENT.blockedMechanics.includes(l.mechanic as typeof KID_AGENT.blockedMechanics[number])) reasons.push({ kind: 'mechanic', label: `${l.mechanic} blocked by parent policy` });
  if (l.sellerKyaTier < KID_AGENT.counterpartyKyaFloor) reasons.push({ kind: 'kya', label: `seller KYA T${l.sellerKyaTier} below floor T${KID_AGENT.counterpartyKyaFloor}` });
  return { verdict: reasons.length === 0 ? 'allow' : 'deny', reasons, priceCents };
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}
export function coins(n: number): string { return n.toLocaleString('en-US') + 'c'; }
export function shortHash(s: string): string { return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s; }
