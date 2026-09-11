"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { CheckoutButton } from "@/components/checkout-button";

interface PricingActionProps {
  plan: {
    id: string;
    status: string;
    ctaUrl: string;
    cta: string;
    popular: boolean;
  };
}

export function PricingAction({ plan }: PricingActionProps) {
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user?.email;

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
    return (
      <CheckoutButton 
        planId={plan.id as "basic" | "pro"} 
        className={`plaiz-btn w-full py-3 justify-center ${plan.popular ? 'plaiz-btn-primary relative z-10' : 'plaiz-btn-secondary'}`}
      >
        Select Plan
      </CheckoutButton>
    );
  }

  return (
    <Link 
      href="/signup" 
      className={`plaiz-btn w-full py-3 justify-center ${plan.popular ? 'plaiz-btn-primary relative z-10' : 'plaiz-btn-secondary'}`}
    >
      {plan.cta}
    </Link>
  );
}
