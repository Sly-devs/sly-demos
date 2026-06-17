/**
 * @sly/demo-aster-acs-adapter — Stripe Agentic Commerce Spec (ACS) → Sly ACP shim.
 *
 * Demo-only. Stripe's ACS exposes a merchant-hosted checkout that an external
 * agent (e.g. ChatGPT/OpenAI Instant Checkout) drives with a SharedPaymentToken.
 * Aster's pitch is: keep the Stripe-ACS request/response shape your integration
 * already speaks, but route the actual money movement through Sly so every
 * checkout is wrapped with KYA + policy + fraud + audit.
 *
 * This module is a *pure typed mapper* plus one thin async entrypoint that
 * delegates to @sly/demo-kit's canonical `agentBuy` flow. Nothing here is
 * production code — never import it from an app outside apps/demo.
 */

import { createDemoClient, type CreateCheckoutRequest } from '@sly/demo-kit';

// ---------------------------------------------------------------------------
// Stripe-ACS-shaped wire types (the subset this demo cares about)
// ---------------------------------------------------------------------------

/** A Stripe-ACS line item. Amounts are in minor units (cents). */
export interface AcsLineItem {
  /** Merchant SKU / product id. Maps to Sly's `item_id`. */
  id: string;
  /** Human label for the line. */
  description: string;
  quantity: number;
  /** Unit price in minor units (cents). */
  unit_amount: number;
}

/** A Stripe-ACS checkout session as presented to the adapter. */
export interface AcsSession {
  /** Stripe checkout session id (e.g. `cs_test_...`). */
  id: string;
  /** ISO-4217 currency, lowercase per Stripe convention (e.g. `usd`). */
  currency: string;
  /** The merchant account the session belongs to (Sly merchant id). */
  merchant_id: string;
  merchant_name?: string;
  /** Buyer agent presenting the session (Sly agent id). */
  agent_id: string;
  agent_name?: string;
  /** Sly account the agent acts under. */
  account_id: string;
  /** Opaque payment credential the agent presents at completion. */
  shared_payment_token?: string;
  customer_email?: string;
  metadata?: Record<string, string>;
}

/** The inbound Stripe-ACS-shaped request. */
export interface AcsCheckoutRequest {
  session: AcsSession;
  line_items: AcsLineItem[];
}

/** The Stripe-ACS-shaped response the adapter returns. */
export interface AcsCheckoutResponse {
  /** Echoes the inbound session id. */
  id: string;
  object: 'checkout.session';
  /** Mapped from Sly's terminal checkout status. */
  status: 'complete' | 'open' | 'expired';
  payment_status: 'paid' | 'unpaid';
  /** Order total in minor units (cents). */
  amount_total: number;
  currency: string;
  /** Sly transfer that settled the order — Aster's audit anchor. */
  payment_intent: string | null;
  metadata: Record<string, string>;
}

export interface AdapterOptions {
  apiKey: string;
  /** Sly API base (e.g. https://sandbox.getsly.ai). */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Pure mapper
// ---------------------------------------------------------------------------

/**
 * Map a Stripe-ACS-shaped request to a Sly ACP `CreateCheckoutRequest`.
 * Pure: no I/O, deterministic given its input (modulo the generated
 * checkout_id which folds in the inbound session id).
 */
export function toSlyCheckout(req: AcsCheckoutRequest): CreateCheckoutRequest {
  const { session, line_items } = req;
  const currency = session.currency.toUpperCase();

  const items = line_items.map((li) => ({
    item_id: li.id,
    name: li.description,
    quantity: li.quantity,
    unit_price: li.unit_amount,
    total_price: li.unit_amount * li.quantity,
    currency,
  }));

  return {
    checkout_id: `acs_${session.id}`,
    agent_id: session.agent_id,
    ...(session.agent_name ? { agent_name: session.agent_name } : {}),
    account_id: session.account_id,
    merchant_id: session.merchant_id,
    ...(session.merchant_name ? { merchant_name: session.merchant_name } : {}),
    ...(session.customer_email ? { customer_email: session.customer_email } : {}),
    currency,
    items,
    ...(session.shared_payment_token
      ? { shared_payment_token: session.shared_payment_token }
      : {}),
    metadata: {
      demo: 'aster',
      adapter: 'stripe-acs',
      acs_session_id: session.id,
      ...(session.metadata ?? {}),
    },
  };
}

/** Map a Sly terminal status onto the Stripe-ACS status pair. */
export function toAcsStatus(slyStatus: string): {
  status: AcsCheckoutResponse['status'];
  payment_status: AcsCheckoutResponse['payment_status'];
} {
  if (slyStatus === 'completed') {
    return { status: 'complete', payment_status: 'paid' };
  }
  if (slyStatus === 'expired') {
    return { status: 'expired', payment_status: 'unpaid' };
  }
  return { status: 'open', payment_status: 'unpaid' };
}

// ---------------------------------------------------------------------------
// Thin async entrypoint — delegates money movement to Sly via demo-kit
// ---------------------------------------------------------------------------

/**
 * Accept a Stripe-ACS-shaped checkout, run it through Sly's canonical ACP
 * flow (KYA + policy + fraud + audit + settlement), and return a
 * Stripe-ACS-shaped response. The caller never has to learn Sly's API.
 */
export async function handleAcsCheckout(
  req: AcsCheckoutRequest,
  opts: AdapterOptions
): Promise<AcsCheckoutResponse> {
  const checkout = toSlyCheckout(req);
  const client = createDemoClient({
    apiKey: opts.apiKey,
    ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
  });

  const { completed } = await client.agentBuy({ checkout });
  const { status, payment_status } = toAcsStatus(completed.status);

  return {
    id: req.session.id,
    object: 'checkout.session',
    status,
    payment_status,
    amount_total: completed.total_amount,
    currency: completed.currency.toUpperCase(),
    payment_intent: completed.transfer_id ?? null,
    metadata: {
      demo: 'aster',
      adapter: 'stripe-acs',
      sly_checkout_id: completed.checkout_id,
      ...(req.session.metadata ?? {}),
    },
  };
}
