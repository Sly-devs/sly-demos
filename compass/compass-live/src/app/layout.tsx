import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sly × Compass — live governance demo',
  description: 'Side-by-side view of agent intent vs. platform-side policy decisions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-ink">
      <body className="bg-ink text-slate-100 antialiased">{children}</body>
    </html>
  );
}
