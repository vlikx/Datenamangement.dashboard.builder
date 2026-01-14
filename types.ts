export interface DataRow {
  [key: string]: string | number | boolean | null;
}

export interface ColumnAnalysis {
  key: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'unknown';
  uniqueValues: number;
  min?: number;
  max?: number;
}

export interface Dataset {
  id: string; // Unique ID for persistence
  fileName: string;
  data: DataRow[];
  columns: string[];
  analysis: ColumnAnalysis[];
  createdAt: number;
  folder?: string; // Optional folder/group name for organization
  dataSource?: {
    name?: string; // e.g., "Statistisches Bundesamt"
    url?: string; // Link to source
    description?: string; // Additional context
    lastUpdated?: string; // When the data was last updated
  };
}

export interface ChartConfig {
  xAxisKey: string;
  dataKeys: string[];
  barChartTitle: string;
  areaChartTitle: string;
}

// Updated WidgetType - removed 'ai-analysis' as it is now a panel
export type WidgetType = 'bar' | 'area' | 'line' | 'pie' | 'table';

export interface Widget {
  id: string;
  datasetId: string;
  type: WidgetType;
  title: string; // Custom title for the hypothesis
  width: 'half' | 'full'; // New property for resizing
  columnConfig?: {
    xAxisKey: string;
    dataKeys: string[];
  };
  sortConfig?: {
    sortKey: string; // Column to sort by
    sortOrder: 'asc' | 'desc';
  };
}

export interface Filter {
  id: string;
  column: string;
  value: string | number | boolean;
}

export interface DashboardPage {
  id: string;
  name: string;
  widgets: Widget[];
  filters: Filter[];
  createdAt: number;
}

// New Type for Chat
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isAnalysis?: boolean;
}