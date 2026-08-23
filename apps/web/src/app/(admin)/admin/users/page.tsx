import { Users, Search, Shield, CreditCard } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SubscriptionStatus } from '@trade-copier/database';

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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Users & Entitlements</h1>
          <p className="text-muted-foreground">Manage customer accounts, subscriptions, and platform access.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="relative">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <input type="text" placeholder="Search users..." className="pl-9 pr-4 py-2 rounded-full bg-black/5 dark:bg-white/5 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-full sm:w-64" />
           </div>
        </div>
      </div>

      <div className="plaiz-card rounded-[20px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-black/5 dark:bg-white/5 border-b border-border/40">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Subscription</th>
                <th className="px-6 py-4 font-semibold">Accounts</th>
                <th className="px-6 py-4 font-semibold">Joined</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p>No users found in the database.</p>
                  </td>
                </tr>
              ) : (
                users.map((user: any) => (
                  <tr key={user.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <span className="font-bold text-xs">{user.email.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{user.email}</span>
                          <span className="text-[10px] text-muted-foreground">ID: {user.id.slice(0,8)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'ADMIN' ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <Shield className="w-3.5 h-3.5" /> Admin
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">User</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {!user.subscription ? (
                        <span className="plaiz-pill plaiz-pill-neutral text-[10px]">No Sub</span>
                      ) : (
                        <span className={`plaiz-pill text-[10px] ${
                          user.subscription.status === SubscriptionStatus.ACTIVE ? 'plaiz-pill-success' :
                          user.subscription.status === SubscriptionStatus.INTERNAL_FREE ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                          'plaiz-pill-destructive'
                        }`}>
                          {user.subscription.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium num-tabular">
                      {user._count?.accounts || 0}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-primary hover:underline text-xs font-medium">Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
