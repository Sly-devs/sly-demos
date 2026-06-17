import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quartz — self-driving crypto portfolio',
  description:
    'Quartz is a policy-bounded autopilot for crypto portfolios. Every trade is gated by Sly before it fires. Demo for the Sly platform.',
};

export const viewport: Viewport = {
  themeColor: '#fbfcfd',
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
