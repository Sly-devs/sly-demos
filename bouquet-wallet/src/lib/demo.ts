/**
 * Shared demo constants for the Bouquet gifting wallet.
 *
 * Bouquet vs Coral: instead of binding intent to a specific cart, Sam
 * approves an **envelope** ("≤ $75 at any KYA-verified gift merchant")
 * and the agent picks within that envelope. Mandate ceiling = envelope.
 * Receipt is gift-formatted (no purchaser PII to the recipient side).
 */

export const GIFT = {
  itemId: 'petallane_sku_tulip_spa_bundle',
  name: 'Tulip Bouquet + $40 Spa Gift Card',
  blurb: 'Hand-tied tulips · spa credit · same-day delivery',
  priceCents: 7200,
  currency: 'USDC',
  image: '/products/bouquet-gift.webp',
};

export const MERCHANT = {
  name: 'Petal Lane',
  blurb: 'Curated gifts · ACP enabled · gift-receipt formatted',
};

export const ENVELOPE_CENTS = 7500;

export const RECIPIENT = {
  name: 'Maya',
  occasion: 'Birthday',
};

export const AGENT = {
  name: 'Bouquet Gift Agent',
  kyaTier: 2,
  reputation: 4.9,
  crossTenantTx: 24,
};

export const WALLET = {
  balance: 1200,
  currency: 'USDC',
  holder: 'Sam Rivera',
};

export interface DemoEvt {
  kind: string;
  label: string;
  protocol?: string;
}

/** Response shape for both /api/agent/buy and /api/agent/approve. */
export interface AgentBuyResponse {
  phase?: 'awaiting_approval' | 'settled' | 'error';
  // awaiting_approval
  requestId?: string;
  checkoutId?: string;
  purpose?: string;
  amount?: number;
  envelopeCents?: number;
  merchant?: string;
  // settled
  status?: string;
  transferId?: string;
  totalAmount?: number;
  currency?: string;
  // shared
  events?: DemoEvt[];
  error?: string;
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

// Aliases — Coral components were copied verbatim into bouquet-wallet/src/components/
// and import HOKA / MANDATE_CEILING_CENTS from this file. Re-export the
// envelope constants under the original names so the components find
// what they expect without code changes.
export const HOKA = GIFT;
export const MANDATE_CEILING_CENTS = ENVELOPE_CENTS;

// Maya = the Savings & Credit surface inside Bouquet, powered by Compass.
export const MAYA = {
  holder: 'Maya Chen',
  agentName: 'Maya Compass Agent',
  agentBlurb:
    "Manages Maya's Aave position on Base via the Compass CLI — Sly gates every borrow.",
  kyaTier: 2,
  reputation: 4.8,
  scope: 'compass:credit',
  borrowAmount: '0.00005',
  borrowAsset: 'WETH',
  // Fallbacks used when the live Compass call hasn't returned yet.
  savingsUsd: 1234.56,
  supplyApy: 3.42,
};

export interface MayaBorrowResponse {
  phase: 'awaiting_approval' | 'settled' | 'error';
  requestId?: string;
  amount?: string;
  asset?: string;
  scope?: string;
  purpose?: string;
  txHash?: string;
  blockNumber?: number;
  grantId?: string;
  error?: string;
  events?: DemoEvt[];
}

export interface MayaPositionResponse {
  collateralUsd: number | null;
  suppliedUsdc: number | null;
  supplyApy: number | null;
  debt: { symbol: string; amount: number }[];
  error?: string;
}
