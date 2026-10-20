'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { useTheme } from 'next-themes';
import { useCurrency } from '@/components/currency-provider';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export interface SnapshotPoint {
  date: string;
  timestamp: number;
  value: number;
}

interface PerformanceChartProps {
  data: SnapshotPoint[];
  height?: number;
  netProfit?: number;
}

type TimeframeOption = '24H' | '7D' | '30D' | 'ALL';

export function PerformanceChart({ data, height = 260, netProfit }: PerformanceChartProps) {
  const { resolvedTheme } = useTheme();
  const { currency, exchangeRate, formatMoney } = useCurrency();
  const [timeframe, setTimeframe] = useState<TimeframeOption>('ALL');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter & synthesize data based on selected timeframe
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = Date.now();
    let cutoff = 0;
    if (timeframe === '24H') cutoff = now - 24 * 60 * 60 * 1000;
    else if (timeframe === '7D') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (timeframe === '30D') cutoff = now - 30 * 24 * 60 * 60 * 1000;

    let filtered = cutoff > 0 ? data.filter(d => d.timestamp >= cutoff) : [...data];

    // If filtered is empty or only 1 point, preserve at least 2 points to draw a clean curve
    if (filtered.length === 0 && data.length > 0) {
      filtered = [data[data.length - 1]];
    }

    if (filtered.length === 1) {
      const single = filtered[0];
      const baselineTime = single.timestamp - 12 * 60 * 60 * 1000;
      const baselineDate = new Date(baselineTime);
      filtered = [
        {
          date: baselineDate.toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          timestamp: baselineTime,
          value: single.value,
        },
        single,
      ];
    }

    // Convert values if active currency is NGN
    return filtered.map(d => ({
      ...d,
      displayValue: currency === 'NGN' ? d.value * exchangeRate : d.value,
    }));
  }, [data, timeframe, currency, exchangeRate]);

  // Compute period metrics
  const stats = useMemo(() => {
    if (processedData.length === 0) {
      return { start: 0, current: 0, high: 0, low: 0, change: 0, changePct: 0 };
    }

    const start = processedData[0].displayValue;
    const current = processedData[processedData.length - 1].displayValue;
    const values = processedData.map(d => d.displayValue);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const change = current - start;
    const changePct = start > 0 ? (change / start) * 100 : 0;

    return { start, current, high, low, change, changePct };
  }, [processedData]);

  // True performance determination: negative change or negative net profit renders RED
  // Must be called unconditionally before any early returns to satisfy React Rules of Hooks
  const isPositive = useMemo(() => {
    if (stats.change < 0) return false;
    if (timeframe === 'ALL' && netProfit !== undefined && netProfit < 0) return false;
    if (stats.change > 0) return true;
    if (netProfit !== undefined) return netProfit >= 0;
    return true;
  }, [stats.change, timeframe, netProfit]);

  if (!mounted) {
    return (
      <div 
        style={{ height: `${height}px` }} 
        className="w-full rounded-2xl flex items-center justify-center bg-black/5 dark:bg-white/[0.02] border border-border/30 animate-pulse"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-primary/60 animate-ping" />
          <span className="text-[11px] text-muted-foreground font-medium">Loading valuation curve...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div 
        style={{ height: `${height}px` }}
        className="w-full flex flex-col items-center justify-center text-center p-6 bg-black/5 dark:bg-white/[0.02] rounded-2xl border border-dashed border-border/40"
      >
        <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
          <Activity className="w-5 h-5 text-muted-foreground opacity-50" />
        </div>
        <p className="text-[13px] font-bold text-foreground">Waiting for First Trade Snapshot</p>
        <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
          Your portfolio valuation curve will stream live as trades execute and broker heartbeats arrive.
        </p>
      </div>
    );
  }

  const isDark = resolvedTheme === 'dark' || !resolvedTheme || resolvedTheme === 'system';
  const gridColor = isDark ? '#272733' : '#e5e7eb';
  const textColor = isDark ? '#8a8a99' : '#6b7280';

  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const gradientId = `equityGradient-${isPositive ? 'pos' : 'neg'}`;
  const glowFilterId = `chartGlow-${isPositive ? 'pos' : 'neg'}`;

  const formatCurrencyCompact = (val: number) => {
    const symbol = currency === 'NGN' ? '₦' : '$';
    if (val === undefined || val === null || isNaN(val) || !isFinite(val)) {
      return `${symbol}0`;
    }
    if (Math.abs(val) >= 1_000_000) {
      return `${symbol}${(val / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `${symbol}${(val / 1_000).toFixed(1)}k`;
    }
    return `${symbol}${val.toFixed(0)}`;
  };

  // Smart responsive X-Axis label formatting
  const formatXAxisTick = (dateStr: string, index: number) => {
    const item = processedData[index];
    if (!item) return dateStr;
    const d = new Date(item.timestamp);
    if (isNaN(d.getTime())) return dateStr;

    if (timeframe === '24H') {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    if (timeframe === '7D') {
      return d.toLocaleDateString([], { weekday: 'short', hour: 'numeric' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Custom institutional-grade tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const val = Number(payload[0].value);
      const startVal = stats.start;
      const diff = val - startVal;
      const diffPct = startVal > 0 ? (diff / startVal) * 100 : 0;
      const isUp = diff >= 0;

      return (
        <div className="bg-card/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/80 dark:border-white/10 rounded-2xl p-3.5 shadow-2xl min-w-[170px] pointer-events-none transition-transform animate-in fade-in-50 zoom-in-95">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {new Date(dataPoint.timestamp).toLocaleDateString('default', { month: 'short', day: 'numeric' })} &bull; {new Date(dataPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-base font-extrabold text-foreground font-mono tracking-tight">
            {formatMoney(val / (currency === 'NGN' ? exchangeRate : 1))}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/30">
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {isUp ? '+' : ''}{diffPct.toFixed(2)}%
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              ({isUp ? '+' : ''}{formatCurrencyCompact(diff)})
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Timeframe & Performance Header Banner */}
      <div className="flex flex-col gap-2.5 px-0.5">
        <div className="flex items-center justify-between gap-3">
          {/* Main Price & Return Badge */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base sm:text-lg font-bold text-foreground font-mono tracking-tight">
              {formatCurrencyCompact(stats.current)}
            </span>

            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight shadow-sm ${
              isPositive 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
            }`}>
              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <span>{isPositive ? '+' : ''}{stats.changePct.toFixed(2)}%</span>
            </div>
          </div>

          {/* Timeframe selector pills */}
          <div className="flex items-center gap-1 p-0.5 bg-black/5 dark:bg-white/5 rounded-xl border border-border/40 shrink-0">
            {(['24H', '7D', '30D', 'ALL'] as TimeframeOption[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all active:scale-95 ${
                  timeframe === tf
                    ? 'bg-card text-foreground shadow-sm border border-border/30 dark:border-white/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary High / Low / Start row (Optimized for Mobile & Desktop) */}
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-muted-foreground overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.03] border border-border/30 shrink-0">
            <span className="text-muted-foreground/80">High:</span>
            <strong className="text-foreground font-mono">{formatCurrencyCompact(stats.high)}</strong>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.03] border border-border/30 shrink-0">
            <span className="text-muted-foreground/80">Low:</span>
            <strong className="text-foreground font-mono">{formatCurrencyCompact(stats.low)}</strong>
          </div>
          <div className="hidden xs:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.03] border border-border/30 shrink-0">
            <span className="text-muted-foreground/80">Start:</span>
            <strong className="text-foreground font-mono">{formatCurrencyCompact(stats.start)}</strong>
          </div>
        </div>
      </div>

      {/* Interactive Responsive Area Chart */}
      <div 
        style={{ height: `${height}px` }} 
        className="w-full relative touch-pan-x"
      >
        <ResponsiveContainer width="100%" height={height} minHeight={180}>
          <AreaChart 
            data={processedData} 
            margin={{ top: 12, right: 0, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={isDark ? 0.38 : 0.22} />
                <stop offset="50%" stopColor={strokeColor} stopOpacity={isDark ? 0.12 : 0.05} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
              <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor={strokeColor} floodOpacity={isDark ? 0.45 : 0.25} />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} opacity={0.3} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: textColor, fontSize: 10 }}
              tickFormatter={formatXAxisTick}
              minTickGap={32}
              dy={6}
            />
            <YAxis 
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: textColor, fontSize: 10 }}
              tickFormatter={formatCurrencyCompact}
              width={48}
              domain={[
                (dataMin: number) => {
                  if (!isFinite(dataMin) || dataMin === 0) return 0;
                  const range = (stats.high - stats.low) || dataMin;
                  const padding = range * 0.08;
                  return Math.max(0, Math.floor(dataMin - padding));
                },
                (dataMax: number) => {
                  if (!isFinite(dataMax) || dataMax === 0) return 100;
                  const range = (stats.high - stats.low) || dataMax;
                  const padding = range * 0.08;
                  return Math.ceil(dataMax + padding);
                }
              ]}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{
                stroke: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                strokeWidth: 1.2,
                strokeDasharray: '4 4'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="displayValue" 
              stroke={strokeColor} 
              fillOpacity={1} 
              fill={`url(#${gradientId})`} 
              strokeWidth={2.4} 
              style={{ filter: `url(#${glowFilterId})` }}
              isAnimationActive={false}
              dot={{ r: processedData.length <= 4 ? 3.5 : 0, fill: strokeColor, stroke: '#ffffff', strokeWidth: 1.5 }}
              activeDot={{ r: 5.5, fill: strokeColor, stroke: '#ffffff', strokeWidth: 2 }} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
