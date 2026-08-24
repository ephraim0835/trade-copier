"use client";

import { useState } from 'react';
import { Shield, CreditCard, Trash2, X, Loader2 } from 'lucide-react';
import { updateUserRole, grantInternalSubscription, revokeSubscription, deleteUser } from '@/app/actions/admin-actions';

interface UserEditModalProps {
  user: any;
  onClose: () => void;
}

export function UserEditModal({ user, onClose }: UserEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isInternalFree = user.subscription?.status === 'INTERNAL_FREE';
  const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border/40 rounded-[20px] shadow-lg overflow-hidden flex flex-col relative">
        <div className="flex items-center justify-between p-6 border-b border-border/20">
          <h2 className="text-xl font-bold">Manage User</h2>
          <button onClick={onClose} disabled={loading} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-6">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1">Email Address</p>
            <p className="font-semibold">{user.email}</p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Access Controls</p>
            
            <button 
              disabled={loading}
              onClick={() => handleAction(() => updateUserRole(user.id, isAdmin ? 'USER' : 'ADMIN'))}
              className="flex items-center justify-between p-4 rounded-xl border border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isAdmin ? 'bg-primary/10 text-primary' : 'bg-black/5 dark:bg-white/5 text-muted-foreground'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">{isAdmin ? 'Revoke Admin' : 'Make Admin'}</p>
                  <p className="text-xs text-muted-foreground">{isAdmin ? 'Remove administrative privileges' : 'Grant full access to the dashboard'}</p>
                </div>
              </div>
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
            </button>

            <button 
              disabled={loading}
              onClick={() => handleAction(() => isInternalFree ? revokeSubscription(user.id) : grantInternalSubscription(user.id))}
              className="flex items-center justify-between p-4 rounded-xl border border-border/30 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isInternalFree ? 'bg-purple-500/10 text-purple-500' : 'bg-black/5 dark:bg-white/5 text-muted-foreground'}`}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">{isInternalFree ? 'Revoke Free Access' : 'Grant Free Access'}</p>
                  <p className="text-xs text-muted-foreground">{isInternalFree ? 'Remove internal free subscription' : 'Bypass Stripe for this user'}</p>
                </div>
              </div>
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
            </button>
          </div>
          
          <div className="pt-4 mt-2 border-t border-border/20">
             <button 
              disabled={loading}
              onClick={() => {
                if (confirm('Are you absolutely sure you want to delete this user? This action cannot be undone and will delete all their data.')) {
                  handleAction(async () => {
                    await deleteUser(user.id);
                    onClose();
                  });
                }
              }}
              className="flex items-center gap-2 text-sm font-semibold text-red-500 hover:text-red-400 transition-colors w-full justify-center p-2 rounded-lg hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" /> Delete Account
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
