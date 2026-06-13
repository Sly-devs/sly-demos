import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Hum — sell spare inference from your phone', description: 'Hum turns your phone into a data center. Buyer agents pay per-call via x402; payouts land in your on-device wallet.' };
export const viewport: Viewport = { themeColor: '#040d0a' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
