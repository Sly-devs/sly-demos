/**
 * Aster Tipping constants. PRD #9 — x402 + reputation gate.
 *
 * Casey's tipping agent caps per-period spend and refuses to pay
 * creators below the reputation floor.
 */

export const FAN = {
  name: 'Casey Park',
  initials: 'CP',
};

export const AGENT = {
  name: 'Aster Tipping Agent',
  kyaTier: 2,
  weeklyCapCents: 1000,
  perTipCents: 50,
  reputationFloor: 4.0,
};

export interface Creator {
  id: string;
  handle: string;
  name: string;
  blurb: string;
  art: string; // gradient css
  reputation: number;
  followers: string;
  blocked?: 'low-rep' | 'sybil';
}

export const CREATORS: Creator[] = [
  {
    id: 'rune',
    handle: '@runeharper',
    name: 'Rune Harper',
    blurb: 'Generative composer · long-form synthesizer pieces',
    art: 'from-magenta to-peach',
    reputation: 4.9,
    followers: '12.4K',
  },
  {
    id: 'wren',
    handle: '@wrenlu',
    name: 'Wren Lu',
    blurb: 'Field-recorded soundscapes from the Pacific',
    art: 'from-mint to-lavender',
    reputation: 4.7,
    followers: '8.1K',
  },
  {
    id: 'iris',
    handle: '@irisleach',
    name: 'Iris Leach',
    blurb: 'Investigative journalism · climate beat',
    art: 'from-gold to-peach',
    reputation: 4.6,
    followers: '46.7K',
  },
  {
    id: 'sylph',
    handle: '@sylph0xx',
    name: 'sylph0xx',
    blurb: 'Brand-new account · 6 followers · unverified',
    art: 'from-deep to-plum',
    reputation: 2.1,
    followers: '6',
    blocked: 'low-rep',
  },
];

export interface Tip {
  id: string;
  creatorId: string;
  amountCents: number;
  ts: string;
  hash: string;
  status: 'allowed' | 'denied';
  reason?: string;
}

export function usd(cents: number, decimals = 2): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function shortHash(s: string): string {
  if (!s) return '—';
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
