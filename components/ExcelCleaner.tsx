import React, { useMemo, useState } from 'react';
import { Dataset, DataRow } from '../types';
import { X, Check } from 'lucide-react';

interface ExcelCleanerProps {
  dataset: Dataset;
  onApply: (updated: Dataset) => void;
  onClose: () => void;
}

const isEmptyRow = (row: DataRow) => {
  return Object.values(row).every(v => v === null || v === undefined || String(v).trim() === '');
};

const tryConvertValue = (v: any) => {
  if (v === null || v === undefined) return v;
  const s = String(v).trim();
  if (s === '') return '';
  // convert numeric-looking values
  if (!isNaN(Number(s))) return Number(s);
  return s;
};

export const ExcelCleaner: React.FC<ExcelCleanerProps> = ({ dataset, onApply, onClose }) => {
  const [removeEmptyRows, setRemoveEmptyRows] = useState(true);
  const [trimStrings, setTrimStrings] = useState(true);
  const [convertNumbers, setConvertNumbers] = useState(true);
  const [dropDuplicates, setDropDuplicates] = useState(true);

  const preview = useMemo(() => {
    let rows = dataset.data.map(r => ({ ...r }));

    if (trimStrings) {
      rows = rows.map(r => {
        const out: DataRow = {};
        Object.keys(r).forEach(k => {
          const val = r[k];
          out[k] = typeof val === 'string' ? val.trim() : val;
        });
        return out;
      });
    }

    if (convertNumbers) {
      rows = rows.map(r => {
        const out: DataRow = {};
        Object.keys(r).forEach(k => {
          out[k] = tryConvertValue(r[k]);
        });
        return out;
      });
    }

    if (removeEmptyRows) {
      rows = rows.filter(r => !isEmptyRow(r));
    }

    if (dropDuplicates) {
      const seen = new Set<string>();
      const filtered: DataRow[] = [];
      rows.forEach(r => {
        const key = dataset.columns.map(c => String(r[c])).join('||');
        if (!seen.has(key)) {
          seen.add(key);
          filtered.push(r);
        }
      });
      rows = filtered;
    }

    return rows;
  }, [dataset, removeEmptyRows, trimStrings, convertNumbers, dropDuplicates]);

  const handleApply = () => {
    const newDataset: Dataset = {
      ...dataset,
      data: preview,
      // recompute columns and analysis lightly: keep same columns but recalc analysis client-side
      columns: dataset.columns,
      analysis: dataset.analysis // App will re-run analysis if desired; keeping for simplicity
    };
    onApply(newDataset);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Excel Cleaner</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4"/></button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={removeEmptyRows} onChange={(e) => setRemoveEmptyRows(e.target.checked)} />
              <span className="text-sm text-slate-300">Remove empty rows</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={trimStrings} onChange={(e) => setTrimStrings(e.target.checked)} />
              <span className="text-sm text-slate-300">Trim whitespace</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={convertNumbers} onChange={(e) => setConvertNumbers(e.target.checked)} />
              <span className="text-sm text-slate-300">Convert numeric-like strings</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={dropDuplicates} onChange={(e) => setDropDuplicates(e.target.checked)} />
              <span className="text-sm text-slate-300">Drop duplicate rows</span>
            </label>
          </div>

          <div className="pt-2">
            <h4 className="text-sm text-slate-400">Preview (first 10 rows)</h4>
            <div className="mt-2 overflow-auto max-h-56 border border-slate-800 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950 sticky top-0">
                  <tr>
                    {dataset.columns.map(c => (
                      <th key={c} className="px-2 py-1 text-xs text-slate-400 uppercase border-b border-slate-800">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-slate-900">
                  {preview.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="odd:bg-slate-900 even:bg-slate-920">
                      {dataset.columns.map(c => (
                        <td key={c} className="px-2 py-1 text-slate-300 border-r border-slate-800">{String(row[c] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                  {preview.length === 0 && (
                    <tr>
                      <td colSpan={dataset.columns.length} className="p-4 text-center text-slate-500">No rows in preview</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">Rows: <span className="text-white">{dataset.data.length}</span> → <span className="text-white">{preview.length}</span></div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-2 bg-slate-800 text-slate-200 rounded hover:bg-slate-700">Cancel</button>
              <button onClick={handleApply} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500">
                <Check className="w-4 h-4" /> Apply Cleaning
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelCleaner;
