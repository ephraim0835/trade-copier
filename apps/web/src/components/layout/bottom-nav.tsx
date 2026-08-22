'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, ArrowRightLeft, ShieldAlert, Menu, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePwa } from '../pwa-provider';

export function BottomNav() {
  const pathname = usePathname();
  const { isInstallable, installApp } = usePwa();

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Accounts', href: '/accounts', icon: Users },
    { name: 'Trades', href: '/positions', icon: ArrowRightLeft },
    { name: 'Risk', href: '/risk', icon: ShieldAlert },
    { name: 'More', href: '/settings', icon: Menu },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe flex flex-col">
      {isInstallable && (
        <div className="bg-primary/10 border-t border-primary/20 px-4 py-2 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Install App</span>
            <span className="text-xs text-muted-foreground">Add to home screen</span>
          </div>
          <button
            onClick={installApp}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-transform"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
        </div>
      )}
      <div className="h-16 bg-card/90 backdrop-blur-xl border-t border-border/50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]">
        <nav className="flex h-full max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_8px_rgba(0,123,255,0.4)]")} />
                <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
