/**
 * OpenRouter client — used by Hum's BFF to dispatch real inference jobs.
 * One key, many providers (Anthropic, OpenAI, Google, Meta, Mistral, etc.).
 */

export interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{ message: { content: string }; finish_reason: string }>;
  usage: OpenRouterUsage;
}

/**
 * Per-model pricing in dollars per 1M tokens (rough — kept current
 * for demo cost-estimate only; OpenRouter reports authoritative cost
 * on its `/generation` endpoint).
 */
export const PRICING: Record<string, { in: number; out: number; label: string; family: string }> = {
  // Local — Ollama on the host. Zero per-token cost (battery + thermal only);
  // floor-priced at the marketplace level so Hum still earns the minimum quote.
  'local/phi3-mini':                         { in: 0,     out: 0,     label: 'Phi-3 Mini · local',  family: 'local' },
  // Cloud — via OpenRouter.
  'anthropic/claude-haiku-4.5':              { in: 1.00,  out: 5.00,  label: 'Claude Haiku 4.5',   family: 'anthropic' },
  'openai/gpt-4o-mini':                      { in: 0.15,  out: 0.60,  label: 'GPT-4o mini',        family: 'openai' },
  'google/gemini-2.5-flash-lite':            { in: 0.10,  out: 0.40,  label: 'Gemini 2.5 Flash',   family: 'google' },
  'meta-llama/llama-4-scout':                { in: 0.10,  out: 0.30,  label: 'Llama 4 Scout',      family: 'meta' },
  'mistralai/mistral-small-3.2-24b-instruct':{ in: 0.075, out: 0.20,  label: 'Mistral Small 3.2',  family: 'mistral' },
};

/** Map our model id to the actual Ollama tag. */
const OLLAMA_TAG: Record<string, string> = {
  'local/phi3-mini': 'phi3:mini',
};

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

/** Returns 'local' or 'cloud' for a given model id. */
export function providerOf(model: string): 'local' | 'cloud' {
  return PRICING[model]?.family === 'local' ? 'local' : 'cloud';
}

/** All UI-selectable choices. AUTO defers to the job's own default. */
export const MODEL_CHOICES = [
  { id: 'auto', label: 'AUTO · Hum picks', family: 'auto' },
  ...Object.entries(PRICING).map(([id, p]) => ({ id, label: p.label, family: p.family })),
];

/** Returns cost in micro-dollars (1 millionth of a USD). */
export function costMicros(model: string, usage: OpenRouterUsage): number {
  const p = PRICING[model];
  if (!p) return 0;
  const dollarsIn = (usage.prompt_tokens * p.in) / 1_000_000;
  const dollarsOut = (usage.completion_tokens * p.out) / 1_000_000;
  return Math.round((dollarsIn + dollarsOut) * 1_000_000);
}

/** Formats micro-dollars for the UI. Uses ¢ for sub-cent values, $ otherwise. */
export function formatCost(micros: number): string {
  const cents = micros / 10_000;
  if (cents < 1) return `${cents.toFixed(2)}¢`;
  if (cents < 100) return `${cents.toFixed(1)}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

async function callOllama(
  model: string,
  prompt: string,
  opts?: { maxTokens?: number; systemPrompt?: string },
): Promise<{ response: OpenRouterResponse; ms: number }> {
  const tag = OLLAMA_TAG[model];
  if (!tag) throw new Error(`unknown local model "${model}"`);

  const messages = [
    ...(opts?.systemPrompt ? [{ role: 'system', content: opts.systemPrompt }] : []),
    { role: 'user', content: prompt },
  ];

  const t0 = Date.now();
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: tag,
      messages,
      stream: false,
      options: { num_predict: opts?.maxTokens ?? 400 },
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${errText.slice(0, 200)}`);
  }
  interface OllamaChatResponse {
    model: string;
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
    done_reason?: string;
  }
  const data = (await res.json()) as OllamaChatResponse;
  // Normalize to OpenRouter shape so downstream consumers don't care.
  const response: OpenRouterResponse = {
    id: `ollama_${Date.now().toString(36)}`,
    model: model,
    choices: [{ message: { content: data.message?.content ?? '' }, finish_reason: data.done_reason ?? 'stop' }],
    usage: {
      prompt_tokens: data.prompt_eval_count ?? 0,
      completion_tokens: data.eval_count ?? 0,
      total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
    },
  };
  return { response, ms };
}

export async function callOpenRouter(
  model: string,
  prompt: string,
  opts?: { maxTokens?: number; systemPrompt?: string },
): Promise<{ response: OpenRouterResponse; ms: number }> {
  // Route local models to Ollama; everything else hits OpenRouter cloud.
  if (providerOf(model) === 'local') {
    return callOllama(model, prompt, opts);
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set — add it to apps/demo/hum-inference/.env.local');

  const messages = [
    ...(opts?.systemPrompt ? [{ role: 'system', content: opts.systemPrompt }] : []),
    { role: 'user', content: prompt },
  ];

  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3260',
      'X-Title': 'Hum Phone Inference Demo',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts?.maxTokens ?? 400,
    }),
  });
  const ms = Date.now() - t0;

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as OpenRouterResponse;
  return { response: data, ms };
}
