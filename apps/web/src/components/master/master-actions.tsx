'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ConnectAccountModal } from '@/components/connect-account-modal';

export function MasterActions() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm"
      >
        <Plus className="w-4 h-4" />
        Connect Master
      </button>

      <ConnectAccountModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        defaultRole="MASTER" 
      />
    </>
  );
}
