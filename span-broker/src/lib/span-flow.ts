/**
 * Server-only Span flow helpers. PROTOCOL-TRUE: a genuine UCP checkout
 * settled with a TOKENIZED CARD (not a stablecoin wallet — that's Coral).
 *
 *   1. tenant key  → UCP createCheckout            (Outpost merchant backend)
 *                     with a tokenized Visa card pre-attached
 *   2. agent token → request `treasury` scope      (Claude agent asks to pay)
 *   3. tenant key  → approve the scope request     (account owner)
 *   4. agent token → UCP completeCheckout          (card charged, order made)
 *
 * Span is the cross-ecosystem story (Claude buyer ↔ ChatGPT seller, Sly the
 * neutral broker); the rail is UCP + card so it's distinct from Coral (ACP +
 * wallet). The `invu` payment handler runs in demo mode, so the tokenized
 * card settles for real and a UCP order is created — no external creds.
 *
 * Kept consistent with apps/demo/_seed/seed-span-demo.ts:
 *   merchant span:outpost-merchant · Hoka Clifton 10 · $135 ·
 *   item id outpost_sku_hoka_clifton_10
 */
import { createDemoClient } from '@sly/demo-kit';

export const OUTPOST_MERCHANT_ID = 'span:outpost-merchant';
export const OUTPOST_MERCHANT_NAME = 'Outpost Outdoors';

export const HOKA = {
  itemId: 'outpost_sku_hoka_clifton_10',
  name: 'Hoka Clifton 10',
  priceCents: 13500, // UCP line items are minor units (cents)
  currency: 'USD', // a card settles in USD — NOT a USDC stablecoin wallet
} as const;

export const PRICE = HOKA.priceCents / 100; // major units for copy

/** The buyer's tokenized card. `invu` is the demo-mode card handler, so
 *  this settles a real UCP order without external processor creds. The
 *  PAN is never present — only the network token + brand/last4. */
export const TOKENIZED_CARD = {
  id: 'tok_visa_span_4242',
  handler: 'invu',
  type: 'card',
  brand: 'visa',
  last4: '4242',
} as const;

export const CARD_LABEL = `Visa •••• ${TOKENIZED_CARD.last4} (tokenized card)`;

export interface SpanEnv {
  tenantKey: string;
  /** Outpost (seller / ChatGPT-side) tenant key — the MERCHANT backend
   *  owns the UCP checkout, so the order lives in Outpost's own Sly
   *  tenant (true cross-ecosystem: buyer authorizes, seller's tenant
   *  holds the order). */
  outpostKey: string;
  agentToken: string;
  agentId: string;
  accountId: string;
  baseUrl: string;
}

export function spanEnv(): SpanEnv | { error: string } {
  const tenantKey = process.env.SPAN_API_KEY ?? 'pk_test_span_demo_2026';
  const outpostKey =
    process.env.SPAN_OUTPOST_API_KEY ?? 'pk_test_outpost_demo_2026';
  const agentToken = process.env.SPAN_AGENT_TOKEN;
  const agentId = process.env.SPAN_AGENT_ID;
  const accountId = process.env.SPAN_ACCOUNT_ID;
  const baseUrl = process.env.SLY_API_URL ?? 'http://localhost:4000';
  if (!agentToken || !agentId || !accountId) {
    return {
      error:
        'Missing SPAN_AGENT_TOKEN / SPAN_AGENT_ID / SPAN_ACCOUNT_ID. Re-run seed-span-demo.ts and update .env.local.',
    };
  }
  return { tenantKey, outpostKey, agentToken, agentId, accountId, baseUrl };
}

export const tenantClient = (e: SpanEnv) =>
  createDemoClient({ apiKey: e.tenantKey, baseUrl: e.baseUrl });
export const agentClient = (e: SpanEnv) =>
  createDemoClient({ apiKey: e.agentToken, baseUrl: e.baseUrl });

/** Raw authed POST — @sly/demo-kit doesn't wrap UCP, so the broker route
 *  drives the real UCP endpoints directly. */
export async function rawPost<T = unknown>(
  baseUrl: string,
  key: string,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T }> {
  const r = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  const j = t ? JSON.parse(t) : {};
  return { ok: r.ok, status: r.status, data: (j?.data ?? j) as T };
}

/** UCP create-checkout payload (Outpost / ChatGPT-side merchant). The
 *  tokenized card is pre-attached, so the API auto-selects it and the
 *  agent can complete straight after the scope is approved. */
export function buildUcpCheckout(e: SpanEnv) {
  // Buyer-driven: the Span Claude agent owns/authorizes this checkout
  // (its one-shot treasury scope completes it). `invu_merchant_id` lets
  // Sly resolve Outpost (the seller, a separate tenant) and MIRROR the
  // completed order into Outpost's own tenant — the merchant never needs
  // a scope to *receive*; Sly mirrors it, same as the ACP path.
  return {
    currency: HOKA.currency, // 'USD'
    checkout_type: 'physical' as const,
    agent_id: e.agentId,
    buyer: {
      name: 'Maya Chen',
      email: 'maya@span-demo.app',
    },
    shipping_address: {
      line1: '2125 Mission St',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94110',
      country: 'US',
    },
    line_items: [
      {
        id: HOKA.itemId,
        name: HOKA.name,
        description: 'Neutral road running shoe · breathable mesh',
        quantity: 1,
        unit_price: HOKA.priceCents,
        total_price: HOKA.priceCents,
        currency: HOKA.currency,
      },
    ],
    payment_instruments: [TOKENIZED_CARD],
    metadata: {
      demo: 'span',
      buyer_ecosystem: 'claude',
      seller_ecosystem: 'chatgpt',
      merchant: OUTPOST_MERCHANT_ID,
      // Sly resolves the seller tenant from this and mirrors the order.
      invu_merchant_id: OUTPOST_MERCHANT_ID,
      surface: 'span-broker-console',
    },
  };
}

export const SCOPE_PURPOSE = `Pay ${OUTPOST_MERCHANT_NAME} $${PRICE.toFixed(2)} for ${HOKA.name} via ${CARD_LABEL} (Span Claude shopping agent)`;
