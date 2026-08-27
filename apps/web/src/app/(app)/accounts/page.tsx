import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { AccountActions } from '@/components/accounts/account-actions';
import { SubAccountCard } from '@/components/accounts/sub-account-card';
import { AlertCircle } from 'lucide-react';

export default async function AccountsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    redirect('/login');
  }

  // AUTO-FIX DATABASE SCHEMA DRIFT
  try {
    if (process.env.DIRECT_URL) {
      const { PrismaClient } = require('@prisma/client');
      const directPrisma = new PrismaClient({
        datasources: { db: { url: process.env.DIRECT_URL } }
      });
      try {
        await directPrisma.$executeRawUnsafe('ALTER TABLE "CopySettings" RENAME COLUMN "riskMultiplier" TO "riskPercentage"');
        await directPrisma.$executeRawUnsafe('ALTER TABLE "CopySettings" ALTER COLUMN "riskPercentage" SET DEFAULT 1.0');
      } catch (e) { /* Ignore */ }
      try {
        await directPrisma.$executeRawUnsafe('ALTER TABLE "AccountSubscription" RENAME COLUMN "riskMultiplier" TO "riskPercentage"');
      } catch (e) { /* Ignore */ }
      await directPrisma.$disconnect();
    }
  } catch (e) { /* Ignore if already renamed */ }

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

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sub Accounts</h1>
          <p className="text-muted-foreground mt-2">
            Manage risk settings, monitoring, and execution overrides for your connected trading terminals.
          </p>
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
