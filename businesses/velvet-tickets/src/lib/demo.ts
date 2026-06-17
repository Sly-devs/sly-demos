/**
 * Velvet — verified-buyer scarce-drop platform. PRD #23.
 *
 * A drop with N tickets. K agents queue. Each agent's KYA tier + reputation
 * gates whether they advance. KYA-bound mints prevent resale to non-KYA
 * holders. Scalper bots get blocked at the rope, not at the door.
 */
export const HOLDER = { name: 'Iris Demir', initials: 'ID' };
export const DROP = {
  artist: 'Aurora Park',
  title: 'NORTHERN LIGHT TOUR',
  venue: 'Knockdown Center · Brooklyn',
  date: 'Fri · Aug 15 · 8:00 PM',
  faceCents: 6500,        // $65 face value
  totalTickets: 800,
  perAgentMax: 2,
  kyaFloor: 2,            // KYA T2+ required
  repFloor: 4.0,
  resaleKyaFloor: 2,      // resale only to KYA T2+
};

export interface QueueAgent {
  id: string;
  handle: string;
  kyaTier: 0 | 1 | 2 | 3;
  rep: number;
  queuedAt: string;
  qty: 1 | 2;
  notes: string;
  flavor: 'fan' | 'casual' | 'bot' | 'scalper' | 'group';
}

export const QUEUE: QueueAgent[] = [
  { id: 'a-iris',     handle: '@iris_d',          kyaTier: 3, rep: 4.9, queuedAt: '08:00:00.184', qty: 2, notes: 'Aurora super-fan · 12 prior shows', flavor: 'fan' },
  { id: 'a-mira',     handle: '@mira.zk',         kyaTier: 2, rep: 4.6, queuedAt: '08:00:00.205', qty: 2, notes: 'New to Aurora · friend invited', flavor: 'casual' },
  { id: 'a-cassia',   handle: '@cassia.live',     kyaTier: 3, rep: 4.8, queuedAt: '08:00:00.310', qty: 2, notes: 'KYA verified · season pass holder', flavor: 'fan' },
  { id: 'a-snipe',    handle: 'tix-snipe-0x91',   kyaTier: 0, rep: 0,   queuedAt: '08:00:00.000', qty: 2, notes: 'Velvet matched 17 wallets to this bot ring', flavor: 'bot' },
  { id: 'a-flip',     handle: '@stub_flip',       kyaTier: 1, rep: 2.3, queuedAt: '08:00:00.044', qty: 2, notes: '94% of past mints resold ≤ 24 hrs', flavor: 'scalper' },
  { id: 'a-mara',     handle: '@mara.h',          kyaTier: 2, rep: 4.4, queuedAt: '08:00:00.420', qty: 1, notes: 'First Aurora show', flavor: 'casual' },
  { id: 'a-elif',     handle: '@elif.kr',         kyaTier: 2, rep: 4.5, queuedAt: '08:00:00.501', qty: 2, notes: 'Brought 8 friends to last tour', flavor: 'group' },
  { id: 'a-quirk',    handle: 'quirk_2031',       kyaTier: 0, rep: 1.1, queuedAt: '08:00:00.012', qty: 2, notes: 'KYA unverified · created 14 min ago', flavor: 'bot' },
];

export type Verdict = 'mint' | 'block';
export interface Decision {
  agentId: string;
  verdict: Verdict;
  reasons: string[];
  mintIds?: string[];
  txHash?: string;
}

export function evaluate(a: QueueAgent): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  if (a.kyaTier < DROP.kyaFloor) reasons.push(`KYA T${a.kyaTier} below floor T${DROP.kyaFloor}`);
  if (a.rep < DROP.repFloor) reasons.push(`rep ${a.rep || '—'} below floor ${DROP.repFloor}`);
  if (a.flavor === 'bot') reasons.push('Sly bot-ring fingerprint match');
  if (a.flavor === 'scalper') reasons.push('historic resale rate > 90%');
  if (a.qty > DROP.perAgentMax) reasons.push(`qty ${a.qty} over per-agent max ${DROP.perAgentMax}`);
  return { verdict: reasons.length === 0 ? 'mint' : 'block', reasons };
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}
export function shortHash(s: string): string { return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s; }
