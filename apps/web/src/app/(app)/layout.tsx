import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RealtimeProvider } from '@/components/realtime-provider';
import { getServerSession } from "next-auth/next";
import { AuthProvider } from '@/components/auth-provider';
import { CurrencyProvider } from '@/components/currency-provider';
import { SubscriptionProvider } from '@/components/subscription-provider';
import { PaywallBanner } from '@/components/paywall-banner';
import { SupportWidget } from '@/components/support-widget';
import { redirect } from 'next/navigation';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  // If not authenticated, redirect to login
  if (!session?.user?.email) {
    redirect('/login');
  }

  const { prisma } = await import('@/lib/prisma');
  
  let user: any = null;
  let retries = 3;
  while (retries > 0) {
    try {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { subscription: true }
      });
      break;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error("Layout failed to fetch user after retries", err);
        redirect('/login?error=db_timeout');
      }
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  if (!user) {
    redirect('/login');
  }

  const { getTrialGraceStatus, enforceTrialGraceCleanup } = await import('@/lib/trial-grace');
  await enforceTrialGraceCleanup(user.id);
  const trialGrace = getTrialGraceStatus(user);

  const hasActiveSubscription = user.role === 'ADMIN' ||
    user.role === 'OWNER' ||
    trialGrace.canConnectAccounts;

  const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';

  return (
    <CurrencyProvider>
      <AuthProvider session={session}>
        <SubscriptionProvider isActive={hasActiveSubscription} isAdmin={isAdmin} trialGrace={trialGrace}>
          <RealtimeProvider>
            <div className="flex flex-col min-h-screen relative">
              <div className="flex flex-1 relative">
                <Sidebar isAdmin={user.role === 'ADMIN' || user.role === 'OWNER'} />
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 lg:pb-0 relative z-10">
                  <PaywallBanner />
                  <div className="w-full max-w-[1440px] mx-auto flex-1 flex flex-col">
                    {children}
                  </div>
                </main>
                <BottomNav isAdmin={user.role === 'ADMIN' || user.role === 'OWNER'} />
                <SupportWidget />
              </div>
            </div>
          </RealtimeProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </CurrencyProvider>
  );
}
