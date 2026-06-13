/**
 * Trim — subscription autopilot. PRD #1.
 *
 * Agent reviews recurring charges, surfaces dupes / unused / over-priced,
 * recommends cancellations + downgrades, and (on user approval) fires
 * ACP cancellation calls against each merchant.
 */
export const OWNER = { name: 'Maya Cohen', initials: 'MC', city: 'Brooklyn' };
export const AGENT = {
  name: 'Trim Autopilot',
  kyaTier: 2,
  // Policy:
  unilateralCapCents: 5000, // can auto-cancel up to $50/mo on its own (mandate)
  // Beyond cap, ask the human.
};

export type Recommendation = 'cancel' | 'downgrade' | 'keep' | 'flag';
export type Reason =
  | 'duplicate-category'
  | 'unused-60d'
  | 'low-utilization'
  | 'price-hike'
  | 'active'
  | 'family-essential';

export interface Sub {
  id: string;
  merchant: string;
  category: string;
  monthlyCents: number;
  lastUsedDays: number;
  notes: string;
  rec: Recommendation;
  reasons: Reason[];
  proposedMonthlyCents?: number; // for downgrades
  icon: string;
}

export const SUBS: Sub[] = [
  {
    id: 's-1', merchant: 'Streamlux Plus', category: 'video streaming',
    monthlyCents: 1499, lastUsedDays: 2, notes: 'Watched 18 hrs this month',
    rec: 'keep', reasons: ['active'], icon: '▶',
  },
  {
    id: 's-2', merchant: 'CineNow', category: 'video streaming',
    monthlyCents: 1199, lastUsedDays: 41, notes: 'Same library as Streamlux',
    rec: 'cancel', reasons: ['duplicate-category', 'unused-60d'], icon: '◑',
  },
  {
    id: 's-3', merchant: 'PulseFit · Brooklyn', category: 'gym',
    monthlyCents: 5900, lastUsedDays: 67, notes: 'Last visit Apr 1',
    rec: 'cancel', reasons: ['unused-60d'], icon: '◎',
  },
  {
    id: 's-4', merchant: 'Foglight Brief', category: 'newsletter',
    monthlyCents: 400, lastUsedDays: 30, notes: '0 opens in last 30d',
    rec: 'cancel', reasons: ['unused-60d'], icon: '✎',
  },
  {
    id: 's-5', merchant: 'CloudVault 2TB', category: 'cloud storage',
    monthlyCents: 999, lastUsedDays: 0, notes: 'Using 78GB of 2TB · 4% utilization',
    rec: 'downgrade', reasons: ['low-utilization'], proposedMonthlyCents: 399, icon: '◧',
  },
  {
    id: 's-6', merchant: 'Slate Tools Pro', category: 'productivity',
    monthlyCents: 2400, lastUsedDays: 1, notes: 'Active · $5 price hike Apr 28',
    rec: 'flag', reasons: ['price-hike', 'active'], icon: '◼',
  },
  {
    id: 's-7', merchant: 'Tidewell Family Health', category: 'health',
    monthlyCents: 1899, lastUsedDays: 0, notes: 'Shared with household',
    rec: 'keep', reasons: ['family-essential'], icon: '✚',
  },
];

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}
export function shortHash(s: string): string { return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s; }

export const REASON_LABEL: Record<Reason, string> = {
  'duplicate-category': 'duplicate category',
  'unused-60d': 'unused 60+ days',
  'low-utilization': 'low utilization',
  'price-hike': 'price hike',
  'active': 'actively used',
  'family-essential': 'family essential',
};
