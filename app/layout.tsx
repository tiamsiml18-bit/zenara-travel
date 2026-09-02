import type { Metadata } from 'next';
import { Fraunces, Inter, IBM_Plex_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme/theme-provider';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600'],
  display: 'swap',
});
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Zenara Travel and Tours',
  description: 'Quotation, client, and follow-up management for Zenara Travel and Tours.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="font-sans">
        {/* attribute="class" toggles the same .dark class globals.css's CSS
            variables key off of. defaultTheme="light" keeps light mode as
            the unchanged default for anyone who's never chosen — only an
            explicit toggle click ever switches someone to dark, and
            next-themes persists that choice (localStorage) and re-applies
            it before paint on return visits, so there's no flash of the
            wrong theme. */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
