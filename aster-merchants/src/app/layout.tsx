import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aster — Operator Console',
  description:
    'Aster commerce-platform operator dashboard. Every agentic checkout wrapped by Sly: KYA, policy, fraud, audit.',
};

const NAV: { label: string; href?: string; active?: boolean }[] = [
  { label: 'Overview', href: '/', active: true },
  { label: 'Transactions' },
  { label: 'Merchants' },
  { label: 'Agents' },
  { label: 'Audit log' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-panel/70 px-5 py-6 backdrop-blur lg:flex">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dim text-sm font-bold text-white shadow-glow">
                A
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[15px] font-semibold tracking-tight">
                  Aster
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-wider text-faint">
                  Operator Console
                </span>
              </span>
            </Link>

            <nav className="mt-9 flex flex-col gap-0.5 text-sm">
              {NAV.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={item.active ? 'page' : undefined}
                    className="flex items-center gap-2.5 rounded-md bg-raised px-3 py-2 font-medium text-ink ring-1 ring-line"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                    {item.label}
                  </Link>
                ) : (
                  <span
                    key={item.label}
                    className="flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-mute transition hover:bg-raised/50 hover:text-ink"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-line" />
                    {item.label}
                  </span>
                )
              )}
            </nav>

            <div className="mt-auto rounded-lg border border-line bg-gradient-to-br from-raised to-panel p-4 text-[11px] leading-relaxed text-faint">
              <span className="flex items-center gap-1.5 font-medium text-mute">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Wrapped by Sly
              </span>
              <p className="mt-1.5">
                KYA · policy · fraud · audit on every ACP checkout.
              </p>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-base/80 px-8 py-3.5 backdrop-blur-md">
              <div className="flex items-center gap-3 lg:hidden">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand to-brand-dim text-sm font-bold text-white">
                  A
                </span>
                <span className="font-semibold">Aster</span>
              </div>
              <div className="ml-auto flex items-center gap-5 text-xs text-mute">
                <span className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
                  Settlement online
                </span>
                <span className="hidden items-center gap-2 sm:flex">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-raised text-[10px] font-medium text-mute">
                    OP
                  </span>
                  operator@aster-demo.app
                </span>
              </div>
            </header>
            <div className="flex-1">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
