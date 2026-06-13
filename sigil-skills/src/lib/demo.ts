/**
 * Sigil — A2A skill rental. PRD #40.
 *
 * One agent grants a specific skill to another for a bounded window.
 * Sly issues a scoped grant; on expiry the grant auto-revokes. Beats
 * "make this agent's full token visible to peer" by orders of magnitude.
 */
export const RENTER = { name: 'Avi Mariga', org: 'Mariga Labs · solo dev' };
export const RENTER_AGENT = { name: 'Avi · code reviewer', kyaTier: 2 };
export const POLICY = {
  perRentalCeilingCents: 800, // $8 per rental
  dailyCapCents: 3000,        // $30/day across all rentals
};

export type SkillTier = 'staff' | 'senior' | 'mid';
export interface Skill {
  id: string;
  name: string;
  domain: string;
  owner: string;        // owner agent name
  ownerKyaTier: 0 | 1 | 2 | 3;
  ownerRep: number;
  tier: SkillTier;
  pricePerHourCents: number;
  maxWindowHours: number; // owner's policy
  rune: string;
  pitch: string;
}

export const CATALOG: Skill[] = [
  { id: 'sk-rust',    name: 'Rust · staff-level review',  domain: 'code review',  owner: 'Polyglot Press',   ownerKyaTier: 3, ownerRep: 4.9, tier: 'staff',  pricePerHourCents: 420, maxWindowHours: 6, rune: '♅', pitch: 'unsafe-block audits, MIR-level intuition' },
  { id: 'sk-fr',      name: 'French · native translation', domain: 'translation', owner: 'Atelier Lingua',   ownerKyaTier: 2, ownerRep: 4.7, tier: 'senior', pricePerHourCents: 280, maxWindowHours: 12, rune: '◈', pitch: 'literary register · attestable native' },
  { id: 'sk-gql',     name: 'GraphQL · schema design',     domain: 'architecture', owner: 'Lattice & Co',    ownerKyaTier: 3, ownerRep: 4.8, tier: 'staff',  pricePerHourCents: 360, maxWindowHours: 8, rune: '⟢', pitch: 'federation, persisted queries, cost limits' },
  { id: 'sk-supabase',name: 'Supabase · RLS audit',        domain: 'security',     owner: 'Bastion Audits',  ownerKyaTier: 3, ownerRep: 4.9, tier: 'staff',  pricePerHourCents: 510, maxWindowHours: 4, rune: '◇', pitch: 'policy expansion + cross-tenant probes' },
  { id: 'sk-design',  name: 'Brand · design crit',         domain: 'design',       owner: 'Quill Studio',    ownerKyaTier: 2, ownerRep: 4.5, tier: 'senior', pricePerHourCents: 220, maxWindowHours: 10, rune: '▲', pitch: 'identity, type, color, voice' },
  { id: 'sk-shady',   name: '*** any-cred backdoor ***',   domain: '???',          owner: 'unverified-vendor',ownerKyaTier: 0,ownerRep: 1.6, tier: 'mid',    pricePerHourCents: 90,  maxWindowHours: 24, rune: '✕', pitch: 'cheap. no questions.' },
];

export interface Grant {
  id: string;
  skill: Skill;
  windowHours: number;
  startTs: string;
  expiryTs: string;
  costCents: number;
  hash: string;
  status: 'active' | 'expired' | 'revoked';
}

export type Decision = 'allow' | 'deny';
export interface DenyReason { kind: 'kya' | 'rep' | 'window' | 'price' | 'cap'; label: string; }

export function evaluateRental(skill: Skill, windowHours: number, spentCents: number): { decision: Decision; reasons: DenyReason[]; costCents: number; } {
  const reasons: DenyReason[] = [];
  const cost = skill.pricePerHourCents * windowHours;
  if (skill.ownerKyaTier < 2) reasons.push({ kind: 'kya', label: `owner KYA T${skill.ownerKyaTier} below floor T2` });
  if (skill.ownerRep < 4.0) reasons.push({ kind: 'rep', label: `owner rep ${skill.ownerRep} below floor 4.0` });
  if (windowHours > skill.maxWindowHours) reasons.push({ kind: 'window', label: `window ${windowHours}h over owner max ${skill.maxWindowHours}h` });
  if (cost > POLICY.perRentalCeilingCents) reasons.push({ kind: 'price', label: `cost ${(cost / 100).toFixed(2)} over ceiling ${(POLICY.perRentalCeilingCents / 100).toFixed(0)}` });
  if (spentCents + cost > POLICY.dailyCapCents) reasons.push({ kind: 'cap', label: `would exceed daily $${POLICY.dailyCapCents / 100} cap` });
  return { decision: reasons.length === 0 ? 'allow' : 'deny', reasons, costCents: cost };
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}
export function shortHash(s: string): string { return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s; }
