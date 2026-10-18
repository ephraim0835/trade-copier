'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function PerformanceChart({ data }: { data: any[] }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[320px] rounded-xl flex items-center justify-center bg-black/5 dark:bg-white/[0.02] border border-border/30 animate-pulse">
        <div className="flex flex-col items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-primary/60 animate-ping" />
          <span className="text-[11px] text-muted-foreground font-medium">Loading valuation curve...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[320px] w-full flex flex-col items-center justify-center text-center p-6 bg-black/5 dark:bg-white/[0.02] rounded-xl border border-dashed border-border/40">
        <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-muted-foreground opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <p className="text-[13px] font-medium text-foreground">Not enough data yet</p>
        <p className="text-[11px] text-muted-foreground mt-1">Performance graphs will appear here once trading begins.</p>
      </div>
    );
  }

  const isDark = resolvedTheme === 'dark' || !resolvedTheme || resolvedTheme === 'system';
  const gridColor = isDark ? '#272733' : '#e5e7eb';
  const textColor = isDark ? '#8a8a99' : '#6b7280';
  const tooltipBg = isDark ? '#141416' : '#ffffff';
  const tooltipBorder = isDark ? '#272733' : '#e5e7eb';
  const tooltipText = isDark ? '#f6fcff' : '#09090b';

  return (
    <div className="w-full h-[320px] relative">
      <ResponsiveContainer width="100%" height={320} minHeight={300} initialDimension={{ width: 800, height: 320 }}>
        <AreaChart data={data} margin={{ top: 15, right: 15, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#007bff" stopOpacity={isDark ? 0.35 : 0.18} />
              <stop offset="95%" stopColor="#007bff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} opacity={0.5} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 11 }} 
            dy={8}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 11 }}
            tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
            width={65}
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
              borderRadius: '10px', 
              fontSize: '12px', 
              boxShadow: '0 8px 16px -2px rgba(0,0,0,0.3)',
              padding: '8px 12px'
            }}
            itemStyle={{ color: tooltipText }}
            formatter={(val: any) => [
              `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              'Portfolio Equity'
            ]}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#007bff" 
            fillOpacity={1} 
            fill="url(#colorValue)" 
            strokeWidth={2.5} 
            isAnimationActive={false}
            dot={{ r: data.length <= 4 ? 4 : 0, fill: '#007bff', stroke: '#3fecff', strokeWidth: 1.5 }}
            activeDot={{ r: 6, fill: '#3fecff', stroke: '#007bff', strokeWidth: 2 }} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
