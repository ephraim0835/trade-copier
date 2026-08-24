'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface SubscriptionContextType {
  isActive: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ 
  children, 
  isActive 
}: { 
  children: ReactNode; 
  isActive: boolean;
}) {
  return (
    <SubscriptionContext.Provider value={{ isActive }}>
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
