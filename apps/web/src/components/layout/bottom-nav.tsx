'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  ArrowRightLeft,
  ShieldCheck,
  ShieldAlert,
  LineChart,
  Activity,
  Settings,
  Shield,
  MoreHorizontal,
  X,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// The 5 primary items always visible in the bottom bar
const PRIMARY_ITEMS = [
  { name: 'Home',     href: '/dashboard', icon: Home },
  { name: 'Master',   href: '/master',    icon: ShieldCheck },
  { name: 'Accounts', href: '/accounts',  icon: Users },
  { name: 'Trades',   href: '/positions', icon: ArrowRightLeft },
];

// Items in the "More" slide-up sheet
const SHEET_ITEMS = [
  { name: 'Risk Engine',  href: '/risk',         icon: ShieldAlert },
  { name: 'Performance',  href: '/performance',  icon: LineChart },
  { name: 'Activity',     href: '/activity',     icon: Activity },
  { name: 'Settings',     href: '/settings',     icon: Settings },
];

const ADMIN_ITEM = { name: 'Admin',  href: '/admin', icon: Shield };

// Admin-area specific nav
const ADMIN_NAV_ITEMS = [
  { name: 'Overview', href: '/admin',                 icon: Activity },
  { name: 'Users',    href: '/admin/users',           icon: Users },
  { name: 'Infra',    href: '/admin/infrastructure',  icon: Server },
  { name: 'Copier',   href: '/admin/copier',          icon: ShieldAlert },
  { name: 'Exit',     href: '/dashboard',             icon: Home },
];

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isAdminRoute = pathname.startsWith('/admin');

  // Check if current page is in the "More" sheet
  const sheetHrefs = [...SHEET_ITEMS.map(i => i.href), ADMIN_ITEM.href];
  const isOnSheetPage = sheetHrefs.some(href =>
    pathname === href || (pathname.startsWith(href) && href !== '/')
  );

  const isActive = (href: string) =>
    href === '/admin' || href === '/dashboard'
      ? pathname === href
      : pathname === href || (pathname.startsWith(href) && href !== '/');

  // ─── Admin area gets its own dedicated nav ───────────────────────────────
  if (isAdminRoute) {
    return (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
        <div className="relative pb-safe">
          <nav className="flex items-center justify-around h-[64px] px-2">
            {ADMIN_NAV_ITEMS.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center h-full relative group transition-transform active:scale-95"
              >
                <div className={cn(
                  'flex flex-col items-center justify-center gap-1 transition-all duration-200',
                  isActive(item.href) ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground/80'
                )}>
                  <item.icon className={cn('w-6 h-6', isActive(item.href) && 'stroke-[2.5px]')} />
                  <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
                </div>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    );
  }

  // ─── Standard app nav ─────────────────────────────────────────────────────
  return (
    <>
      {/* Slide-up sheet backdrop */}
      {sheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* More sheet */}
      <div className={cn(
        'lg:hidden fixed left-0 right-0 z-50 transition-all duration-300 ease-out',
        sheetOpen
          ? 'bottom-[64px] opacity-100 translate-y-0'
          : 'bottom-[64px] opacity-0 translate-y-full pointer-events-none'
      )}>
        <div className="mx-3 mb-2 bg-card border border-border/40 rounded-[24px] shadow-2xl overflow-hidden">
          {/* Sheet header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">More</span>
            <button
              onClick={() => setSheetOpen(false)}
              className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Sheet items */}
          <div className="p-3 flex flex-col gap-1">
            {SHEET_ITEMS.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSheetOpen(false)}
                className={cn(
                  'flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-150 group',
                  isActive(item.href)
                    ? 'bg-black/5 dark:bg-white/10 text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground'
                )}
              >
                {isActive(item.href) && (
                  <div className="absolute left-3 w-[3px] h-4 bg-foreground rounded-r-full" />
                )}
                <item.icon className={cn(
                  'w-5 h-5 transition-colors',
                  isActive(item.href) ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                <span className="text-[14px]">{item.name}</span>
              </Link>
            ))}

            {/* Admin item — only for admins/owners */}
            {isAdmin && (
              <Link
                href={ADMIN_ITEM.href}
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-primary hover:bg-primary/10 transition-all duration-150"
              >
                <ADMIN_ITEM.icon className="w-5 h-5 text-primary" />
                <span className="text-[14px] font-semibold">Admin Dashboard</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
        <div className="relative pb-safe">
          <nav className="flex items-center justify-around h-[64px] px-2">
            {/* Primary items */}
            {PRIMARY_ITEMS.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center h-full relative group transition-transform active:scale-95"
              >
                <div className={cn(
                  'flex flex-col items-center justify-center gap-1 transition-all duration-200',
                  isActive(item.href) ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground/80'
                )}>
                  <item.icon className={cn('w-6 h-6', isActive(item.href) && 'stroke-[2.5px]')} />
                  <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
                </div>
              </Link>
            ))}

            {/* "More" button */}
            <button
              onClick={() => setSheetOpen(prev => !prev)}
              className="flex-1 flex flex-col items-center justify-center h-full relative group transition-transform active:scale-95"
            >
              <div className={cn(
                'flex flex-col items-center justify-center gap-1 transition-all duration-200 relative',
                (sheetOpen || isOnSheetPage) ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground/80'
              )}>
                {/* Dot indicator when user is on a sheet page */}
                {isOnSheetPage && !sheetOpen && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
                <MoreHorizontal className={cn('w-6 h-6', (sheetOpen || isOnSheetPage) && 'stroke-[2.5px]')} />
                <span className="text-[10px] font-medium tracking-wide">More</span>
              </div>
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}
