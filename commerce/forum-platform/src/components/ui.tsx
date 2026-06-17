import Link from 'next/link';
import type { ReactNode } from 'react';

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-indigo">
      {children}
    </span>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl2 border border-line bg-panel shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: 'human' | 'agent' | 'indigo' | 'ok';
}) {
  const dot =
    accent === 'human'
      ? 'bg-human'
      : accent === 'agent'
        ? 'bg-agent'
        : accent === 'ok'
          ? 'bg-ok'
          : 'bg-indigo';
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-mist">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-display text-[28px] font-semibold leading-none tabular text-ink">
        {value}
      </span>
      {sub ? <span className="text-xs text-slate">{sub}</span> : null}
    </div>
  );
}

export function IdentityBadge({
  scheme,
  tier,
}: {
  scheme: 'KYC' | 'KYA';
  tier: number;
}) {
  const isHuman = scheme === 'KYC';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        isHuman
          ? 'bg-human/10 text-human'
          : 'bg-agent/10 text-agent'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isHuman ? 'bg-human' : 'bg-agent'}`}
      />
      {scheme} · Tier {tier}
    </span>
  );
}

export function KindPill({ kind }: { kind: 'human' | 'agent' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        kind === 'human'
          ? 'border-human/30 bg-human/5 text-human'
          : 'border-agent/30 bg-agent/5 text-agent'
      }`}
    >
      {kind === 'human' ? 'Human seller' : 'AI-agent seller'}
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-gold">
      <span aria-hidden className="text-[13px]">
        {'★'.repeat(Math.round(value))}
        <span className="text-line">
          {'★'.repeat(5 - Math.round(value))}
        </span>
      </span>
      <span className="font-mono text-[12px] font-medium text-ink">
        {value.toFixed(1)}
      </span>
    </span>
  );
}

export function ProtocolTag({ p }: { p: string }) {
  const map: Record<string, string> = {
    ACP: 'bg-indigo/10 text-indigo',
    AP2: 'bg-agent/10 text-agent',
    A2A: 'bg-human/10 text-human',
    MPP: 'bg-ink/8 text-ink',
    x402: 'bg-indigo/10 text-indigo',
    split: 'bg-ink/8 text-ink',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${
        map[p] ?? 'bg-line text-slate'
      }`}
    >
      {p}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="max-w-3xl font-display text-[34px] font-semibold leading-[1.12] text-ink sm:text-[42px]">
        {title}
      </h1>
      <p className="max-w-2xl text-[15px] leading-relaxed text-slate">
        {sub}
      </p>
    </div>
  );
}

export function CrumbLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate transition hover:text-indigo"
    >
      ← {children}
    </Link>
  );
}

export function MoneyChip({
  amount,
  tone = 'neutral',
}: {
  amount: number;
  tone?: 'net' | 'fee' | 'tax' | 'gross' | 'neutral';
}) {
  const toneCls: Record<string, string> = {
    net: 'bg-ok/10 text-ok',
    fee: 'bg-indigo/10 text-indigo',
    tax: 'bg-gold/10 text-gold',
    gross: 'bg-ink text-white',
    neutral: 'bg-wash text-indigodark',
  };
  return (
    <span
      className={`rounded-lg px-2.5 py-1 font-mono text-[13px] font-semibold tabular ${toneCls[tone]}`}
    >
      ${amount.toFixed(2)}
    </span>
  );
}
