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
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Master Account', href: '/master', icon: ShieldCheck },
    { name: 'Sub Accounts', href: '/accounts', icon: Users },
    { name: 'Trades', href: '/positions', icon: ArrowRightLeft },
    { name: 'Risk Management', href: '/risk', icon: ShieldAlert },
    { name: 'Performance', href: '/performance', icon: LineChart },
    { name: 'Activity', href: '/activity', icon: Activity },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0">
      <div className="h-20 flex items-center px-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-bold text-lg tracking-tighter">Pz</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-foreground leading-none">Plaiz</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-medium">Trade Copier</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-6 custom-scrollbar">
        <nav className="px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className={cn(
                  'w-5 h-5 transition-colors', 
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                {item.name}
              </Link>
            );
          })}
          {isInstallable && (
            <button
              onClick={installApp}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-primary hover:bg-primary/10 mt-4"
            >
              <Download className="w-5 h-5 text-primary" />
              Install App
            </button>
          )}
        </nav>
      </div>
      <div className="p-4 border-t border-border/50 space-y-4">
        <div className="flex justify-center">
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 transition-colors cursor-pointer border border-border/50">
          <UserCircle className="w-9 h-9 text-muted-foreground" />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-semibold truncate text-foreground">Admin</span>
            <span className="text-xs text-muted-foreground truncate">owner@plaiz.com</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
