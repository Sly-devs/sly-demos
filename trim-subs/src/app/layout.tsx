import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Trim — subscription autopilot on Sly', description: 'Trim watches your recurring charges, surfaces dupes & unused subs, and cancels them with one tap.' };
export const viewport: Viewport = { themeColor: '#f6f8fc' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
