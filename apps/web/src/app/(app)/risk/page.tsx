import { ShieldAlert, Users, SlidersHorizontal, Info } from 'lucide-react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { RiskControls } from './risk-controls';
import { RiskActions } from '@/components/risk/risk-actions';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

export default async function RiskPage() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    redirect('/login');
  }

  const subAccounts = await prisma.mt5Account.findMany({
    where: { role: 'SUB', userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: { copySettings: true }
  });

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-12 flex flex-col gap-10 pb-32 overflow-y-auto custom-scrollbar relative">
      <header className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Risk Engine
          </h1>
          <p className="text-muted-foreground text-[13px] tracking-wide mt-2 max-w-xl">
            Configure custom allocation profiles per sub-account. The allocation percentage determines the proportional lot size copied relative to the master account's balance.
          </p>
        </div>
        <RiskActions />
      </header>

      <div className="relative z-10 flex flex-col gap-6">
        {subAccounts.length > 0 ? (
          <RiskControls initialAccounts={subAccounts} />
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center plaiz-card bg-secondary/20 border-dashed">
            <Users className="w-8 h-8 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-bold">No Sub Accounts Found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Connect portfolio accounts from the <Link href="/accounts" className="text-primary hover:underline">Accounts tab</Link> to configure their risk allocation settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
