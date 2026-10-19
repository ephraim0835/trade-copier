'use client';

import React, { createContext, useContext, ReactNode } from 'react';

import { TrialGraceStatus } from '@/lib/trial-grace';

interface SubscriptionContextType {
  isActive: boolean;
  isAdmin: boolean;
  trialGrace?: TrialGraceStatus;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ 
  children, 
  isActive,
  isAdmin = false,
  trialGrace,
}: { 
  children: ReactNode; 
  isActive: boolean;
  isAdmin?: boolean;
  trialGrace?: TrialGraceStatus;
}) {
  return (
    <SubscriptionContext.Provider value={{ isActive, isAdmin, trialGrace }}>
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
