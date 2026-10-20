import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { RiskSettingsClient } from './risk-settings-client';
import { ArrowLeft, ShieldAlert, Wifi } from 'lucide-react';
import Link from 'next/link';
import { ReconnectButton } from '@/components/accounts/reconnect-button';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await prisma.mt5Account.findUnique({
    where: { id },
    include: { copySettings: true },
  });

  if (!account) {
    notFound();
  }

  // Set default settings if null
  const clientSettings = {
    displayName: account.displayName,
    ...(account.copySettings || {
      riskType: 'RISK_PERCENT',
      fixedLotSize: 0.01,
      lotMultiplier: 1.0,
      riskPercentage: 1.0,
      roundingTolerancePct: 2.0,
      dailyRiskEnabled: false,
      maxDailyRisk: 0,
      maxTradesEnabled: false,
      maxActiveTrades: 0,
      requireTp: true,
      missingSlTimeoutSec: 60,
      maxRecoveryRRDegradation: 0.5,
      maxLotCap: null,
    }),
    maxLotCap: account.copySettings?.maxLotCap ?? null,
  };

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex items-center gap-4">
        <Link href="/accounts" className="p-2 hover:bg-secondary rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Risk Controls</h1>
            <span className="text-sm font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-md font-mono">
              {account.login}
            </span>
            {(() => {
              const isOnline = Boolean((account.isActive ?? false) && account.connectionStatus === 'ONLINE' && account.lastHeartbeatAt && (Math.abs(Date.now() - new Date(account.lastHeartbeatAt).getTime()) < 180_000));
              return (
                <div className="flex items-center gap-2">
                  <div className={`plaiz-pill text-[10px] ${isOnline ? 'plaiz-pill-success' : 'plaiz-pill-destructive'}`}>
                    <Wifi className="w-3 h-3" />
                    {isOnline ? 'Online' : 'Offline'}
                  </div>
                  {!isOnline && (
                    <ReconnectButton
                      accountId={account.id}
                      accountName={account.login}
                      variant="pill"
                      isOnline={isOnline}
                      connectionStatus={account.connectionStatus}
                    />
                  )}
                </div>
              );
            })()}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure safety parameters and execution overrides for this specific sub account.
          </p>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Real-time Parameter Application</p>
          <p className="text-muted-foreground text-xs mt-0.5">Updated safety parameters apply dynamically to subsequent incoming signals. Existing open positions remain governed by their initial entry rules.</p>
        </div>
      </div>

      <RiskSettingsClient accountId={account.id} initialSettings={clientSettings} />
    </div>
  );
}
