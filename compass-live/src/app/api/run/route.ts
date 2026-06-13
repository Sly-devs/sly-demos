/**
 * POST /api/run
 *
 * Body: { scenario: ScenarioId }
 *
 * Returns: { session_id }
 *
 * Side-effects (async, after returning):
 *   1. Setup scenario state (allowlist / grant / agent.status) per the
 *      `setup` block of the scenario definition.
 *   2. Spawn `node packages/mcp-compass/demo-agent-client.mjs` with
 *      `DEMO_TOOL=<governed_*>` and `DEMO_ARGS=<json>` in env. Stream
 *      each stdout line to the session bus as a `pane: 'left'` event.
 *   3. Emit the exact `compass <cmd>` invocation as a curated event on
 *      the right pane so the Compass team can review what their CLI is
 *      being asked to do on this scenario.
 *   4. After the child exits, fetch the policy_evaluations + audit_log
 *      rows and replay them on the right pane with synthetic timing.
 *   5. Restore baseline state and emit `done`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createSession, pushEvent } from '@/lib/bus';
import { setupScenario, restoreBaseline } from '@/lib/state';
import { getScenario, scenarioSteps, type Scenario, type ScenarioStep } from '@/lib/scenarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Resolve the vendored @sly_ai/mcp-compass demo client at REQUEST time so the
// bundler doesn't try to statically include it as a module dep (it is spawned
// as a child process, not imported). Walks up from CWD looking for the
// vendored _mcp-compass/ workspace package; honors SLY_DEMOS_ROOT override.
function resolveAgentClient(): { script: string; cwd: string } {
  const envRoot = process.env.SLY_DEMOS_ROOT;
  const candidates: string[] = [];
  if (envRoot) candidates.push(envRoot);
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    candidates.push(dir);
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  for (const c of candidates) {
    const script = join(c, '_mcp-compass', 'demo-agent-client.mjs');
    if (existsSync(script)) return { script, cwd: join(c, '_mcp-compass') };
  }
  throw new Error(
    'Could not locate _mcp-compass/demo-agent-client.mjs. Set SLY_DEMOS_ROOT to the sly-demos repo root.',
  );
}

const SLY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sandbox.getsly.ai';
const SLY_TENANT_KEY = process.env.SLY_DEMO_TENANT_API_KEY || '';

type Level = 'info' | 'good' | 'warn' | 'deny' | 'dim';

export async function POST(req: NextRequest) {
  let body: { scenario?: string };
  try {
    body = (await req.json()) as { scenario?: string };
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }
  const scenario = body?.scenario ? getScenario(body.scenario) : undefined;
  if (!scenario) {
    return NextResponse.json({ error: `unknown scenario: ${String(body?.scenario)}` }, { status: 400 });
  }
  const sessionId = createSession();
  // Fire-and-forget; the browser subscribes via /stream/:id.
  void runScenario(sessionId, scenario);
  return NextResponse.json({ session_id: sessionId });
}

async function runScenario(sessionId: string, scenario: Scenario): Promise<void> {
  const startedAt = Date.now();
  const banner = (text: string, level: Level = 'info') =>
    pushEvent(sessionId, { kind: 'meta', pane: 'either', text, level });
  const left = (text: string, level: Level = 'info') =>
    pushEvent(sessionId, { kind: 'agent', pane: 'left', text, level });
  const right = (text: string, level: Level = 'info', detail?: Record<string, unknown>) =>
    pushEvent(sessionId, { kind: 'api', pane: 'right', text, level, detail });

  try {
    banner(`▶ ${scenario.label} — ${scenario.sub}`, 'info');
    left('# preparing scenario state…', 'dim');
    await setupScenario(scenario);

    const steps = scenarioSteps(scenario);
    const isMulti = steps.length > 1;

    if (isMulti) {
      banner(`▶ ${steps.length}-step scenario · each step independently gated by Sly`, 'dim');
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const prefix = isMulti ? `[step ${i + 1}/${steps.length}] ` : '';
      if (isMulti) {
        banner(`▶ ${prefix}${step.label}`, 'info');
        right(`▶ ${prefix}${step.label}${step.description ? ` — ${step.description}` : ''}`, 'info');
        left(`# ${prefix}invoking ${step.tool}`, 'dim');
      } else {
        left(`# scenario primed — invoking ${step.tool}`, 'dim');
      }

      // Faked steps replay a canned visual instead of spawning the real
      // MCP client (used when the underlying primitive — hierarchical
      // agent delegation, perps execute — isn't built yet).
      if (step.fake) {
        const fakeLines = step.fake.leftLines ?? [];
        for (const fl of fakeLines) {
          left(fl, chooseLevel(fl));
          await new Promise<void>((r) => setTimeout(r, 120));
        }
        // Custom right-pane events (delegation-request beat) take
        // precedence over the standard precheck → engine → decision
        // flow. For the standard flow with a canned parsed, fall
        // through to emitCuratedEvents below.
        if (step.fake.customEvents && step.fake.customEvents.length > 0) {
          for (const ev of step.fake.customEvents) {
            right(prefix + ev.text, ev.level ?? 'info', ev.detail);
            await new Promise<void>((r) => setTimeout(r, ev.waitAfterMs ?? 200));
          }
        }
        await emitCuratedEvents(scenario, step, step.fake.parsed, right, banner, prefix);
        // Don't halt on fake denies — they're scripted, and a denying
        // step in a multi-step fake (e.g. junior denied → treasury
        // delegates → junior succeeds) is the WHOLE POINT of the
        // sequence. Let it continue.
        if (i < steps.length - 1) await new Promise<void>((r) => setTimeout(r, 350));
        continue;
      }

      const agentExit = await spawnAgentClient(left, step);
      if (!agentExit.parsed) {
        banner(`${prefix}agent client did not emit a parseable result — see left pane`, 'warn');
        if (isMulti && i < steps.length - 1) break;
      } else {
        await emitCuratedEvents(scenario, step, agentExit.parsed, right, banner, prefix);
        if (isMulti && agentExit.parsed?.decision === 'deny' && i < steps.length - 1) {
          banner(`▶ multi-step halted at step ${i + 1} (deny upstream)`, 'deny');
          break;
        }
      }

      if (i < steps.length - 1) await new Promise<void>((r) => setTimeout(r, 350));
    }

    banner(`▶ scenario complete (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`, 'dim');
  } catch (e) {
    banner(`runner error: ${(e as Error).message}`, 'deny');
  } finally {
    try {
      await restoreBaseline();
    } catch (e) {
      banner(`restore baseline failed: ${(e as Error).message}`, 'warn');
    }
    pushEvent(sessionId, { kind: 'done', pane: 'either', text: '' });
  }
}

// ─── Spawn the demo agent client and pipe stdout to the left pane ────

interface AgentRunResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed: any | null;
}

async function spawnAgentClient(
  left: (text: string, level?: Level) => void,
  step: ScenarioStep,
): Promise<AgentRunResult> {
  return new Promise((resolve) => {
    const { script, cwd: scriptCwd } = resolveAgentClient();
    const child = spawn('node', [script], {
      cwd: scriptCwd,
      env: {
        ...process.env,
        SLY_API_URL,
        SLY_API_KEY: SLY_TENANT_KEY,
        DEMO_TOOL: step.tool,
        DEMO_ARGS: JSON.stringify(step.args),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buf = '';
    let resultBuf = '';
    let inResult = false;
    let parsed: unknown = null;

    const onLine = (line: string) => {
      if (line.startsWith('[MCP→agent] result:')) {
        inResult = true;
      } else if (inResult) {
        resultBuf += line + '\n';
      }
      left(line, chooseLevel(line));
    };

    child.stdout.on('data', (d: Buffer) => {
      buf += d.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        onLine(line);
      }
    });
    child.stderr.on('data', (d: Buffer) => {
      const s = d.toString();
      for (const line of s.split('\n')) {
        if (line) left(line, 'warn');
      }
    });
    child.on('error', (e) => {
      left(`spawn error: ${(e as Error).message}`, 'deny');
      resolve({ parsed: null });
    });
    child.on('close', (code) => {
      if (buf) onLine(buf);
      if (inResult) {
        try {
          parsed = JSON.parse(resultBuf);
        } catch {
          /* not parseable, fine */
        }
      }
      left(`# agent client exited (code=${code})`, 'dim');
      resolve({ parsed });
    });
  });
}

function chooseLevel(line: string): Level {
  if (line.startsWith('#')) return 'dim';
  if (line.includes('"decision": "approve"')) return 'good';
  if (line.includes('"decision": "deny"')) return 'deny';
  if (line.includes('"error"') || line.includes('failed') || line.includes('reasons')) return 'warn';
  if (line.startsWith('[agent→MCP]') || line.startsWith('[MCP→agent]')) return 'info';
  return 'info';
}

// ─── Right-pane curated events ────────────────────────────────────────

interface CheckRow {
  check: string;
  result: 'pass' | 'fail';
  detail: string;
}

async function emitCuratedEvents(
  scenario: Scenario,
  step: ScenarioStep,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed: any,
  right: (text: string, level?: Level, detail?: Record<string, unknown>) => void,
  banner: (text: string, level?: Level) => void,
  prefix: string,
): Promise<void> {
  const evaluationId: string | null = parsed?.evaluation_id ?? null;
  const decision: 'approve' | 'deny' = parsed?.decision === 'approve' ? 'approve' : 'deny';
  const reasons: string[] = parsed?.reasons ?? [];
  const checks: CheckRow[] = parsed?.checks ?? [];

  const subcommand = step.tool
    .replace(/^governed_/, '')
    .replace(/_/g, ':');
  const venue = String((step.args as Record<string, unknown>).venue_type ?? (step.args as Record<string, unknown>).symbol ?? '');
  const amount = String((step.args as Record<string, unknown>).amount ?? '');

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  right(`${prefix}POST /v1/policy/evaluate-intent`, 'info', {
    intent: {
      subcommand,
      chain: 'base',
      amount,
      currency: 'USDC',
      venue_type: venue || undefined,
    },
  });
  await wait(220);

  // 1. kill-switch precheck
  if (scenario.setup.agentStatus === 'suspended') {
    right(`${prefix}[precheck] kill_switch: DENY — agent.status='suspended'`, 'deny');
    right(`${prefix}[decision] deny (engine NOT invoked)`, 'deny', { reasons });
  } else {
    right(`${prefix}[precheck] kill_switch: pass — agent.status=active, no operator override`, 'good');
    await wait(140);

    // 2. scope step-up — credit:*, tokenized:*, perps:* require an active scope grant
    const requiredScope: 'compass:credit' | 'compass:tokenized' | null =
      step.tool === 'governed_credit_borrow' || step.tool === 'governed_compass_withdraw'
        ? 'compass:credit'
        : step.tool === 'governed_tokenized_buy'
        ? 'compass:tokenized'
        : null;
    const hasRequiredScope = requiredScope
      ? (scenario.setup.scopes as Record<string, boolean | undefined>)[requiredScope] === true
      : true;
    if (requiredScope && !hasRequiredScope) {
      right(`${prefix}[precheck] scope_step_up: DENY — required '${requiredScope}', no active grant`, 'deny');
      right(`${prefix}[decision] deny (engine NOT invoked)`, 'deny', { reasons });
    } else {
      if (requiredScope) {
        right(`${prefix}[precheck] scope_step_up: pass — '${requiredScope}' grant active (standing)`, 'good');
        await wait(140);
      } else {
        right(`${prefix}[precheck] scope_step_up: not required (action is non-step-up — earn surface)`, 'dim');
        await wait(120);
      }

      // 3. engine checks
      const spendingCheck = checks.find((c) => c.check === 'spending_policy');
      const contractCheck = checks.find((c) => c.check === 'contract_type_allowed');
      const kyaCheck = checks.find((c) => c.check === 'kya_tier');

      const tierLabel = scenario.setup.agent === 'credit' ? 'KYA T2 · $1,000/tx' : 'KYA T1 · $100/tx';
      right(`${prefix}[engine] spending_policy: ${spendingCheck?.result ?? 'pass'} — $${amount || '?'} ${venue.startsWith('equity:') ? 'USDC → ' + venue.replace('equity:', '') : 'USDC'}, within ${tierLabel} cap`, spendingCheck?.result === 'fail' ? 'deny' : 'good');
      await wait(120);
      if (contractCheck) {
        right(`${prefix}[engine] contract_type_allowed: ${contractCheck.result} — ${contractCheck.detail}`, contractCheck.result === 'fail' ? 'deny' : 'good');
        await wait(120);
      }
      if (kyaCheck) {
        right(`${prefix}[engine] kya_tier: ${kyaCheck.result} — ${kyaCheck.detail}`, kyaCheck.result === 'fail' ? 'deny' : 'good');
        await wait(120);
      }
      right(`${prefix}[decision] ${decision}`, decision === 'approve' ? 'good' : 'deny', { reasons });
    }
  }
  await wait(180);

  // 4. audit log
  if (evaluationId) {
    right(`${prefix}[audit] policy_evaluations row inserted (id=${shortId(evaluationId)})`, 'info');
    await wait(120);
    const auditRow = await fetchAuditRow(evaluationId);
    if (auditRow) {
      right(`${prefix}[audit] audit_log row signed — Ed25519 sig=${shortSig(auditRow.signature)}`, 'good', {
        signed_at: auditRow.signed_at,
        action: auditRow.action,
        actor_type: auditRow.actor_type,
      });
      await wait(100);
      right(`${prefix}[audit] anchor=base (pending next Merkle batch)`, 'dim');
    } else {
      right(`${prefix}[audit] audit_log row queued (signature pending)`, 'dim');
    }
  } else if (scenario.setup.agentStatus === 'suspended') {
    right(`${prefix}[audit] audit_log row signed — action=policy.deny.kill_switch`, 'good');
    right(`${prefix}[audit] anchor=base (pending next Merkle batch)`, 'dim');
  } else if (decision === 'deny' && reasons.some((r) => r.startsWith('scope_required:'))) {
    right(`${prefix}[audit] audit_log row signed — action=policy.deny.scope_required`, 'good');
    right(`${prefix}[audit] anchor=base (pending next Merkle batch)`, 'dim');
  }
  await wait(160);

  // 5. The COMPASS CLI invocation — what their team needs to review.
  const cliText = step.buildCli();
  if (decision === 'approve') {
    right(`${prefix}[exec] $ ${cliText}`, 'good', { surface: 'compass-cli' });
    await wait(140);
    // 6. surface-specific outcome
    const tx = parsed?.compass_payload?.transaction ?? parsed?.tx_hash;
    if (parsed?.executed === true && parsed?.tx_hash) {
      right(`${prefix}[compass] ${subcommand} → executed on-chain — tx=${shortTx(parsed.tx_hash)}`, 'good', {
        tx_hash: parsed.tx_hash,
        chain: 'base',
      });
    } else if (parsed?.compass_payload?.transaction) {
      const t = parsed.compass_payload.transaction;
      right(`${prefix}[compass] ${subcommand} → unsigned tx returned (to=${shortAddr(t.to)}, gas=${parseInt(t.gas, 16)})`, 'good', {
        to: t.to,
        from: t.from,
        gas_decimal: parseInt(t.gas ?? '0', 16),
        chainId: t.chainId,
      });
    } else if (parsed?.compass_payload?.eip_712) {
      right(`${prefix}[compass] ${subcommand} → EIP-712 payload returned (sign with owner key, submit via compass)`, 'good', {
        primaryType: parsed.compass_payload.eip_712?.primaryType,
      });
    } else if (parsed?.compass_payload) {
      right(`${prefix}[compass] ${subcommand} → payload returned`, 'good');
    } else if (parsed?.compass?.error) {
      right(`${prefix}[compass] ${subcommand} → CLI returned an error (${String(parsed.compass.error).slice(0, 80)})`, 'warn', parsed.compass);
    }
    void tx;
    right(`${prefix}[bilateral_receipt] evaluation_id=${shortId(evaluationId ?? '?')} ⇄ (tx hash on submit)`, 'good');
    if (!prefix) banner('approve — agent has machine-readable receipt + Compass payload', 'good');
  } else {
    // On deny: surface the CLI that WOULD have run, with "BLOCKED" marker.
    right(`${prefix}[exec-blocked] $ ${cliText}`, 'deny', { surface: 'compass-cli', reason: 'denied by Sly — never reached Compass' });
    if (!prefix) banner(`deny — ${reasons.join(' · ') || 'see right pane'}`, 'deny');
  }
}

function shortId(id: string): string {
  if (!id || id === '?') return '?';
  return id.slice(0, 8) + '…';
}
function shortSig(sig: string | null | undefined): string {
  if (!sig) return '<unsigned>';
  return sig.slice(0, 10) + '…';
}
function shortAddr(addr: string | null | undefined): string {
  if (!addr) return '<unknown>';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}
function shortTx(tx: string | null | undefined): string {
  if (!tx) return '<unknown>';
  return tx.slice(0, 10) + '…' + tx.slice(-6);
}

async function fetchAuditRow(
  evaluationId: string,
): Promise<{ signature: string | null; signed_at: string | null; action: string; actor_type: string } | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const sb = createClient(url, key);
  const { data } = await sb
    .from('audit_log')
    .select('signature, signed_at, action, actor_type')
    .eq('entity_id', evaluationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { signature: string | null; signed_at: string | null; action: string; actor_type: string } | null) ?? null;
}
