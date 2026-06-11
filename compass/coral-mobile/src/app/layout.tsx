import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coral — your agentic wallet',
  description:
    'Coral is a consumer wallet where your shopping agent finds, vets, and settles purchases in stablecoin. Demo for the Sly platform.',
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
