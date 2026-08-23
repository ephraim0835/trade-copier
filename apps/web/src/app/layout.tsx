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
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Trade Copier | SaaS Dashboard',
  description: 'Professional fintech trade copying and risk management platform.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Plaiz Copier',
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
        
        {/* Ambient Lighting Background Layer */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Top Left Primary Glow */}
          <div className="ambient-glow-primary w-[60vw] h-[60vw] min-w-[600px] min-h-[600px] -top-[20%] -left-[10%]" />
          {/* Bottom Right Cyan Glow */}
          <div className="ambient-glow-accent w-[50vw] h-[50vw] min-w-[500px] min-h-[500px] -bottom-[10%] -right-[5%]" />
        </div>

        <div className="relative z-10 flex flex-col min-h-screen">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <PwaProvider>
              <AuthProvider session={session}>
                {session ? (
                  <RealtimeProvider>
                    <div className="flex min-h-screen relative">
                      <Sidebar />
                      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 lg:pb-0 relative z-10">
                        <div className="w-full max-w-[1440px] mx-auto flex-1 flex flex-col">
                          {children}
                        </div>
                      </main>
                      <BottomNav />
                    </div>
                    <PwaIosPrompt />
                  </RealtimeProvider>
                ) : (
                  <main className="flex-1 min-h-screen bg-background/50 backdrop-blur-sm relative z-10">
                    {children}
                    <PwaIosPrompt />
                  </main>
                )}
              </AuthProvider>
            </PwaProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
