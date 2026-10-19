import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AccountActions } from '@/components/accounts/account-actions';
import { SubAccountCard } from '@/components/accounts/sub-account-card';
import { AlertCircle } from 'lucide-react';
import { PrismaClient } from '@trade-copier/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AccountsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { subscription: true }
  });

  if (!user) {
    redirect('/login');
  }

  const accounts = await prisma.mt5Account.findMany({
    where: { role: 'SUB', userId: user.id },
    include: {
      copySettings: true,
      eaTokens: {
        orderBy: { lastUsedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' }
  });

  const planId = (user.subscription?.planId || 'basic').toLowerCase();
  const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';
  const isInternalFree = user.subscription?.status === 'INTERNAL_FREE';
  const maxSubs = isAdmin || isInternalFree ? 999 : (planId === 'pro' ? 10 : 3);
  const isAtSubLimit = !isAdmin && !isInternalFree && accounts.length >= maxSubs;

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Sub Accounts</h1>
            <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-foreground font-semibold border border-border/40">
              {accounts.length} / {isAdmin || isInternalFree ? '∞' : maxSubs} Used • {planId.toUpperCase()} Plan
            </span>
          </div>
          <p className="text-muted-foreground mt-2">
            Manage risk settings, monitoring, and execution overrides for your connected trading terminals.
          </p>
          {isAtSubLimit && planId === 'basic' && (
            <div className="mt-2 text-xs flex items-center gap-1.5 text-amber-500 font-medium">
              <span>Basic Plan capacity reached (3/3).</span>
              <Link href="/pricing" className="text-primary font-semibold hover:underline">
                Upgrade to Pro for up to 10 Sub accounts &rarr;
              </Link>
            </div>
          )}
        </div>
        <AccountActions />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {accounts.map((account: any) => (
          <SubAccountCard key={account.id} account={account} />
        ))}

        {accounts.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center plaiz-card bg-secondary/20 border-dashed">
            <AlertCircle className="w-8 h-8 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-bold">No Sub Accounts</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
              You haven't connected any sub accounts yet. Connect a portfolio account to get started.
            </p>
            <AccountActions />
          </div>
        )}
      </div>
    </div>
  );
}
