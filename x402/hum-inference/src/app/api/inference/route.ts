import { NextResponse } from 'next/server';
import { callOpenRouter, costMicros, PRICING } from '@/lib/openrouter';

/**
 * Hum's public inference endpoint.
 *
 * This route is meant to be wrapped by Sly's x402 gateway — Sly verifies
 * payment, then proxies the request here. No auth check inside.
 *
 * Body:  { prompt: string, model?: string, maxTokens?: number, systemPrompt?: string, buyer?: string }
 * Reply: { ok: true, model, output, usage: {prompt_tokens, completion_tokens}, latencyMs, costMicros, hash }
 */

function genHash() {
  return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

interface InferenceBody {
  prompt?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  buyer?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as InferenceBody;
  const { prompt, model = 'anthropic/claude-haiku-4.5', maxTokens = 200, systemPrompt, buyer = 'anonymous' } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.length === 0) {
    return NextResponse.json({ ok: false, error: 'prompt required' }, { status: 400 });
  }
  if (!(model in PRICING)) {
    return NextResponse.json({
      ok: false,
      error: `unknown model "${model}"`,
      allowed_models: Object.keys(PRICING),
    }, { status: 400 });
  }

  try {
    const { response, ms } = await callOpenRouter(model, prompt, { maxTokens, systemPrompt });
    const usage = response.usage;
    return NextResponse.json({
      ok: true,
      buyer,
      requestedModel: model,
      model: response.model,
      output: response.choices?.[0]?.message?.content ?? '',
      usage,
      latencyMs: ms,
      costMicros: costMicros(model, usage),
      hash: genHash(),
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 300) : 'openrouter call failed',
    }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'Hum Inference Agent',
    description: 'Phone-side LLM marketplace via OpenRouter, gated by Sly x402.',
    method: 'POST',
    body: {
      prompt: 'string (required)',
      model: 'string (optional, default anthropic/claude-haiku-4.5)',
      maxTokens: 'number (optional, default 200)',
      systemPrompt: 'string (optional)',
      buyer: 'string (optional, display name)',
    },
    models: PRICING,
  });
}
