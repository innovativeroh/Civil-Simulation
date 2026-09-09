import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Earthquake Resistant Infrastructure',
  description:
    'Live Arduino sensor comparison between a building with and without a damper, plus recorded readings by earthquake magnitude.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
