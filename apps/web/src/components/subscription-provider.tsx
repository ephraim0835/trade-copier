'use client';

import React, { createContext, useContext, ReactNode } from 'react';

import { TrialGraceStatus } from '@/lib/trial-grace';

interface SubscriptionContextType {
  isActive: boolean;
  isAdmin: boolean;
  trialGrace?: TrialGraceStatus;
  planId?: string | null;
  status?: string | null;
}

const defaultContext: SubscriptionContextType = {
  isActive: false,
  isAdmin: false,
  trialGrace: undefined,
  planId: null,
  status: null,
};

const SubscriptionContext = createContext<SubscriptionContextType>(defaultContext);

export function SubscriptionProvider({ 
  children, 
  isActive,
  isAdmin = false,
  trialGrace,
  planId = null,
  status = null,
}: { 
  children: ReactNode; 
  isActive: boolean;
  isAdmin?: boolean;
  trialGrace?: TrialGraceStatus;
  planId?: string | null;
  status?: string | null;
}) {
  return (
    <SubscriptionContext.Provider value={{ isActive, isAdmin, trialGrace, planId, status }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  return context ?? defaultContext;
}

