import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aster — creator tipping on Sly',
  description:
    'Aster is an agent-driven creator tipping app. Reputation-gated, per-tip x402 micropayments, signed receipts. Demo for the Sly platform.',
};

export const viewport: Viewport = { themeColor: '#15101c' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
