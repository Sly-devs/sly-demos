import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Pocket — in-game wallet on Sly', description: 'Pocket gives kids real wallets — and parents real guardrails. KYA tiers, mandate caps, A2A skin trades.' };
export const viewport: Viewport = { themeColor: '#0a0223' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
