import { ShieldAlert, Users, SlidersHorizontal, Info } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { RiskControls } from './risk-controls';

export default async function RiskPage() {
  const subAccounts = await prisma.mt5Account.findMany({
    where: { role: 'SUB' },
    include: {
      copySettings: true
    },
    orderBy: { createdAt: 'asc' }
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
      </header>

      <div className="relative z-10 flex flex-col gap-6">
        {subAccounts.length > 0 ? (
          <RiskControls initialAccounts={subAccounts} />
        ) : (
          <div className="surface-matte p-12 rounded-[24px] flex flex-col items-center justify-center text-center">
            <Users className="w-10 h-10 mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-[16px] font-bold text-foreground mb-2">No Sub Accounts Found</h2>
            <p className="text-[13px] text-muted-foreground max-w-md">Connect portfolio accounts to configure their risk allocation settings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
