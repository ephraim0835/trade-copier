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
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
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
    <aside className="hidden lg:flex flex-col w-[260px] bg-background border-r border-border/40 h-screen sticky top-0 z-40">
      <div className="h-[88px] flex items-center px-6">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="flex gap-1 items-end h-6 pt-1">
            <div className="w-[5px] h-3 bg-primary rounded-[2px]"></div>
            <div className="w-[5px] h-[18px] bg-primary rounded-[2px]"></div>
            <div className="w-[5px] h-6 bg-accent rounded-[2px]"></div>
          </div>
          <div className="flex flex-col pt-0.5">
            <span className="font-bold text-xl tracking-tight text-primary leading-none">Plaiz</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-foreground mt-0.5 font-bold">Markets</span>
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
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_rgba(0,123,255,0.4)]'
                    : 'text-muted-foreground hover:bg-card hover:text-foreground'
                )}
              >
                <item.icon className={cn(
                  'w-[18px] h-[18px] transition-colors', 
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                {item.name}
              </Link>
            );
          })}
          
          {isInstallable && (
            <button
              onClick={installApp}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 text-primary hover:bg-primary/10 mt-6 border border-primary/20"
            >
              <Download className="w-[18px] h-[18px] text-primary" />
              Install App
            </button>
          )}
        </nav>
      </div>
      
      <div className="p-4 mt-auto">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-card border border-border/40 hover:border-border/80 transition-colors cursor-pointer shadow-sm">
          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
             <UserCircle className="w-9 h-9 text-muted-foreground" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[13px] font-semibold truncate text-foreground leading-tight">Admin</span>
            <span className="text-[11px] text-muted-foreground truncate">Administrator</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
