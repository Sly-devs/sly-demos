/**
 * Nest — neighborhood agent mesh. PRD #36.
 *
 * A small block (you + 7 neighbors). Each household runs an agent that
 * brokers favors: lend a drill, walk a dog, hold a key. Sly enforces
 * neighborhood trust (KYA tier + block-rep) and meters per-favor pay.
 */
export const YOU = { name: 'Noor Bakir', house: '#412 Linden St', initials: 'NB' };

export type FavorKind = 'tool' | 'service' | 'meal' | 'pet';

export interface Neighbor {
  id: string;
  handle: string;
  house: string;       // approx address for the map
  pin: { x: number; y: number }; // % position on the block map
  kyaTier: 0 | 1 | 2 | 3;
  blockRep: number;
  movedInYears: number;
  agent: string;
  offers: FavorOffer[];
}

export interface FavorOffer {
  id: string;
  kind: FavorKind;
  title: string;
  rateCents: number;          // 0 = free favor (returns favor-token)
  pitch: string;
  available: boolean;
  icon: string;
}

export const NEIGHBORS: Neighbor[] = [
  {
    id: 'n-rhea', handle: 'Rhea · #408', house: 'two doors east', pin: { x: 28, y: 32 },
    kyaTier: 3, blockRep: 4.9, movedInYears: 9,
    agent: 'Maple-house bot',
    offers: [
      { id: 'f-rhea-drill', kind: 'tool', title: 'cordless drill + 24-bit set', rateCents: 200, pitch: 'usually under the workbench', available: true, icon: '⚒' },
      { id: 'f-rhea-key',   kind: 'service', title: 'hold your spare key (1 yr)', rateCents: 0, pitch: 'fireproof safe · home most days', available: true, icon: '⊕' },
    ],
  },
  {
    id: 'n-iggy', handle: 'Iggy · #410', house: 'right next door', pin: { x: 44, y: 38 },
    kyaTier: 2, blockRep: 4.6, movedInYears: 3,
    agent: 'Iggy-domo',
    offers: [
      { id: 'f-iggy-walk', kind: 'pet', title: 'walk Otto (your dog) 30 min', rateCents: 600, pitch: 'knows Otto · usually after 5pm', available: true, icon: '◐' },
      { id: 'f-iggy-meal', kind: 'meal', title: 'extra portion of bibimbap', rateCents: 700, pitch: 'cooks Sundays · 4 servings spare', available: true, icon: '◍' },
    ],
  },
  {
    id: 'n-tova', handle: 'Tova · #414', house: 'across the street', pin: { x: 62, y: 22 },
    kyaTier: 3, blockRep: 4.8, movedInYears: 6,
    agent: 'Tova-blue',
    offers: [
      { id: 'f-tova-watch', kind: 'service', title: 'watch kids 1 hr (1–3 kids)', rateCents: 1500, pitch: 'former teacher · CPR · M–Th evenings', available: true, icon: '◎' },
    ],
  },
  {
    id: 'n-lior', handle: 'Lior · #418', house: 'four doors east', pin: { x: 78, y: 46 },
    kyaTier: 2, blockRep: 4.4, movedInYears: 2,
    agent: 'Lior-loop',
    offers: [
      { id: 'f-lior-grocery', kind: 'service', title: 'add 1 bag to grocery run', rateCents: 0, pitch: 'goes to Fairway Sat 10am · favor-token', available: true, icon: '◧' },
      { id: 'f-lior-tool', kind: 'tool', title: 'borrow ladder (8 ft)', rateCents: 100, pitch: 'garage · sat in dust all year', available: true, icon: '⫛' },
    ],
  },
  {
    id: 'n-shay', handle: 'Shay · #411', house: 'across · #411', pin: { x: 36, y: 64 },
    kyaTier: 2, blockRep: 4.5, movedInYears: 4,
    agent: 'Shay-spark',
    offers: [
      { id: 'f-shay-jump', kind: 'service', title: 'jumpstart your car', rateCents: 0, pitch: 'usually home weekdays · pays in favors', available: true, icon: '⚡' },
    ],
  },
  // Flagged actors — Sly blocks them at discovery
  {
    id: 'n-rotcat', handle: 'rotcat99', house: 'unverified · ~5 blocks?', pin: { x: 88, y: 78 },
    kyaTier: 0, blockRep: 1.4, movedInYears: 0,
    agent: 'no-handshake',
    offers: [
      { id: 'f-rot-drill', kind: 'tool', title: 'drill?? "best price"', rateCents: 100, pitch: 'KYA unverified · 2 disputes pending', available: true, icon: '?' },
    ],
  },
];

export const POLICY = {
  kyaFloor: 2,        // block-mesh requires KYA T2+
  repFloor: 4.0,
  perFavorCeilingCents: 2000, // $20 max per favor
};

export type Decision = 'allow' | 'deny';
export interface DenyReason { kind: 'kya' | 'rep' | 'ceiling' | 'unavailable'; label: string; }

export function evaluateFavor(n: Neighbor, offer: FavorOffer): { decision: Decision; reasons: DenyReason[] } {
  const reasons: DenyReason[] = [];
  if (n.kyaTier < POLICY.kyaFloor) reasons.push({ kind: 'kya', label: `KYA T${n.kyaTier} below block floor T${POLICY.kyaFloor}` });
  if (n.blockRep < POLICY.repFloor) reasons.push({ kind: 'rep', label: `block-rep ${n.blockRep} below ${POLICY.repFloor}` });
  if (offer.rateCents > POLICY.perFavorCeilingCents) reasons.push({ kind: 'ceiling', label: `${(offer.rateCents / 100).toFixed(0)} over per-favor ceiling ${(POLICY.perFavorCeilingCents / 100).toFixed(0)}` });
  if (!offer.available) reasons.push({ kind: 'unavailable', label: 'offer paused' });
  return { decision: reasons.length === 0 ? 'allow' : 'deny', reasons };
}

export function usd(cents: number): string {
  if (cents === 0) return 'favor';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}
export function shortHash(s: string): string { return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s; }
