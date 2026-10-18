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

  let users: any[] = [];
  let discountCodes: any[] = [];

  try {
    // Fetch all users with their subscriptions and active discount relations
    users = await prisma.user.findMany({
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
    discountCodes = await prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  } catch (err) {
    console.error('Failed to query revenue records from database:', err);
  }

  // Serialize users for client component
  const serializedUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
    accountCount: u._count?.accounts || 0,
    subscription: u.subscription
      ? {
          id: u.subscription.id,
          status: u.subscription.status,
          planId: u.subscription.planId,
          currentPeriodEnd: u.subscription.currentPeriodEnd
            ? new Date(u.subscription.currentPeriodEnd).toISOString()
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
    validUntil: d.validUntil ? new Date(d.validUntil).toISOString() : null,
  }));

  return (
    <RevenueClient 
      users={serializedUsers} 
      discounts={serializedDiscounts} 
    />
  );
}
