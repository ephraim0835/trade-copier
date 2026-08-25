'use client';

import { useSubscription } from './subscription-provider';
import React, { HTMLAttributes } from 'react';

interface ProtectedActionProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedAction({ children, fallback, ...props }: ProtectedActionProps) {
  const { isActive, isAdmin } = useSubscription();

  // Admins, owners, and users granted access always bypass the paywall
  if (isAdmin || isActive) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;
  
  // Default fallback: wrap children in a disabled, unclickable state
  return (
    <div className="relative opacity-50 cursor-not-allowed select-none group" {...props} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <div className="pointer-events-none">
        {children}
      </div>
    </div>
  );
}
