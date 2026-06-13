import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Anvil — reverse marketplace on Sly', description: 'Anvil flips the marketplace. You post an intent; KYA-bonded seller agents bid.' };
export const viewport: Viewport = { themeColor: '#0a0d12' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
