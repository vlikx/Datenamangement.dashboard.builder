import { DataRow, ColumnAnalysis, Dataset } from '../types';

// Stub implementations to disable AI features in this deployment
export const generateDataInsights = async (
  fileName: string,
  columns: string[],
  data: DataRow[],
  analysis: ColumnAnalysis[]
): Promise<string> => {
  return "AI features are disabled in this deployment.";
};

export const analyzeCorrelations = async (
  datasets: Dataset[],
  activeFilteredData?: { id: string, data: DataRow[] } | null
): Promise<string> => {
  return "AI features are disabled in this deployment.";
};

export const chatWithDataset = async (
  message: string,
  datasets: Dataset[],
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
  activeFilteredData?: { id: string, data: DataRow[] } | null
): Promise<string> => {
  return "AI features are disabled in this deployment.";
};
