/**
 * Echo — sell-my-attention agent. PRD #10.
 *
 * Brand agents send attention offers (30s spot, micro-survey, podcast pre-roll).
 * Echo agent enforces preferences: min payout, brand quality (KYA + reputation),
 * topic blocklist. Accepted offers settle via x402 — coins drop into the user's
 * wallet in real time.
 */
export const USER = { name: 'Naya Brent', initials: 'NB', city: 'Austin' };
export const AGENT = {
  name: 'Echo Attention Agent',
  kyaTier: 2,
  minPayoutCents: 25,    // minimum acceptable payout
  brandRepFloor: 4.2,    // min brand reputation
  topicBlocklist: ['crypto-pump', 'sweepstakes'],
  weeklyCapCents: 500,   // cap on total earnings (also a privacy ceiling)
};

export interface BrandOffer {
  id: string;
  brand: string;
  brandRep: number;
  brandKyaTier: 0 | 1 | 2 | 3;
  topic: string;
  format: '30s spot' | 'micro-survey' | 'podcast pre-roll' | 'opt-in story';
  payoutCents: number;
  receivedAt: string;     // ISO ts
}

export const FEED: BrandOffer[] = [
  { id: 'o-1', brand: 'Lume Coffee', brandRep: 4.8, brandKyaTier: 3, topic: 'specialty coffee · new roast', format: '30s spot', payoutCents: 45, receivedAt: new Date().toISOString() },
  { id: 'o-2', brand: 'Sole Mfg', brandRep: 4.5, brandKyaTier: 2, topic: 'running shoes · fall drop', format: 'opt-in story', payoutCents: 60, receivedAt: new Date().toISOString() },
  { id: 'o-3', brand: 'Pulse Cards (sweepstakes!!!)', brandRep: 2.8, brandKyaTier: 1, topic: 'sweepstakes', format: '30s spot', payoutCents: 80, receivedAt: new Date().toISOString() },
  { id: 'o-4', brand: 'Petal Lane', brandRep: 4.7, brandKyaTier: 2, topic: 'gift cards · birthdays', format: 'micro-survey', payoutCents: 30, receivedAt: new Date().toISOString() },
  { id: 'o-5', brand: 'AcmeChain ICO', brandRep: 3.2, brandKyaTier: 0, topic: 'crypto-pump', format: 'podcast pre-roll', payoutCents: 120, receivedAt: new Date().toISOString() },
  { id: 'o-6', brand: 'Forum Hiring', brandRep: 4.9, brandKyaTier: 3, topic: 'agent marketplaces · careers', format: 'opt-in story', payoutCents: 75, receivedAt: new Date().toISOString() },
];

export type Decision = 'accept' | 'reject';
export interface RejectReason { kind: 'low-payout' | 'low-rep' | 'blocked-topic' | 'low-kya'; label: string; }

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export function evaluate(offer: BrandOffer): { decision: Decision; reasons: RejectReason[] } {
  const reasons: RejectReason[] = [];
  if (offer.payoutCents < AGENT.minPayoutCents) reasons.push({ kind: 'low-payout', label: `payout below ${AGENT.minPayoutCents}¢ floor` });
  if (offer.brandRep < AGENT.brandRepFloor) reasons.push({ kind: 'low-rep', label: `brand rep ${offer.brandRep} below ${AGENT.brandRepFloor}` });
  if (AGENT.topicBlocklist.includes(offer.topic)) reasons.push({ kind: 'blocked-topic', label: `topic "${offer.topic}" on blocklist` });
  if (offer.brandKyaTier < 2) reasons.push({ kind: 'low-kya', label: `brand KYA T${offer.brandKyaTier} below T2 floor` });
  return { decision: reasons.length === 0 ? 'accept' : 'reject', reasons };
}

export function shortHash(s: string): string { return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s; }
