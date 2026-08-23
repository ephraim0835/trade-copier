'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  Users, 
  ArrowRightLeft, 
  ShieldAlert, 
  LineChart, 
  Activity, 
  Settings, 
  UserCircle, 
  Download 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePwa } from '../pwa-provider';
import { ThemeToggle } from '../theme-toggle';

export function Sidebar() {
  const { isInstallable, installApp } = usePwa();
    const navItems = [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Master Source', href: '/master', icon: ShieldCheck },
    { name: 'Sub Accounts', href: '/accounts', icon: Users },
    { name: 'Live Trades', href: '/positions', icon: ArrowRightLeft },
    { name: 'Risk Engine', href: '/risk', icon: ShieldAlert },
    { name: 'Performance', href: '/performance', icon: LineChart },
    { name: 'Activity', href: '/activity', icon: Activity },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-[260px] plaiz-card h-[calc(100vh-2rem)] sticky top-4 ml-4 rounded-[24px] z-40 shrink-0">
      <div className="h-[88px] flex items-center px-8">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img src="/plaiz-logo.png" alt="Plaiz Markets" className="h-6 w-auto" />
          <div className="flex flex-col pt-0.5">
            <span className="font-bold text-xl tracking-tight text-foreground leading-none">Plaiz</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5 font-bold">Markets</span>
          </div>
        </Link>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar space-y-1">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 group relative',
                  isActive
                    ? 'bg-black/5 dark:bg-white/10 text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground border border-transparent'
                )}
              >
                {isActive && (
                   <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-foreground rounded-r-full"></div>
                )}
                <item.icon className={cn(
                  'w-[18px] h-[18px] transition-colors', 
                  isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                {item.name}
              </Link>
            );
          })}
          
          {isInstallable && (
            <button
              onClick={installApp}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-8 text-[13px] font-semibold text-foreground bg-black/20 hover:bg-black/30 dark:bg-white/5 dark:hover:bg-white/10 border border-border/30 rounded-2xl transition-all duration-200 backdrop-blur-md"
            >
              <Download className="w-4 h-4" />
              Install App
            </button>
          )}
        </nav>
      </div>
      
      <div className="p-4 mt-auto">
        <Link href="/settings" className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-black/5 dark:bg-black/20 border border-border/30 hover:bg-black/10 dark:hover:bg-black/40 transition-colors cursor-pointer backdrop-blur-md group">
          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden group-hover:ring-2 ring-primary/20 transition-all">
             <UserCircle className="w-9 h-9 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[13px] font-semibold truncate text-foreground leading-tight">Admin</span>
            <span className="text-[11px] text-muted-foreground truncate group-hover:text-primary transition-colors">Manage Account</span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
