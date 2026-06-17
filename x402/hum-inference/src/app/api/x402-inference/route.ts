import { NextResponse } from 'next/server';
import { callOpenRouter, costMicros, PRICING, providerOf } from '@/lib/openrouter';
import { pushReceipt, shortAddr } from '@/lib/recent-receipts';

/**
 * Hum's real x402-protected inference endpoint.
 *
 * Implements the x402 wire protocol directly (no Sly gateway in front):
 *   1. No X-PAYMENT → respond 402 with payment requirements in x402 spec shape.
 *   2. X-PAYMENT present → decode the EIP-3009 authorization payload, run the
 *      LLM, return the result. The signed payload could be settled via a
 *      facilitator (Sly exposes one at /v1/x402/facilitator/settle) but for
 *      this demo we accept the signature as proof of intent and skip
 *      on-chain settlement — buyer agent has 0 USDC, this is base-sepolia.
 *
 * Cost: 0.01 USDC per call (10000 micro-USDC, USDC has 6 decimals).
 */

// Hum's seller wallet (EVM address) — same address works on Sepolia and
// mainnet (an EOA is chain-agnostic). Override via HUM_PAY_TO to use a
// different relayer wallet (e.g. a mainnet-funded agent's EVM).
const HUM_PAY_TO = process.env.HUM_PAY_TO ?? '0x36EEa12Bb11fe53d7A20a1217b821030A682574E';

// Chain config — flip HUM_CHAIN=base-mainnet to send Hum into production.
// Same protocol, same code path; only the USDC contract + chain ID change.
type ChainKey = 'base-sepolia' | 'base-mainnet';
const CHAIN_KEY: ChainKey = (process.env.HUM_CHAIN as ChainKey) === 'base-mainnet'
  ? 'base-mainnet'
  : 'base-sepolia';
const CHAINS: Record<ChainKey, {
  network: string;        // wire-level network label in the 402 response
  caip2: string;          // CAIP-2 form Sly's facilitator expects
  usdc: string;           // USDC contract address
  usdcName: string;       // EIP-712 domain `name` — DIFFERENT between testnet + mainnet
  usdcVersion: string;
  chainId: number;
  explorer: string;
}> = {
  'base-sepolia': {
    network: 'base-sepolia',
    caip2: 'eip155:84532',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcName: 'USDC',
    usdcVersion: '2',
    chainId: 84532,
    explorer: 'https://sepolia.basescan.org',
  },
  'base-mainnet': {
    network: 'base',
    caip2: 'eip155:8453',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    usdcName: 'USD Coin',
    usdcVersion: '2',
    chainId: 8453,
    explorer: 'https://basescan.org',
  },
};
const CHAIN = CHAINS[CHAIN_KEY];
const NETWORK = CHAIN.network;
const CAIP2_NETWORK = CHAIN.caip2;
const USDC_ADDRESS = CHAIN.usdc;
const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';

const SLY_BASE = process.env.SLY_API_URL ?? 'https://sandbox.getsly.ai';
const SLY_KEY = process.env.HUM_API_KEY ?? 'pk_test_hum_demo_2026';

// Hum's own seller account in the Sly tenant — every inbound x402 payment
// is credited here so it shows on the dashboard ledger.
const HUM_ACCOUNT_ID = process.env.HUM_SELLER_ACCOUNT_ID ?? '913d191d-d360-4ec9-9877-536dfb2e06e4';
// Sly agent whose EVM key relays buyer-signed payments on-chain when real
// settle is enabled via Sly's internal relayer. Must have ETH for gas on
// the target chain. Unused when the endpoint is in CDP facilitator mode.
const HUM_RELAY_AGENT_ID = process.env.HUM_RELAY_AGENT_ID ?? '9131b709-d80a-478f-aee3-d64985e3a1c9';
// Sly endpoint id for Hum. When set + endpoint's facilitator_mode='cdp',
// settle calls route through Coinbase's CDP facilitator (gasless for both
// buyer and seller) instead of Sly's internal relayer.
const HUM_X402_ENDPOINT_ID = process.env.HUM_X402_ENDPOINT_ID ?? 'e7f8c63f-bdb4-4dd4-abee-f4b90b443c4f';
const HUM_DEBUG = process.env.HUM_DEBUG === '1' || process.env.HUM_DEBUG === 'true';

interface FacilitatorSettleResult {
  ok: boolean;
  txHash?: string;
  timestamp?: string;
  transferId?: string;
  onChain?: boolean;
  error?: string;
}

interface SettleMetadata {
  resource: {
    url: string;
    host: string;
    path: string;
    method: string;
    description?: string;
    mimeType?: string;
  };
  intent: {
    reason: string;
    model: string;
    tokens_in?: number;
    tokens_out?: number;
    actual_cost_micro_usd?: number;
  };
  // Buyer's signed EIP-3009 authorization — required for on-chain relay.
  signedPayload?: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
}

/**
 * Ask Sly's facilitator to settle the signed payment + record the inbound
 * x402 transfer on Hum's ledger. In dev/sandbox the txHash is mocked;
 * in production it routes to CDP.
 */
async function settleViaFacilitator(
  payment: { from: string; to: string; amountUsdcDecimal: string },
  meta: SettleMetadata,
): Promise<FacilitatorSettleResult> {
  try {
    const res = await fetch(`${SLY_BASE}/v1/x402/facilitator/settle`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${SLY_KEY}`,
      },
      body: JSON.stringify({
        payment: {
          scheme: 'exact-evm',
          network: CAIP2_NETWORK,
          amount: payment.amountUsdcDecimal,
          token: USDC_ADDRESS,
          from: payment.from,
          to: payment.to,
        },
        // Tell Sly to also write a ledger row for this seller-side inbound.
        accountId: HUM_ACCOUNT_ID,
        description: `Hum LLM inference — ${meta.intent.model}`,
        resource: meta.resource,
        intent: meta.intent,
        // Routing keys for real settlement:
        // - endpointId: when the endpoint's facilitator_mode='cdp', Sly
        //   proxies to Coinbase's CDP facilitator (gasless for both sides).
        // - relayAgentId: fallback for internal/self-relay mode (seller
        //   pays gas with its own Sly-managed EVM key).
        // - payload: the buyer's EIP-3009 signature + auth fields.
        endpointId: HUM_X402_ENDPOINT_ID,
        relayAgentId: HUM_RELAY_AGENT_ID,
        payload: meta.signedPayload,
      }),
    });
    interface SettleEnvelope {
      success?: boolean;
      data?: { transactionHash?: string; settled?: boolean; timestamp?: string; transferId?: string; onChain?: boolean };
      transactionHash?: string;
      settled?: boolean;
      timestamp?: string;
      transferId?: string;
      onChain?: boolean;
      error?: string;
      errorCode?: string;
    }
    const raw = (await res.json().catch(() => ({} as SettleEnvelope))) as SettleEnvelope;
    const inner = raw.data ?? raw;
    const txHash = inner.transactionHash;
    const timestamp = inner.timestamp;
    const transferId = inner.transferId;
    const onChain = inner.onChain;
    if (!res.ok || !txHash) {
      return { ok: false, error: raw.error ?? `facilitator returned ${res.status} without transactionHash` };
    }
    return { ok: true, txHash, timestamp, transferId, onChain };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'facilitator call failed' };
  }
}

/** Hum's pricing policy — quoted on the 402, honored on the paid retry. */
const PRICING_POLICY = {
  /** Multiplier applied to the OpenRouter base cost. 3.0 = 3× markup. */
  markup: 3.0,
  /** Floor in micro-USDC. Stops sub-cent dust quotes from rounding to zero. */
  minPriceMicroUsdc: 1000, // 0.001 USDC
  /** Rough chars-per-token for the input estimate (English heuristic). */
  charsPerToken: 4,
  /** Default maxTokens if buyer omits. */
  defaultMaxTokens: 200,
};

function genHash() {
  return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

interface InferenceBody {
  prompt?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

interface Quote {
  microUsdc: string;
  model: string;
  estInputTokens: number;
  estOutputTokens: number;
  baseCostMicroUsd: number;
  markup: number;
  hitFloor: boolean;
}

/**
 * Quote a price for a specific job. Worst-case for the buyer: input is
 * estimated from prompt length + system prompt; output uses the full
 * maxTokens ceiling. Markup is multiplied in, then floored.
 */
function quoteJob(body: InferenceBody): Quote {
  const model = body.model && body.model in PRICING ? body.model : DEFAULT_MODEL;
  const p = PRICING[model];
  const promptLen = (body.prompt ?? '').length + (body.systemPrompt ?? '').length;
  const estInputTokens = Math.max(1, Math.ceil(promptLen / PRICING_POLICY.charsPerToken));
  const estOutputTokens = Math.max(1, body.maxTokens ?? PRICING_POLICY.defaultMaxTokens);

  // PRICING values are $/1M tokens. Convert to micro-USD (1 USD = 1e6 µUSD).
  const baseCostMicroUsd =
    estInputTokens * p.in + estOutputTokens * p.out;
  const priced = Math.ceil(baseCostMicroUsd * PRICING_POLICY.markup);
  const microUsdc = Math.max(PRICING_POLICY.minPriceMicroUsdc, priced);

  return {
    microUsdc: microUsdc.toString(),
    model,
    estInputTokens,
    estOutputTokens,
    baseCostMicroUsd: Math.ceil(baseCostMicroUsd),
    markup: PRICING_POLICY.markup,
    hitFloor: priced < PRICING_POLICY.minPriceMicroUsdc,
  };
}

function paymentRequirements(resource: string, quote: Quote) {
  const usdcAmount = (Number(quote.microUsdc) / 1_000_000).toFixed(6);
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: NETWORK,
        maxAmountRequired: quote.microUsdc,
        resource,
        description:
          `LLM inference · ${quote.model} · ` +
          `est ${quote.estInputTokens}→${quote.estOutputTokens} tok · ` +
          `base $${(quote.baseCostMicroUsd / 1_000_000).toFixed(6)} × ${quote.markup.toFixed(1)}x` +
          (quote.hitFloor ? ` (floored at ${PRICING_POLICY.minPriceMicroUsdc} µUSDC)` : '') +
          ` = ${usdcAmount} USDC`,
        mimeType: 'application/json',
        payTo: HUM_PAY_TO,
        maxTimeoutSeconds: 60,
        asset: USDC_ADDRESS,
        extra: { name: CHAIN.usdcName, version: CHAIN.usdcVersion },
      },
    ],
    error: 'X-PAYMENT header required (x402 v1)',
    pricing: {
      model: quote.model,
      estInputTokens: quote.estInputTokens,
      estOutputTokens: quote.estOutputTokens,
      baseCostMicroUsd: quote.baseCostMicroUsd,
      markup: quote.markup,
      finalMicroUsdc: quote.microUsdc,
    },
  };
}

export async function POST(req: Request) {
  const resource = req.url;
  const paymentHeader = req.headers.get('x-payment');

  // Parse body first — we quote off it for both 402 and paid responses.
  const body = (await req.json().catch(() => ({}))) as InferenceBody;
  if (!body.prompt || body.prompt.length === 0) {
    return NextResponse.json({ ok: false, error: 'prompt required in body' }, { status: 400 });
  }

  const quote = quoteJob(body);

  // Stage 1: no payment → return 402 with the job-specific quote.
  if (!paymentHeader) {
    return NextResponse.json(paymentRequirements(resource, quote), {
      status: 402,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Stage 2: decode the X-PAYMENT header.
  // Per x402 spec it's base64(JSON of {x402Version, scheme, network, payload}).
  interface PaymentMeta {
    x402Version?: number;
    scheme?: string;
    network?: string;
    payload?: {
      signature?: string;
      authorization?: {
        from?: string;
        to?: string;
        value?: string;
        validAfter?: string;
        validBefore?: string;
        nonce?: string;
      };
    };
  }
  let paymentMeta: PaymentMeta | null = null;
  try {
    const raw = Buffer.from(paymentHeader, 'base64').toString('utf-8');
    paymentMeta = JSON.parse(raw);
  } catch {
    return NextResponse.json({
      x402Version: 1,
      error: 'X-PAYMENT header was not valid base64-JSON',
    }, { status: 402 });
  }

  if (!paymentMeta || paymentMeta.scheme !== 'exact' || paymentMeta.network !== NETWORK) {
    return NextResponse.json({
      x402Version: 1,
      error: `payment scheme/network mismatch — got ${paymentMeta?.scheme}/${paymentMeta?.network}, want exact/${NETWORK}`,
    }, { status: 402 });
  }

  // Verify the buyer signed for at least the quoted amount.
  const signedValue = paymentMeta.payload?.authorization?.value;
  const payer = paymentMeta.payload?.authorization?.from;
  const payeeFromAuth = paymentMeta.payload?.authorization?.to;
  if (!signedValue || BigInt(signedValue) < BigInt(quote.microUsdc)) {
    return NextResponse.json(paymentRequirements(resource, quote), {
      status: 402,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!payer || !payeeFromAuth || payeeFromAuth.toLowerCase() !== HUM_PAY_TO.toLowerCase()) {
    return NextResponse.json({
      x402Version: 1,
      error: `payee mismatch — auth.to=${payeeFromAuth}, want ${HUM_PAY_TO}`,
    }, { status: 402 });
  }

  // Settle through Sly's facilitator BEFORE running OpenRouter. If settle
  // fails we never spend cloud cost on a job we won't get paid for. The
  // meta argument also writes a ledger row on Hum's side so the call shows
  // on the dashboard.
  const amountUsdcDecimal = (Number(signedValue) / 1_000_000).toFixed(6);
  const reqUrl = new URL(req.url);
  const settle = await settleViaFacilitator(
    { from: payer, to: HUM_PAY_TO, amountUsdcDecimal },
    {
      resource: {
        url: req.url,
        host: reqUrl.host,
        path: reqUrl.pathname,
        method: 'POST',
        description: `Hum LLM inference · ${quote.model}`,
        mimeType: 'application/json',
      },
      intent: {
        reason: `LLM inference call · ${(body.prompt ?? '').slice(0, 80)}`,
        model: quote.model,
        tokens_in: quote.estInputTokens,
        tokens_out: quote.estOutputTokens,
        // actual_cost is filled in after the OpenRouter call returns;
        // for now we pass the worst-case quote.
        actual_cost_micro_usd: quote.baseCostMicroUsd,
      },
      // Forward the buyer's signed authorization so Sly can broadcast on chain
      // when X402_REAL_SETTLE=1. Without these fields the facilitator stays
      // in mock mode regardless of the env flag.
      signedPayload: paymentMeta.payload?.signature && paymentMeta.payload.authorization
        ? {
            signature: paymentMeta.payload.signature,
            authorization: {
              from: paymentMeta.payload.authorization.from!,
              to: paymentMeta.payload.authorization.to!,
              value: String(paymentMeta.payload.authorization.value!),
              validAfter: String(paymentMeta.payload.authorization.validAfter ?? '0'),
              validBefore: String(paymentMeta.payload.authorization.validBefore!),
              nonce: paymentMeta.payload.authorization.nonce!,
            },
          }
        : undefined,
    },
  );
  if (!settle.ok) {
    const errStr = typeof settle.error === 'string'
      ? settle.error
      : (settle.error && typeof (settle.error as { message?: unknown }).message === 'string'
          ? (settle.error as { message: string }).message
          : JSON.stringify(settle.error));
    return NextResponse.json({
      x402Version: 1,
      error: `settlement failed: ${errStr}`,
    }, { status: 402 });
  }

  try {
    const { response, ms } = await callOpenRouter(quote.model, body.prompt, {
      maxTokens: body.maxTokens ?? PRICING_POLICY.defaultMaxTokens,
      systemPrompt: body.systemPrompt,
    });
    const usage = response.usage;
    const actualCostMicros = costMicros(quote.model, usage);
    const revenueMicros = Number(signedValue);
    const marginMicros = revenueMicros - actualCostMicros;
    const marginPct = revenueMicros > 0 ? marginMicros / revenueMicros : 0;

    const provider = providerOf(quote.model);

    // Push to the in-memory ring buffer so the phone-frame UI can render this
    // call live. Fire-and-forget; an error here must NOT break the response.
    try {
      const outputText = response.choices?.[0]?.message?.content ?? '';
      pushReceipt({
        payer,
        payerShort: shortAddr(payer),
        payeeShort: shortAddr(HUM_PAY_TO),
        paidMicroUsdc: Number(signedValue),
        paidUsdc: (Number(signedValue) / 1_000_000).toFixed(6),
        network: NETWORK,
        model: quote.model,
        provider,
        promptPreview: body.prompt!.replace(/\s+/g, ' ').slice(0, 120),
        outputPreview: outputText.replace(/\s+/g, ' ').slice(0, 120),
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        latencyMs: ms,
        onChain: settle.onChain === true,
        settlementTxHash: settle.txHash ?? null,
        facilitator: settle.onChain ? 'x402.org/cdp' : 'internal',
        slyTransferId: settle.transferId ?? null,
        marginPct: Math.round(marginPct * 1000) / 10,
      });
    } catch (e) {
      console.error('[hum] pushReceipt failed (ignored):', e);
    }

    if (HUM_DEBUG) {
      const promptPreview = body.prompt!.replace(/\s+/g, ' ').slice(0, 140);
      const outputPreview = (response.choices?.[0]?.message?.content ?? '').replace(/\s+/g, ' ').slice(0, 140);
      console.log(
        `[hum] [${provider.toUpperCase().padEnd(5)}] ${quote.model} · ${payer.slice(0, 10)}… ` +
        `· ${usage.prompt_tokens}→${usage.completion_tokens} tok ` +
        `· ${ms}ms ` +
        `· paid ${signedValue}µ revenue ${revenueMicros}µ cost ${actualCostMicros}µ margin ${(marginPct * 100).toFixed(1)}% ` +
        `· settle ${settle.txHash?.slice(0, 14)}… transfer ${settle.transferId?.slice(0, 12) ?? '—'}\n` +
        `       prompt:  ${JSON.stringify(promptPreview)}\n` +
        `       output:  ${JSON.stringify(outputPreview)}`,
      );
    }

    // X-PAYMENT-RESPONSE header now carries the REAL settlement txHash.
    const paymentResponse = Buffer.from(JSON.stringify({
      success: true,
      txHash: settle.txHash,
      network: NETWORK,
      payer,
      amount: signedValue,
      timestamp: settle.timestamp ?? new Date().toISOString(),
    })).toString('base64');

    return NextResponse.json({
      ok: true,
      paid: true,
      x402: {
        scheme: paymentMeta.scheme,
        network: paymentMeta.network,
        quotedMicroUsdc: quote.microUsdc,
        paidMicroUsdc: signedValue,
        payer,
        payTo: HUM_PAY_TO,
        settled: true,
        onChain: settle.onChain === true,
        settlementTxHash: settle.txHash,
        settledAt: settle.timestamp,
        slyTransferId: settle.transferId ?? null,
        note: settle.onChain
          ? 'broadcast on-chain via Sly relayer (Base Sepolia)'
          : 'settled via Sly facilitator mock — set X402_REAL_SETTLE=1 to broadcast',
      },
      pricing: {
        estInputTokens: quote.estInputTokens,
        estOutputTokens: quote.estOutputTokens,
        actualInputTokens: usage.prompt_tokens,
        actualOutputTokens: usage.completion_tokens,
        baseCostMicroUsd: quote.baseCostMicroUsd,
        actualCostMicroUsd: actualCostMicros,
        markup: quote.markup,
        revenueMicroUsdc: revenueMicros,
        marginMicroUsd: marginMicros,
        marginPct: Math.round(marginPct * 1000) / 10, // 1 decimal place
      },
      requestedModel: quote.model,
      model: response.model,
      provider,
      output: response.choices?.[0]?.message?.content ?? '',
      usage,
      latencyMs: ms,
    }, {
      headers: {
        'x-payment-response': paymentResponse,
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 300) : 'openrouter call failed',
    }, { status: 502 });
  }
}

export async function GET() {
  // Show a few sample quotes so callers can preview pricing.
  const samples = [
    { prompt: 'Hi there.', model: 'anthropic/claude-haiku-4.5', maxTokens: 50 },
    { prompt: 'Summarize this 500-word article: ' + 'x'.repeat(500), model: 'anthropic/claude-haiku-4.5', maxTokens: 200 },
    { prompt: 'Tell me a story.', model: 'openai/gpt-4o-mini', maxTokens: 500 },
    { prompt: 'Hello.', model: 'google/gemini-2.5-flash-lite', maxTokens: 30 },
  ].map((b) => {
    const q = quoteJob(b as InferenceBody);
    return {
      example: { prompt_len: b.prompt.length, model: b.model, maxTokens: b.maxTokens },
      quote: {
        microUsdc: q.microUsdc,
        usdc: (Number(q.microUsdc) / 1_000_000).toFixed(6),
        estInputTokens: q.estInputTokens,
        estOutputTokens: q.estOutputTokens,
        baseCostMicroUsd: q.baseCostMicroUsd,
        markup: q.markup,
        hitFloor: q.hitFloor,
      },
    };
  });
  return NextResponse.json({
    ok: true,
    service: 'Hum x402 Inference',
    spec: 'https://www.x402.org',
    method: 'POST',
    network: NETWORK,
    payTo: HUM_PAY_TO,
    asset: USDC_ADDRESS,
    pricing_policy: {
      ...PRICING_POLICY,
      models: Object.fromEntries(Object.entries(PRICING).map(([id, p]) => [id, { in_per_1m_usd: p.in, out_per_1m_usd: p.out, label: p.label }])),
      formula: 'price_µUSDC = max(min_floor, ceil((est_in_tok × in_rate_µUSD/tok + est_out_tok × out_rate_µUSD/tok) × markup))',
    },
    sample_quotes: samples,
  });
}
