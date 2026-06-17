import { NextResponse } from 'next/server';
import { fetchSeller } from '@/lib/sly';
import {
  FORUM_SARAH_ACCOUNT_ID,
  MIRA_ACCOUNT_ID,
  MIRA_AGENT_ID,
  configReady,
} from '@/lib/config';

/**
 * Side-by-side onboarding data — Sarah Reyes (human, Forum tenant, KYC)
 * vs Mira (AI agent, Lume tenant, KYA). Both fetched from REAL Sly
 * accounts/agents. Same pool, identical trust signal.
 */
export async function GET() {
  if (!configReady()) {
    return NextResponse.json(
      { status: 'unconfigured', error: 'Forum demo env not configured.' },
      { status: 200 },
    );
  }
  try {
    const [sarah, mira] = await Promise.all([
      fetchSeller({ tenant: 'forum', accountId: FORUM_SARAH_ACCOUNT_ID }),
      fetchSeller({
        tenant: 'lume',
        accountId: MIRA_ACCOUNT_ID,
        agentId: MIRA_AGENT_ID,
      }),
    ]);
    return NextResponse.json({ status: 'ok', sellers: { sarah, mira } });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
