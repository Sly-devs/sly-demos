/**
 * Drift — mobility micropay wallet. PRD #29.
 * Three providers (parking, toll, EV charging). x402 micropays per
 * tap. Reimbursement-formatted receipts.
 */
export const DRIVER = { name: 'Robin Saldívar', initials: 'RS', vehicle: 'EV · ID.4 · CA-7HZ-4421' };

export const AGENT = {
  name: 'Drift Pay Agent',
  kyaTier: 2,
  perTapCents: 50,    // max ceiling per tap
  dailyCapCents: 5000,
};

export interface Provider {
  id: string;
  name: string;
  city: string;
  type: 'parking' | 'toll' | 'charging';
  perTapCents: number;
  icon: string;
}

export const PROVIDERS: Provider[] = [
  { id: 'lot-7th', name: 'Helio Lot · 7th & Cedar', city: 'Oakland', type: 'parking', perTapCents: 275, icon: '🅿️' },
  { id: 'bridge-tw', name: 'Toll · Bay Bridge westbound', city: 'San Francisco', type: 'toll', perTapCents: 750, icon: '🌉' },
  { id: 'ev-fast', name: 'Volt · DC fast charger #4', city: 'Berkeley', type: 'charging', perTapCents: 1290, icon: '⚡' },
];

export interface Receipt {
  id: string;
  providerId: string;
  amountCents: number;
  ts: string;
  hash: string;
  reimbursableTag: 'business' | 'personal';
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function shortHash(s: string): string {
  if (!s) return '—';
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
