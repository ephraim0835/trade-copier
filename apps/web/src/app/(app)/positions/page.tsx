import { prisma } from '@/lib/prisma';
import { ArrowRight, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

// Helper to determine the consolidated status
function getStatusDisplay(copy: any, commands: any[]) {
  if (copy.state === 'WAITING_FOR_SL') {
    return { label: 'Waiting for SL', icon: Clock, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
  }
  if (copy.state === 'REJECTED' || copy.state === 'FAILED') {
    return { label: 'Rejected / Failed', icon: XCircle, color: 'plaiz-pill-destructive' };
  }
  
  // Check commands to see if a CLOSE command exists and was executed
  const closeCommand = commands?.find((c: any) => c.type === 'CLOSE_ORDER' && c.status === 'EXECUTED');
  if (closeCommand) {
    return { label: 'Closed / Completed', icon: CheckCircle2, color: 'plaiz-pill-neutral' };
  }

  if (copy.state === 'EXECUTED' || copy.state === 'APPROVED') {
    return { label: 'Copied / Synchronized', icon: CheckCircle2, color: 'plaiz-pill-success' };
  }
  
  return { label: copy.state || 'Unknown', icon: AlertCircle, color: 'plaiz-pill-neutral' };
}

export default async function PositionsPage() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    redirect('/login');
  }

  // Get user's master accounts
  const masterAccounts = await prisma.mt5Account.findMany({
    where: { role: 'MASTER', userId: user.id }
  });
  
  const masterAccountIds = masterAccounts.map((a: any) => a.id);

  // Query all trade signals (representing master orders/positions)
  // And include their mappings (TradeCopies) and the executed commands
  const signals = masterAccountIds.length > 0 ? await prisma.tradeSignal.findMany({
    where: { masterAcctId: { in: masterAccountIds } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      copies: {
        where: { subAccount: { userId: user.id } }, // double check copies belong to user too
        include: {
          subAccount: true,
          commands: {
            orderBy: { createdAt: 'desc' }
          }
        }
      }
    }
  }) : [];

  const masterMap = new Map(masterAccounts.map((a: any) => [a.id, a.login]));

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Live Positions & Trade Mapping</h1>
        <p className="text-muted-foreground mt-2">
          Real-time view of Master signals and their corresponding Sub account executions.
        </p>
      </div>

      <div className="plaiz-card rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-black/5 dark:bg-white/5 text-muted-foreground font-semibold text-xs uppercase tracking-widest border-b border-border/40">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Master Signal</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Sub Mapping</th>
                <th className="px-4 py-3">Entry / Current</th>
                <th className="px-4 py-3">SL / TP</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {signals.map((signal: any) => {
                // Determine if there are copies
                if (signal.copies.length === 0) {
                  return (
                    <tr key={signal.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(signal.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{String(masterMap.get(signal.masterAcctId) || 'Unknown Master')}</div>
                        <div className="text-xs text-muted-foreground font-mono">Tkt: {String(signal.ticket)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${signal.type.includes('BUY') ? 'text-emerald-500' : 'text-destructive'}`}>
                            {signal.type}
                          </span>
                          <span className="text-xs text-muted-foreground border border-border px-1.5 rounded bg-secondary/50">
                            {signal.symbol}
                          </span>
                        </div>
                        <div className="text-xs mt-1">Vol: {signal.volume}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground italic">No mapping generated</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {signal.priceOpen}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        <div className={signal.sl ? '' : 'text-red-400'}>SL: {signal.sl || 'None'}</div>
                        <div>TP: {signal.tp || 'None'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="plaiz-pill plaiz-pill-neutral text-[10px]">
                          <AlertCircle className="w-3 h-3" />
                          Unmapped
                        </span>
                      </td>
                    </tr>
                  );
                }

                return signal.copies.map((copy: any) => {
                  const status = getStatusDisplay(copy, copy.commands);
                  const Icon = status.icon;

                  return (
                    <tr key={copy.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(signal.createdAt).toLocaleTimeString()}
                      </td>
                      
                      {/* Master Column */}
                      <td className="px-4 py-3">
                        <div className="font-medium">{String(masterMap.get(signal.masterAcctId) || 'Unknown Master')}</div>
                        <div className="text-xs text-muted-foreground font-mono">Tkt: {String(signal.ticket)}</div>
                      </td>

                      {/* Direction / Symbol */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${signal.type.includes('BUY') ? 'text-emerald-500' : 'text-destructive'}`}>
                            {signal.type}
                          </span>
                          <span className="text-xs text-muted-foreground border border-border px-1.5 rounded bg-secondary/50">
                            {signal.symbol}
                          </span>
                        </div>
                        <div className="text-xs mt-1">Vol: {signal.volume}</div>
                      </td>

                      {/* Sub Column */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div>
                            <div className="font-medium">{copy.subAccount.login}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              Tkt: {copy.subPositionId?.toString() || copy.subOrderTicket?.toString() || 'Pending'} 
                              {' '}(Vol: {copy.executedVolume || copy.requestedVolume || '0'})
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Prices */}
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {signal.priceOpen}
                      </td>

                      {/* SL / TP */}
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className={signal.sl ? '' : 'text-destructive'}>SL: {signal.sl || 'None'}</div>
                        <div>TP: {signal.tp || 'None'}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`plaiz-pill text-[10px] ${status.color}`}>
                          <Icon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                });
              })}

              {signals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No trade mappings found. Execute a trade on the Master terminal to see it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
