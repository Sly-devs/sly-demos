import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Nest — your block, governed by Sly', description: 'Nest turns the neighborhood into an A2A mesh. Borrow a drill, lend a hand, share a meal.' };
export const viewport: Viewport = { themeColor: '#fbf6ec' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
