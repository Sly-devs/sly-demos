import { NextResponse } from 'next/server';
import { humEnv } from '@/lib/hum-flow';
import { AGENT, JOB_QUEUE, evaluateJob } from '@/lib/demo';
import { callOpenRouter, costMicros } from '@/lib/openrouter';

function genHash() {
  return '0x' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

interface RunBody {
  jobId?: string;
  battery?: number;
  inFlight?: number;
  earnedCents?: number;
  cloudSpentMicros?: number;
  /** "auto" or a specific OpenRouter model id. */
  modelOverride?: string;
}

export async function POST(req: Request) {
  const env = humEnv();
  if ('error' in env) return NextResponse.json({ error: env.error }, { status: 500 });

  const {
    jobId,
    battery = 90,
    inFlight = 0,
    earnedCents = 0,
    cloudSpentMicros = 0,
    modelOverride = 'auto',
  } = (await req.json().catch(() => ({}))) as RunBody;

  const job = JOB_QUEUE.find((j) => j.id === jobId);
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 });

  const { decision, reasons } = evaluateJob(job, { battery, inFlight, earnedCents, cloudSpentMicros });

  if (decision === 'reject') {
    return NextResponse.json({
      job, decision, reasons,
      events: [
        { protocol: 'KYA', label: `buyer "${job.buyer.name.split(' · ')[0]}" KYA T${job.buyer.kyaTier} · rep ${job.buyer.rep || '—'}` },
        { protocol: 'AP2', label: `DENY · ${reasons.map((r) => r.label).join(' · ')}` },
      ],
    });
  }

  const model = modelOverride === 'auto' ? job.defaultModel : modelOverride;

  let realModel = model;
  let tokensIn = 0;
  let tokensOut = 0;
  let costM = 0;
  let ms = 0;
  let output = '';
  let usedOpenRouter = false;

  try {
    const { response, ms: latency } = await callOpenRouter(model, job.prompt, {
      maxTokens: job.maxTokens,
      systemPrompt: job.systemPrompt,
    });
    realModel = response.model || model;
    tokensIn = response.usage.prompt_tokens;
    tokensOut = response.usage.completion_tokens;
    costM = costMicros(model, response.usage);
    ms = latency;
    output = response.choices?.[0]?.message?.content ?? '';
    usedOpenRouter = true;
  } catch (err) {
    return NextResponse.json({
      job, decision: 'reject',
      reasons: [{ kind: 'kya' as const, label: err instanceof Error ? err.message : 'openrouter call failed' }],
      events: [
        { protocol: 'KYA', label: `OpenRouter unavailable — ${err instanceof Error ? err.message.slice(0, 80) : 'unknown'}` },
        { protocol: 'AP2', label: 'job aborted before settlement' },
      ],
    }, { status: 200 });
  }

  return NextResponse.json({
    job, decision,
    receipt: {
      id: `inf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      hash: genHash(),
      payoutCents: job.payoutCents,
      buyer: job.buyer.name,
      kind: job.kind,
      model: realModel,
      requestedModel: model,
      tokensIn,
      tokensOut,
      costMicros: costM,
      latencyMs: ms,
      output,
      ts: new Date().toISOString(),
    },
    events: [
      { protocol: 'KYA', label: `${job.buyer.name.split(' · ')[0]} KYA T${job.buyer.kyaTier} · rep ${job.buyer.rep} ✓` },
      { protocol: 'AP2', label: `ACCEPT · ${job.payoutCents}¢ revenue · within $${(AGENT.dailyCapCents / 100).toFixed(0)} daily cap` },
      { protocol: 'x402', label: usedOpenRouter ? `${realModel.split('/').slice(-1)[0]} · ${tokensIn}→${tokensOut} tok · ${ms}ms · settled` : 'x402 micropay settled' },
    ],
  });
}
