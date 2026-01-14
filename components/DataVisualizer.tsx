import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { Dataset, DataRow } from '../types';
import { suggestCharts, formatNumber, formatNumberShort } from '../utils/dataUtils';

interface DataVisualizerProps {
  dataset: Dataset;
  filteredData?: DataRow[];
  mode?: 'full' | 'bar' | 'area' | 'line' | 'pie';
  customTitle?: string;
  columnConfig?: {
    xAxisKey: string;
    dataKeys: string[];
  };
  sortConfig?: {
    sortKey: string;
    sortOrder: 'asc' | 'desc';
  };
}

export const DataVisualizer: React.FC<DataVisualizerProps> = React.memo(({ dataset, filteredData, mode = 'full', customTitle, columnConfig, sortConfig }) => {
  
  const chartConfig = useMemo(() => {
    // Use custom column config if provided, otherwise auto-detect
    if (columnConfig) {
      return {
        xAxisKey: columnConfig.xAxisKey,
        dataKeys: columnConfig.dataKeys,
        barChartTitle: `${columnConfig.dataKeys[0]} by ${columnConfig.xAxisKey}`,
        areaChartTitle: `${columnConfig.dataKeys[0]} Trends & Overview`
      };
    }
    return suggestCharts(dataset.analysis);
  }, [dataset, columnConfig]);
  
  // Neon-ish colors for dark mode
  const colors = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#2dd4bf', '#fb7185'];

  if (!chartConfig) {
    return (
      <div className="p-12 text-center bg-slate-900 rounded-xl border border-slate-800 border-dashed h-full flex items-center justify-center">
        <p className="text-slate-500">No chart data available.</p>
      </div>
    );
  }

  // Use filtered data if provided, otherwise default to full dataset
  const sourceData = filteredData || dataset.data;

  // Apply sorting if configured and limit data for performance
  const sortedData = useMemo(() => {
    let data = sourceData.length > 1000 ? sourceData.slice(0, 1000) : sourceData;
    
    if (sortConfig && chartConfig) {
      // Sort by the dataKey value
      const sortKey = sortConfig.sortKey;
      data = [...data].sort((a, b) => {
        const valA = Number(a[sortKey]) || 0;
        const valB = Number(b[sortKey]) || 0;
        return sortConfig.sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }
    
    return data;
  }, [sourceData, sortConfig, chartConfig]);

  // Pie charts shouldn't have too many slices, and filter out zero/negligible values
  const pieData = (() => {
    const dataKey = chartConfig.dataKeys[0];
    const total = sourceData.reduce((sum, item) => {
      const value = Number(item[dataKey]);
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
    
    return sourceData
      .filter(item => {
        const value = Number(item[dataKey]);
        if (isNaN(value) || value <= 0) return false;
        const percentage = (value / total) * 100;
        return percentage >= 0.5; // Only show items with at least 0.5%
      })
      .slice(0, 10);
  })(); 

  const renderTitle = (defaultTitle: string) => (
    <div className="flex items-center justify-between mb-4 shrink-0">
      <div>
        <h3 className="text-lg font-semibold text-white">{customTitle || defaultTitle}</h3>
        {mode === 'full' && (
           <p className="text-sm text-slate-400">
             Breakdown of {chartConfig.dataKeys[0]} across {chartConfig.xAxisKey}
           </p>
        )}
      </div>
    </div>
  );

  const renderBarChart = () => (
    <div className={`bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl ${mode !== 'full' ? 'h-full flex flex-col' : ''}`}>
      {renderTitle(chartConfig.barChartTitle)}
      <div className="flex-1 min-h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={sortedData} 
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis 
              dataKey={chartConfig.xAxisKey} 
              stroke="#64748b" 
              tick={{fill: '#94a3b8', fontSize: 12}}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis 
              stroke="#64748b" 
              tick={{fill: '#94a3b8', fontSize: 12}}
              tickLine={false}
              tickFormatter={(value) => formatNumberShort(value)}
              width={100}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0f172a', 
                borderColor: '#334155', 
                color: '#f8fafc',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
              }}
              itemStyle={{ color: '#e2e8f0' }}
              cursor={{ fill: '#1e293b' }}
              formatter={(value: any) => formatNumber(value)}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            {chartConfig.dataKeys.map((key, index) => (
              <Bar 
                key={key} 
                dataKey={key} 
                fill={colors[index % colors.length]} 
                radius={[4, 4, 0, 0]} 
                maxBarSize={50}
                animationDuration={1500}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderAreaChart = () => (
    <div className={`bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl ${mode !== 'full' ? 'h-full flex flex-col' : ''}`}>
      {renderTitle(chartConfig.areaChartTitle)}
      <div className="flex-1 min-h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={sortedData} 
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              {chartConfig.dataKeys.map((key, index) => (
                 <linearGradient key={`grad-${key}`} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                   <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.3}/>
                   <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0}/>
                 </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis 
              dataKey={chartConfig.xAxisKey} 
              stroke="#64748b"
              tick={{fill: '#94a3b8', fontSize: 12}}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis 
              stroke="#64748b" 
              tick={{fill: '#94a3b8', fontSize: 12}}
              tickLine={false}
              tickFormatter={(value) => formatNumberShort(value)}
              width={100}
            />
            <Tooltip 
               contentStyle={{ 
                backgroundColor: '#0f172a', 
                borderColor: '#334155', 
                color: '#f8fafc',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
              }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(value: any) => formatNumber(value)}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            {chartConfig.dataKeys.map((key, index) => (
              <Area 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={colors[index % colors.length]} 
                strokeWidth={2}
                fillOpacity={1} 
                fill={`url(#color-${key})`} 
                animationDuration={1500}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderLineChart = () => (
    <div className={`bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl ${mode !== 'full' ? 'h-full flex flex-col' : ''}`}>
      {renderTitle('Trend Analysis')}
      <div className="flex-1 min-h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={sortedData} 
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis 
              dataKey={chartConfig.xAxisKey} 
              stroke="#64748b"
              tick={{fill: '#94a3b8', fontSize: 12}}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis 
              stroke="#64748b" 
              tick={{fill: '#94a3b8', fontSize: 12}}
              tickLine={false}
              tickFormatter={(value) => formatNumberShort(value)}
              width={100}
            />
            <Tooltip 
               contentStyle={{ 
                backgroundColor: '#0f172a', 
                borderColor: '#334155', 
                color: '#f8fafc',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
              }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(value: any) => formatNumber(value)}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            {chartConfig.dataKeys.map((key, index) => (
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={colors[index % colors.length]} 
                strokeWidth={3}
                dot={{ fill: '#0f172a', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={1500}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderPieChart = () => (
    <div className={`bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl ${mode !== 'full' ? 'h-full flex flex-col' : ''}`}>
      {renderTitle('Distribution')}
      <div className="flex-1 min-h-[300px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
             <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey={chartConfig.dataKeys[0]} // Use first metric for pie slice size
              nameKey={chartConfig.xAxisKey} // Use category for label
              label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#64748b' }}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="rgba(0,0,0,0)" />
              ))}
            </Pie>
            <Tooltip 
               contentStyle={{ 
                backgroundColor: '#0f172a', 
                borderColor: '#334155', 
                color: '#f8fafc',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
              }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(value: any) => formatNumber(value)}
            />
          </PieChart>
        </ResponsiveContainer>
        {pieData.length < sourceData.length && (
            <div className="absolute bottom-0 right-0 text-xs text-slate-500 italic">
                * Top 10 items shown
            </div>
        )}
      </div>
    </div>
  );

  if (mode === 'bar') return renderBarChart();
  if (mode === 'area') return renderAreaChart();
  if (mode === 'line') return renderLineChart();
  if (mode === 'pie') return renderPieChart();

  return (
    <div className="space-y-8">
      {renderBarChart()}
      {renderLineChart()}
      {renderAreaChart()}
    </div>
  );
});

DataVisualizer.displayName = 'DataVisualizer';