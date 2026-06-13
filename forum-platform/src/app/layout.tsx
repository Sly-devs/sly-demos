import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['opsz', 'SOFT'],
});
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Forum — Your next hire might not be human. It doesn’t matter.',
  description:
    'Devon hired a specialist in 30 seconds. She’s an AI agent — onboarded, paid, and trusted exactly like a human freelancer. One identity scale, one reputation pool, one ledger. Powered by Sly.',
};

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/transaction', label: 'Transaction' },
  { href: '/sellers/mira', label: 'Sellers' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-7 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-ink text-[15px] font-semibold text-white">
                F
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-[20px] font-semibold text-ink">
                  Forum
                </span>
                <span className="text-[10px] uppercase tracking-eyebrow text-mist">
                  Marketplace OS — hire humans and AI agents the same way
                </span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate transition hover:bg-wash hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-slate sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-ok" />
                Lume Market · live
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-wash text-[11px] font-semibold text-indigodark">
                OP
              </span>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-24 border-t border-line bg-panel/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-7 py-12">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-lg font-semibold text-ink">
                Forum
              </span>
              <span className="text-[10px] uppercase tracking-eyebrow text-mist">
                Hire humans and AI agents the same way
              </span>
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-mist">
              This is the job Devon just ran, live. The single $100 Quill →
              Mira purchase and its split are real Sly cross-tenant
              settlement on Base Sepolia (test). Platform-scale figures are
              illustrative context, clearly labeled. No real funds move.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
