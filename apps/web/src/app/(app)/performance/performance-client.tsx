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
import Link from 'next/link';

export interface PerformanceAccount {
  id: string;
  login: string;
  role: string;
  broker?: string | null;
  server?: string | null;
  balance: number;
  equity: number;
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
}

interface PerformanceClientProps {
  accounts: PerformanceAccount[];
  snapshots: PerformanceSnapshot[];
  trades: PerformanceTrade[];
}

export function PerformanceClient({ accounts, snapshots, trades }: PerformanceClientProps) {
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

  // Filtered trades based on selection
  const filteredTrades = useMemo(() => {
    if (selectedAccount === 'all') return trades;
    return trades.filter(t => t.masterLogin === selectedAccount || t.subLogin === selectedAccount);
  }, [trades, selectedAccount]);

  // Calculate high-level performance metrics
  const totalBalance = useMemo(() => {
    return filteredAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [filteredAccounts]);

  const totalEquity = useMemo(() => {
    return filteredAccounts.reduce((sum, a) => sum + (a.equity || a.balance || 0), 0);
  }, [filteredAccounts]);

  // Trade analytics
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
      const p = t.profit || 0;
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
  }, [filteredTrades]);

  // Chart Data preparation: group snapshots or synthesize from trade trajectory
  const chartData = useMemo(() => {
    // Filter snapshots for selected accounts
    const activeSnapshots = snapshots.filter(s => selectedAccountIds.has(s.mt5AccountId));

    if (activeSnapshots.length >= 2) {
      // Group by hour
      const grouped = activeSnapshots.reduce((acc: any, curr) => {
        const d = new Date(curr.timestamp);
        const hourKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:00`;
        if (!acc[hourKey]) {
          acc[hourKey] = {
            date: d.toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            timestamp: d.getTime(),
            value: 0
          };
        }
        acc[hourKey].value += (curr.equity || curr.balance || 0);
        return acc;
      }, {});

      return Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
    }

    // If snapshots are fewer than 2, synthesize curve from current equity + closed trades
    if (totalEquity > 0) {
      const now = Date.now();
      const points = [];
      const baseEquity = totalEquity - tradeStats.netProfit;

      points.push({
        date: 'Start',
        timestamp: now - 3600000 * 6,
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
  }, [snapshots, selectedAccountIds, totalEquity, tradeStats.netProfit]);

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
              ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Balance: ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Realized Profit / Loss */}
        <div className="plaiz-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Net Realized P/L</span>
            <TrendingUp className={`w-3.5 h-3.5 ${tradeStats.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-bold num-tabular ${
              tradeStats.netProfit > 0 ? 'text-emerald-500' : tradeStats.netProfit < 0 ? 'text-red-500' : 'text-muted-foreground'
            }`}>
              {tradeStats.netProfit > 0 ? `+$${tradeStats.netProfit.toFixed(2)}` : tradeStats.netProfit < 0 ? `-$${Math.abs(tradeStats.netProfit).toFixed(2)}` : '$0.00'}
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
              Gains: +${tradeStats.grossProfit.toFixed(2)} &bull; Losses: -${tradeStats.grossLoss.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* PORTFOLIO GROWTH CURVE */}
      <section className="plaiz-card p-5 sm:p-6 rounded-2xl flex flex-col min-h-[420px] border border-border/40">
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

        <div className="flex-1 w-full min-h-[300px]">
          {chartData.length > 0 ? (
            <PerformanceChart data={chartData} />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-center p-8">
              <Activity className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Initializing growth curve from broker feed...</p>
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
              {tradeStats.bestTrade > 0 ? `+$${tradeStats.bestTrade.toFixed(2)}` : '$0.00'}
            </span>
          </div>
          <ArrowUpRight className="w-5 h-5 text-emerald-500/80" />
        </div>

        <div className="plaiz-card p-4 rounded-xl border border-border/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Worst Trade</span>
            <span className="font-mono font-bold text-base text-red-500">
              {tradeStats.worstTrade < 0 ? `-$${Math.abs(tradeStats.worstTrade).toFixed(2)}` : '$0.00'}
            </span>
          </div>
          <ArrowDownRight className="w-5 h-5 text-red-500/80" />
        </div>

        <div className="plaiz-card p-4 rounded-xl border border-border/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Average Return / Trade</span>
            <span className={`font-mono font-bold text-base ${
              tradeStats.totalTrades > 0 && (tradeStats.netProfit / tradeStats.totalTrades) >= 0 ? 'text-emerald-500' : 'text-red-500'
            }`}>
              {tradeStats.totalTrades > 0 
                ? (tradeStats.netProfit / tradeStats.totalTrades >= 0 
                    ? `+$${(tradeStats.netProfit / tradeStats.totalTrades).toFixed(2)}` 
                    : `-$${Math.abs(tradeStats.netProfit / tradeStats.totalTrades).toFixed(2)}`)
                : '$0.00'}
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
                          <span className={profit > 0 ? 'text-emerald-500' : profit < 0 ? 'text-red-500' : 'text-muted-foreground'}>
                            {profit > 0 ? `+$${profit.toFixed(2)}` : profit < 0 ? `-$${Math.abs(profit).toFixed(2)}` : '$0.00'}
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
