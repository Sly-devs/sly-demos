import { PageHeader, CrumbLink, ProtocolTag, Card } from '@/components/ui';
import { RunCheckout } from './run-checkout';
import {
  GROSS,
  MIRA_NET,
  FEE_AMOUNT,
  PLATFORM_FEE_PCT,
  TAX_AMOUNT,
  TAX_PCT,
} from '@/lib/config';

export const dynamic = 'force-dynamic';

const CHAIN = [
  { p: 'A2A', t: 'Quill hires Mira', d: 'Cross-tenant A2A task: Forum buyer agent → Lume agent seller' },
  { p: 'AP2', t: 'Spend mandate + scope', d: 'One-shot spend scope, owner-approved' },
  { p: 'x402', t: 'Per-call settlement', d: 'Quill pays Mira’s $100 service endpoint (x402)' },
  { p: 'split', t: 'Forum split', d: 'Lume 10% fee + 8% tax via real ledger transfers' },
];

export default function TransactionPage() {
  return (
    <div className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-3">
        <CrumbLink href="/">Operator console</CrumbLink>
      </div>
      <PageHeader
        eyebrow="Single transaction · split engine"
        title="Devon’s agent hires Mira for $100."
        sub="Devon picks the AI-agent seller Mira for the month-end invoice run. Quill — Devon’s buyer agent in the Forum tenant — opens a cross-tenant A2A task hiring Mira, then settles her $100 service per-call over x402. No invoice is sent, no human approves the payment: Forum’s split engine carves Lume’s 10% fee and 8% tax via real Sly transfers — and the ledger reconciles itself."
      />

      <Card className="mt-8 mb-8 grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
        {CHAIN.map((c) => (
          <div key={c.p} className="flex flex-col gap-2">
            <ProtocolTag p={c.p} />
            <span className="text-[13px] font-semibold text-ink">{c.t}</span>
            <span className="text-[11px] leading-relaxed text-mist">
              {c.d}
            </span>
          </div>
        ))}
      </Card>

      <RunCheckout
        gross={GROSS}
        miraNet={MIRA_NET}
        fee={FEE_AMOUNT}
        feePct={PLATFORM_FEE_PCT}
        tax={TAX_AMOUNT}
        taxPct={TAX_PCT}
      />

      <p className="mt-8 max-w-3xl text-[12px] leading-relaxed text-mist">
        A week of month-end reconciliation collapses into one move that
        books itself. The purchase uses a fixed checkout id and idempotency
        keys, so re-running reconciles to the same single real transaction
        rather than charging again. Internal USDC transfers execute
        synchronously
        on the Sly ledger; the seller-account balance is the authoritative
        net. If the dedicated on-chain payout wallet lags, the verified
        panel shows the real numbers as the API reports them.
      </p>
    </div>
  );
}
