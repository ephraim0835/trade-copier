import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UsersClient } from './users-client';

export const dynamic = 'force-dynamic';

export default async function UsersAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect('/login');
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'OWNER')) {
    redirect('/dashboard');
  }

  let users: any[] = [];
  try {
    users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        emailVerified: true,
        botStopped: true,
        subscription: true,
        _count: {
          select: { accounts: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  } catch (e) {
    console.error("Failed to fetch users", e);
  }

  return <UsersClient users={users} />;
}

