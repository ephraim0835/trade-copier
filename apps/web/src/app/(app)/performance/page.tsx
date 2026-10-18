import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { 
  PerformanceClient, 
  PerformanceAccount, 
  PerformanceSnapshot, 
  PerformanceTrade 
} from './performance-client';

export const dynamic = 'force-dynamic';

export default async function PerformancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) redirect('/login');

  // 1. Fetch user accounts
  const userAccounts = await prisma.mt5Account.findMany({
    where: { userId: user.id },
    orderBy: { role: 'asc' },
  });

  const masterAccountIds = userAccounts.filter(a => a.role === 'MASTER').map(a => a.id);
  const subAccountIds = userAccounts.filter(a => a.role === 'SUB').map(a => a.id);
  const accountLoginMap = new Map(userAccounts.map(a => [a.id, a.login]));

  // 2. Fetch snapshots
  const snapshots = await prisma.accountSnapshot.findMany({
    where: { mt5Account: { userId: user.id } },
    orderBy: { timestamp: 'asc' },
    take: 500,
  });

  // 3. Fetch completed trade signals and copies
  const rawSignals = (masterAccountIds.length > 0 || subAccountIds.length > 0) ? await prisma.tradeSignal.findMany({
    where: {
      OR: [
        ...(masterAccountIds.length > 0 ? [{ masterAcctId: { in: masterAccountIds } }] : []),
        ...(subAccountIds.length > 0 ? [{ copies: { some: { subAccountId: { in: subAccountIds } } } }] : [])
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      copies: {
        where: {
          subAccountId: { in: subAccountIds }
        },
        include: {
          subAccount: true
        }
      }
    }
  }) : [];

  // Serialize accounts
  const serializedAccounts: PerformanceAccount[] = userAccounts.map(a => ({
    id: a.id,
    login: a.login,
    role: a.role,
    broker: a.broker,
    server: a.server,
    balance: a.balance || 0,
    equity: a.equity || a.balance || 0,
    currency: a.currency || 'USD',
  }));

  // Serialize snapshots
  const serializedSnapshots: PerformanceSnapshot[] = snapshots.map(s => ({
    id: s.id,
    mt5AccountId: s.mt5AccountId,
    balance: s.balance,
    equity: s.equity,
    floatingPl: s.floatingPl,
    timestamp: s.timestamp.toISOString(),
  }));

  const accountCurrencyMap = new Map(userAccounts.map(a => [a.id, a.currency || 'USD']));

  // Build trade list from both master signals and sub copies
  const trades: PerformanceTrade[] = [];

  rawSignals.forEach(signal => {
    // If user owns master account, add master trade record
    if (masterAccountIds.includes(signal.masterAcctId)) {
      trades.push({
        id: `m_${signal.id}`,
        ticket: signal.ticket.toString(),
        symbol: signal.symbol,
        type: signal.type,
        volume: signal.volume,
        priceOpen: signal.priceOpen,
        closePrice: (signal as any).closePrice ?? null,
        profit: (signal as any).profit ?? null,
        createdAt: signal.createdAt.toISOString(),
        masterLogin: accountLoginMap.get(signal.masterAcctId),
        accountRole: 'MASTER',
        currency: accountCurrencyMap.get(signal.masterAcctId) || 'USD',
      });
    }

    // Add sub copy records
    signal.copies.forEach(copy => {
      trades.push({
        id: `s_${copy.id}`,
        ticket: copy.subPositionId?.toString() || copy.subOrderTicket?.toString() || signal.ticket.toString(),
        symbol: signal.symbol,
        type: signal.type,
        volume: copy.executedVolume || copy.requestedVolume || 0,
        priceOpen: signal.priceOpen,
        closePrice: (copy as any).closePrice ?? (signal as any).closePrice ?? null,
        profit: (copy as any).profit ?? null,
        createdAt: signal.createdAt.toISOString(),
        masterLogin: accountLoginMap.get(signal.masterAcctId),
        subLogin: copy.subAccount?.login || accountLoginMap.get(copy.subAccountId),
        accountRole: 'SUB',
        currency: copy.subAccount?.currency || accountCurrencyMap.get(copy.subAccountId) || 'USD',
      });
    });
  });

  return (
    <PerformanceClient 
      accounts={serializedAccounts}
      snapshots={serializedSnapshots}
      trades={trades}
    />
  );
}
