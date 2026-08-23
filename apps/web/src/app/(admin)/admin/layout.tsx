import { ShieldAlert, Users, Server, Activity, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

import { getServerSession } from "next-auth/next";
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user?.email) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user || user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-border/40 bg-card/50 flex flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border/40 gap-3">
          <img src="/plaiz-logo.png" alt="Plaiz Markets" className="h-5 w-auto grayscale" />
          <span className="font-bold text-lg tracking-tight text-foreground">PLAIZ ADMIN</span>
        </div>
        <div className="px-6 py-4 border-b border-border/40">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Exit to User App
          </Link>
        </div>
        <div className="p-6 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Console Modules</h2>
          <nav className="flex flex-col gap-1">
            <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium text-sm">
              <Activity className="w-4 h-4" />
              Overview
            </Link>
            <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors">
              <Users className="w-4 h-4" />
              Users & Subs
            </Link>
            <Link href="/admin/infrastructure" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors">
              <Server className="w-4 h-4" />
              Infrastructure
            </Link>
            <Link href="/admin/copier" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors">
              <ShieldAlert className="w-4 h-4" />
              Copier Ops
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2 md:hidden">
            <h1 className="font-bold">Admin Console</h1>
          </div>
          <div className="hidden md:block">
            {/* Breadcrumb could go here */}
          </div>
          <div className="flex items-center gap-4">
             <div className="plaiz-pill plaiz-pill-destructive">
               <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse"></span>
               God Mode
             </div>
             <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
