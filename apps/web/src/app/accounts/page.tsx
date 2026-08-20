import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Settings2, Activity, AlertCircle } from 'lucide-react';

export default async function AccountsPage() {
  const accounts = await prisma.mt5Account.findMany({
    where: { role: 'SUB' },
    include: {
      copySettings: true,
      eaTokens: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sub Accounts</h1>
        <p className="text-muted-foreground mt-2">
          Manage risk settings, monitoring, and execution overrides for your connected trading terminals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {accounts.map((account: any) => {
          const isOnline = account.eaTokens?.[0]?.lastUsedAt 
            ? new Date().getTime() - new Date(account.eaTokens[0].lastUsedAt).getTime() < 5 * 60 * 1000 
            : false;
          
          return (
            <div key={account.id} className="bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-destructive'}`} />
                    <span className="font-semibold">{account.login}</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                    {account.broker}
                  </span>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className={account.isActive ? 'text-primary' : 'text-muted-foreground'}>
                      {account.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance</span>
                    <span className="font-mono">
                      {account.balance != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency || 'USD' }).format(account.balance) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Risk Multiplier</span>
                    <span className="font-mono">{account.copySettings?.riskMultiplier?.toFixed(2) || '1.00'}x</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                <Link 
                  href={`/accounts/${account.id}/settings`}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                  Risk Controls
                </Link>
                <button className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-secondary transition-colors" title="View Logs">
                  <Activity className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-secondary/20 rounded-xl border border-dashed border-border">
            <AlertCircle className="w-8 h-8 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Sub Accounts</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              You haven't connected any sub accounts yet. Launch the Sub EA to connect a terminal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
