import { Settings, Globe, Moon } from 'lucide-react';
import { SettingsControls } from './settings-controls';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const session = await getServerSession();
  
  if (!session?.user?.email) {
    redirect('/login');
  }

  const { prisma } = await import('@/lib/prisma');
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { subscription: true }
  });

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-12 flex flex-col gap-10 pb-32 overflow-y-auto custom-scrollbar relative">
      <header className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground text-[13px] tracking-wide mt-2">
            Global preferences, subscription plan, themes, and application configuration.
          </p>
        </div>
      </header>

      <div className="relative z-10 max-w-3xl">
        <section className="plaiz-card bg-secondary/30 p-8 rounded-[24px]">
          <SettingsControls 
            email={session.user.email} 
            subscription={user?.subscription ? {
              status: user.subscription.status,
              planId: user.subscription.planId,
              currentPeriodEnd: user.subscription.currentPeriodEnd ? user.subscription.currentPeriodEnd.toISOString() : null,
              flutterwaveTxRef: user.subscription.flutterwaveTxRef,
            } : null}
            role={user?.role || 'USER'}
          />
        </section>
      </div>
    </div>
  );
}
