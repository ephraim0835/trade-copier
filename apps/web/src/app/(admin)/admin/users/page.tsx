import { prisma } from '@/lib/prisma';
import { UsersClient } from './users-client';

export default async function UsersAdminPage() {
  let users: any[] = [];
  try {
    users = await prisma.user.findMany({
      include: {
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
