"use client";

import { useState } from "react";
import { CheckoutModal, PlanTier } from "@/components/checkout-modal";
import { useSubscription } from "@/components/subscription-provider";

interface CheckoutButtonProps {
  planId?: PlanTier;
  currentPlanId?: string | null;
  currentStatus?: string | null;
  className?: string;
  children: React.ReactNode;
}

export function CheckoutButton({ 
  planId, 
  currentPlanId, 
  currentStatus, 
  className = "", 
  children 
}: CheckoutButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sub = useSubscription();

  const resolvedPlanId = currentPlanId !== undefined ? currentPlanId : sub?.planId;
  const resolvedStatus = currentStatus !== undefined ? currentStatus : sub?.status;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`${className} flex justify-center items-center gap-2 cursor-pointer`}
      >
        {children}
      </button>

      <CheckoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPlanId={planId}
        currentPlanId={resolvedPlanId}
        currentStatus={resolvedStatus}
      />
    </>
  );
}
