'use client';

import React from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, BarChart, Bar 
} from 'recharts';

interface LongitudinalChartsProps {
  chartData: any[];
}

export default function LongitudinalCharts({ chartData }: LongitudinalChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Chart 1: Range of Motion Evolution */}
      <div className="card flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Rango de Movimiento (ROM)
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-800 rounded text-zinc-300">
            Ángulo en grados (°)
          </span>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} unit="°" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)', 
                  borderRadius: 6, 
                  color: 'var(--text-primary)',
                  fontSize: 12
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" fontSize={12} />
              <Line type="monotone" dataKey="PRE_ROM" name="Antes (PRE)" stroke="var(--warning)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="POST_ROM" name="Después (POST)" stroke="var(--success)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Speed Evolution */}
      <div className="card flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Velocidad Máxima
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-800 rounded text-zinc-300">
            Grados por segundo (°/s)
          </span>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} unit="°/s" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)', 
                  borderRadius: 6,
                  fontSize: 12
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" fontSize={12} />
              <Bar dataKey="PRE_Vel" name="Antes (PRE)" fill="var(--warning)" radius={[4, 4, 0, 0]} maxBarSize={25} />
              <Bar dataKey="POST_Vel" name="Después (POST)" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={25} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
