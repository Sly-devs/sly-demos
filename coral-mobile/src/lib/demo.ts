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

/** Demo display scale — UI surfaces show on-chain USDC amounts multiplied
 * by this factor so the narrative ("a $1,450 Aave position, $145 shoes")
 * lands harder than the literal sandbox values ($1 collateral, $0.10
 * shoes). Real txns are still cents — Basescan links go to the live
 * sub-dollar transfers. Ratios (LTV %, APY) are NOT scaled. */
export const DEMO_SCALE = 1450;

/** Scale a real on-chain USDC amount to its displayed value. */
export function displayUsdc(real: number | string | undefined | null): number {
  if (real == null) return 0;
  const n = typeof real === 'string' ? Number(real) : real;
  if (!Number.isFinite(n)) return 0;
  return n * DEMO_SCALE;
}

/** Format a scaled USDC amount with two decimals — "1,450.00 USDC".
 * Matches the approval-sheet styling; pass `withSuffix: false` when
 * embedding inside a layout that prints "USDC" separately. */
export function fmtUsdc(
  scaled: number | string | undefined | null,
  opts: { withSuffix?: boolean } = {},
): string {
  const { withSuffix = true } = opts;
  const n = scaled == null ? 0 : typeof scaled === 'string' ? Number(scaled) : scaled;
  const num = (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSuffix ? `${num} USDC` : num;
}

/* ── Maya's Compass DeFi (Savings & Credit) story ───────────────── */

export const MAYA = {
  holder: 'Maya Chen',
  agentName: "Maya's DeFi Agent",
  agentBlurb: 'Manages your Aave position · borrows within scope',
  kyaTier: 2,
  reputation: 4.9,
  /** Approx. savings figures — real values come from /api/maya/position.
   * Stored as the on-chain USDC amount; display layer multiplies by
   * DEMO_SCALE (1.00 → $1,450 displayed). */
  savingsUsd: 1.00,
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
