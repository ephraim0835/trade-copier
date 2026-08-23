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
    <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[400px] z-50 flex flex-col gap-3">
      {isInstallable && (
        <div className="glass-panel rounded-[16px] px-4 py-3 flex items-center justify-between mx-4 mb-2">
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-foreground">Plaiz App</span>
            <span className="text-[11px] text-muted-foreground">Add to home screen</span>
          </div>
          <button
            onClick={installApp}
            className="btn-apple btn-secondary py-1.5 px-3 text-[11px]"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
        </div>
      )}
      
      <div className="glass-panel rounded-[24px] h-[64px] px-2 shadow-lg">
        <nav className="flex h-full items-center justify-between">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center h-full relative transition-transform active:scale-95 group"
              >
                {isActive && (
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-foreground rounded-full"></div>
                )}
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-200 mt-2",
                  isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80"
                )}>
                  <item.icon className={cn("w-[22px] h-[22px]", isActive && "text-primary")} />
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
