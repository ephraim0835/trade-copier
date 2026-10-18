'use client';

import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Shield, 
  LayoutGrid, 
  List,
  Activity,
  ArrowRightLeft,
  X,
  Crown,
  Zap,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { MoneyDisplay } from '@/components/money-display';

export interface SerializedCommand {
  id: string;
  type: string;
  status: string;
  orderTicket?: string | null;
  executedVolume?: number | null;
  executedAt?: string | null;
  success?: boolean | null;
}

export interface SerializedCopy {
  id: string;
  subAccountId: string;
  subAccountLogin: string;
  subAccountBroker?: string | null;
  subAccountServer?: string | null;
  state: string;
  subOrderTicket?: string | null;
  subPositionId?: string | null;
  executedVolume?: number | null;
  requestedVolume?: number | null;
  currentVolume?: number | null;
  closedVolume: number;
  profit?: number | null;
  closePrice?: number | null;
  commands: SerializedCommand[];
}

export interface SerializedTradeSignal {
  id: string;
  ticket: string;
  masterAcctId: string;
  masterLogin: string;
  symbol: string;
  type: string;
  volume: number;
  priceOpen: number;
  closePrice?: number | null;
  profit?: number | null;
  isClosed?: boolean;
  sl: number;
  tp: number;
  createdAt: string;
  copies: SerializedCopy[];
}

export interface UserAccountSummary {
  id: string;
  login: string;
  role: string;
  broker?: string | null;
  server?: string | null;
  balance?: number;
  equity?: number;
  currency?: string;
}

interface PositionsClientProps {
  signals: SerializedTradeSignal[];
  accounts?: UserAccountSummary[];
}

// Flat representation of a trade specific to one account
export interface AccountSpecificTrade {
  id: string;
  ticket: string;
  accountId: string;
  accountLogin: string;
  accountRole: 'MASTER' | 'SUB';
  symbol: string;
  type: string;
  volume: number;
  priceOpen: number;
  closePrice?: number | null;
  profit?: number | null;
  sl: number;
  tp: number;
  createdAt: string;
  isOpen: boolean;
  isClosed: boolean;
  masterOriginLogin?: string;
}

export function PositionsClient({ signals, accounts = [] }: PositionsClientProps) {
  // If there are accounts, default selected account to the first Sub account (or Master)
  const defaultAccount = useMemo(() => {
    const sub = accounts.find(a => a.role === 'SUB');
    if (sub) return sub.login;
    if (accounts.length > 0) return accounts[0].login;
    return 'all';
  }, [accounts]);

  const [selectedAccountLogin, setSelectedAccountLogin] = useState<string>(defaultAccount);
  const [activeTab, setActiveTab] = useState<'active' | 'closed' | 'all'>('closed');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Decompose all signals into individual account trades so each account has its OWN trades and PnL
  const allAccountTrades = useMemo(() => {
    const list: AccountSpecificTrade[] = [];

    signals.forEach(signal => {
      const isSignalClosed = signal.isClosed || 
        (signal.profit !== null && signal.profit !== undefined) || 
        (signal.closePrice !== null && signal.closePrice !== undefined);

      // 1. Master Account Trade
      list.push({
        id: `m_${signal.id}`,
        ticket: signal.ticket,
        accountId: signal.masterAcctId,
        accountLogin: signal.masterLogin,
        accountRole: 'MASTER',
        symbol: signal.symbol,
        type: signal.type,
        volume: signal.volume,
        priceOpen: signal.priceOpen,
        closePrice: signal.closePrice,
        profit: signal.profit,
        sl: signal.sl,
        tp: signal.tp,
        createdAt: signal.createdAt,
        isOpen: !isSignalClosed,
        isClosed: isSignalClosed,
      });

      // 2. Sub Account Trades (copies)
      signal.copies.forEach(copy => {
        const isCopyClosed = isSignalClosed ||
          (copy.profit !== null && copy.profit !== undefined) ||
          (copy.closePrice !== null && copy.closePrice !== undefined) ||
          (copy.closedVolume > 0 && (copy.currentVolume === 0 || copy.currentVolume === null)) ||
          (copy.currentVolume !== null && copy.currentVolume !== undefined && copy.currentVolume <= 0);

        list.push({
          id: `s_${copy.id}`,
          ticket: copy.subPositionId || copy.subOrderTicket || signal.ticket,
          accountId: copy.subAccountId,
          accountLogin: copy.subAccountLogin,
          accountRole: 'SUB',
          symbol: signal.symbol,
          type: signal.type,
          volume: copy.executedVolume || copy.requestedVolume || signal.volume,
          priceOpen: signal.priceOpen,
          closePrice: copy.closePrice || signal.closePrice,
          profit: copy.profit,
          sl: signal.sl,
          tp: signal.tp,
          createdAt: signal.createdAt,
          isOpen: !isCopyClosed,
          isClosed: isCopyClosed,
          masterOriginLogin: signal.masterLogin,
        });
      });
    });

    return list;
  }, [signals]);

  // Compute per-account performance metrics (Realized P/L, Open Positions, Closed Trades)
  const accountStatsMap = useMemo(() => {
    const map = new Map<string, { realizedPnl: number; openCount: number; closedCount: number }>();

    accounts.forEach(acc => {
      map.set(acc.login, { realizedPnl: 0, openCount: 0, closedCount: 0 });
    });

    allAccountTrades.forEach(trade => {
      const stats = map.get(trade.accountLogin) || { realizedPnl: 0, openCount: 0, closedCount: 0 };
      if (trade.isOpen) {
        stats.openCount++;
      } else if (trade.isClosed) {
        stats.closedCount++;
        if (trade.profit !== null && trade.profit !== undefined) {
          stats.realizedPnl += trade.profit;
        }
      }
      map.set(trade.accountLogin, stats);
    });

    // Round PnLs
    map.forEach(stats => {
      stats.realizedPnl = Math.round(stats.realizedPnl * 100) / 100;
    });

    return map;
  }, [accounts, allAccountTrades]);

  // Filter trades for the selected account
  const accountTrades = useMemo(() => {
    if (selectedAccountLogin === 'all') return allAccountTrades;
    return allAccountTrades.filter(t => t.accountLogin === selectedAccountLogin);
  }, [allAccountTrades, selectedAccountLogin]);

  // Tab filtering: Active / Closed / All
  const displayedTrades = useMemo(() => {
    let list = accountTrades;
    if (activeTab === 'active') {
      list = list.filter(t => t.isOpen);
    } else if (activeTab === 'closed') {
      list = list.filter(t => t.isClosed);
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase().trim();
    return list.filter(t => 
      t.symbol.toLowerCase().includes(query) ||
      t.type.toLowerCase().includes(query) ||
      t.ticket.includes(query) ||
      t.accountLogin.includes(query)
    );
  }, [accountTrades, activeTab, searchQuery]);

  // Active / Closed counts for current view
  const currentOpenCount = useMemo(() => accountTrades.filter(t => t.isOpen).length, [accountTrades]);
  const currentClosedCount = useMemo(() => accountTrades.filter(t => t.isClosed).length, [accountTrades]);

  // Realized P/L for current selection
  const currentRealizedPnl = useMemo(() => {
    if (selectedAccountLogin !== 'all') {
      return accountStatsMap.get(selectedAccountLogin)?.realizedPnl || 0;
    }
    let total = 0;
    accountTrades.forEach(t => {
      if (t.isClosed && t.profit !== null && t.profit !== undefined) {
        total += t.profit;
      }
    });
    return Math.round(total * 100) / 100;
  }, [selectedAccountLogin, accountStatsMap, accountTrades]);

  const activeAccountObj = accounts.find(a => a.login === selectedAccountLogin);

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar max-w-7xl mx-auto w-full">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/30">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
            Live Positions & Trades
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Select an account to view its specific positions, volume, and exact P/L.
          </p>
        </div>

        {/* Live Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Copier Sync Active
        </div>
      </div>

      {/* 2. DEDICATED ACCOUNT CARDS STRIP - EACH ACCOUNT HAS ITS OWN PnL */}
      <div>
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2.5 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <span>Select Account to Inspect</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map(acc => {
            const isSelected = selectedAccountLogin === acc.login;
            const stats = accountStatsMap.get(acc.login) || { realizedPnl: 0, openCount: 0, closedCount: 0 };
            const isMaster = acc.role === 'MASTER';

            return (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountLogin(acc.login)}
                className={`p-4 rounded-2xl text-left transition-all border flex flex-col justify-between gap-3 ${
                  isSelected 
                    ? 'bg-secondary/70 border-primary shadow-sm ring-1 ring-primary/40' 
                    : 'bg-card border-border/40 hover:border-border/70 hover:bg-secondary/20'
                }`}
              >
                {/* Account Tag & Role */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isMaster ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'
                    }`}>
                      {isMaster ? <Crown className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-foreground font-mono">
                        #{acc.login}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {isMaster ? 'Master Account' : 'Sub Account'}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground border-transparent' 
                      : 'bg-secondary text-muted-foreground border-border/40'
                  }`}>
                    {isSelected ? 'Viewing' : 'Select'}
                  </span>
                </div>

                {/* Account's Own Balance & Realized P/L */}
                <div className="flex items-end justify-between pt-2 border-t border-border/20 w-full">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Balance</span>
                    <span className="font-mono font-semibold text-xs text-foreground">
                      <MoneyDisplay 
                        amount={acc.balance || 0} 
                        sourceCurrency={acc.currency || 'USD'} 
                        accountId={acc.id} 
                        liveType="balance" 
                      />
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Realized P/L</span>
                    <span className="font-mono font-bold text-sm">
                      <MoneyDisplay 
                        amount={stats.realizedPnl} 
                        sourceCurrency={acc.currency || 'USD'} 
                        colored={true} 
                        showSign={true} 
                      />
                    </span>
                  </div>
                </div>

                {/* Position summary */}
                <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-between">
                  <span>{stats.openCount > 0 ? `${stats.openCount} Open` : 'Flat (0 Open)'}</span>
                  <span>{stats.closedCount} Closed</span>
                </div>
              </button>
            );
          })}

          {/* All Accounts / Fleet Option */}
          <button
            onClick={() => setSelectedAccountLogin('all')}
            className={`p-4 rounded-2xl text-left transition-all border flex flex-col justify-between gap-3 ${
              selectedAccountLogin === 'all' 
                ? 'bg-secondary/70 border-primary shadow-sm ring-1 ring-primary/40' 
                : 'bg-card border-border/40 hover:border-border/70 hover:bg-secondary/20'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground">All Accounts</span>
                  <span className="text-[10px] text-muted-foreground block">Combined Fleet Overview</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                selectedAccountLogin === 'all' 
                  ? 'bg-primary text-primary-foreground border-transparent' 
                  : 'bg-secondary text-muted-foreground border-border/40'
              }`}>
                {selectedAccountLogin === 'all' ? 'Viewing' : 'Select'}
              </span>
            </div>

            <div className="flex items-end justify-between pt-2 border-t border-border/20 w-full">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Total Accounts</span>
                <span className="font-mono font-semibold text-xs text-foreground">{accounts.length} Accounts</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Combined P/L</span>
                <span className={`font-mono font-bold text-sm ${
                  currentRealizedPnl > 0 ? 'text-emerald-500' : currentRealizedPnl < 0 ? 'text-red-500' : 'text-muted-foreground'
                }`}>
                  {currentRealizedPnl > 0 ? `+$${currentRealizedPnl.toFixed(2)}` : currentRealizedPnl < 0 ? `-$${Math.abs(currentRealizedPnl).toFixed(2)}` : '$0.00'}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-between">
              <span>{currentOpenCount > 0 ? `${currentOpenCount} Open` : 'Flat (0 Open)'}</span>
              <span>{currentClosedCount} Closed</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. FOCUSED ACCOUNT BANNER & CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Status Tabs */}
        <div className="flex items-center p-1 bg-secondary/50 border border-border/40 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Active</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'active' 
                ? 'bg-background/20 text-background font-bold' 
                : 'bg-secondary text-muted-foreground'
            }`}>
              {currentOpenCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('closed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === 'closed'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Closed History</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'closed' 
                ? 'bg-background/20 text-background font-bold' 
                : 'bg-secondary text-muted-foreground'
            }`}>
              {currentClosedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>All</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'all' 
                ? 'bg-background/20 text-background font-bold' 
                : 'bg-secondary text-muted-foreground'
            }`}>
              {accountTrades.length}
            </span>
          </button>
        </div>

        {/* Search & View Mode Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol, ticket..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-secondary/30 border border-border/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center p-1 bg-secondary/50 border border-border/40 rounded-xl">
            <button
              onClick={() => setViewMode('cards')}
              title="Card View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'cards' 
                  ? 'bg-foreground text-background shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' 
                  ? 'bg-foreground text-background shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. CLEAN TRADE LIST - ZERO INFO OVERLOAD */}
      {displayedTrades.length === 0 ? (
        <div className="plaiz-card p-10 rounded-2xl text-center flex flex-col items-center justify-center border border-border/40">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-3">
            <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {activeTab === 'active' 
              ? 'No Open Positions on This Account' 
              : activeTab === 'closed' 
              ? 'No Closed Trades Found' 
              : 'No Trades Recorded'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
            {activeTab === 'active'
              ? `Account ${selectedAccountLogin === 'all' ? 'portfolio' : '#' + selectedAccountLogin} is flat with zero open market exposure.`
              : 'Completed trades for this account will appear here.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* SIMPLE, UNCLUTTERED CARD VIEW */
        <div className="space-y-3">
          {displayedTrades.map(trade => {
            const isBuy = trade.type.includes('BUY');
            const profit = trade.profit;

            return (
              <div 
                key={trade.id} 
                className={`plaiz-card rounded-2xl p-4 sm:p-5 transition-all border ${
                  trade.isOpen 
                    ? 'border-emerald-500/30 bg-emerald-500/[0.02] shadow-sm' 
                    : 'border-border/40 hover:border-border/70'
                }`}
              >
                {/* Header: Side, Symbol, Volume, Time, Account PnL, Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/30">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Buy / Sell Badge */}
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase ${
                      isBuy ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                    }`}>
                      {trade.type}
                    </span>

                    {/* Symbol */}
                    <span className="font-bold text-base sm:text-lg text-foreground tracking-tight">
                      {trade.symbol}
                    </span>

                    {/* Lot Size */}
                    <span className="font-mono text-xs font-semibold text-foreground px-2 py-0.5 rounded bg-secondary">
                      {trade.volume} Lot{trade.volume === 1 ? '' : 's'}
                    </span>

                    {/* Account Attribution Pill */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold font-mono ${
                      trade.accountRole === 'MASTER' 
                        ? 'bg-blue-500/10 text-blue-400' 
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {trade.accountRole === 'MASTER' ? <Crown className="w-3 h-3 text-amber-400" /> : <Zap className="w-3 h-3 text-emerald-400" />}
                      <span>#{trade.accountLogin}</span>
                    </span>

                    <span className="text-muted-foreground/30 hidden sm:inline">&bull;</span>

                    {/* Time */}
                    <span className="text-xs text-muted-foreground hidden sm:inline font-mono">
                      {new Date(trade.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(trade.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {/* THIS ACCOUNT'S PnL (HERO NUMBER) & STATUS */}
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {profit !== null && profit !== undefined ? (
                      <span className={`font-mono font-bold text-base num-tabular ${
                        profit > 0 ? 'text-emerald-500' : profit < 0 ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        {profit > 0 ? `+$${profit.toFixed(2)}` : profit < 0 ? `-$${Math.abs(profit).toFixed(2)}` : '$0.00'}
                      </span>
                    ) : trade.isOpen ? (
                      <span className="text-xs font-mono font-semibold text-emerald-500">Live Floating</span>
                    ) : null}

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                      trade.isOpen 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
                        : 'bg-secondary/60 text-muted-foreground border-border/40'
                    }`}>
                      {trade.isOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      {trade.isOpen ? 'Active' : 'Closed'}
                    </span>
                  </div>
                </div>

                {/* Clean Metrics: Entry, Exit, SL, TP, Order Ticket */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Entry Price</span>
                    <span className="font-mono font-semibold text-foreground text-xs num-tabular">
                      {trade.priceOpen ? trade.priceOpen.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Exit Price</span>
                    <span className="font-mono font-semibold text-foreground text-xs num-tabular">
                      {trade.closePrice ? trade.closePrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : trade.isOpen ? 'In Market' : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Stop Loss</span>
                    <span className={`font-mono font-semibold text-xs num-tabular ${trade.sl ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {trade.sl ? trade.sl.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Take Profit</span>
                    <span className={`font-mono font-semibold text-xs num-tabular ${trade.tp ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {trade.tp ? trade.tp.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Ticket #</span>
                    <span className="font-mono text-muted-foreground text-xs">
                      #{trade.ticket}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* SIMPLE TABLE VIEW */
        <div className="plaiz-card rounded-2xl overflow-hidden border border-border/40">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider border-b border-border/30">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Trade</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Volume</th>
                  <th className="px-4 py-3">Entry / Exit</th>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Realized P/L</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono">
                {displayedTrades.map(trade => {
                  const isBuy = trade.type.includes('BUY');
                  const profit = trade.profit;

                  return (
                    <tr key={trade.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{new Date(trade.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-[10px] text-muted-foreground/60">{new Date(trade.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                      </td>

                      <td className="px-4 py-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isBuy ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                          }`}>
                            {trade.type}
                          </span>
                          <span className="font-bold text-foreground">{trade.symbol}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-sans">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          trade.accountRole === 'MASTER' ? 'text-blue-400' : 'text-emerald-400'
                        }`}>
                          {trade.accountRole === 'MASTER' ? <Crown className="w-3 h-3 text-amber-400" /> : <Zap className="w-3 h-3 text-emerald-400" />}
                          <span>#{trade.accountLogin}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold text-foreground">
                        {trade.volume} Lot{trade.volume === 1 ? '' : 's'}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        <div>Entry: {trade.priceOpen ? trade.priceOpen.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}</div>
                        {trade.closePrice && <div>Exit: {trade.closePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        #{trade.ticket}
                      </td>

                      <td className="px-4 py-3 font-bold text-sm">
                        {profit !== null && profit !== undefined ? (
                          <span className={profit > 0 ? 'text-emerald-500' : profit < 0 ? 'text-red-500' : 'text-muted-foreground'}>
                            {profit > 0 ? `+$${profit.toFixed(2)}` : profit < 0 ? `-$${Math.abs(profit).toFixed(2)}` : '$0.00'}
                          </span>
                        ) : (
                          <span className="text-emerald-500 text-xs">Live</span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-sans">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          trade.isOpen 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
                            : 'bg-secondary/60 text-muted-foreground border-border/40'
                        }`}>
                          {trade.isOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {trade.isOpen ? 'Active' : 'Closed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
