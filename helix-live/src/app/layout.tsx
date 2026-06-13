import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Helix — live agentic marketplace',
  description:
    'A marketplace stands up x402 · UCP · ACP · A2A rails on Sly, agents arrive, volume climbs — live.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="helix-grid min-h-screen">{children}</body>
    </html>
  );
}
