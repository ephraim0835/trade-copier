'use client';

import { useState, useTransition } from 'react';
import { Plus, Unplug } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ConnectAccountModal } from '@/components/connect-account-modal';
import { ProtectedAction } from '@/components/protected-action';
import { deleteAccount } from '@/app/actions/account-actions';

interface MasterActionsProps {
  masterAccountId?: string;
}

export function MasterActions({ masterAccountId }: MasterActionsProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDisconnect() {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      setTimeout(() => setConfirmDisconnect(false), 3000);
      return;
    }
    startTransition(async () => {
      if (masterAccountId) {
        await deleteAccount(masterAccountId);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Disconnect button — only shown when a master account exists */}
        {masterAccountId && (
          <ProtectedAction>
            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 border disabled:opacity-50 ${
                confirmDisconnect
                  ? 'bg-destructive text-destructive-foreground border-destructive animate-pulse'
                  : 'border-border/50 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5'
              }`}
            >
              <Unplug className="w-4 h-4" />
              {confirmDisconnect ? 'Confirm Disconnect' : 'Disconnect'}
            </button>
          </ProtectedAction>
        )}

        {/* Connect / Replace master button */}
        <ProtectedAction>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {masterAccountId ? 'Replace Master' : 'Connect Master'}
          </button>
        </ProtectedAction>
      </div>

      <ConnectAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultRole="MASTER"
      />
    </>
  );
}
