'use client';

import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Radio, 
  Shield, 
  LayoutGrid, 
  List,
  Activity,
  ArrowRightLeft
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
  sl: number;
  tp: number;
  createdAt: string;
  copies: SerializedCopy[];
}

interface PositionsClientProps {
  signals: SerializedTradeSignal[];
}

// Helper to determine the consolidated status of a copy
function getCopyStatus(copy: SerializedCopy) {
  const hasCloseCommand = copy.commands?.some(c => 
    (c.type === 'CLOSE_ORDER' || c.type === 'CLOSE_PARTIAL') && 
    (c.status === 'EXECUTED' || !!c.executedAt || c.success === true)
  );

  const isClosed = hasCloseCommand || 
    (copy.closedVolume > 0 && (copy.currentVolume === 0 || copy.currentVolume === null || (copy.executedVolume && copy.closedVolume >= copy.executedVolume))) ||
    (copy.currentVolume !== null && copy.currentVolume !== undefined && copy.currentVolume <= 0);

  if (isClosed) {
    return {
      isOpen: false,
      isClosed: true,
      statusKey: 'CLOSED',
      label: 'Closed / Completed',
      icon: CheckCircle2,
      color: 'bg-secondary/60 text-muted-foreground border-border/40',
      badgeClass: 'plaiz-pill-neutral',
    };
  }

  if (copy.state === 'WAITING_FOR_SL') {
    return {
      isOpen: true,
      isClosed: false,
      statusKey: 'WAITING_FOR_SL',
      label: 'Waiting for SL (60s)',
      icon: Clock,
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/25',
      badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/25',
    };
  }

  if (copy.state === 'REJECTED' || copy.state === 'FAILED') {
    return {
      isOpen: false,
      isClosed: false,
      statusKey: 'REJECTED',
      label: 'Rejected by Guardrail',
      icon: XCircle,
      color: 'plaiz-pill-destructive',
      badgeClass: 'plaiz-pill-destructive',
    };
  }

  if (copy.state === 'EXECUTED' || copy.state === 'APPROVED') {
    return {
      isOpen: true,
      isClosed: false,
      statusKey: 'ACTIVE',
      label: 'Active in Market',
      icon: Radio,
      color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25 shadow-sm shadow-emerald-500/5',
      badgeClass: 'plaiz-pill-success',
    };
  }

  return {
    isOpen: copy.state === 'EXECUTING' || copy.state === 'WAITING',
    isClosed: false,
    statusKey: copy.state || 'PENDING',
    label: copy.state || 'Processing',
    icon: AlertCircle,
    color: 'bg-secondary/60 text-muted-foreground border-border/40',
    badgeClass: 'plaiz-pill-neutral',
  };
}

// Evaluate signal open/closed status based on its copies
function evaluateSignal(signal: SerializedTradeSignal) {
  if (signal.copies.length === 0) {
    return {
      isOpen: true,
      isClosed: false,
      statusLabel: 'Pending Mapping',
      activeCopiesCount: 0,
      totalCopiedVolume: 0,
    };
  }

  const evaluatedCopies = signal.copies.map(c => ({
    copy: c,
    status: getCopyStatus(c),
  }));

  const openCopies = evaluatedCopies.filter(ec => ec.status.isOpen);
  const totalCopiedVolume = openCopies.reduce((sum, ec) => sum + (ec.copy.executedVolume || ec.copy.requestedVolume || 0), 0);

  const isOpen = openCopies.length > 0;
  const isAllClosed = evaluatedCopies.every(ec => ec.status.isClosed);
  const isAllRejected = evaluatedCopies.every(ec => ec.status.statusKey === 'REJECTED');

  let statusLabel = 'Active in Market';
  if (isAllClosed) statusLabel = 'Closed';
  else if (isAllRejected) statusLabel = 'Rejected';
  else if (openCopies.some(ec => ec.status.statusKey === 'WAITING_FOR_SL')) statusLabel = 'Waiting for SL';

  return {
    isOpen,
    isClosed: isAllClosed,
    statusLabel,
    activeCopiesCount: openCopies.length,
    totalCopiedVolume: Math.round(totalCopiedVolume * 100) / 100,
    evaluatedCopies,
  };
}

export function PositionsClient({ signals }: PositionsClientProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'closed' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Process signals with evaluation
  const processedSignals = useMemo(() => {
    return signals.map(signal => ({
      ...signal,
      eval: evaluateSignal(signal),
    }));
  }, [signals]);

  // Overall KPI stats
  const activeSignals = useMemo(() => processedSignals.filter(s => s.eval.isOpen), [processedSignals]);
  const closedSignals = useMemo(() => processedSignals.filter(s => s.eval.isClosed), [processedSignals]);

  // Count unique carrying sub-accounts currently holding open positions
  const activeCarryingAccounts = useMemo(() => {
    const accSet = new Set<string>();
    activeSignals.forEach(s => {
      s.eval.evaluatedCopies?.forEach(ec => {
        if (ec.status.isOpen) {
          accSet.add(ec.copy.subAccountLogin);
        }
      });
    });
    return Array.from(accSet);
  }, [activeSignals]);

  const totalActiveFleetVolume = useMemo(() => {
    const vol = activeSignals.reduce((sum, s) => sum + s.eval.totalCopiedVolume, 0);
    return Math.round(vol * 100) / 100;
  }, [activeSignals]);

  // Filter based on active tab and search query
  const displayedSignals = useMemo(() => {
    let list = processedSignals;
    if (activeTab === 'active') {
      list = activeSignals;
    } else if (activeTab === 'closed') {
      list = closedSignals;
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
  }, [processedSignals, activeSignals, closedSignals, activeTab, searchQuery]);

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ArrowRightLeft className="w-7 h-7 text-primary" />
            Live Positions & Fleet Copier
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time tracking of master signals and the connected sub-accounts carrying them.
          </p>
        </div>

        {/* Realtime Live Indicator */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Copier Sync Active
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Open Trades */}
        <div className="plaiz-card p-5 rounded-[20px] flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Active Positions</span>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold num-tabular text-foreground flex items-center gap-2">
              {activeSignals.length}
              {activeSignals.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              {activeSignals.length === 1 ? '1 open position' : `${activeSignals.length} open positions`} in market
            </span>
          </div>
        </div>

        {/* Carrying Sub Accounts */}
        <div className="plaiz-card p-5 rounded-[20px] flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Carrying Accounts</span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold num-tabular text-foreground">
              {activeCarryingAccounts.length}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block truncate">
              {activeCarryingAccounts.length > 0 
                ? activeCarryingAccounts.join(', ') 
                : 'No accounts carrying open trades'}
            </span>
          </div>
        </div>

        {/* Total Fleet Copied Volume */}
        <div className="plaiz-card p-5 rounded-[20px] flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Fleet Open Volume</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold num-tabular text-foreground">
              {totalActiveFleetVolume} <span className="text-xs text-muted-foreground font-normal">Lots</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Mirrored across active accounts
            </span>
          </div>
        </div>

        {/* Fleet Sync Status */}
        <div className="plaiz-card p-5 rounded-[20px] flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Fleet Guardrail</span>
            <Shield className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold num-tabular text-emerald-500">
              100%
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Risk & SL protection synchronized
            </span>
          </div>
        </div>
      </div>

      {/* FILTER BAR & TABS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center p-1 bg-secondary/40 border border-border/40 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Active Positions</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'active' 
                ? 'bg-background/20 text-background' 
                : 'bg-secondary text-muted-foreground'
            }`}>
              {activeSignals.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('closed')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === 'closed'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Closed History</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'closed' 
                ? 'bg-background/20 text-background' 
                : 'bg-secondary text-muted-foreground'
            }`}>
              {closedSignals.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>All Records</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'all' 
                ? 'bg-background/20 text-background' 
                : 'bg-secondary text-muted-foreground'
            }`}>
              {processedSignals.length}
            </span>
          </button>
        </div>

        {/* Search & View Mode */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol, ticket, account..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-secondary/30 border border-border/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center p-1 bg-secondary/40 border border-border/40 rounded-xl">
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
        <div className="plaiz-card p-12 rounded-[24px] text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
            <ArrowRightLeft className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {activeTab === 'active' 
              ? 'No Active Open Positions' 
              : activeTab === 'closed' 
              ? 'No Closed History Found' 
              : 'No Trade Signals Recorded'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
            {activeTab === 'active'
              ? 'When a trade is placed on your Master terminal, it will instantly appear here showing the exact sub-accounts carrying it and their mirrored lot sizes.'
              : 'Execute a trade on your Master terminal to monitor execution and history.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* =========================================================================
           CARD VIEW (PREMIUM FINTECH FEED)
           ========================================================================= */
        <div className="space-y-4">
          {displayedSignals.map(signal => {
            const isBuy = signal.type.includes('BUY');
            const evalResult = signal.eval;
            const isOpen = evalResult.isOpen;

            return (
              <div 
                key={signal.id} 
                className={`plaiz-card rounded-[22px] p-5 sm:p-6 transition-all border ${
                  isOpen 
                    ? 'border-emerald-500/25 bg-emerald-500/[0.015] shadow-lg shadow-emerald-500/5' 
                    : 'border-border/40 hover:border-border/60'
                }`}
              >
                {/* CARD TOP ROW */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/30">
                  <div className="flex items-center gap-3">
                    {/* Direction Icon & Symbol */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isBuy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {isBuy ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground tracking-tight">
                          {signal.symbol}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isBuy ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                        }`}>
                          {signal.type}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {signal.volume} Lot{signal.volume === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Opened at {new Date(signal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} &bull; {new Date(signal.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Master Origin */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <div className="text-right hidden sm:block mr-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Master Origin</span>
                      <span className="text-xs font-semibold text-foreground font-mono">{signal.masterLogin}</span>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                      isOpen 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
                        : evalResult.isClosed 
                        ? 'bg-secondary text-muted-foreground border-border/50' 
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/25'
                    }`}>
                      {isOpen && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
                      {isOpen ? 'Active in Market' : evalResult.isClosed ? 'Closed / Completed' : evalResult.statusLabel}
                    </span>
                  </div>
                </div>

                {/* CARD BODY: CARRYING SUB-ACCOUNTS (THE CRITICAL SECTION) */}
                <div className="py-4 border-b border-border/30">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Accounts Carrying This Position ({signal.copies.length})
                  </div>

                  {signal.copies.length === 0 ? (
                    <div className="p-3 rounded-xl bg-secondary/30 text-xs text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      No sub accounts mapped to this signal yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {signal.copies.map(copy => {
                        const copyStatus = getCopyStatus(copy);
                        const StatusIcon = copyStatus.icon;

                        return (
                          <div 
                            key={copy.id}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                              copyStatus.isOpen 
                                ? 'bg-secondary/40 border-emerald-500/20' 
                                : 'bg-secondary/20 border-border/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                  Sub
                                </div>
                                <span className="font-bold text-xs text-foreground font-mono">
                                  {copy.subAccountLogin}
                                </span>
                              </div>

                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${copyStatus.color}`}>
                                <StatusIcon className="w-2.5 h-2.5" />
                                {copyStatus.label}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/20">
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Copied Volume</span>
                                <span className="font-bold text-foreground font-mono">
                                  {copy.executedVolume || copy.requestedVolume || '0.00'} Lots
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] text-muted-foreground block">MT5 Ticket</span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  #{copy.subPositionId || copy.subOrderTicket || 'Pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* CARD FOOTER: PRICES & RISK PARAMETERS */}
                <div className="pt-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Entry Price</span>
                      <span className="font-mono font-semibold text-foreground text-sm num-tabular">
                        {signal.priceOpen ? signal.priceOpen.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Stop Loss</span>
                      <span className={`font-mono font-semibold text-sm num-tabular ${signal.sl ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {signal.sl ? signal.sl.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None (Unprotected)'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Take Profit</span>
                      <span className={`font-mono font-semibold text-sm num-tabular ${signal.tp ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {signal.tp ? signal.tp.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None'}
                      </span>
                    </div>
                  </div>

                  <div className="text-muted-foreground text-[11px] font-mono">
                    Master Ticket: #{signal.ticket}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =========================================================================
           STREAMLINED TABLE VIEW
           ========================================================================= */
        <div className="plaiz-card rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-black/5 dark:bg-white/5 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider border-b border-border/40">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Trade & Symbol</th>
                  <th className="px-4 py-3">Master Origin</th>
                  <th className="px-4 py-3">Carrying Sub-Accounts</th>
                  <th className="px-4 py-3">Entry Price</th>
                  <th className="px-4 py-3">Protection (SL / TP)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {displayedSignals.map(signal => {
                  const isBuy = signal.type.includes('BUY');
                  const evalResult = signal.eval;
                  const isOpen = evalResult.isOpen;

                  return (
                    <tr key={signal.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      {/* Time */}
                      <td className="px-4 py-4 whitespace-nowrap text-muted-foreground text-xs font-mono">
                        {new Date(signal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Trade & Symbol */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBuy ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                          }`}>
                            {signal.type}
                          </span>
                          <span className="font-bold text-foreground">{signal.symbol}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {signal.volume} Lot{signal.volume === 1 ? '' : 's'}
                        </div>
                      </td>

                      {/* Master Origin */}
                      <td className="px-4 py-4">
                        <div className="font-semibold text-foreground text-xs font-mono">{signal.masterLogin}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">Tkt: #{signal.ticket}</div>
                      </td>

                      {/* Carrying Sub Accounts */}
                      <td className="px-4 py-4">
                        {signal.copies.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">None</span>
                        ) : (
                          <div className="space-y-1.5">
                            {signal.copies.map(c => {
                              const cs = getCopyStatus(c);
                              return (
                                <div key={c.id} className="flex items-center gap-2 text-xs">
                                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span className="font-mono font-semibold text-foreground">{c.subAccountLogin}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-secondary text-[10px] font-mono font-medium">
                                    {c.executedVolume || c.requestedVolume || '0'} Lots
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    #{c.subPositionId || c.subOrderTicket || 'Pending'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Entry Price */}
                      <td className="px-4 py-4 font-mono text-xs font-semibold text-foreground">
                        {signal.priceOpen ? signal.priceOpen.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}
                      </td>

                      {/* SL / TP */}
                      <td className="px-4 py-4 font-mono text-xs">
                        <div className={signal.sl ? 'text-red-500' : 'text-muted-foreground'}>
                          SL: {signal.sl ? signal.sl.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None'}
                        </div>
                        <div className={signal.tp ? 'text-emerald-500' : 'text-muted-foreground'}>
                          TP: {signal.tp ? signal.tp.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'None'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          isOpen 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
                            : evalResult.isClosed 
                            ? 'bg-secondary text-muted-foreground border-border/50' 
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/25'
                        }`}>
                          {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                          {isOpen ? 'Active' : evalResult.isClosed ? 'Closed' : evalResult.statusLabel}
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
