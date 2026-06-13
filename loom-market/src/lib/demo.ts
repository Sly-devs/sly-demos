/**
 * Loom — peer resource market constants.
 *
 * Two agents on Sly: Beacon (buyer, runs inference jobs) and Forge
 * (provider, sells GPU time). Loom is the discovery + session layer;
 * Sly meters per-call via x402 and emits a receipt per settled call.
 */

export const BUYER = {
  name: 'Beacon',
  owner: 'Aris Maren',
  kyaTier: 2,
  reputation: 4.7,
  purpose: 'Document parsing pipeline',
};

export const PROVIDER = {
  name: 'Forge',
  blurb: 'GPU inference · LLama-3.1-70B-Instruct',
  kyaTier: 2,
  reputation: 4.8,
  jobsCompleted: 421,
  region: 'us-west',
  pricePerCallCents: 2, // $0.02 / call
  endpointPath: '/v1/forge/infer',
};

export const PEERS = [
  {
    name: 'Forge',
    role: 'GPU · LLama-70B',
    rep: 4.8,
    jobs: 421,
    price: '$0.020 / call',
    status: 'selected' as const,
  },
  {
    name: 'Atlas',
    role: 'Vector store · 1B vectors',
    rep: 4.6,
    jobs: 312,
    price: '$0.005 / call',
    status: 'available' as const,
  },
  {
    name: 'Sift',
    role: 'OCR · 14 languages',
    rep: 4.4,
    jobs: 188,
    price: '$0.015 / call',
    status: 'available' as const,
  },
  {
    name: 'Vex',
    role: 'GPU · Stable Diffusion XL',
    rep: 3.6,
    jobs: 41,
    price: '$0.030 / call',
    status: 'low-rep' as const,
  },
];

export const SESSION = {
  ceilingCents: 5000, // $50.00
  batchCalls: 50, // each "Run batch" fires 50 metered calls in one demo click
};

export interface CallReceipt {
  i: number;
  ts: string;
  amountCents: number;
  hash: string;
}

export interface SessionState {
  phase: 'idle' | 'opening' | 'open' | 'closing' | 'closed' | 'error';
  sessionId?: string;
  mandateId?: string;
  callsMade: number;
  centsSpent: number;
  receipts: CallReceipt[];
  errors?: string[];
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shortHash(s: string): string {
  if (!s) return '—';
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
