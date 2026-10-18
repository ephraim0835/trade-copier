import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { RevenueClient } from './revenue-client';

export const dynamic = 'force-dynamic';

export default async function AdminRevenuePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
    redirect('/dashboard');
  }

  // Fetch all users with their subscriptions and active discount relations
  const users = await prisma.user.findMany({
    include: {
      subscription: {
        include: {
          discountCode: true,
        },
      },
      _count: {
        select: { accounts: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch discount codes
  const discountCodes = await prisma.discountCode.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Serialize users for client component
  const serializedUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    accountCount: u._count.accounts,
    subscription: u.subscription
      ? {
          id: u.subscription.id,
          status: u.subscription.status,
          planId: u.subscription.planId,
          currentPeriodEnd: u.subscription.currentPeriodEnd
            ? u.subscription.currentPeriodEnd.toISOString()
            : null,
          flutterwaveTxRef: u.subscription.flutterwaveTxRef,
          discountPercentage: u.subscription.discountCode?.percentage || 0,
          discountCode: u.subscription.discountCode?.code || null,
        }
      : null,
  }));

  const serializedDiscounts = discountCodes.map((d) => ({
    id: d.id,
    code: d.code,
    percentage: d.percentage,
    duration: d.duration,
    usedCount: d.usedCount,
    maxUses: d.maxUses,
    isActive: d.isActive,
    validUntil: d.validUntil ? d.validUntil.toISOString() : null,
  }));

  return (
    <RevenueClient 
      users={serializedUsers} 
      discounts={serializedDiscounts} 
    />
  );
}
