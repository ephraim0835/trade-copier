'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <button 
      onClick={handleLogout}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-1.5 lg:gap-2 px-3 h-9 rounded-full bg-black/5 dark:bg-white/5",
        "hover:bg-destructive/10 dark:hover:bg-destructive/20 hover:text-destructive hover:border-destructive/30",
        "transition-all border border-border/50 text-muted-foreground",
        isLoading && "opacity-50 cursor-not-allowed"
      )}
      title="Log out"
    >
      <LogOut className={cn("w-3.5 h-3.5 lg:w-4 lg:h-4", isLoading && "animate-pulse")} />
      <span className="hidden lg:block text-[11px] font-semibold tracking-wide uppercase">
        {isLoading ? '...' : 'Logout'}
      </span>
    </button>
  );
}
