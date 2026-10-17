import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { PositionsClient, SerializedTradeSignal, SerializedCopy, SerializedCommand } from './positions-client';

export const dynamic = 'force-dynamic';

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

  // Get user's accounts (both Master and Sub)
  const userAccounts = await prisma.mt5Account.findMany({
    where: { userId: user.id }
  });
  
  const masterAccounts = userAccounts.filter(a => a.role === 'MASTER');
  const subAccounts = userAccounts.filter(a => a.role === 'SUB');

  const masterAccountIds = masterAccounts.map(a => a.id);
  const subAccountIds = subAccounts.map(a => a.id);

  // Map of account ID to login
  const accountLoginMap = new Map(userAccounts.map(a => [a.id, a.login]));

  // Query all trade signals that belong to user's master accounts OR have copies belonging to user's sub accounts
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
          OR: [
            { subAccountId: { in: subAccountIds } },
            { subAccount: { userId: user.id } }
          ]
        },
        include: {
          subAccount: true,
          commands: {
            orderBy: { createdAt: 'desc' }
          }
        }
      }
    }
  }) : [];

  // Safely serialize for Client Component (converting all BigInt to string)
  const serializedSignals: SerializedTradeSignal[] = rawSignals.map(signal => {
    const serializedCopies: SerializedCopy[] = signal.copies.map(copy => {
      const serializedCommands: SerializedCommand[] = copy.commands.map(cmd => ({
        id: cmd.id,
        type: cmd.type,
        status: cmd.status,
        orderTicket: cmd.orderTicket ? cmd.orderTicket.toString() : null,
        executedVolume: cmd.executedVolume,
        executedAt: cmd.executedAt ? cmd.executedAt.toISOString() : null,
        success: cmd.success,
      }));

      return {
        id: copy.id,
        subAccountId: copy.subAccountId,
        subAccountLogin: copy.subAccount?.login || accountLoginMap.get(copy.subAccountId) || 'Unknown Sub',
        subAccountBroker: copy.subAccount?.broker,
        subAccountServer: copy.subAccount?.server,
        state: copy.state,
        subOrderTicket: copy.subOrderTicket ? copy.subOrderTicket.toString() : null,
        subPositionId: copy.subPositionId ? copy.subPositionId.toString() : null,
        executedVolume: copy.executedVolume,
        requestedVolume: copy.requestedVolume,
        currentVolume: copy.currentVolume,
        closedVolume: copy.closedVolume || 0,
        profit: (copy as any).profit ?? null,
        closePrice: (copy as any).closePrice ?? null,
        commands: serializedCommands,
      };
    });

    return {
      id: signal.id,
      ticket: signal.ticket.toString(),
      masterAcctId: signal.masterAcctId,
      masterLogin: accountLoginMap.get(signal.masterAcctId) || 'Master Account',
      symbol: signal.symbol,
      type: signal.type,
      volume: signal.volume,
      priceOpen: signal.priceOpen,
      closePrice: (signal as any).closePrice ?? null,
      profit: (signal as any).profit ?? null,
      isClosed: (signal as any).isClosed ?? false,
      sl: signal.sl || 0,
      tp: signal.tp || 0,
      createdAt: signal.createdAt.toISOString(),
      copies: serializedCopies,
    };
  });

  const serializedAccounts = userAccounts.map(a => ({
    id: a.id,
    login: a.login,
    role: a.role,
    broker: a.broker,
    server: a.server,
  }));

  return <PositionsClient signals={serializedSignals} accounts={serializedAccounts} />;
}

