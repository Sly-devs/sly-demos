import { NextResponse } from 'next/server';
import {
  BORROW,
  BORROW_PURPOSE,
  borrowIntent,
  mayaEnv,
  slyPost,
  type PolicyDeny,
  type ScopeRequestResult,
} from '@/lib/maya-flow';

/**
 * Steps 1–2 of the proven Compass-credit handshake (FREE — no broadcast):
 *   1. agent evaluates `credit:borrow` with no grant → Sly returns 403 deny
 *      with reason `scope_required:compass:credit`.
 *   2. agent requests the `compass:credit` scope (one_shot) → { request_id }.
 *
 * Returns a PENDING approval. The savings surface then shows Maya the real
 * scope request; /api/maya/approve finishes it (steps 3–6, which DO broadcast).
 */
export async function POST() {
  const env = mayaEnv();
  if ('error' in env) {
    return NextResponse.json({ phase: 'error', error: env.error }, { status: 500 });
  }

  try {
    // Step 1 — evaluate with no grant. We EXPECT a 403 deny here.
    const evaluated = await slyPost<unknown>(env, '/v1/policy/evaluate-intent', {
      token: env.agentToken,
      body: borrowIntent(env),
    });

    if (evaluated.ok) {
      // Already granted (e.g. a standing grant exists). Surface that the deny
      // didn't fire rather than silently proceeding — keeps the demo honest.
      return NextResponse.json(
        {
          phase: 'error',
          error:
            'Expected a scope_required deny on first evaluation, but the agent was already authorized. Revoke the existing compass:credit grant to replay the just-in-time approval story.',
        },
        { status: 409 },
      );
    }

    const deny = evaluated.raw as PolicyDeny;
    const denyReason =
      deny?.reasons?.find((r) => r.startsWith('scope_required')) ??
      deny?.reasons?.[0] ??
      'scope_required:compass:credit';

    // Step 2 — agent requests the compass:credit scope (one_shot).
    const scope = await slyPost<ScopeRequestResult>(env, '/v1/auth/scopes/request', {
      token: env.agentToken,
      body: {
        scope: BORROW.scope,
        lifecycle: 'one_shot',
        purpose: BORROW_PURPOSE,
      },
    });
    if (!scope.ok) {
      return NextResponse.json(
        {
          phase: 'error',
          error:
            (scope.raw as { error?: string })?.error ??
            `scope request failed → ${scope.status}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      phase: 'awaiting_approval',
      requestId: scope.data.request_id,
      amount: BORROW.amount,
      asset: BORROW.asset,
      scope: BORROW.scope,
      purpose: BORROW_PURPOSE,
      events: [
        {
          kind: 'intent.evaluated',
          label: `Sly denied — ${denyReason}`,
        },
        {
          kind: 'scope.requested',
          label: 'Agent requested compass:credit — awaiting your approval',
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { phase: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
