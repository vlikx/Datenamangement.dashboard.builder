import React from 'react';
import { Dataset, DataRow } from '../types';

interface DataTableProps {
  dataset: Dataset;
  filteredData?: DataRow[];
}

export const DataTable: React.FC<DataTableProps> = ({ dataset, filteredData }) => {
  const sourceData = filteredData || dataset.data;
  const displayRows = sourceData.slice(0, 100); 

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl flex flex-col h-[600px]">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h3 className="font-semibold text-slate-200">Raw Data Preview</h3>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
          Showing {displayRows.length} of {sourceData.length} rows
        </span>
      </div>
      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="min-w-full divide-y divide-slate-800 text-left">
          <thead className="bg-slate-950 sticky top-0 z-10">
            <tr>
              {dataset.columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap bg-slate-950 border-b border-slate-800"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-slate-900 divide-y divide-slate-800">
            {displayRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                {dataset.columns.map((col) => (
                  <td key={`${idx}-${col}`} className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 border-r border-slate-800/50 last:border-0">
                    {row[col]?.toString() || <span className="text-slate-600">-</span>}
                  </td>
                ))}
              </tr>
            ))}
            {displayRows.length === 0 && (
                <tr>
                    <td colSpan={dataset.columns.length} className="px-6 py-12 text-center text-slate-500 italic">
                        No matches found for current filters.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};