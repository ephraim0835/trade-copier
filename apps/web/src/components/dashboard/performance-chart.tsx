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

  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
        No performance data available.
      </div>
    );
  }

  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const gridColor = isDark ? '#272733' : '#e5e7eb';
  const textColor = isDark ? '#8a8a99' : '#6b7280';
  const tooltipBg = isDark ? '#1a1a1a' : '#ffffff';
  const tooltipBorder = isDark ? '#272733' : '#e5e7eb';
  const tooltipText = isDark ? '#f6fcff' : '#09090b';

  return (
    <div className="h-full w-full min-h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#007bff" stopOpacity={isDark ? 0.3 : 0.15}/>
              <stop offset="95%" stopColor="#007bff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 11 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 11 }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
            itemStyle={{ color: tooltipText }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#007bff" 
            fillOpacity={1} 
            fill="url(#colorValue)" 
            strokeWidth={2.5} 
            activeDot={{ r: 5, fill: '#3fecff', stroke: '#007bff', strokeWidth: 2 }} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
