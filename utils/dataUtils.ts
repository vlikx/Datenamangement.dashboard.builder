import { DataRow, ColumnAnalysis, ChartConfig } from '../types';
import * as XLSX from 'xlsx';

export const parseExcelFile = async (file: File): Promise<{ data: DataRow[]; columns: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<DataRow>(worksheet);

        if (jsonData.length === 0) {
          resolve({ data: [], columns: [] });
          return;
        }

        const columns = Object.keys(jsonData[0]);
        resolve({ data: jsonData, columns });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const analyzeColumns = (data: DataRow[], columns: string[]): ColumnAnalysis[] => {
  return columns.map(col => {
    const values = data.map(row => row[col]);
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
    
    // Determine type
    const isNumber = nonNullValues.every(v => !isNaN(Number(v)));
    
    let stats: Partial<ColumnAnalysis> = {};
    if (isNumber && nonNullValues.length > 0) {
        const numbers = nonNullValues.map(v => Number(v));
        stats.min = Math.min(...numbers);
        stats.max = Math.max(...numbers);
    }

    const uniqueValues = new Set(values).size;

    return {
      key: col,
      type: isNumber ? 'number' : 'string',
      uniqueValues,
      ...stats
    };
  });
};

// Format numbers with thousands separator (ISO/German format: 1.000.000)
export const formatNumber = (value: any): string => {
  // Return non-numeric values as-is
  if (value === null || value === undefined || value === '') return '';
  
  const num = Number(value);
  if (isNaN(num)) return String(value);
  
  // Check if it's an integer or float
  if (Number.isInteger(num)) {
    // Format integers with dot separator
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } else {
    // Format floats: use comma as decimal separator and dot for thousands
    const parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  }
};

// Format numbers for chart axes with abbreviations (e.g., 1 Mio., 1 Mrd.)
export const formatNumberShort = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  
  const num = Number(value);
  if (isNaN(num)) return String(value);
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1000000000) {
    // Milliarden
    return (num / 1000000000).toFixed(1).replace('.', ',') + ' Mrd.';
  } else if (absNum >= 1000000) {
    // Millionen
    return (num / 1000000).toFixed(1).replace('.', ',') + ' Mio.';
  } else if (absNum >= 1000) {
    // Tausend
    return (num / 1000).toFixed(1).replace('.', ',') + ' Tsd.';
  } else {
    // Kleinere Zahlen normal formatieren
    return formatNumber(num);
  }
};

// Heuristic to suggest chart config
export const suggestCharts = (analysis: ColumnAnalysis[]): ChartConfig | null => {
  // Look for a categorical column (string, reasonably low cardinality) for X-Axis
  const categoryCol = analysis.find(c => c.type === 'string' || (c.type === 'number' && c.uniqueValues < 50));
  
  // Look for numeric columns for Y-Axis
  const valueCols = analysis.filter(c => c.type === 'number' && c.key !== categoryCol?.key);

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  if (categoryCol && valueCols.length > 0) {
    const primaryMetric = valueCols[0].key;
    const dimension = categoryCol.key;
    const secondaryMetrics = valueCols.slice(0, 3).map(c => c.key);

    return {
      xAxisKey: dimension,
      dataKeys: secondaryMetrics,
      // Dynamic titles based on the data topics
      barChartTitle: `${capitalize(primaryMetric)} by ${capitalize(dimension)}`,
      areaChartTitle: `${capitalize(primaryMetric)} Trends & Overview`
    };
  }
  return null;
};