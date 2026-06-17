import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const serif = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  axes: ['opsz', 'SOFT'],
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lume Goods — Warm things for the home',
  description:
    'A small, editorial catalog of lighting, textiles, and ceramics. Agent checkout enabled.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="lume-grain min-h-screen antialiased">
        <header className="sticky top-0 z-30 border-b border-umber/10 bg-cream/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="font-display text-[26px] font-medium tracking-tight">
                Lume
              </span>
              <span className="text-[10px] uppercase tracking-editorial text-sage">
                Goods
              </span>
            </Link>
            <nav className="hidden gap-9 text-[13px] text-umber/55 sm:flex">
              {['Lighting', 'Textiles', 'Ceramics', 'Kitchen'].map((c) => (
                <span
                  key={c}
                  className="cursor-default border-b border-transparent pb-0.5 transition hover:border-gilt/60 hover:text-umber"
                >
                  {c}
                </span>
              ))}
            </nav>
            <span className="flex items-center gap-2 rounded-full border border-gilt/45 bg-parch/60 px-3.5 py-1.5 text-[10px] uppercase tracking-widest text-sage">
              <span className="h-1.5 w-1.5 rounded-full bg-terra/80" />
              Agent checkout
            </span>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-28 border-t border-umber/10 bg-parch/40">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-8 py-14">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-xl text-umber">
                Lume Goods
              </span>
              <span className="text-[10px] uppercase tracking-editorial text-sage">
                Issue No. 14
              </span>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-sage">
              A demo storefront on the Aster commerce platform, settled through
              Sly. No real orders are fulfilled.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
