"use client";

import { useState } from "react";
import { CheckoutModal, PlanTier } from "@/components/checkout-modal";

interface CheckoutButtonProps {
  planId?: PlanTier;
  className?: string;
  children: React.ReactNode;
}

export function CheckoutButton({ planId, className = "", children }: CheckoutButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      />
    </>
  );
}
