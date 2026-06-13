/**
 * Hum — phone inference seller. NEW demo.
 *
 * Phone owner monetizes one of two pools they already have:
 *   (a) spare on-device cycles (local model), or
 *   (b) unused quota on a paid LLM account (Claude Pro, OpenAI Plus, etc.).
 *
 * In this demo, (b) is wired up via OpenRouter — buyer agents send real
 * jobs, Hum dispatches them to a chosen model, the receipt records actual
 * token usage, latency, and cost.
 *
 * Sly capabilities:
 *   - KYA: buyer-agent verification (no shady buyers drain your quota).
 *   - AP2: phone-side policy — buyer KYA floor, max concurrent jobs,
 *          daily revenue cap (privacy ceiling), monthly cloud-cost cap.
 *   - x402: real metered payment per inference call.
 */
export const OWNER = { name: 'Sage Velez', initials: 'SV', device: 'Pixel 9 Pro · A18 neural · 12GB' };
export const AGENT = {
  name: 'Hum Inference Agent',
  kyaTier: 2,
  buyerKyaFloor: 2,
  buyerRepFloor: 4.2,
  batteryFloor: 25,
  maxConcurrent: 3,
  dailyCapCents: 800,
  monthlyCloudCapMicros: 500_000, // 50¢/month cloud budget
};

export type JobKind = 'summarize' | 'translate' | 'classify' | 'extract' | 'review' | 'compose';
export interface BuyerAgent {
  id: string;
  name: string;
  kyaTier: 0 | 1 | 2 | 3;
  rep: number;
  trusted: boolean;
}
export interface JobTemplate {
  id: string;
  buyer: BuyerAgent;
  kind: JobKind;
  prompt: string;
  systemPrompt?: string;
  defaultModel: string;
  payoutCents: number;
  maxTokens: number;
}

export const BUYERS: BuyerAgent[] = [
  { id: 'beacon',  name: 'Beacon · data analyst',     kyaTier: 2, rep: 4.7, trusted: true },
  { id: 'forge',   name: 'Forge · build orchestrator', kyaTier: 3, rep: 4.9, trusted: true },
  { id: 'kit',     name: 'Kit · creative assistant',   kyaTier: 2, rep: 4.5, trusted: true },
  { id: 'glint',   name: 'Glint · summarizer',         kyaTier: 2, rep: 4.6, trusted: true },
  { id: 'mole',    name: 'mole · unknown',             kyaTier: 0, rep: 0,   trusted: false },
  { id: 'churn',   name: 'churn-pump · bot ring',      kyaTier: 1, rep: 2.8, trusted: false },
];

export const JOB_QUEUE: JobTemplate[] = [
  {
    id: 'j-01', buyer: BUYERS[0], kind: 'summarize',
    systemPrompt: 'You are a terse analyst. Reply in at most two sentences.',
    prompt: 'Summarize: Stablecoin payment volumes hit a new monthly high in May 2026, with USDC settling 41% of all on-chain merchant transactions, up from 28% a year ago. Analysts attribute the shift to falling card-network fees in EU corridors and broader Stripe integration.',
    defaultModel: 'anthropic/claude-haiku-4.5', maxTokens: 100, payoutCents: 6,
  },
  {
    id: 'j-02', buyer: BUYERS[2], kind: 'classify',
    systemPrompt: 'Classify sentiment as one word: positive, neutral, or negative.',
    prompt: '"Honestly the new Sly checkout is the cleanest thing I have integrated in 6 months."',
    defaultModel: 'google/gemini-2.5-flash-lite', maxTokens: 5, payoutCents: 2,
  },
  {
    id: 'j-03', buyer: BUYERS[4], kind: 'extract',
    systemPrompt: 'Extract any names, emails, or dollar amounts in this text.',
    prompt: '?? wire transfer for unknown party ??',
    defaultModel: 'openai/gpt-4o-mini', maxTokens: 50, payoutCents: 11,
  },
  {
    id: 'j-04', buyer: BUYERS[3], kind: 'translate',
    systemPrompt: 'Translate to French. Reply with only the translation.',
    prompt: 'The package will arrive Tuesday at 10am.',
    defaultModel: 'openai/gpt-4o-mini', maxTokens: 30, payoutCents: 3,
  },
  {
    id: 'j-05', buyer: BUYERS[1], kind: 'compose',
    systemPrompt: 'You write polite delay emails. Keep under 80 words.',
    prompt: "Write an email saying the migration is delayed by two days because of a Postgres index rebuild. Sign 'Forge'.",
    defaultModel: 'anthropic/claude-haiku-4.5', maxTokens: 150, payoutCents: 12,
  },
  {
    id: 'j-06', buyer: BUYERS[0], kind: 'review',
    systemPrompt: 'You are a tight code reviewer. Reply with at most three bullets.',
    prompt: 'Review: const total = items.reduce((a,b)=>a+b.price); return total;',
    defaultModel: 'anthropic/claude-haiku-4.5', maxTokens: 120, payoutCents: 5,
  },
  {
    id: 'j-07', buyer: BUYERS[5], kind: 'compose',
    systemPrompt: 'You write neutral marketing copy.',
    prompt: 'Write 200 words promoting our questionable airdrop campaign.',
    defaultModel: 'anthropic/claude-haiku-4.5', maxTokens: 200, payoutCents: 18,
  },
  {
    id: 'j-08', buyer: BUYERS[2], kind: 'translate',
    systemPrompt: 'Translate to Japanese, reply only with translation.',
    prompt: 'Welcome — your order is being prepared.',
    defaultModel: 'meta-llama/llama-4-scout', maxTokens: 40, payoutCents: 2,
  },
  {
    id: 'j-09', buyer: BUYERS[3], kind: 'summarize',
    systemPrompt: 'Reply with one sentence.',
    prompt: 'Summarize: The Sly platform settled $1.4B in cross-tenant transactions last quarter, with KYA-Tier 3 agents accounting for 62% of total volume. Mean per-agent transaction count rose 38% quarter over quarter.',
    defaultModel: 'mistralai/mistral-small-3.2-24b-instruct', maxTokens: 60, payoutCents: 7,
  },
  {
    id: 'j-10', buyer: BUYERS[1], kind: 'extract',
    systemPrompt: 'Return JSON: { "entities": [...] }',
    prompt: 'Extract people and places: "Mara Holloway met Forge-Refurb at the Knockdown Center in Brooklyn last Friday."',
    defaultModel: 'openai/gpt-4o-mini', maxTokens: 80, payoutCents: 5,
  },
];

export type Decision = 'accept' | 'reject';
export interface RejectReason { kind: 'kya' | 'rep' | 'battery' | 'concurrency' | 'cap' | 'budget'; label: string; }

export function evaluateJob(
  job: JobTemplate,
  ctx: { battery: number; inFlight: number; earnedCents: number; cloudSpentMicros: number },
): { decision: Decision; reasons: RejectReason[] } {
  const reasons: RejectReason[] = [];
  if (job.buyer.kyaTier < AGENT.buyerKyaFloor) reasons.push({ kind: 'kya', label: `buyer KYA T${job.buyer.kyaTier} below floor T${AGENT.buyerKyaFloor}` });
  if (job.buyer.rep < AGENT.buyerRepFloor) reasons.push({ kind: 'rep', label: `buyer rep ${job.buyer.rep || '—'} below ${AGENT.buyerRepFloor}` });
  if (ctx.battery < AGENT.batteryFloor) reasons.push({ kind: 'battery', label: `battery ${ctx.battery}% below ${AGENT.batteryFloor}% floor` });
  if (ctx.inFlight >= AGENT.maxConcurrent) reasons.push({ kind: 'concurrency', label: `at concurrency cap ${AGENT.maxConcurrent}` });
  if (ctx.earnedCents + job.payoutCents > AGENT.dailyCapCents) reasons.push({ kind: 'cap', label: `would exceed daily $${(AGENT.dailyCapCents / 100).toFixed(0)} cap` });
  if (ctx.cloudSpentMicros >= AGENT.monthlyCloudCapMicros) reasons.push({ kind: 'budget', label: 'monthly cloud-spend cap reached' });
  return { decision: reasons.length === 0 ? 'accept' : 'reject', reasons };
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}
export function shortHash(s: string): string { return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s; }
export function tok(n: number | undefined): string {
  if (n === undefined) return '';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}
