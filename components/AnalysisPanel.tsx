import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCcw, AlertCircle, Bot } from 'lucide-react';
import { Dataset } from '../types';
import { generateDataInsights } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface AnalysisPanelProps {
  dataset: Dataset;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ dataset }) => {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [hasRun, setHasRun] = useState<boolean>(false);

  const runAnalysis = async () => {
    setLoading(true);
    const result = await generateDataInsights(
      dataset.fileName,
      dataset.columns,
      dataset.data,
      dataset.analysis
    );
    setInsight(result);
    setLoading(false);
    setHasRun(true);
  };

  useEffect(() => {
    if (!hasRun) {
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset.fileName]);

  return (
    <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 rounded-xl border border-indigo-500/20 shadow-lg overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
      
      <div className="p-6 border-b border-indigo-500/10 flex justify-between items-center bg-slate-900/50">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-500/10 p-2 rounded-lg">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Executive Summary</h3>
            <p className="text-xs text-indigo-300/60">Powered by Gemini 3 Flash</p>
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center space-x-2 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Thinking...' : 'Refresh'}</span>
        </button>
      </div>
      
      <div className="p-8 min-h-[160px]">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-2 bg-slate-800 rounded w-1/3 mb-6"></div>
            <div className="h-2 bg-slate-800 rounded w-full"></div>
            <div className="h-2 bg-slate-800 rounded w-5/6"></div>
            <div className="h-2 bg-slate-800 rounded w-4/5"></div>
          </div>
        ) : insight ? (
          <div className="prose prose-invert prose-sm max-w-none text-slate-300">
             <ReactMarkdown>{insight}</ReactMarkdown>
          </div>
        ) : (
           <div className="flex flex-col items-center justify-center py-8 text-slate-500 space-y-3">
             <AlertCircle className="w-8 h-8 opacity-50" />
             <span className="text-sm">Click refresh to generate new insights.</span>
           </div>
        )}
      </div>
    </div>
  );
};