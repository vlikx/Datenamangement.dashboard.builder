import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, FilePlus } from 'lucide-react';
import { parseExcelFile, analyzeColumns } from '../utils/dataUtils';
import { Dataset } from '../types';

interface FileUploadProps {
  onDataLoaded: (dataset: Dataset) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      setError("Please upload a valid Excel (.xlsx, .xls) or CSV file.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, columns } = await parseExcelFile(file);
      const analysis = analyzeColumns(data, columns);
      
      const newDataset: Dataset = {
        id: crypto.randomUUID(),
        fileName: file.name,
        data,
        columns,
        analysis,
        createdAt: Date.now()
      };
      
      onDataLoaded(newDataset);
    } catch (err) {
      console.error(err);
      setError("Failed to parse file. Please check the format.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 cursor-pointer
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]' 
          : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800'
        }
      `}
    >
      <input 
        type="file" 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
        accept=".xlsx,.xls,.csv" 
        onChange={handleFileChange} 
      />
      
      <div className="flex flex-col items-center justify-center space-y-6 pointer-events-none">
        <div className={`p-5 rounded-full transition-colors ${isDragging ? 'bg-indigo-500/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
          {isLoading ? (
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
          ) : (
            <FileSpreadsheet className={`w-12 h-12 ${isDragging ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-400'}`} />
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold text-white">
            {isLoading ? 'Crunching Numbers...' : 'Drop your Excel file here'}
          </h3>
          <p className="text-slate-400">
            or click to browse local files
          </p>
        </div>

        {error && (
          <div className="absolute -bottom-16 left-0 right-0 p-3 bg-red-900/50 text-red-200 text-sm rounded-lg border border-red-800/50 animate-fade-in">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};