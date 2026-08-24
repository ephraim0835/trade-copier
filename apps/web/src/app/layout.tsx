import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PwaProvider } from '@/components/pwa-provider';
import { PwaIosPrompt } from '@/components/pwa-ios-prompt';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Plaiz Markets | Professional Trade Copying',
  description: 'Premium fintech trade copying and risk management platform for professional traders.',
  keywords: ['trade copier', 'forex', 'prop firm', 'risk management', 'metatrader', 'mt5', 'automated trading'],
  authors: [{ name: 'Plaiz Markets' }],
  openGraph: {
    title: 'Plaiz Markets | Professional Trade Copying',
    description: 'Lightning fast, ultra-reliable trade copying across MetaTrader accounts.',
    url: 'https://plaiz-markets.online',
    siteName: 'Plaiz Markets',
    images: [
      {
        url: '/plaiz-logo.png',
        width: 800,
        height: 600,
        alt: 'Plaiz Markets Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Plaiz Markets',
    description: 'Professional trade copying and risk management.',
    images: ['/plaiz-logo.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Plaiz Markets',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased relative overflow-x-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <PwaProvider>
            {/* The rest of the app content will be injected here */}
            {children}
            <PwaInstallBanner />
            <PwaIosPrompt />
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
