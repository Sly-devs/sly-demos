/**
 * Shared demo constants + types for the Coral × Compass mobile demo.
 *
 * (Trimmed for the public demos repo — the Coral shopping flow's HOKA
 * / MERCHANT / AGENT / WALLET / AgentBuyResponse / DemoEvt-as-event-log
 * types stay in the internal Sly repo.)
 */

export interface DemoEvt {
  kind: string;
  label: string;
}

/* ── Maya's Compass DeFi (Savings & Credit) story ───────────────── */

export const MAYA = {
  holder: 'Maya Chen',
  agentName: "Maya's DeFi Agent",
  agentBlurb: 'Manages your Aave position · borrows within scope',
  kyaTier: 2,
  reputation: 4.9,
  /** Approx. savings figures — real values come from /api/maya/position. */
  savingsUsd: 8.01,
  supplyApy: 3.25,
  borrowAmount: '0.10',
  borrowAsset: 'USDC',
  scope: 'compass:credit',
};

/** GET /api/maya/position — Maya's on-chain Aave position for the savings card. */
export interface MayaPositionResponse {
  collateralUsd: number | null;
  suppliedUsdc: number | null;
  supplyApy: number | null;
  debt: { symbol: string; amount: number }[];
  // Compass routes credit borrows through a per-owner Safe wallet —
  // the borrowed asset lands there, not on the agent EOA. Surface it
  // so the user sees the funds are real and reachable. `currency` is
  // whatever was borrowed (USDC in the current demo).
  safe?: {
    address: string;
    balance: number;
    currency: string;
  };
  error?: string;
}

/** Response shape for both /api/maya/borrow and /api/maya/approve. */
export interface MayaBorrowResponse {
  phase?: 'awaiting_approval' | 'settled' | 'error';
  // awaiting_approval
  requestId?: string;
  amount?: string;
  asset?: string;
  scope?: string;
  purpose?: string;
  // settled
  txHash?: string;
  blockNumber?: number;
  // shared
  events?: DemoEvt[];
  error?: string;
}
