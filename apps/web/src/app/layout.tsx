import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RealtimeProvider } from '@/components/realtime-provider';
import { getServerSession } from "next-auth/next";
import { AuthProvider } from '@/components/auth-provider';
import { PwaProvider } from '@/components/pwa-provider';
import { PwaIosPrompt } from '@/components/pwa-ios-prompt';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { ThemeProvider } from '@/components/theme-provider';
import { CurrencyProvider } from '@/components/currency-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Trade Copier | SaaS Dashboard',
  description: 'Professional fintech trade copying and risk management platform.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Plaiz Markets App',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased relative overflow-x-hidden`}>
        
        {/* Subtle environment lighting is handled purely by the background CSS variables */}

        <div className="relative z-10 flex flex-col min-h-screen">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <PwaProvider>
              <CurrencyProvider>
                <AuthProvider session={session}>
                  <RealtimeProvider>
                    <div className="flex flex-col min-h-screen relative">
                      <PwaInstallBanner />
                      <div className="flex flex-1 relative">
                        <Sidebar />
                        <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 lg:pb-0 relative z-10">
                          <div className="w-full max-w-[1440px] mx-auto flex-1 flex flex-col">
                            {children}
                          </div>
                        </main>
                        <BottomNav />
                      </div>
                    </div>
                    <PwaIosPrompt />
                  </RealtimeProvider>
                </AuthProvider>
              </CurrencyProvider>
            </PwaProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
