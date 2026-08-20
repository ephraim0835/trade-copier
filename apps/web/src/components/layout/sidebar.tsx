'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, LayoutDashboard, Settings, ListTree, UserCircle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePwa } from '../pwa-provider';

export function Sidebar() {
  const { isInstallable, installApp } = usePwa();
  const navItems = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Accounts', href: '/accounts', icon: ListTree },
    { name: 'Live Positions', href: '/positions', icon: Activity },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-white font-bold tracking-tighter">TC</span>
          </div>
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Copier
          </span>
        </div>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
              {item.name}
            </Link>
          );
        })}
        {isInstallable && (
          <button
            onClick={installApp}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 text-primary hover:bg-primary/10 mt-4"
          >
            <Download className="w-5 h-5 text-primary" />
            Install App
          </button>
        )}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <UserCircle className="w-8 h-8 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Owner Admin</span>
            <span className="text-xs text-muted-foreground">owner@plaiz.com</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
