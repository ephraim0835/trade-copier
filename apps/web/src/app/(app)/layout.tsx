import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RealtimeProvider } from '@/components/realtime-provider';
import { getServerSession } from "next-auth/next";
import { AuthProvider } from '@/components/auth-provider';
import { CurrencyProvider } from '@/components/currency-provider';
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
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { subscription: true }
  });

  if (!user) {
    redirect('/login');
  }

  // Admin bypasses subscription check
  if (user.role !== 'ADMIN') {
    const validStatuses = ['ACTIVE', 'TRIAL', 'INTERNAL_FREE'];
    if (!user.subscription || !validStatuses.includes(user.subscription.status)) {
      redirect('/pricing');
    }
  }

  return (
    <CurrencyProvider>
      <AuthProvider session={session}>
        <RealtimeProvider>
          <div className="flex flex-col min-h-screen relative">
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
        </RealtimeProvider>
      </AuthProvider>
    </CurrencyProvider>
  );
}
