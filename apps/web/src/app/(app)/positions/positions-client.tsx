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
  Filter
} from 'lucide-react';

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
}

interface PositionsClientProps {
  signals: SerializedTradeSignal[];
  accounts?: UserAccountSummary[];
}

// Evaluate signal open/closed status and aggregate profit
function evaluateSignal(signal: SerializedTradeSignal) {
  const isSignalMarkedClosed = signal.isClosed || 
    (signal.profit !== null && signal.profit !== undefined) || 
    (signal.closePrice !== null && signal.closePrice !== undefined);

  if (signal.copies.length === 0) {
    return {
      isOpen: !isSignalMarkedClosed,
      isClosed: isSignalMarkedClosed,
      statusLabel: isSignalMarkedClosed ? 'Closed' : 'Pending',
      activeCopiesCount: 0,
      totalCopiedVolume: 0,
      subProfit: null,
      masterProfit: signal.profit ?? null,
    };
  }

  const isClosedByCopy = signal.copies.every(c => 
    isSignalMarkedClosed ||
    (c.profit !== null && c.profit !== undefined) ||
    (c.closePrice !== null && c.closePrice !== undefined) ||
    (c.closedVolume > 0 && (c.currentVolume === 0 || c.currentVolume === null)) ||
    (c.currentVolume !== null && c.currentVolume !== undefined && c.currentVolume <= 0)
  );

  const isClosed = isSignalMarkedClosed || isClosedByCopy;
  const isOpen = !isClosed;

  // Realized profit on Sub accounts
  const copiesWithProfit = signal.copies.filter(c => c.profit !== null && c.profit !== undefined);
  let subProfit: number | null = null;
  if (copiesWithProfit.length > 0) {
    subProfit = Math.round(copiesWithProfit.reduce((sum, c) => sum + (c.profit || 0), 0) * 100) / 100;
  }

  const masterProfit = signal.profit !== null && signal.profit !== undefined ? Math.round(signal.profit * 100) / 100 : null;

  const totalCopiedVolume = signal.copies.reduce((sum, c) => sum + (c.executedVolume || c.requestedVolume || 0), 0);

  return {
    isOpen,
    isClosed,
    statusLabel: isClosed ? 'Closed' : 'Active',
    activeCopiesCount: isOpen ? signal.copies.length : 0,
    totalCopiedVolume: Math.round(totalCopiedVolume * 100) / 100,
    subProfit,
    masterProfit,
  };
}

export function PositionsClient({ signals, accounts = [] }: PositionsClientProps) {
  // Process signals with evaluation
  const processedSignals = useMemo(() => {
    return signals.map(signal => ({
      ...signal,
      eval: evaluateSignal(signal),
    }));
  }, [signals]);

  const activeSignals = useMemo(() => processedSignals.filter(s => s.eval.isOpen), [processedSignals]);
  const closedSignals = useMemo(() => processedSignals.filter(s => s.eval.isClosed), [processedSignals]);

  // Tab: Active / Closed / All
  const [activeTab, setActiveTab] = useState<'active' | 'closed' | 'all'>(
    activeSignals.length > 0 ? 'active' : 'closed'
  );
  
  // Account filter: 'all' | 'master' | 'sub' | specific account login
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Count active carrying accounts
  const activeCarryingAccounts = useMemo(() => {
    const accSet = new Set<string>();
    activeSignals.forEach(s => {
      s.copies.forEach(c => {
        if (c.currentVolume === null || c.currentVolume === undefined || c.currentVolume > 0) {
          accSet.add(c.subAccountLogin);
        }
      });
    });
    return Array.from(accSet);
  }, [activeSignals]);

  // Total realized P/L across closed trades
  const totalRealizedPnL = useMemo(() => {
    let sum = 0;
    closedSignals.forEach(s => {
      // If user filtered by master, calculate master P/L, otherwise calculate sub/fleet P/L
      if (accountFilter === 'master' || (accounts.find(a => a.login === accountFilter)?.role === 'MASTER')) {
        if (s.eval.masterProfit !== null) sum += s.eval.masterProfit;
      } else {
        if (s.eval.subProfit !== null) sum += s.eval.subProfit;
        else if (s.eval.masterProfit !== null) sum += s.eval.masterProfit;
      }
    });
    return Math.round(sum * 100) / 100;
  }, [closedSignals, accountFilter, accounts]);

  // Filter based on active tab, account filter, and search query
  const displayedSignals = useMemo(() => {
    let list = processedSignals;
    if (activeTab === 'active') {
      list = activeSignals;
    } else if (activeTab === 'closed') {
      list = closedSignals;
    }

    // Filter by account role or login
    if (accountFilter === 'master') {
      list = list.filter(s => !!s.masterLogin);
    } else if (accountFilter === 'sub') {
      list = list.filter(s => s.copies.length > 0);
    } else if (accountFilter !== 'all') {
      list = list.filter(s => 
        s.masterLogin === accountFilter || 
        s.copies.some(c => c.subAccountLogin === accountFilter)
      );
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase().trim();
    return list.filter(s => {
      const matchSymbol = s.symbol.toLowerCase().includes(query);
      const matchType = s.type.toLowerCase().includes(query);
      const matchTicket = s.ticket.includes(query);
      const matchMaster = s.masterLogin.toLowerCase().includes(query);
      const matchSub = s.copies.some(c => 
        c.subAccountLogin.toLowerCase().includes(query) || 
        (c.subOrderTicket && c.subOrderTicket.includes(query)) ||
        (c.subPositionId && c.subPositionId.includes(query))
      );
      return matchSymbol || matchType || matchTicket || matchMaster || matchSub;
    });
  }, [processedSignals, activeSignals, closedSignals, activeTab, accountFilter, searchQuery]);

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar max-w-7xl mx-auto w-full">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
            Live Positions & Fleet Copier
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time tracking of master trades and connected fleet copy executions.
          </p>
        </div>

        {/* Live Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Copier Sync Active
        </div>
      </div>

      {/* TOP KPI STRIP (CLEAN & COMPACT) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Positions */}
        <div className="plaiz-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Active Positions</span>
            <Activity className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold num-tabular text-foreground flex items-center gap-2">
              {activeSignals.length}
              {activeSignals.length > 0 ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              ) : (
                <span className="text-xs font-normal text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">Flat</span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              {activeSignals.length === 0 ? 'No open market exposure' : `${activeSignals.length} position${activeSignals.length === 1 ? '' : 's'} live`}
            </span>
          </div>
        </div>

        {/* Fleet Exposure */}
        <div className="plaiz-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Carrying Fleet</span>
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold num-tabular text-foreground">
              {activeCarryingAccounts.length > 0 ? `${activeCarryingAccounts.length} Sub${activeCarryingAccounts.length === 1 ? '' : 's'}` : '0 Sub'}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block truncate">
              {activeCarryingAccounts.length > 0 ? activeCarryingAccounts.join(', ') : 'All accounts standing by'}
            </span>
          </div>
        </div>

        {/* Realized P/L */}
        <div className="plaiz-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Total Realized P/L</span>
            <TrendingUp className={`w-3.5 h-3.5 ${totalRealizedPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
          <div>
            <div className={`text-2xl font-bold num-tabular ${
              totalRealizedPnL > 0 ? 'text-emerald-500' : totalRealizedPnL < 0 ? 'text-red-500' : 'text-muted-foreground'
            }`}>
              {totalRealizedPnL > 0 ? `+$${totalRealizedPnL.toFixed(2)}` : totalRealizedPnL < 0 ? `-$${Math.abs(totalRealizedPnL).toFixed(2)}` : '$0.00'}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Across {closedSignals.length} closed trade{closedSignals.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Protection / Guardrail */}
        <div className="plaiz-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Fleet Guardrail</span>
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold num-tabular text-emerald-500">
              100%
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Risk & SL synchronization active
            </span>
          </div>
        </div>
      </div>

      {/* FILTER TABS, ACCOUNT SELECTOR & SEARCH CONTROLS */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
        {/* Left Controls: Status Tabs & Account Origin Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center p-1 bg-secondary/50 border border-border/40 rounded-xl">
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
                {activeSignals.length}
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
              <span>Closed</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'closed' 
                  ? 'bg-background/20 text-background font-bold' 
                  : 'bg-secondary text-muted-foreground'
              }`}>
                {closedSignals.length}
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
                {processedSignals.length}
              </span>
            </button>
          </div>

          {/* Account Origin Filter Pills */}
          <div className="flex items-center p-1 bg-secondary/50 border border-border/40 rounded-xl">
            <button
              onClick={() => setAccountFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                accountFilter === 'all'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Trades
            </button>
            <button
              onClick={() => setAccountFilter('master')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                accountFilter === 'master'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span>Master Origin</span>
            </button>
            <button
              onClick={() => setAccountFilter('sub')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                accountFilter === 'sub'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Zap className="w-3 h-3 text-emerald-300" />
              <span>Sub Copied</span>
            </button>
          </div>
        </div>

        {/* Right Controls: Search & View Mode Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol, ticket, account..."
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

      {/* CONTENT: EMPTY STATE OR TRADES */}
      {displayedSignals.length === 0 ? (
        <div className="plaiz-card p-10 rounded-2xl text-center flex flex-col items-center justify-center border border-border/40">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-3">
            <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {activeTab === 'active' 
              ? 'No Active Open Positions' 
              : activeTab === 'closed' 
              ? 'No Closed Trades Found' 
              : 'No Trade Signals Recorded'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
            {activeTab === 'active'
              ? 'Your trading fleet is flat with 0 open positions. Live trades from your Master terminal will appear here automatically.'
              : 'Trades executed on your Master MT5 terminal will appear in this history log.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* =========================================================================
           SIMPLIFIED & EXPLICIT CARD VIEW
           ========================================================================= */
        <div className="space-y-3">
          {displayedSignals.map(signal => {
            const isBuy = signal.type.includes('BUY');
            const evalResult = signal.eval;
            const isOpen = evalResult.isOpen;
            const subProfit = evalResult.subProfit;
            const masterProfit = evalResult.masterProfit;

            return (
              <div 
                key={signal.id} 
                className={`plaiz-card rounded-2xl p-4 sm:p-5 transition-all border ${
                  isOpen 
                    ? 'border-emerald-500/30 bg-emerald-500/[0.02] shadow-sm' 
                    : 'border-border/40 hover:border-border/70'
                }`}
              >
                {/* 1. TOP HEADER: Symbol, Direction, ORIGIN BADGE, Status & Net Outcome */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/30">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Buy / Sell Badge */}
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase ${
                      isBuy ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                    }`}>
                      {signal.type}
                    </span>

                    {/* Symbol */}
                    <span className="font-bold text-base sm:text-lg text-foreground tracking-tight">
                      {signal.symbol}
                    </span>

                    {/* PROMINENT ORIGIN BADGE: Explicitly shows WHERE trade was taken */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/25">
                      <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Taken on Master #{signal.masterLogin}</span>
                    </span>

                    {/* Date / Time */}
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {new Date(signal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(signal.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {/* Right Status Badge */}
                  <div className="flex items-center gap-2.5 self-end sm:self-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                      isOpen 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
                        : 'bg-secondary/60 text-muted-foreground border-border/40'
                    }`}>
                      {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      {isOpen ? 'Active in Market' : 'Closed'}
                    </span>
                  </div>
                </div>

                {/* 2. DUAL EXECUTION STRIP: MASTER (ORIGIN) ➔ SUB (COPIED) WITH DISTINCT VOLUMES & P/L */}
                <div className="my-3 p-3 rounded-xl bg-secondary/30 border border-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {/* Master Origin Execution */}
                  <div className="flex items-center gap-2.5 font-mono">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Master Trade</span>
                        <span className="font-semibold text-foreground">#{signal.masterLogin}</span>
                        <span className="text-muted-foreground/60 text-[10px]">Tkt: #{signal.ticket}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground">{signal.volume} Lot{signal.volume === 1 ? '' : 's'}</span>
                        <span>&bull;</span>
                        {masterProfit !== null ? (
                          <span className={`font-bold ${masterProfit > 0 ? 'text-emerald-500' : masterProfit < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                            Master P/L: {masterProfit > 0 ? `+$${masterProfit.toFixed(2)}` : masterProfit < 0 ? `-$${Math.abs(masterProfit).toFixed(2)}` : '$0.00'}
                          </span>
                        ) : isOpen ? (
                          <span className="text-emerald-500 font-medium">Live</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Routing Arrow */}
                  <div className="hidden sm:flex items-center gap-1 text-muted-foreground/40 text-[10px] font-semibold uppercase tracking-wider px-2">
                    <span>Copied To</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>

                  {/* Sub Account Execution(s) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {signal.copies.length === 0 ? (
                      <span className="text-muted-foreground italic text-xs">No copy targets attached</span>
                    ) : (
                      signal.copies.map(c => (
                        <div 
                          key={c.id} 
                          className="flex items-center gap-2.5 p-2 px-3 rounded-lg bg-background border border-border/40 font-mono"
                        >
                          <div className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                            <Zap className="w-3 h-3 text-emerald-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Sub Copied</span>
                              <span className="font-semibold text-foreground">#{c.subAccountLogin}</span>
                              {c.subPositionId && <span className="text-muted-foreground/60 text-[10px]">#{c.subPositionId}</span>}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] mt-0.5">
                              <span className="text-muted-foreground font-medium">{c.executedVolume || c.requestedVolume || '0'} Lots</span>
                              <span>&bull;</span>
                              {c.profit !== null && c.profit !== undefined ? (
                                <span className={`font-bold ${c.profit > 0 ? 'text-emerald-500' : c.profit < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                  Sub P/L: {c.profit > 0 ? `+$${c.profit.toFixed(2)}` : c.profit < 0 ? `-$${Math.abs(c.profit).toFixed(2)}` : '$0.00'}
                                </span>
                              ) : isOpen ? (
                                <span className="text-emerald-500 font-medium">Live</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. PRICE & PROTECTION METRICS (Clean horizontal 4-column strip) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Entry</span>
                    <span className="font-mono font-semibold text-foreground text-sm num-tabular">
                      {signal.priceOpen ? signal.priceOpen.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Exit</span>
                    <span className="font-mono font-semibold text-foreground text-sm num-tabular">
                      {signal.closePrice ? signal.closePrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : isOpen ? 'In Market' : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Stop Loss</span>
                    <span className={`font-mono font-semibold text-sm num-tabular ${signal.sl ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {signal.sl ? signal.sl.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Take Profit</span>
                    <span className={`font-mono font-semibold text-sm num-tabular ${signal.tp ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {signal.tp ? signal.tp.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =========================================================================
           STREAMLINED TABLE VIEW WITH EXPLICIT ORIGIN & TARGET
           ========================================================================= */
        <div className="plaiz-card rounded-2xl overflow-hidden border border-border/40">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider border-b border-border/40">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Trade</th>
                  <th className="px-4 py-3">Origin (Taken On)</th>
                  <th className="px-4 py-3">Fleet Copy (Target)</th>
                  <th className="px-4 py-3">Entry / Exit</th>
                  <th className="px-4 py-3">Protection</th>
                  <th className="px-4 py-3">Sub P/L</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {displayedSignals.map(signal => {
                  const isBuy = signal.type.includes('BUY');
                  const evalResult = signal.eval;
                  const isOpen = evalResult.isOpen;
                  const subProfit = evalResult.subProfit;
                  const masterProfit = evalResult.masterProfit;

                  return (
                    <tr key={signal.id} className="hover:bg-secondary/20 transition-colors">
                      {/* Time */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground font-mono">
                        <div>{new Date(signal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-[10px] text-muted-foreground/60">{new Date(signal.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                      </td>

                      {/* Trade */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isBuy ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                          }`}>
                            {signal.type}
                          </span>
                          <span className="font-bold text-foreground">{signal.symbol}</span>
                        </div>
                      </td>

                      {/* Origin (Taken on Master) */}
                      <td className="px-4 py-3.5 font-mono">
                        <div className="flex items-center gap-1 text-blue-400 font-semibold text-[11px]">
                          <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Master #{signal.masterLogin}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {signal.volume} Lots &bull; {masterProfit !== null ? (masterProfit > 0 ? `+$${masterProfit.toFixed(2)}` : `-$${Math.abs(masterProfit).toFixed(2)}`) : 'Live'}
                        </div>
                      </td>

                      {/* Fleet Copy (Sub) */}
                      <td className="px-4 py-3.5 font-mono">
                        {signal.copies.length === 0 ? (
                          <span className="text-muted-foreground italic text-[11px]">None</span>
                        ) : (
                          signal.copies.map(c => (
                            <div key={c.id} className="text-[11px]">
                              <span className="text-emerald-500 font-semibold">Sub #{c.subAccountLogin}</span>
                              <span className="text-muted-foreground ml-1.5">({c.executedVolume || c.requestedVolume || '0'} Lots)</span>
                            </div>
                          ))
                        )}
                      </td>

                      {/* Entry / Exit */}
                      <td className="px-4 py-3.5 font-mono">
                        <div className="font-semibold text-foreground">
                          {signal.priceOpen ? signal.priceOpen.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}
                        </div>
                        {signal.closePrice ? (
                          <div className="text-[11px] text-muted-foreground">
                            Exit: {signal.closePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        ) : null}
                      </td>

                      {/* Protection */}
                      <td className="px-4 py-3.5 font-mono text-[11px]">
                        <div className={signal.sl ? 'text-red-500' : 'text-muted-foreground'}>
                          SL: {signal.sl ? signal.sl.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None'}
                        </div>
                        <div className={signal.tp ? 'text-emerald-500' : 'text-muted-foreground'}>
                          TP: {signal.tp ? signal.tp.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None'}
                        </div>
                      </td>

                      {/* Sub Profit / Loss */}
                      <td className="px-4 py-3.5 font-mono">
                        {subProfit !== null && subProfit !== undefined ? (
                          <span className={`font-bold text-sm ${
                            subProfit > 0 ? 'text-emerald-500' : subProfit < 0 ? 'text-red-500' : 'text-muted-foreground'
                          }`}>
                            {subProfit > 0 
                              ? `+$${subProfit.toFixed(2)}` 
                              : subProfit < 0 
                              ? `-$${Math.abs(subProfit).toFixed(2)}` 
                              : '$0.00'}
                          </span>
                        ) : (
                          <span className="text-emerald-500 font-semibold text-xs">Live</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          isOpen 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
                            : 'bg-secondary/60 text-muted-foreground border-border/40'
                        }`}>
                          {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {isOpen ? 'Active' : 'Closed'}
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
