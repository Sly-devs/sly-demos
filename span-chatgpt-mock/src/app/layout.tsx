import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Outpost Outdoors GPT',
  description:
    'Shop Outpost Outdoors gear inside ChatGPT. Agent checkout brokered by Sly.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden bg-cgpt-bg font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
