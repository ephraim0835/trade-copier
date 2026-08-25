'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface SubscriptionContextType {
  isActive: boolean;
  isAdmin: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ 
  children, 
  isActive,
  isAdmin = false,
}: { 
  children: ReactNode; 
  isActive: boolean;
  isAdmin?: boolean;
}) {
  return (
    <SubscriptionContext.Provider value={{ isActive, isAdmin }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
