import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Barter — A2A haggling market on Sly', description: 'Barter is an agent-to-agent marketplace where Sly governs every offer, counter, and settle.' };
export const viewport: Viewport = { themeColor: '#fcf7ef' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
