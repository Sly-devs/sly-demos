import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Echo — sell your attention on Sly', description: 'Echo turns your attention into an asset. Brands offer x402 micropays — your agent decides what to accept.' };
export const viewport: Viewport = { themeColor: '#f7faf9' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
