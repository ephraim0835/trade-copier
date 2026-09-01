'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Users, Server, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminSidebarNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Overview', href: '/admin', icon: Activity, exact: true },
    { name: 'Users & Subs', href: '/admin/users', icon: Users },
    { name: 'Infrastructure', href: '/admin/infrastructure', icon: Server },
    { name: 'Copier Ops', href: '/admin/copier', icon: ShieldAlert },
  ];

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
