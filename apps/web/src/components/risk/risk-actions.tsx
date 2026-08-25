'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ConnectAccountModal } from '@/components/connect-account-modal';
import { ProtectedAction } from '@/components/protected-action';

export function RiskActions() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <ProtectedAction>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Portfolio Account
        </button>
      </ProtectedAction>

      <ConnectAccountModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        defaultRole="SUB" 
      />
    </>
  );
}
