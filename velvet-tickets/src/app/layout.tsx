import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Velvet — KYA-gated scarce drops on Sly', description: 'Velvet runs ticket drops as KYA-verified queues. No scalper bots, no fake fans, no fake queues.' };
export const viewport: Viewport = { themeColor: '#0c0414' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
