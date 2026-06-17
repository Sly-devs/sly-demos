import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Mint — agent-run micro-business on Sly', description: 'Mint is an autonomous code-review shop run entirely by an agent. P&L, dividends, all on Sly.' };
export const viewport: Viewport = { themeColor: '#0c1419' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
