'use client';

import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Crown, 
  Zap, 
  Target, 
  Percent, 
  Activity, 
  Scale, 
  BarChart2, 
  Clock, 
  ArrowRightLeft
} from 'lucide-react';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { MultiMoneyDisplay } from '@/components/multi-money-display';
import { useCurrency } from '@/components/currency-provider';
import Link from 'next/link';

export interface PerformanceAccount {
  id: string;
  login: string;
  role: string;
  broker?: string | null;
  server?: string | null;
  balance: number;
  equity: number;
  initialBalance?: number;
  currency: string;
}

export interface PerformanceSnapshot {
  id: string;
  mt5AccountId: string;
  balance: number;
  equity: number;
  floatingPl: number;
  timestamp: string;
}

export interface PerformanceTrade {
  id: string;
  ticket: string;
  symbol: string;
  type: string;
  volume: number;
  priceOpen: number;
  closePrice?: number | null;
  profit?: number | null;
  createdAt: string;
  masterLogin?: string;
  subLogin?: string;
  accountRole: 'MASTER' | 'SUB';
  currency?: string;
}

interface PerformanceClientProps {
  accounts: PerformanceAccount[];
  snapshots: PerformanceSnapshot[];
  trades: PerformanceTrade[];
}

export function PerformanceClient({ accounts, snapshots, trades }: PerformanceClientProps) {
  const { currency, exchangeRate, formatMoney } = useCurrency();

  // Helper to convert an amount from source currency to target viewing currency
  const convertAmount = (amount: number, sourceCurrency: string = 'USD') => {
    const src = (sourceCurrency || 'USD').toUpperCase();
    if (src === 'NGN' && currency === 'USD') {
      return amount / exchangeRate;
    } else if (src === 'USD' && currency === 'NGN') {
      return amount * exchangeRate;
    }
    return amount;
  };

  // Format currency helper for current active currency
  const formatCurValue = (val: number) => {
    return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'NGN' ? 0 : 2,
      maximumFractionDigits: currency === 'NGN' ? 0 : 2
    }).format(val);
  };

  // Account currency map
  const accountCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach(a => map.set(a.id, a.currency || 'USD'));
    return map;
  }, [accounts]);

  // Account filter: 'all' | account.login
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'all' | '7d' | '30d'>('all');

  // Filtered accounts based on selection
  const filteredAccounts = useMemo(() => {
    if (selectedAccount === 'all') return accounts;
    return accounts.filter(a => a.login === selectedAccount);
  }, [accounts, selectedAccount]);

  const selectedAccountIds = useMemo(() => {
    return new Set(filteredAccounts.map(a => a.id));
  }, [filteredAccounts]);

  // MultiMoneyDisplay data payloads
  const balanceBalances = useMemo(() => {
    return filteredAccounts.map(a => ({
      id: a.id,
      amount: a.balance || 0,
      currency: a.currency || 'USD'
    }));
  }, [filteredAccounts]);

  const equityBalances = useMemo(() => {
    return filteredAccounts.map(a => ({
      id: a.id,
      amount: a.equity || a.balance || 0,
      currency: a.currency || 'USD'
    }));
  }, [filteredAccounts]);

  // Filtered trades based on selection
  const filteredTrades = useMemo(() => {
    if (selectedAccount === 'all') return trades;
    return trades.filter(t => t.masterLogin === selectedAccount || t.subLogin === selectedAccount);
  }, [trades, selectedAccount]);

  // Calculate high-level performance metrics (converted to active viewing currency)
  const totalBalance = useMemo(() => {
    return filteredAccounts.reduce((sum, a) => sum + convertAmount(a.balance || 0, a.currency), 0);
  }, [filteredAccounts, currency, exchangeRate]);

  const totalEquity = useMemo(() => {
    return filteredAccounts.reduce((sum, a) => sum + convertAmount(a.equity || a.balance || 0, a.currency), 0);
  }, [filteredAccounts, currency, exchangeRate]);

  // Trade analytics (converted to active viewing currency)
  const tradeStats = useMemo(() => {
    const closedTrades = filteredTrades.filter(t => t.profit !== null && t.profit !== undefined);
    const totalTrades = closedTrades.length;
    
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        netProfit: 0,
        profitFactor: 0,
        bestTrade: 0,
        worstTrade: 0,
        grossProfit: 0,
        grossLoss: 0,
      };
    }

    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let bestTrade = -Infinity;
    let worstTrade = Infinity;

    closedTrades.forEach(t => {
      const p = convertAmount(t.profit || 0, t.currency || 'USD');
      if (p > 0) {
        winningTrades++;
        grossProfit += p;
      } else if (p < 0) {
        losingTrades++;
        grossLoss += Math.abs(p);
      }
      if (p > bestTrade) bestTrade = p;
      if (p < worstTrade) worstTrade = p;
    });

    const netProfit = Math.round((grossProfit - grossLoss) * 100) / 100;
    const winRate = Math.round((winningTrades / totalTrades) * 100);
    const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : (grossProfit > 0 ? 999 : 0);

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      netProfit,
      profitFactor,
      bestTrade: bestTrade === -Infinity ? 0 : Math.round(bestTrade * 100) / 100,
      worstTrade: worstTrade === Infinity ? 0 : Math.round(worstTrade * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
    };
  }, [filteredTrades, currency, exchangeRate]);

  // Chart Data preparation: accurate multi-account timeline replay
  const chartData = useMemo<{ date: string; timestamp: number; value: number }[]>(() => {
    // Filter snapshots for selected accounts
    const activeSnapshots = snapshots
      .filter(s => selectedAccountIds.has(s.mt5AccountId))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (filteredAccounts.length === 0) return [];

    // Map each account to its initial starting baseline equity
    const currentEquities = new Map<string, number>();
    filteredAccounts.forEach(acc => {
      const firstSnap = activeSnapshots.find(s => s.mt5AccountId === acc.id);
      const initVal = acc.initialBalance || (firstSnap ? (firstSnap.equity || firstSnap.balance) : (acc.equity || acc.balance || 0));
      currentEquities.set(acc.id, initVal);
    });

    const getPortfolioTotal = () => {
      let total = 0;
      filteredAccounts.forEach(acc => {
        const val = currentEquities.get(acc.id) || 0;
        total += convertAmount(val, acc.currency || 'USD');
      });
      return Math.round(total * 100) / 100;
    };

    if (activeSnapshots.length >= 2) {
      const initialTotal = getPortfolioTotal();
      const firstTs = new Date(activeSnapshots[0].timestamp).getTime();

      // Bucket snapshots by hour, recording the latest closing valuation per hour
      const hourlyState = new Map<string, { date: string; timestamp: number; value: number }>();

      // Baseline starting point 1 hour before first snapshot
      const baselineTime = firstTs - 3600000;
      const baselineDate = new Date(baselineTime);
      const baselineKey = `${baselineDate.getFullYear()}-${baselineDate.getMonth() + 1}-${baselineDate.getDate()} ${baselineDate.getHours()}:00`;
      hourlyState.set(baselineKey, {
        date: baselineDate.toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timestamp: baselineTime,
        value: initialTotal,
      });

      // Process chronologically: update account state and record bucket valuation
      activeSnapshots.forEach(s => {
        const d = new Date(s.timestamp);
        const hourKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:00`;

        currentEquities.set(s.mt5AccountId, s.equity || s.balance || 0);
        const currentTotal = getPortfolioTotal();

        hourlyState.set(hourKey, {
          date: d.toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          timestamp: d.getTime(),
          value: currentTotal,
        });
      });

      // Add current live portfolio state
      const now = Date.now();
      let liveTotal = 0;
      filteredAccounts.forEach(acc => {
        liveTotal += convertAmount(acc.equity || acc.balance || 0, acc.currency || 'USD');
      });
      liveTotal = Math.round(liveTotal * 100) / 100;

      const sorted = Array.from(hourlyState.values()).sort((a, b) => a.timestamp - b.timestamp);

      // Append live point if it's newer than the last recorded point
      if (sorted.length > 0 && now - sorted[sorted.length - 1].timestamp > 60000) {
        sorted.push({
          date: new Date(now).toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          timestamp: now,
          value: liveTotal,
        });
      }

      if (sorted.length >= 2) {
        return sorted;
      }
    }

    // Fallback: If snapshots are fewer than 2, synthesize curve from current equity + closed trades
    if (totalEquity > 0) {
      const now = Date.now();
      const points: { date: string; timestamp: number; value: number }[] = [];
      const baseEquity = Math.max(0, totalEquity - tradeStats.netProfit);

      // If closedTrades exist, plot progression across trades
      const closedTrades = filteredTrades
        .filter(t => t.profit !== null && t.profit !== undefined)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (closedTrades.length > 0) {
        let runningEquity = baseEquity;
        const firstTradeTime = new Date(closedTrades[0].createdAt).getTime();
        points.push({
          date: 'Initial',
          timestamp: firstTradeTime - 3600000,
          value: Math.round(baseEquity * 100) / 100
        });

        closedTrades.forEach((t) => {
          runningEquity += convertAmount(t.profit || 0, t.currency || 'USD');
          const d = new Date(t.createdAt);
          points.push({
            date: d.toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            timestamp: d.getTime(),
            value: Math.round(runningEquity * 100) / 100
          });
        });

        // Add current live point
        points.push({
          date: 'Live Portfolio',
          timestamp: now,
          value: Math.round(totalEquity * 100) / 100
        });

        return points;
      }

      // No closed trades yet: synthesize a clean 24h trajectory to current equity
      points.push({
        date: 'Start',
        timestamp: now - 3600000 * 24,
        value: Math.round(baseEquity * 100) / 100
      });

      points.push({
        date: 'Live Portfolio',
        timestamp: now,
        value: Math.round(totalEquity * 100) / 100
      });

      return points;
    }

    return [];
  }, [snapshots, selectedAccountIds, filteredAccounts, totalEquity, tradeStats.netProfit, filteredTrades, currency, exchangeRate]);

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar max-w-7xl mx-auto w-full">
      {/* HEADER & ACCOUNT SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/30">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <LineChart className="w-6 h-6 text-primary" />
            Performance & Portfolio Analytics
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Comprehensive portfolio growth curve, win rate metrics, and historical trade statistics.
          </p>
        </div>

        {/* Account Selector Filter */}
        <div className="flex items-center p-1 bg-secondary/50 border border-border/40 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setSelectedAccount('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedAccount === 'all'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Accounts
          </button>
          {accounts.map(acc => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccount(acc.login)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedAccount === acc.login
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {acc.role === 'MASTER' ? (
                <Crown className="w-3 h-3 text-amber-400 shrink-0" />
              ) : (
                <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
              <span>#{acc.login}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Equity */}
        <div className="plaiz-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Portfolio Equity</span>
            <Activity className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold num-tabular text-foreground">
              <MultiMoneyDisplay 
                balances={equityBalances}
                liveType="equity"
              />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <span>Balance:</span>
              <MultiMoneyDisplay balances={balanceBalances} liveType="balance" />
            </div>
          </div>
        </div>

        {/* Realized Profit / Loss */}
        <div className="plaiz-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Net Realized P/L</span>
            {tradeStats.netProfit >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            )}
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-bold num-tabular ${
              tradeStats.netProfit > 0 ? 'text-emerald-500' : tradeStats.netProfit < 0 ? 'text-rose-500' : 'text-muted-foreground'
            }`}>
              {tradeStats.netProfit > 0 ? `+${formatCurValue(tradeStats.netProfit)}` : tradeStats.netProfit < 0 ? `-${formatCurValue(Math.abs(tradeStats.netProfit))}` : formatCurValue(0)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Across {tradeStats.totalTrades} completed trade{tradeStats.totalTrades === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="plaiz-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Win Rate</span>
            <Percent className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold num-tabular text-foreground flex items-center gap-2">
              {tradeStats.winRate}%
              <span className="text-xs font-normal text-muted-foreground">
                ({tradeStats.winningTrades}W / {tradeStats.losingTrades}L)
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              {tradeStats.totalTrades > 0 ? `${tradeStats.winningTrades} of ${tradeStats.totalTrades} trades profitable` : 'Awaiting completed trades'}
            </span>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="plaiz-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Profit Factor</span>
            <Scale className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold num-tabular text-foreground">
              {tradeStats.profitFactor > 50 ? 'N/A' : tradeStats.profitFactor.toFixed(2)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Gains: +{formatCurValue(tradeStats.grossProfit)} &bull; Losses: -{formatCurValue(tradeStats.grossLoss)}
            </span>
          </div>
        </div>
      </div>

      {/* PORTFOLIO GROWTH CURVE */}
      <section className="plaiz-card p-4 sm:p-6 rounded-2xl flex flex-col border border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Portfolio Growth Trajectory
            </h2>
            <p className="text-xs text-muted-foreground">
              Real-time portfolio valuation curve plotted from broker equity snapshots and trade milestones.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Broker Feed Active
          </div>
        </div>

        <div className="w-full">
          {chartData.length > 0 ? (
            <PerformanceChart data={chartData} height={280} netProfit={tradeStats.netProfit} />
          ) : (
            <div className="h-[260px] w-full flex flex-col items-center justify-center text-center p-8 bg-black/5 dark:bg-white/[0.02] rounded-xl border border-dashed border-border/40">
              <Activity className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-foreground">Awaiting Trading Activity</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Connect an MT5 account or start copying trades to generate live equity curves and performance tracking.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* TRADE METRICS & INSIGHTS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="plaiz-card p-4 rounded-xl border border-border/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Best Trade</span>
            <span className="font-mono font-bold text-base text-emerald-500">
              {tradeStats.bestTrade > 0 ? `+${formatCurValue(tradeStats.bestTrade)}` : formatCurValue(0)}
            </span>
          </div>
          <ArrowUpRight className="w-5 h-5 text-emerald-500/80" />
        </div>

        <div className="plaiz-card p-4 rounded-xl border border-border/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Worst Trade</span>
            <span className="font-mono font-bold text-base text-rose-500">
              {tradeStats.worstTrade < 0 ? `-${formatCurValue(Math.abs(tradeStats.worstTrade))}` : formatCurValue(0)}
            </span>
          </div>
          <ArrowDownRight className="w-5 h-5 text-rose-500/80" />
        </div>

        <div className="plaiz-card p-4 rounded-xl border border-border/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Average Return / Trade</span>
            <span className={`font-mono font-bold text-base ${
              tradeStats.totalTrades > 0 && (tradeStats.netProfit / tradeStats.totalTrades) >= 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}>
              {tradeStats.totalTrades > 0 
                ? (tradeStats.netProfit / tradeStats.totalTrades >= 0 
                    ? `+${formatCurValue(tradeStats.netProfit / tradeStats.totalTrades)}` 
                    : `-${formatCurValue(Math.abs(tradeStats.netProfit / tradeStats.totalTrades))}`)
                : formatCurValue(0)}
            </span>
          </div>
          <BarChart2 className="w-5 h-5 text-primary/80" />
        </div>
      </div>

      {/* CLOSED TRADES PERFORMANCE LOG */}
      <section className="plaiz-card rounded-2xl overflow-hidden border border-border/40">
        <div className="p-4 sm:p-5 border-b border-border/30 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Completed Trade Performance History
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Closed trades contributing to portfolio performance analytics.
            </p>
          </div>
          <Link 
            href="/positions" 
            className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            <span>Live Positions</span>
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {filteredTrades.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No completed trades recorded for this selection yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider border-b border-border/30">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Symbol & Side</th>
                  <th className="px-4 py-3">Account Execution</th>
                  <th className="px-4 py-3">Volume</th>
                  <th className="px-4 py-3">Entry / Exit</th>
                  <th className="px-4 py-3">Realized P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono">
                {filteredTrades.map(trade => {
                  const isBuy = trade.type.includes('BUY');
                  const profit = trade.profit;

                  return (
                    <tr key={trade.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(trade.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(trade.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-sans">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isBuy ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                          }`}>
                            {trade.type}
                          </span>
                          <span className="font-bold text-foreground">{trade.symbol}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-sans">
                        {trade.accountRole === 'MASTER' ? (
                          <div className="inline-flex items-center gap-1 text-blue-400 font-semibold text-xs">
                            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Master #{trade.masterLogin}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                            <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Sub #{trade.subLogin}</span>
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground block font-mono">Tkt #{trade.ticket}</span>
                      </td>

                      <td className="px-4 py-3 font-medium text-foreground">
                        {trade.volume} Lot{trade.volume === 1 ? '' : 's'}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        <div>Entry: {trade.priceOpen ? trade.priceOpen.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}</div>
                        {trade.closePrice && <div>Exit: {trade.closePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
                      </td>

                      <td className="px-4 py-3 font-bold text-sm">
                        {profit !== null && profit !== undefined ? (
                          <span className={profit > 0 ? 'text-emerald-500' : profit < 0 ? 'text-rose-500' : 'text-muted-foreground'}>
                            {profit > 0 ? `+${formatCurValue(convertAmount(profit, trade.currency || 'USD'))}` : profit < 0 ? `-${formatCurValue(Math.abs(convertAmount(profit, trade.currency || 'USD')))}` : formatCurValue(0)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
