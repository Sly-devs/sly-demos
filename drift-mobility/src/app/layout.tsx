import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Drift — mobility micropay wallet',
  description: 'Drift is a mobility wallet: one Sly-governed account that pays parking, tolls, and charging across providers via x402.',
};
export const viewport: Viewport = { themeColor: '#06121f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
