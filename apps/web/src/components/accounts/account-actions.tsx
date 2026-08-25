'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ProtectedAction } from '@/components/protected-action';
import { ConnectAccountModal } from '@/components/connect-account-modal';

export function AccountActions() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <ProtectedAction>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="plaiz-btn plaiz-btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Connect Sub Account
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
