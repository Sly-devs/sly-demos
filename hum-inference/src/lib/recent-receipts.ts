/**
 * Tiny in-memory ring buffer of the last N real x402 receipts that landed
 * via /api/x402-inference. Powers the live "real calls" feed on the phone
 * UI — anything that hits the paid endpoint pushes here.
 *
 * Process-local (dev-only). For multi-instance production you'd back this
 * with Redis or the Sly ledger.
 */

export interface RecentReceipt {
  id: string;                    // unique id (random hex)
  ts: string;                    // ISO timestamp
  payer: string;                 // buyer EVM address
  payerShort: string;            // "0x9f60…9c18"
  payeeShort: string;            // "0x36EE…574E"
  paidMicroUsdc: number;         // what the buyer paid (µUSDC)
  paidUsdc: string;              // "0.001000"
  network: string;               // "base-sepolia" | "base"
  model: string;                 // requestedModel
  provider: 'local' | 'cloud';
  promptPreview: string;         // first 120 chars
  outputPreview: string;         // first 120 chars
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  onChain: boolean;
  settlementTxHash: string | null;
  facilitator: string;           // 'internal' | 'cdp' | URL
  slyTransferId: string | null;
  marginPct: number;
}

const MAX = 50;
const buffer: RecentReceipt[] = [];

export function pushReceipt(r: Omit<RecentReceipt, 'id' | 'ts'>): RecentReceipt {
  const id = 'r' + Math.floor((Date.now() % 1e9)).toString(36) + Math.random().toString(36).slice(2, 6);
  const entry: RecentReceipt = { id, ts: new Date().toISOString(), ...r };
  buffer.unshift(entry);
  if (buffer.length > MAX) buffer.length = MAX;
  return entry;
}

export function listReceipts(since?: string): RecentReceipt[] {
  if (!since) return buffer.slice();
  return buffer.filter((r) => r.ts > since);
}

export function clearReceipts(): void {
  buffer.length = 0;
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}
