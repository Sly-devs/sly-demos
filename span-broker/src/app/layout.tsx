import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Span — Cross-ecosystem trust & settlement broker',
  description:
    'Watch Sly broker identity, policy, and settlement live between a Claude-side buyer agent and a ChatGPT-side merchant.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-span-bg font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
