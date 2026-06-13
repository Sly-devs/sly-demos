import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crate — Considered goods',
  description: 'A small catalog of well-made things. Agent checkout enabled.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-cream"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-ink/[0.07] bg-cream/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <a
              href="/"
              className="flex items-center gap-2.5 text-[19px] font-semibold tracking-tight"
              aria-label="Crate home"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-cream"
                aria-hidden
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 7.5 12 3l9 4.5M3 7.5v9L12 21m-9-13.5L12 12m9-4.5v9L12 21m9-13.5L12 12m0 9V12"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Crate
            </a>
            <span className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55 shadow-soft">
              <span
                className="h-1.5 w-1.5 rounded-full bg-moss"
                aria-hidden
              />
              Agent checkout enabled
            </span>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
          {children}
        </main>
        <footer className="border-t border-ink/[0.07]">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-10 text-xs text-ink/40 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Crate — considered goods.</span>
            <span>
              Demo storefront for the Sly platform. No real orders are
              fulfilled.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
