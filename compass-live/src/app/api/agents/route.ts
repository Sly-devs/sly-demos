/**
 * GET /api/agents
 *
 * Returns the tenant's agents (paginated through every page) annotated
 * with the capability flags the picker needs to gate scenarios:
 *
 *   - hasWallet            : agent has a Sly wallet at all
 *   - walletProvider       : 'coinbase' | 'compass' | 'circle' | …
 *   - walletAddress        : EOA the runner uses for --owner
 *   - hasCompassAllowlist  : wallet's contract policy already contains
 *                            at least one Compass venue (seed marker —
 *                            used to surface "Compass-ready" agents).
 *
 * The Next page proxies through here so the tenant API key never leaves
 * the server. Capabilities are computed once per agent in parallel.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SLY_TENANT_KEY =
  process.env.SLY_DEMO_TENANT_API_KEY || 'pk_test_compass_demo_2026';

const COMPASS_VENUES = new Set([
  'aave-v3-base',
  'morpho-base',
  'aave-credit:WETH',
  'aave-credit:USDC',
  'compass-earn-account',
  'equity:TSLAon',
  'compass:withdraw',
]);

interface AgentDto {
  id: string;
  name: string;
  status: string;
  kyaTier?: number;
  kya_tier?: number;
  description?: string;
}

interface AgentRow {
  id: string;
  name: string;
  status: string;
  kyaTier: number;
  hasWallet: boolean;
  walletProvider: string | null;
  walletAddress: string | null;
  walletType: string | null;
  hasCompassAllowlist: boolean;
  // On-chain gas state — populated by an RPC balanceOf call on the
  // wallet address. Used by the picker to surface "needs gas" badge.
  // Wei as decimal string; null when no wallet or on RPC failure.
  ethBalanceWei: string | null;
  // Compass Safe sidecar — Credit Agent (and any future agent with a
  // Compass-deployed smart wallet) carries a Safe address that holds
  // collateral / borrowed funds. Surfaced so the picker can offer a
  // separate "Fund Safe USDC" CTA when the Safe is bare.
  safeAddress: string | null;
  // USDC balance of the Safe, in micro-USDC (6 decimals). null when
  // no Safe or on RPC failure.
  safeUsdcMicro: string | null;
}

// Threshold below which the picker considers the agent under-gassed and
// surfaces the "Fund agent" CTA. ~0.0003 ETH covers a Morpho deposit on Base.
// (Server-side reference; the actual badge threshold lives in page.tsx so
// it can refresh without a server round-trip.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MIN_GAS_WEI = BigInt('300000000000000');

async function slyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SLY_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${SLY_TENANT_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAllAgents(): Promise<AgentDto[]> {
  const all: AgentDto[] = [];
  const seen = new Set<string>();
  let page = 1;
  while (page < 10) {
    const body = await slyGet<{
      data: AgentDto[];
      pagination?: { totalPages?: number };
    }>(`/v1/agents?page=${page}&limit=100`);
    for (const a of body.data ?? []) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      all.push(a);
    }
    const totalPages = body.pagination?.totalPages ?? 1;
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

async function annotate(a: AgentDto): Promise<AgentRow> {
  const tier = a.kyaTier ?? a.kya_tier ?? 0;
  const base: AgentRow = {
    id: a.id,
    name: a.name,
    status: a.status,
    kyaTier: tier,
    hasWallet: false,
    walletProvider: null,
    walletAddress: null,
    walletType: null,
    hasCompassAllowlist: false,
    ethBalanceWei: null,
    safeAddress: null,
    safeUsdcMicro: null,
  };
  try {
    const w = await slyGet<{
      data: {
        address?: string;
        wallet_address?: string;
        provider?: string;
        wallet_type?: string;
        spending_policy?: {
          contractPolicy?: { allowedContractTypes?: string[] };
        };
        all_wallets?: Array<{
          address?: string;
          wallet_address?: string;
          wallet_type?: string;
          provider?: string;
        }>;
      };
    }>(`/v1/agents/${a.id}/wallet`);
    const d = w.data;
    base.hasWallet = true;
    base.walletProvider = d.provider ?? null;
    base.walletAddress = d.address ?? d.wallet_address ?? null;
    base.walletType = d.wallet_type ?? null;
    const allowed = d.spending_policy?.contractPolicy?.allowedContractTypes ?? [];
    base.hasCompassAllowlist = allowed.some((v) => COMPASS_VENUES.has(v));
    // Find the Compass-deployed Safe sidecar (if any). The primary
    // address is now the EOA after Sly platform PR #160; the Safe lives
    // in all_wallets alongside it for agents that have one.
    const safe = (d.all_wallets ?? []).find(
      (w2) => w2.wallet_type === 'smart_wallet' && w2.provider === 'compass',
    );
    base.safeAddress = safe?.address ?? safe?.wallet_address ?? null;
  } catch {
    // Agent has no wallet — leave flags false.
  }
  return base;
}

/**
 * Batch ETH-balance check for every agent's wallet address. One eth_getBalance
 * RPC per address; we pool 20 in flight at a time so a 658-agent tenant
 * doesn't get rate-limited by the public Base RPC.
 */
async function annotateEthBalances(rows: AgentRow[]): Promise<void> {
  const RPC_URL = 'https://mainnet.base.org';
  const targets = rows.filter((r) => r.walletAddress);
  for (let i = 0; i < targets.length; i += 20) {
    const batch = targets.slice(i, i + 20);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const res = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_getBalance',
              params: [row.walletAddress, 'latest'],
            }),
          });
          const body = (await res.json()) as { result?: string };
          if (body.result) {
            row.ethBalanceWei = BigInt(body.result).toString();
          }
        } catch {
          // Leave ethBalanceWei null on RPC failure — the picker
          // surfaces it as "unknown" rather than blocking.
        }
      }),
    );
  }
}

/**
 * Probe USDC balance of each agent's Compass Safe via balanceOf on the
 * Circle USDC contract on Base. Same 20-in-flight batching as the ETH
 * balance probe. Only agents with a safeAddress are touched.
 */
async function annotateSafeUsdcBalances(rows: AgentRow[]): Promise<void> {
  const RPC_URL = 'https://mainnet.base.org';
  const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
  // balanceOf(address) selector + 32-byte padded address.
  const balanceOfData = (addr: string) =>
    `0x70a08231000000000000000000000000${addr.slice(2).toLowerCase()}`;
  const targets = rows.filter((r) => r.safeAddress);
  for (let i = 0; i < targets.length; i += 20) {
    const batch = targets.slice(i, i + 20);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const res = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_call',
              params: [
                { to: USDC_BASE, data: balanceOfData(row.safeAddress as string) },
                'latest',
              ],
            }),
          });
          const body = (await res.json()) as { result?: string };
          if (body.result) {
            row.safeUsdcMicro = BigInt(body.result).toString();
          }
        } catch {
          // Leave safeUsdcMicro null on RPC failure.
        }
      }),
    );
  }
}

export async function GET() {
  try {
    const agents = await fetchAllAgents();
    // Annotate in parallel but bounded — 25 concurrent wallet fetches.
    const rows: AgentRow[] = [];
    for (let i = 0; i < agents.length; i += 25) {
      const batch = agents.slice(i, i + 25);
      const out = await Promise.all(batch.map(annotate));
      rows.push(...out);
    }
    // Sort: Compass-ready active agents first, then active+wallet, then the rest.
    rows.sort((a, b) => {
      const score = (r: AgentRow) =>
        (r.hasCompassAllowlist ? 4 : 0) +
        (r.hasWallet ? 2 : 0) +
        (r.status === 'active' ? 1 : 0);
      return score(b) - score(a) || a.name.localeCompare(b.name);
    });
    // ETH + Safe USDC balances for the visible top of the list. Cap at 50
    // — full-tenant probing is wasted bandwidth when the picker only shows
    // a handful by default. Partners scrolling further will see balances
    // load when they re-fetch.
    const visible = rows.slice(0, 50);
    await Promise.all([
      annotateEthBalances(visible),
      annotateSafeUsdcBalances(visible),
    ]);
    return NextResponse.json({ agents: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
