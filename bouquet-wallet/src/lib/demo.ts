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
