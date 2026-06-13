import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Loom — peer compute market',
  description:
    'Loom is a peer compute market where AI agents rent metered resources from each other over x402. Demo for the Sly platform.',
};

export const viewport: Viewport = {
  themeColor: '#0c0f14',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="grid-bg min-h-screen antialiased">{children}</body>
    </html>
  );
}
