"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CheckoutButton } from "@/components/checkout-button";
import { PlanTier } from "@/components/checkout-modal";
import { getPlanActionLabel } from "@/lib/plan-tiers";
import { useSubscription } from "@/components/subscription-provider";

interface PricingActionProps {
  plan: {
    id: string;
    status: string;
    ctaUrl: string;
    cta: string;
    popular: boolean;
  };
  userSubscription?: {
    planId: string | null;
    status: string;
  } | null;
}

export function PricingAction({ plan, userSubscription }: PricingActionProps) {
  const { data: session, status } = useSession();
  const sub = useSubscription();
  const isLoggedIn = !!session?.user?.email;

  const [activePlanId, setActivePlanId] = useState<string | null | undefined>(
    userSubscription?.planId ?? sub?.planId
  );
  const [activeStatus, setActiveStatus] = useState<string | undefined>(
    userSubscription?.status ?? sub?.status ?? undefined
  );

  useEffect(() => {
    if (userSubscription !== undefined) {
      setActivePlanId(userSubscription?.planId);
      setActiveStatus(userSubscription?.status);
    } else if (sub?.planId !== undefined || sub?.status !== undefined) {
      setActivePlanId(sub.planId);
      setActiveStatus(sub.status ?? undefined);
    }
  }, [userSubscription, sub?.planId, sub?.status]);

  useEffect(() => {
    if (isLoggedIn && (activePlanId === undefined || activeStatus === undefined)) {
      fetch('/api/billing/subscription')
        .then((res) => res.json())
        .then((data) => {
          if (data?.subscription) {
            setActivePlanId(data.subscription.planId);
            setActiveStatus(data.subscription.status);
          }
        })
        .catch(() => {});
    }
  }, [isLoggedIn, activePlanId, activeStatus]);

  if (plan.status === 'coming_later') {
    return (
      <Link 
        href={plan.ctaUrl} 
        className={`plaiz-btn w-full py-3 justify-center ${plan.popular ? 'plaiz-btn-primary relative z-10' : 'plaiz-btn-secondary'}`}
      >
        {plan.cta}
      </Link>
    );
  }

  if (status === "loading") {
    return (
      <div className={`plaiz-btn w-full py-3 justify-center opacity-50 cursor-wait ${plan.popular ? 'plaiz-btn-primary relative z-10' : 'plaiz-btn-secondary'}`}>
        Loading...
      </div>
    );
  }

  if (isLoggedIn) {
    const actionLabel = getPlanActionLabel(plan.id, activePlanId, activeStatus);

    return (
      <CheckoutButton 
        planId={plan.id as PlanTier} 
        currentPlanId={activePlanId}
        currentStatus={activeStatus}
        className={`plaiz-btn w-full py-3 justify-center ${plan.popular ? 'plaiz-btn-primary relative z-10' : 'plaiz-btn-secondary'}`}
      >
        {actionLabel}
      </CheckoutButton>
    );
  }

  return (
    <Link 
      href="/signup" 
      prefetch={true}
      className={`plaiz-btn w-full py-3 justify-center ${plan.popular ? 'plaiz-btn-primary relative z-10' : 'plaiz-btn-secondary'}`}
    >
      {plan.cta}
    </Link>
  );
}
