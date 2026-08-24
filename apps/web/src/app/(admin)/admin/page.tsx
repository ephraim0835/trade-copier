import { Server, Users, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  // Safe backend fetch for overview stats
  let totalUsers = 0;
  let activeSubs = 0;
  let activeMasters = 0;
  
  try {
    totalUsers = await prisma.user.count();
    activeSubs = await prisma.mt5Account.count({ where: { role: 'SUB', isActive: true } });
    activeMasters = await prisma.mt5Account.count({ where: { role: 'MASTER', isActive: true } });
  } catch (e) {
    console.error("Database connection failed in admin overview:", e);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Platform Overview</h1>
        <p className="text-muted-foreground">High-level telemetry and status of Plaiz Markets.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="plaiz-card p-6 flex flex-col">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Server className="w-5 h-5" />
          </div>
          <span className="text-sm text-muted-foreground font-medium mb-1">Infrastructure Status</span>
          <span className="text-2xl font-bold text-emerald-500">Healthy</span>
        </div>
        
        <div className="plaiz-card p-6 flex flex-col">
          <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center mb-4">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-sm text-muted-foreground font-medium mb-1">Total Users</span>
          <span className="text-2xl font-bold num-tabular">{totalUsers}</span>
        </div>
        
        <div className="plaiz-card p-6 flex flex-col">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <span className="text-sm text-muted-foreground font-medium mb-1">Active Masters</span>
          <span className="text-2xl font-bold num-tabular">{activeMasters}</span>
        </div>
        
        <div className="plaiz-card p-6 flex flex-col">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <span className="text-sm text-muted-foreground font-medium mb-1">Active Subs</span>
          <span className="text-2xl font-bold num-tabular">{activeSubs}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="plaiz-card p-6 flex flex-col">
           <h3 className="text-lg font-bold mb-4">Recent System Events</h3>
           <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
             <span className="text-sm">No critical events recorded recently.</span>
           </div>
        </section>
        
        <section className="plaiz-card p-6 flex flex-col">
           <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
           <div className="flex flex-col gap-3">
             <Link href="/admin/infrastructure" className="plaiz-btn plaiz-btn-secondary w-full justify-start">
               <Server className="w-4 h-4 mr-2 text-muted-foreground" /> Check VPS Capacity
             </Link>
             <Link href="/admin/users" className="plaiz-btn plaiz-btn-secondary w-full justify-start">
               <Users className="w-4 h-4 mr-2 text-muted-foreground" /> Manage Entitlements
             </Link>
           </div>
        </section>
      </div>
    </div>
  );
}
