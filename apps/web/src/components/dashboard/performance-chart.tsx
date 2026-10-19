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
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface SnapshotPoint {
  date: string;
  timestamp: number;
  value: number;
}

interface PerformanceChartProps {
  data: SnapshotPoint[];
}

type TimeframeOption = '24H' | '7D' | '30D' | 'ALL';

export function PerformanceChart({ data }: PerformanceChartProps) {
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
      // Create a sensible starting baseline point 12 hours earlier
      const single = filtered[0];
      const baselineTime = single.timestamp - 12 * 60 * 60 * 1000;
      const baselineDate = new Date(baselineTime);
      filtered = [
        {
          date: baselineDate.toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          timestamp: baselineTime,
          value: single.value, // Flat baseline if no prior history
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

  if (!mounted) {
    return (
      <div className="w-full h-[260px] rounded-2xl flex items-center justify-center bg-black/5 dark:bg-white/[0.02] border border-border/30 animate-pulse">
        <div className="flex flex-col items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-primary/60 animate-ping" />
          <span className="text-[11px] text-muted-foreground font-medium">Loading valuation curve...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[260px] w-full flex flex-col items-center justify-center text-center p-6 bg-black/5 dark:bg-white/[0.02] rounded-2xl border border-dashed border-border/40">
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
  const tooltipBg = isDark ? '#141416' : '#ffffff';
  const tooltipBorder = isDark ? '#272733' : '#e5e7eb';
  const isPositive = stats.change >= 0;

  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const gradientId = `equityGradient-${isPositive ? 'pos' : 'neg'}`;

  const formatCurrencyCompact = (val: number) => {
    const symbol = currency === 'NGN' ? '₦' : '$';
    if (Math.abs(val) >= 1_000_000) {
      return `${symbol}${(val / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `${symbol}${(val / 1_000).toFixed(1)}k`;
    }
    return `${symbol}${val.toFixed(0)}`;
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Timeframe & Performance Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        {/* Period Return Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-foreground num-tabular">
              {formatCurrencyCompact(stats.current)}
            </span>
          </div>

          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight ${
            isPositive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{isPositive ? '+' : ''}{stats.changePct.toFixed(2)}%</span>
          </div>

          {/* Period High / Low subtle chips */}
          <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>High: <strong className="text-foreground">{formatCurrencyCompact(stats.high)}</strong></span>
            <span>&bull;</span>
            <span>Low: <strong className="text-foreground">{formatCurrencyCompact(stats.low)}</strong></span>
          </div>
        </div>

        {/* Timeframe selector pills */}
        <div className="flex items-center gap-1 p-0.5 bg-black/5 dark:bg-white/5 rounded-xl border border-border/30 self-start sm:self-auto">
          {(['24H', '7D', '30D', 'ALL'] as TimeframeOption[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                timeframe === tf
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Responsive Area Chart */}
      <div className="w-full h-[230px] relative">
        <ResponsiveContainer width="100%" height={230} minHeight={200} initialDimension={{ width: 600, height: 230 }}>
          <AreaChart data={processedData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={isDark ? 0.35 : 0.22} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} opacity={0.4} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: textColor, fontSize: 10 }} 
              dy={6}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: textColor, fontSize: 10 }}
              tickFormatter={formatCurrencyCompact}
              width={55}
              domain={[
                (dataMin: number) => {
                  if (!isFinite(dataMin) || dataMin === 0) return 0;
                  return Math.max(0, Math.floor(dataMin * 0.98));
                },
                (dataMax: number) => {
                  if (!isFinite(dataMax) || dataMax === 0) return 100;
                  return Math.ceil(dataMax * 1.02);
                }
              ]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: tooltipBg, 
                borderColor: tooltipBorder, 
                borderRadius: '12px', 
                fontSize: '11px', 
                boxShadow: '0 8px 24px -4px rgba(0,0,0,0.4)',
                padding: '8px 12px'
              }}
              formatter={(val: any) => [
                new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
                  style: 'currency',
                  currency: currency,
                  minimumFractionDigits: 2,
                }).format(Number(val)),
                'Portfolio Valuation'
              ]}
              labelFormatter={(label: any) => `${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="displayValue" 
              stroke={strokeColor} 
              fillOpacity={1} 
              fill={`url(#${gradientId})`} 
              strokeWidth={2.2} 
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
