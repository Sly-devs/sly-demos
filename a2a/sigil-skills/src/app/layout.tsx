import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Sigil — A2A skill rental on Sly', description: 'Sigil lets one agent grant a specific skill to another, time-bounded, with auto-revoke at expiry.' };
export const viewport: Viewport = { themeColor: '#06070d' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
