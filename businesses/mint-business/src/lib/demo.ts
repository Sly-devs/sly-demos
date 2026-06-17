/**
 * Mint — agent-run micro-business. PRD #37.
 *
 * One agent runs an autonomous code-review shop. It sources expert
 * skills from peer providers (Polyglot Press, Bastion Audits, etc.),
 * sells per-PR review to client agents, and pays weekly dividends
 * to its human owner. All P&L is on Sly.
 */
export const OWNER = { name: 'Nilsa Aronson', org: 'solo · gets dividends' };
export const SHOP = {
  name: 'Mint #014',
  blurb: 'autonomous code-review shop',
  kyaTier: 2,
  // payout policy:
  dividendPct: 0.7,            // 70% of net profit → owner each Friday
  reservePct: 0.3,             // 30% retained for working capital
  // policy gates:
  minMarginPct: 0.30,          // refuse jobs under 30% margin
  maxSourceCostCents: 4000,    // refuse sourcing over $40/job
};

export type JobStatus = 'queued' | 'sourcing' | 'in-progress' | 'shipped' | 'failed';
export interface Job {
  id: string;
  client: string;
  clientKyaTier: 0 | 1 | 2 | 3;
  description: string;
  priceCents: number;         // what client paid
  sourcedFrom: string;        // upstream provider
  costCents: number;          // what Mint owes upstream
  status: JobStatus;
  startedAt: string;
  txHash?: string;
}

export const SEED_JOBS: Job[] = [
  { id: 'j-001', client: 'Halo Labs',     clientKyaTier: 3, description: 'Rust async runtime PR · 1.2K LOC',     priceCents: 6500, sourcedFrom: 'Polyglot Press',  costCents: 2520, status: 'shipped',    startedAt: '08:42', txHash: '0x9a31...2c84' },
  { id: 'j-002', client: 'Petal Lane',    clientKyaTier: 2, description: 'GraphQL schema diff',                 priceCents: 4800, sourcedFrom: 'Lattice & Co',    costCents: 1800, status: 'shipped',    startedAt: '09:14', txHash: '0xf3bd...5811' },
  { id: 'j-003', client: 'Forum Hiring',  clientKyaTier: 3, description: 'Supabase RLS audit · 3 tables',       priceCents: 8200, sourcedFrom: 'Bastion Audits',  costCents: 3060, status: 'shipped',    startedAt: '10:01', txHash: '0xc217...90d3' },
  { id: 'j-004', client: 'Lume Coffee',   clientKyaTier: 2, description: 'NextJS App Router migration review',  priceCents: 5500, sourcedFrom: 'Lattice & Co',    costCents: 2200, status: 'in-progress', startedAt: '10:38' },
  { id: 'j-005', client: 'Bouquet',       clientKyaTier: 2, description: 'AP2 envelope mandate review',         priceCents: 7200, sourcedFrom: 'Bastion Audits',  costCents: 2880, status: 'sourcing',    startedAt: '10:55' },
];

// Jobs that arrive next when "next tick" fires
export const NEXT_TICK_JOBS: Job[] = [
  { id: 'j-006', client: 'Aster',          clientKyaTier: 3, description: 'tip-policy contract audit',           priceCents: 5800, sourcedFrom: 'Bastion Audits', costCents: 2030, status: 'queued', startedAt: '11:10' },
  // bad-margin job — should be REJECTED by Mint's policy
  { id: 'j-007', client: 'Loom Cheapskate',clientKyaTier: 2, description: 'review with $44 budget, $42 cost',    priceCents: 4400, sourcedFrom: 'Polyglot Press',  costCents: 4200, status: 'queued', startedAt: '11:12' },
];

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}
export function shortHash(s: string): string { return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s; }
export function marginPct(price: number, cost: number): number {
  if (price === 0) return 0;
  return (price - cost) / price;
}
