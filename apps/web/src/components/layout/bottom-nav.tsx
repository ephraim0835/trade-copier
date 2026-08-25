'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, ArrowRightLeft, ShieldAlert, Settings, Download, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePwa } from '../pwa-provider';

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const { isInstallable, installApp } = usePwa();

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Accounts', href: '/accounts', icon: Users },
    { name: 'Trades', href: '/positions', icon: ArrowRightLeft },
    { name: 'Risk', href: '/risk', icon: ShieldAlert },
    { name: 'Settings', href: '/settings', icon: Settings }
  ];

  if (isAdmin) {
    navItems.push({ name: 'Admin', href: '/admin', icon: Shield });
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50"></div>
      
      {/* Safe area padding for modern phones */}
      <div className="relative pb-safe">
        <nav className="flex items-center justify-around h-[64px] px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center h-full relative group transition-transform active:scale-95"
              >
                <div className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all duration-200",
                  isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80"
                )}>
                  <item.icon className={cn("w-6 h-6", isActive && "text-foreground stroke-[2.5px]")} />
                  <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
