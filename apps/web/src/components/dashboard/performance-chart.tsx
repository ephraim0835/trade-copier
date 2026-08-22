'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function PerformanceChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
        No performance data available for this period.
      </div>
    );
  }

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#272733" vertical={false} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#8a8a99', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#8a8a99', fontSize: 12 }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#272733', borderRadius: '8px' }}
            itemStyle={{ color: '#f6fcff' }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#007bff" 
            strokeWidth={3} 
            dot={false} 
            activeDot={{ r: 6, fill: '#3fecff', stroke: '#007bff' }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
