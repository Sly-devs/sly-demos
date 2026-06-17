import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bouquet — agentic gifting wallet',
  description:
    'Bouquet is a consumer gifting wallet where your agent picks a present within an envelope and settles via ACP. Demo for the Sly platform.',
};

export const viewport: Viewport = {
  themeColor: '#070a12',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
