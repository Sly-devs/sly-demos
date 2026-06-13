import { NextResponse } from 'next/server';
import { asterClient, fetchMerchants } from '@/lib/sly';
import {
  AGENTS,
  evaluatePolicy,
  fraudScore,
  generateSyntheticVolume,
  getMerchantByName,
  type FeedResponse,
  type FeedTx,
  type TxStatus,
} from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Raw ACP checkout row from GET /v1/acp/checkouts. */
interface SlyCheckout {
  id: string;
  checkout_id: string;
  agent_id: string;
  agent_name: string | null;
  merchant_id: string;
  merchant_name: string | null;
  total_amount: number;
  currency: string;
  status: string;
  transfer_id: string | null;
  created_at: string;
}

/**
 * Operator transaction feed.
 *
 * REAL: GET /v1/acp/checkouts via the Aster operator key — these are genuine
 * Sly ACP checkouts (the headline row is Velo's completed $87 Lume Goods
 * order). SYNTHETIC: a clearly-flagged volume backfill so the table reflects
 * that Aster serves many merchants. Synthetic rows never hit the ledger.
 */
export async function GET() {
  let realTxs: FeedTx[] = [];
  let source: FeedResponse['source'] = 'mock';

  // Live merchant directory (so policy verdicts use current Sly policy).
  const { merchants } = await fetchMerchants();

  try {
    const client = asterClient();
    const checkouts = await client.apiGet<SlyCheckout[]>(
      '/v1/acp/checkouts?limit=40',
    );

    if (Array.isArray(checkouts) && checkouts.length > 0) {
      source = 'sly-api';
      realTxs = checkouts.map((c): FeedTx => {
        const merchant = getMerchantByName(c.merchant_name ?? undefined);
        const agent = AGENTS[c.agent_id] ?? {
          name: c.agent_name ?? 'Buyer agent',
          kya: 1 as const,
          reputation: 3.5,
          crossTenantTx: 0,
        };
        const policy =
          merchant?.policy ?? {
            minKyaTier: 1 as const,
            minReputation: 3.5,
            minCrossTenantTx: 1,
          };
        const verdict = evaluatePolicy(policy, agent);
        const fs = fraudScore(agent);

        let status: TxStatus;
        if (c.status === 'completed') status = 'completed';
        else if (c.status === 'failed' || c.status === 'cancelled')
          status = 'blocked';
        else if (!verdict.pass || fs >= 55) status = 'review';
        else status = 'completed';

        return {
          id: c.id,
          at: c.created_at,
          merchant: c.merchant_name ?? merchant?.name ?? 'Unknown merchant',
          merchantId: merchant?.id ?? c.merchant_id,
          agent: agent.name,
          agentId: c.agent_id,
          kyaTier: agent.kya,
          reputation: agent.reputation,
          crossTenantTx: agent.crossTenantTx,
          fraudScore: fs,
          amountCents: Math.round((c.total_amount ?? 0) * 100),
          currency: c.currency ?? 'USDC',
          status,
          verdict,
          auditAnchor: `0x${(c.transfer_id ?? c.id ?? '')
            .replace(/-/g, '')
            .slice(0, 12) || '000000000000'}`,
          synthetic: false,
        };
      });
    }
  } catch {
    // Sly API unreachable — feed degrades to synthetic-only so the demo
    // still renders, but `source` stays 'mock' so the UI is honest.
  }

  const synthetic = generateSyntheticVolume(
    merchants,
    26,
    Math.floor(Date.now() / 60000),
  );

  // Real rows always sit on top; synthetic backfill is time-ordered below.
  const transactions = [
    ...realTxs.sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    ...synthetic,
  ];

  const body: FeedResponse = {
    source,
    generatedAt: new Date().toISOString(),
    realCount: realTxs.length,
    syntheticCount: synthetic.length,
    transactions,
  };
  return NextResponse.json(body);
}
