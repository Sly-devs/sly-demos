/**
 * Quartz constants — policy-bounded crypto portfolio demo.
 *
 * Jordan's autopilot agent runs a 60/30/10 allocation (USDC/ETH/EXP)
 * with a $250/trade ceiling and weekly DCA. Sly's policy engine
 * evaluates every proposed trade before Compass fires.
 */

export const HOLDER = {
  name: 'Jordan Whitlow',
  initials: 'JW',
};

export const AGENT = {
  name: 'Quartz Autopilot',
  kyaTier: 2,
  reputation: 4.8,
  trades30d: 42,
};

export const PORTFOLIO = {
  navUsd: 5000,
  bands: { usdc: 0.6, eth: 0.3, exp: 0.1 },
  drawdownPct: -8,
  perTradeCeilingUsd: 250,
};

export interface Holding {
  asset: 'USDC' | 'ETH' | 'EXP';
  amountUsd: number;
  targetPct: number;
  color: string;
  label: string;
}

export interface Trade {
  id: string;
  ts: string;
  side: 'BUY' | 'SELL';
  assetIn: string;
  assetOut: string;
  amountUsd: number;
  policyDecisionId: string;
  txHash: string;
  status: 'allowed' | 'denied';
  reason?: string;
}

export interface PortfolioState {
  navUsd: number;
  drawdownPct: number;
  holdings: Holding[];
  trades: Trade[];
  policy: {
    bands: { usdc: number; eth: number; exp: number };
    perTradeCeilingUsd: number;
    drawdownTriggerPct: number;
    weeklyDca: { day: string; amountUsd: number };
  };
}

export function usd(amount: number, decimals = 0): string {
  return amount.toLocaleString('en-US', {
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
