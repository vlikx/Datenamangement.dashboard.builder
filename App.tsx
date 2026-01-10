import React, { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
const FileUpload = lazy(() => import('./components/FileUpload').then(m => ({ default: m.FileUpload })));
const DataVisualizer = lazy(() => import('./components/DataVisualizer').then(m => ({ default: m.DataVisualizer })));
const DataTable = lazy(() => import('./components/DataTable').then(m => ({ default: m.DataTable })));
import { parseExcelFile, analyzeColumns } from './utils/dataUtils';
import { Dataset, DashboardPage, Widget, WidgetType, Filter, DataRow } from './types';
import { 
  getAllDatasetsFromDB, saveDatasetToDB, deleteDatasetFromDB,
  getAllPagesFromDB, savePageToDB, deletePageFromDB
} from './services/storageService';
import { 
  LayoutDashboard, 
  Table as TableIcon, 
  Plus, 
  Trash2, 
  BarChart3,
  Loader2,
  Pencil,
  X,
  Database,
  Info,
  AreaChart as AreaChartIcon,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter as FilterIcon,
  Check,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  UploadCloud,
  Settings,
  ArrowUpDown
} from 'lucide-react';

const App: React.FC = () => {
  // Data State
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [pages, setPages] = useState<DashboardPage[]>([]);
  
  // Navigation State
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null); // For "Raw Data" view
  
  // UI State
  const [isInitializing, setIsInitializing] = useState(true);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);
  const [editingPageTitleId, setEditingPageTitleId] = useState<string | null>(null);
    
  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDashboardsOpen, setIsDashboardsOpen] = useState(true);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(true);
  // Dataset selection for bulk actions
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);

  // Widget Title Editing State
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [tempWidgetTitle, setTempWidgetTitle] = useState("");

  // Filter UI State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempFilterColumn, setTempFilterColumn] = useState<string>("");
  const [tempFilterValue, setTempFilterValue] = useState<string>("");

  // Column Config Modal State
  const [showColumnConfigModal, setShowColumnConfigModal] = useState(false);
  const [columnConfigWidgetId, setColumnConfigWidgetId] = useState<string | null>(null);
  const [tempXAxisKey, setTempXAxisKey] = useState<string>("");
  const [tempDataKeys, setTempDataKeys] = useState<string[]>([]);

  // Widget Data Sort Modal State
  const [showWidgetSortModal, setShowWidgetSortModal] = useState(false);
  const [widgetSortId, setWidgetSortId] = useState<string | null>(null);
  const [tempSortKey, setTempSortKey] = useState<string>("");
  const [tempSortOrder, setTempSortOrder] = useState<'asc' | 'desc'>('asc');

  // Delete Confirmation State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: 'dashboard' | 'dataset' | null;
    id: string | null;
    name: string;
  }>({ isOpen: false, type: null, id: null, name: '' });
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const refreshFileInputRef = useRef<HTMLInputElement>(null);
  const [refreshingDatasetId, setRefreshingDatasetId] = useState<string | null>(null);

  // Folder management state
  const [folderExpanded, setFolderExpanded] = useState<Set<string>>(new Set(['Unfiled'])); // Track which folders are expanded
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalDatasetId, setFolderModalDatasetId] = useState<string | null>(null);
  const [tempFolderName, setTempFolderName] = useState<string>("");

  // Drag and drop state for moving datasets to folders
  const [draggedDatasetId, setDraggedDatasetId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Fit-to-screen: refs and scale state to allow shrinking the widget grid to fit viewport
  const widgetsViewportRef = useRef<HTMLDivElement | null>(null);
  const widgetsGridRef = useRef<HTMLDivElement | null>(null);
  const [fitToScreen, setFitToScreen] = useState(false);
  const [fitScale, setFitScale] = useState<number>(1);

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
      const [storedDatasets, storedPages] = await Promise.all([
        getAllDatasetsFromDB(),
        getAllPagesFromDB()
      ]);
      setDatasets(storedDatasets);
      setPages(storedPages);
      
      if (storedPages.length > 0) {
        setActivePageId(storedPages[0].id);
      } else if (storedDatasets.length > 0) {
        await createNewPage("Overview", storedDatasets[0].id);
      }
      
      setIsInitializing(false);
    };
    init();
  }, []);

  // Compute scale when fitToScreen is active or on resize / content changes
  useEffect(() => {
    const compute = () => {
      const vp = widgetsViewportRef.current;
      const grid = widgetsGridRef.current;
      if (!vp || !grid) {
        setFitScale(1);
        return;
      }

      if (!fitToScreen) {
        setFitScale(1);
        return;
      }

      const vw = vp.clientWidth;
      const vh = vp.clientHeight;
      const gw = grid.scrollWidth || grid.offsetWidth;
      const gh = grid.scrollHeight || grid.offsetHeight;
      if (!gw || !gh) {
        setFitScale(1);
        return;
      }

      const scaleX = vw / gw;
      const scaleY = vh / gh;
      const newScale = Math.max(Math.min(scaleX, scaleY, 1), 0.25);
      setFitScale(Number(newScale.toFixed(3)));
    };

    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [fitToScreen, pages, datasets, activePageId]);

  // --- Helpers ---
  const activePage = pages.find(p => p.id === activePageId);
  const activeDataset = activePage?.widgets.length && activePage.widgets[0] 
    ? datasets.find(d => d.id === activePage.widgets[0].datasetId) 
    : (activeDatasetId ? datasets.find(d => d.id === activeDatasetId) : null);

  // Compute available columns for filtering based on datasets used in the current dashboard
  const availableFilterColumns = useMemo(() => {
    if (!activePage) return [];
    // Get IDs of all datasets used in this dashboard
    const usedDatasetIds = new Set(activePage.widgets.map(w => w.datasetId));
    // Filter the full datasets list
    const relevantDatasets = datasets.filter(d => usedDatasetIds.has(d.id));
    // Get unique columns
    const columns = new Set<string>();
    relevantDatasets.forEach(d => d.columns.forEach(c => columns.add(c)));
    return Array.from(columns).sort();
  }, [activePage, datasets]);

  // Compute available values when a column is selected
  const availableFilterValues = useMemo(() => {
    if (!activePage || !tempFilterColumn) return [];
    const usedDatasetIds = new Set(activePage.widgets.map(w => w.datasetId));
    const relevantDatasets = datasets.filter(d => usedDatasetIds.has(d.id));
    
    const values = new Set<string>();
    relevantDatasets.forEach(d => {
      if (d.columns.includes(tempFilterColumn)) {
        d.data.forEach(row => {
          const val = row[tempFilterColumn];
          if (val !== null && val !== undefined) {
             values.add(String(val));
          }
        });
      }
    });
    return Array.from(values).sort().slice(0, 500); // Limit dropdown size
  }, [activePage, datasets, tempFilterColumn]);

  // Apply filters to a dataset
  const getFilteredData = (dataset: Dataset): DataRow[] => {
    if (!activePage || !activePage.filters || activePage.filters.length === 0) {
      return dataset.data;
    }

    return dataset.data.filter(row => {
      // Check if row satisfies ALL filters
      return activePage.filters.every(filter => {
        // If the dataset doesn't have this column, ignore the filter (safe filtering)
        if (!dataset.columns.includes(filter.column)) return true;
        
        // Loose equality to handle number/string differences coming from inputs
        // eslint-disable-next-line eqeqeq
        return row[filter.column] == filter.value;
      });
    });
  };

  
  // --- Actions ---

  const createNewPage = async (name: string = "New Dashboard", initialDatasetId?: string) => {
    const newPage: DashboardPage = {
      id: crypto.randomUUID(),
      name,
      widgets: [],
      filters: [],
      createdAt: Date.now()
    };
    
    if (initialDatasetId) {
      newPage.widgets.push({
        id: crypto.randomUUID(),
        datasetId: initialDatasetId,
        type: 'bar',
        title: 'Key Metrics',
        width: 'half'
      });
      newPage.widgets.push({
        id: crypto.randomUUID(),
        datasetId: initialDatasetId,
        type: 'line',
        title: 'Trend Analysis',
        width: 'half'
      });
       newPage.widgets.push({
        id: crypto.randomUUID(),
        datasetId: initialDatasetId,
        type: 'table',
        title: 'Raw Data View',
        width: 'full'
      });
    }

    setPages(prev => [...prev, newPage]);
    setActivePageId(newPage.id);
    setActiveDatasetId(null); 
    await savePageToDB(newPage);
  };

  const addFilter = async () => {
    if (!activePage || !tempFilterColumn || !tempFilterValue) return;

    const newFilter: Filter = {
      id: crypto.randomUUID(),
      column: tempFilterColumn,
      value: tempFilterValue
    };

    const updatedPage = {
      ...activePage,
      filters: [...(activePage.filters || []), newFilter]
    };

    setPages(prev => prev.map(p => p.id === activePageId ? updatedPage : p));
    await savePageToDB(updatedPage);
    
    // Reset and close
    setTempFilterColumn("");
    setTempFilterValue("");
    setShowFilterModal(false);
  };

  const removeFilter = async (filterId: string) => {
    if (!activePage) return;
    const updatedPage = {
      ...activePage,
      filters: activePage.filters.filter(f => f.id !== filterId)
    };
    setPages(prev => prev.map(p => p.id === activePageId ? updatedPage : p));
    await savePageToDB(updatedPage);
  };

  const openColumnConfigModal = (widget: Widget, dataset: Dataset) => {
    setColumnConfigWidgetId(widget.id);
    setTempXAxisKey(widget.columnConfig?.xAxisKey || "");
    setTempDataKeys(widget.columnConfig?.dataKeys || []);
    setShowColumnConfigModal(true);
  };

  const applyColumnConfig = async () => {
    if (!columnConfigWidgetId || !tempXAxisKey || tempDataKeys.length === 0) return;
    
    await updateWidget(columnConfigWidgetId, {
      columnConfig: {
        xAxisKey: tempXAxisKey,
        dataKeys: tempDataKeys
      }
    });
    
    setShowColumnConfigModal(false);
    setColumnConfigWidgetId(null);
    setTempXAxisKey("");
    setTempDataKeys([]);
  };

  const openWidgetSortModal = (widget: Widget, dataset: Dataset) => {
    setWidgetSortId(widget.id);
    setTempSortKey(widget.sortConfig?.sortKey || dataset.columns[0] || "");
    setTempSortOrder(widget.sortConfig?.sortOrder || 'asc');
    setShowWidgetSortModal(true);
  };

  const applyWidgetSort = async () => {
    if (!widgetSortId || !tempSortKey) return;
    
    await updateWidget(widgetSortId, {
      sortConfig: {
        sortKey: tempSortKey,
        sortOrder: tempSortOrder
      }
    });
    
    setShowWidgetSortModal(false);
    setWidgetSortId(null);
    setTempSortKey("");
    setTempSortOrder('asc');
  };

  const requestDeletePage = (id: string, name: string) => {
    setDeleteConfirmState({ isOpen: true, type: 'dashboard', id, name });
  };

  const requestDeleteDataset = (id: string, name: string) => {
    setDeleteConfirmState({ isOpen: true, type: 'dataset', id, name });
  };

  const executeDelete = async () => {
    const { type, id } = deleteConfirmState;
    if (!type || !id) return;

    if (type === 'dashboard') {
      setPages(prev => prev.filter(p => p.id !== id));
      if (activePageId === id) setActivePageId(null);
      await deletePageFromDB(id);
    } else if (type === 'dataset') {
      setDatasets(prev => prev.filter(d => d.id !== id));
      if (activeDatasetId === id) setActiveDatasetId(null);
      // Clean up widgets using this dataset
      setPages(prev => {
        const updatedPages = prev.map(p => ({
            ...p,
            widgets: p.widgets.filter(w => w.datasetId !== id)
        }));
        updatedPages.forEach(p => savePageToDB(p)); 
        return updatedPages;
      });
      await deleteDatasetFromDB(id);
    }

    setDeleteConfirmState({ isOpen: false, type: null, id: null, name: '' });
  };

  const updatePageName = async (id: string, newName: string) => {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    const updatedPage = { ...page, name: newName };
    setPages(prev => prev.map(p => p.id === id ? updatedPage : p));
    await savePageToDB(updatedPage);
  };

  const handleDataLoaded = async (newDataset: Dataset) => {
    setDatasets(prev => [...prev, newDataset]);
    await saveDatasetToDB(newDataset);
    setIsDataSourcesOpen(true); // Auto expand when new data arrives
    
    if (pages.length === 0) {
      await createNewPage("Overview", newDataset.id);
    }
  };

  const triggerRefreshDataset = (datasetId: string) => {
    setRefreshingDatasetId(datasetId);
    refreshFileInputRef.current?.click();
  };

  const handleRefreshDataset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!refreshingDatasetId || !e.target.files || e.target.files.length === 0) {
      e.target.value = '';
      return;
    }

    // Only process the first file if multiple files are selected
    const file = e.target.files[0];
    try {
      const { data, columns } = await parseExcelFile(file);
      const analysis = analyzeColumns(data, columns);
      
      // Update the existing dataset with new data
      const updatedDataset: Dataset = {
        ...datasets.find(d => d.id === refreshingDatasetId)!,
        data,
        columns,
        analysis,
        fileName: file.name
      };

      // Update state and DB
      setDatasets(prev => prev.map(d => d.id === refreshingDatasetId ? updatedDataset : d));
      await saveDatasetToDB(updatedDataset);
      
      alert(`Dataset "${file.name}" refreshed successfully!`);
    } catch (err) {
      console.error(err);
      alert("Failed to refresh dataset.");
    }
    
    setRefreshingDatasetId(null);
    e.target.value = '';
  };

  const toggleFolder = (folderName: string) => {
    const newExpanded = new Set(folderExpanded);
    if (newExpanded.has(folderName)) {
      newExpanded.delete(folderName);
    } else {
      newExpanded.add(folderName);
    }
    setFolderExpanded(newExpanded);
  };

  const assignDatasetToFolder = async (datasetId: string, folderName: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (!dataset) return;

    const updatedDataset: Dataset = { ...dataset, folder: folderName };
    setDatasets(prev => prev.map(d => d.id === datasetId ? updatedDataset : d));
    await saveDatasetToDB(updatedDataset);
    
    // Expand the new folder
    const newExpanded = new Set(folderExpanded);
    newExpanded.add(folderName);
    setFolderExpanded(newExpanded);
    
    setShowFolderModal(false);
    setFolderModalDatasetId(null);
    setTempFolderName("");
  };

  const getUniqueFolders = (): string[] => {
    const folders = new Set<string>();
    datasets.forEach(d => {
      if (d.folder) folders.add(d.folder);
      else folders.add('Unfiled');
    });
    return Array.from(folders).sort((a, b) => a === 'Unfiled' ? 1 : b === 'Unfiled' ? -1 : a.localeCompare(b));
  };

  // Drag and drop handlers for moving datasets to folders
  const handleDatasetDragStart = (datasetId: string) => {
    setDraggedDatasetId(datasetId);
  };

  const handleDatasetDragEnd = () => {
    setDraggedDatasetId(null);
    setDragOverFolder(null);
  };

  const handleFolderDragOver = (e: React.DragEvent<HTMLDivElement>, folderName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedDatasetId) {
      setDragOverFolder(folderName);
    }
  };

  const handleFolderDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleFolderDrop = async (e: React.DragEvent<HTMLDivElement>, folderName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedDatasetId) return;

    const dataset = datasets.find(d => d.id === draggedDatasetId);
    if (dataset && dataset.folder !== folderName) {
      // Update the dataset's folder
      await assignDatasetToFolder(draggedDatasetId, folderName);
    }

    setDraggedDatasetId(null);
    setDragOverFolder(null);
  };

  // --- Backup Functions ---
  const handleExportBackup = () => {
    const backupData = {
      version: 1,
      timestamp: Date.now(),
      datasets,
      pages
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `datadeck-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => importInputRef.current?.click();

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only process the first file if multiple files are selected
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        let importedDatasetsCount = 0;
        let importedPagesCount = 0;
        let skippedDatasetsCount = 0;

        // Get existing dataset filenames to avoid duplicates
        const existingFileNames = new Set(datasets.map(d => d.fileName));

        if (json.datasets && Array.isArray(json.datasets)) {
          for (const ds of json.datasets) {
            // Skip if dataset with same filename already exists
            if (existingFileNames.has(ds.fileName)) {
              skippedDatasetsCount++;
              continue;
            }
            await saveDatasetToDB(ds);
            importedDatasetsCount++;
          }
        }
        
        if (json.pages && Array.isArray(json.pages)) {
          for (const pg of json.pages) {
            await savePageToDB(pg);
            importedPagesCount++;
          }
        }

        // Refresh state from DB
        const [storedDatasets, storedPages] = await Promise.all([
          getAllDatasetsFromDB(),
          getAllPagesFromDB()
        ]);
        setDatasets(storedDatasets);
        setPages(storedPages);

        // Set active page to the first imported page if available
        if (storedPages.length > 0) {
          setActivePageId(storedPages[0].id);
        } else if (storedDatasets.length > 0) {
          setActiveDatasetId(storedDatasets[0].id);
        }

        let message = `Restored ${importedDatasetsCount} datasets and ${importedPagesCount} dashboards.`;
        if (skippedDatasetsCount > 0) {
          message += ` (${skippedDatasetsCount} duplicate dataset(s) skipped)`;
        }
        alert(message);
      } catch (err) {
        console.error(err);
        alert("Failed to restore backup. Invalid file format.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };


  // --- Widget Management ---

  const addWidget = async (datasetId: string, type: WidgetType) => {
    if (!activePageId) return;
    const page = pages.find(p => p.id === activePageId);
    const dataset = datasets.find(d => d.id === datasetId);
    if (!page || !dataset) return;

    let title = "New Widget";
    if (type === 'bar') title = "Metric Breakdown";
    if (type === 'area') title = "Trend Analysis";
    if (type === 'line') title = "Growth Trend";
    if (type === 'pie') title = "Distribution";
    if (type === 'table') title = "Data Table";

    // Add dataset filename to title
    const fileName = dataset.fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
    title = `${title} - ${fileName}`;

    const newWidget: Widget = {
      id: crypto.randomUUID(),
      datasetId,
      type,
      title,
      width: type === 'table' ? 'full' : 'half'
    };

    const updatedPage = { ...page, widgets: [...page.widgets, newWidget] };
    setPages(prev => prev.map(p => p.id === activePageId ? updatedPage : p));
    await savePageToDB(updatedPage);
    setShowAddWidgetModal(false);
  };

  const removeWidget = async (widgetId: string) => {
    if (!activePageId) return;
    const page = pages.find(p => p.id === activePageId);
    if (!page) return;

    const updatedPage = {
      ...page,
      widgets: page.widgets.filter(w => w.id !== widgetId)
    };
    setPages(prev => prev.map(p => p.id === activePageId ? updatedPage : p));
    await savePageToDB(updatedPage);
  };

  const updateWidget = async (widgetId: string, updates: Partial<Widget>) => {
    if (!activePageId) return;
    const page = pages.find(p => p.id === activePageId);
    if (!page) return;

    const updatedPage = {
      ...page,
      widgets: page.widgets.map(w => w.id === widgetId ? { ...w, ...updates } : w)
    };
    setPages(prev => prev.map(p => p.id === activePageId ? updatedPage : p));
    await savePageToDB(updatedPage);
  };

  const moveWidget = async (index: number, direction: 'left' | 'right') => {
    if (!activePageId) return;
    const page = pages.find(p => p.id === activePageId);
    if (!page) return;

    const newWidgets = [...page.widgets];
    if (direction === 'left' && index > 0) {
      [newWidgets[index - 1], newWidgets[index]] = [newWidgets[index], newWidgets[index - 1]];
    } else if (direction === 'right' && index < newWidgets.length - 1) {
      [newWidgets[index + 1], newWidgets[index]] = [newWidgets[index], newWidgets[index + 1]];
    } else {
      return;
    }

    const updatedPage = { ...page, widgets: newWidgets };
    setPages(prev => prev.map(p => p.id === activePageId ? updatedPage : p));
    await savePageToDB(updatedPage);
  };

  // --- File Input Helpers ---
  const triggerHiddenFileInput = () => fileInputRef.current?.click();
  const handleHiddenFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only process the first file if multiple files are selected
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
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
         handleDataLoaded(newDataset);
      } catch (err) {
        console.error(err);
        alert("Failed to load file.");
      }
      e.target.value = '';
    }
  };

  // --- Main Render ---

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Loading fallback component
  const LoadingFallback = () => (
    <div className="flex items-center justify-center w-full h-full">
      <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside 
        className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out`}
      >
        <div className={`p-6 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-slate-500 hover:text-white transition-colors"
          >
             {isSidebarCollapsed ? (
                <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
                   <PanelLeftOpen className="w-5 h-5 text-white" />
                </div>
             ) : (
                <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
                   <PanelLeftClose className="w-5 h-5 text-white" />
                </div>
             )}
          </button>
          {!isSidebarCollapsed && (
            <span className="font-bold text-lg tracking-tight text-white whitespace-nowrap animate-in fade-in duration-200">Data Deck</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
          
          {/* Dashboards Section */}
          <div className="py-2">
            {!isSidebarCollapsed ? (
              <div 
                className="px-6 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-colors"
                onClick={() => setIsDashboardsOpen(!isDashboardsOpen)}
              >
                 <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {isDashboardsOpen ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                    <span>My Dashboards</span>
                 </div>
                 <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                   <button onClick={() => createNewPage()} className="p-1 hover:text-indigo-400 text-slate-500 transition-colors">
                      <Plus className="w-4 h-4" />
                   </button>
                 </div>
              </div>
            ) : (
               <div className="flex justify-center py-2 mb-2">
                  <div className="h-px w-8 bg-slate-800" />
               </div>
            )}

            {(isDashboardsOpen || isSidebarCollapsed) && (
              <div className={`space-y-1 mt-1 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
                {pages.map(page => (
                  <div key={page.id} 
                    className={`group flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-3'} py-2 rounded-lg text-sm font-medium transition-all ${
                      activePageId === page.id 
                        ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700' 
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                    title={isSidebarCollapsed ? page.name : undefined}
                  >
                    {/* Navigation Area */}
                    <div 
                      className={`flex-1 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} cursor-pointer overflow-hidden`}
                      onClick={() => { setActivePageId(page.id); setActiveDatasetId(null); }}
                    >
                      <BarChart3 className={`w-4 h-4 shrink-0 ${activePageId === page.id ? 'text-indigo-400' : 'text-slate-600'}`} />
                      
                      {!isSidebarCollapsed && (
                        <div className="truncate">
                          {editingPageTitleId === page.id ? (
                            <input 
                              autoFocus
                              className="bg-transparent border-b border-indigo-500 outline-none w-full text-white"
                              defaultValue={page.name}
                              onBlur={(e) => {
                                updatePageName(page.id, e.target.value);
                                setEditingPageTitleId(null);
                              }}
                              onKeyDown={(e) => {
                                if(e.key === 'Enter') {
                                  updatePageName(page.id, e.currentTarget.value);
                                  setEditingPageTitleId(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span onDoubleClick={() => setEditingPageTitleId(page.id)}>{page.name}</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons (Only visible when expanded) */}
                    {!isSidebarCollapsed && (
                      <div className={`flex items-center shrink-0 ${activePageId === page.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button 
                          onClick={() => setEditingPageTitleId(page.id)}
                          className="p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-white"
                          title="Rename Dashboard"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { deleteButtonRef.current = e.currentTarget as HTMLButtonElement; requestDeletePage(page.id, page.name); }}
                          className="p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400"
                          title="Delete Dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isSidebarCollapsed && <div className="h-px bg-slate-900 my-2 mx-4" />}

          {/* Data Sources Section */}
          <div className="py-2">
             {!isSidebarCollapsed ? (
                <div 
                  className="px-6 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-colors"
                  onClick={() => setIsDataSourcesOpen(!isDataSourcesOpen)}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {isDataSourcesOpen ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                    <span>Data Sources</span>
                  </div>
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <button onClick={triggerHiddenFileInput} className="p-1 hover:text-indigo-400 text-slate-500 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
             ) : (
               <div className="flex justify-center py-2 mb-2">
                   <div className="h-px w-8 bg-slate-800" />
               </div>
             )}

            {(isDataSourcesOpen || isSidebarCollapsed) && (
              <div className={`space-y-1 mt-1 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
                {/* Render folders with datasets grouped inside */}
                {getUniqueFolders().map(folder => {
                  const datasetsInFolder = datasets.filter(d => (d.folder || 'Unfiled') === folder);
                  const isExpanded = folderExpanded.has(folder);

                  return (
                    <div key={folder}>
                      {/* Folder Header (if not collapsed sidebar) */}
                      {!isSidebarCollapsed && (
                        <div
                          className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer rounded transition-colors ${
                            dragOverFolder === folder 
                              ? 'bg-indigo-600/30 text-indigo-300 ring-1 ring-indigo-500' 
                              : 'hover:bg-slate-900'
                          }`}
                          onClick={() => toggleFolder(folder)}
                          onDragOver={(e) => handleFolderDragOver(e, folder)}
                          onDragLeave={handleFolderDragLeave}
                          onDrop={(e) => handleFolderDrop(e, folder)}
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          <span>{folder}</span>
                        </div>
                      )}

                      {/* Datasets in folder */}
                      {isExpanded && datasetsInFolder.map(ds => (
                        <div key={ds.id} 
                          draggable
                          onDragStart={() => handleDatasetDragStart(ds.id)}
                          onDragEnd={handleDatasetDragEnd}
                          className={`group flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-3'} py-2 rounded-lg text-sm font-medium transition-all cursor-grab active:cursor-grabbing ${
                            draggedDatasetId === ds.id
                              ? 'opacity-50 bg-slate-700'
                              : activeDatasetId === ds.id 
                              ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700' 
                              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                          }`}
                          title={isSidebarCollapsed ? ds.fileName : undefined}
                        >
                          {/* Selection checkbox for bulk delete */}
                          {!isSidebarCollapsed && (
                            <div className="shrink-0">
                              <input
                                type="checkbox"
                                className="mr-2"
                                checked={selectedDatasetIds.includes(ds.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedDatasetIds(prev => {
                                    if (e.target.checked) return [...prev, ds.id];
                                    return prev.filter(id => id !== ds.id);
                                  });
                                }}
                              />
                            </div>
                          )}
                          {/* Navigation Area */}
                          <div 
                            className={`flex-1 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} cursor-pointer overflow-hidden`}
                            onClick={() => { setActiveDatasetId(ds.id); setActivePageId(null); }}
                          >
                            <Database className={`w-4 h-4 shrink-0 ${activeDatasetId === ds.id ? 'text-indigo-400' : 'text-slate-600'}`} />
                            {!isSidebarCollapsed && <span className="truncate">{ds.fileName}</span>}
                          </div>
                          
                          {/* Action Buttons (Only visible when expanded) */}
                          {!isSidebarCollapsed && (
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all z-20">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setFolderModalDatasetId(ds.id); setTempFolderName(ds.folder || ""); setShowFolderModal(true); }}
                                className="p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-blue-400 transition-colors"
                                title="Move to Folder"
                              >
                                <Database className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); triggerRefreshDataset(ds.id); }}
                                className="p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-green-400 transition-colors"
                                title="Refresh Dataset"
                              >
                                <UploadCloud className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteButtonRef.current = e.currentTarget as HTMLButtonElement; requestDeleteDataset(ds.id, ds.fileName); }}
                                className="p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400 transition-colors"
                                title="Delete Dataset"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {datasets.length === 0 && !isSidebarCollapsed && (
                  <div className="px-3 py-2 text-sm text-slate-600 italic">No files loaded</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Backup / Restore Section (Bottom) */}
        <div className="border-t border-slate-800 p-3 bg-slate-950/50">
           {!isSidebarCollapsed ? (
             <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportBackup}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors text-xs font-medium"
                  title="Download Backup"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Backup</span>
                </button>
                <button 
                  onClick={triggerImport}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors text-xs font-medium"
                  title="Restore Backup"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Delete selected datasets"
                  disabled={selectedDatasetIds.length === 0}
                  onClick={(e) => {
                    if (selectedDatasetIds.length === 0) return;
                    deleteButtonRef.current = e.currentTarget as HTMLButtonElement;
                    const ok = window.confirm(`Delete ${selectedDatasetIds.length} selected data source(s)? This will remove any widgets using them.`);
                    if (!ok) return;
                    const toDelete = new Set(selectedDatasetIds);
                    setDatasets(prev => prev.filter(d => !toDelete.has(d.id)));
                    const updatedPages = pages.map(p => ({ ...p, widgets: p.widgets.filter(w => !toDelete.has(w.datasetId)) }));
                    setPages(updatedPages);
                    for (const p of updatedPages) savePageToDB(p);
                    for (const id of selectedDatasetIds) deleteDatasetFromDB(id);
                    setSelectedDatasetIds([]);
                    if (selectedDatasetIds.includes(activeDatasetId || '')) setActiveDatasetId(null);
                  }}
                  className={`p-2 rounded-md transition-colors ${selectedDatasetIds.length === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`} 
                  title="Delete selected datasets"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
             </div>
           ) : (
             <div className="flex flex-col gap-2 items-center">
                <button 
                 onClick={handleExportBackup}
                 className="p-2 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                 title="Download Backup"
               >
                 <Download className="w-4 h-4" />
               </button>
               <button 
                 onClick={triggerImport}
                 className="p-2 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                 title="Restore Backup"
               >
                 <UploadCloud className="w-4 h-4" />
               </button>
             </div>
           )}
        </div>

        <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".xlsx,.xls,.csv" 
            onChange={handleHiddenFileChange}
        />
        <input 
            type="file" 
            ref={refreshFileInputRef}
            className="hidden" 
            accept=".xlsx,.xls,.csv" 
            onChange={handleRefreshDataset}
        />
        <input 
            type="file" 
            ref={importInputRef}
            className="hidden" 
            accept=".json" 
            onChange={handleImportBackup}
        />
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
        
        
        
        {/* VIEW: DASHBOARD */}
        {activePageId && activePage && (
          <div className="flex flex-col h-full">
            <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm flex items-center justify-between px-8 shrink-0 z-10 sticky top-0">
               <div className="flex items-center gap-6 overflow-hidden">
                 <div className="shrink-0">
                   <h1 className="text-2xl font-bold text-white tracking-tight">{activePage.name}</h1>
                 </div>
                 
                 {/* Filter Bar */}
                 <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                   {activePage.filters?.map(filter => (
                     <div key={filter.id} className="flex items-center gap-1.5 bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-2 py-1 rounded text-xs whitespace-nowrap">
                       <span className="font-semibold">{filter.column}:</span>
                       <span>{String(filter.value)}</span>
                       <button onClick={() => removeFilter(filter.id)} className="hover:text-white ml-1">
                         <X className="w-3 h-3"/>
                       </button>
                     </div>
                   ))}
                   
                   {/* Add Filter Trigger */}
                   {activePage.widgets.length > 0 && (
                      <button 
                        onClick={() => setShowFilterModal(true)}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 px-2 py-1 rounded text-xs transition-colors whitespace-nowrap"
                      >
                        <FilterIcon className="w-3 h-3" />
                        Filter
                      </button>
                   )}
                 </div>
               </div>
               
               <div className="flex items-center gap-2 shrink-0">
                 <button 
                   onClick={(e) => { deleteButtonRef.current = e.currentTarget as HTMLButtonElement; requestDeletePage(activePage.id, activePage.name); }}
                   className="flex items-center gap-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 px-3 py-2 rounded-lg transition-colors text-sm font-medium border border-slate-800 hover:border-red-400/30"
                 >
                   <Trash2 className="w-4 h-4" />
                   <span className="hidden sm:inline">Delete</span>
                 </button>
                 
                 <button 
                   onClick={() => setShowAddWidgetModal(true)}
                   className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                 >
                   <Plus className="w-4 h-4" />
                   Add Widget
                 </button>
                 
                 <button
                   onClick={() => setFitToScreen(prev => !prev)}
                   className="flex items-center gap-2 ml-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                   title={fitToScreen ? 'Exit fit-to-screen' : 'Fit widgets to screen'}
                 >
                   {fitToScreen ? (
                     <Minimize2 className="w-4 h-4" />
                   ) : (
                     <Maximize2 className="w-4 h-4" />
                   )}
                   <span className="hidden sm:inline">{fitToScreen ? 'Exit Fit' : 'Fit'}</span>
                 </button>
               </div>
            </header>

            <div ref={widgetsViewportRef} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
               {activePage.widgets.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                    <BarChart3 className="w-16 h-16 mb-4 stroke-1" />
                    <p className="text-lg font-medium">This dashboard is empty</p>
                    <p>Add widgets to start analyzing your data</p>
                 </div>
               ) : (
                 <div ref={widgetsGridRef} style={fitToScreen ? { transform: `scale(${fitScale})`, transformOrigin: 'top center' } : undefined} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1920px] mx-auto pb-20">
                    {activePage.widgets.map((widget, index) => {
                      const dataset = datasets.find(d => d.id === widget.datasetId);
                      const isFullWidth = widget.width === 'full';
                      const colSpan = isFullWidth ? 'md:col-span-2' : 'md:col-span-1';
                      
                      // Calculate filtered data specifically for this widget
                      const widgetData = dataset ? getFilteredData(dataset) : [];

                      return (
                        <div key={widget.id} className={`${colSpan} min-h-[400px] flex flex-col relative group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all hover:border-slate-700`}>
                           
                          {/* Widget Controls Overlay (moved slightly left to make room for info icon) */}
                          <div className="absolute top-2 right-12 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 rounded-lg p-1 border border-slate-800 backdrop-blur-sm">
                              {/* Move Controls */}
                              <button onClick={() => moveWidget(index, 'left')} disabled={index === 0} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30">
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => moveWidget(index, 'right')} disabled={index === activePage.widgets.length - 1} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30">
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                              
                              <div className="w-px bg-slate-700 mx-1"></div>

                              {/* Size Control */}
                              <button onClick={() => updateWidget(widget.id, { width: isFullWidth ? 'half' : 'full' })} className="p-1.5 text-slate-400 hover:text-indigo-400">
                                {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                              </button>

                              <div className="w-px bg-slate-700 mx-1"></div>

                              {/* Column Config for Chart Widgets */}
                              {(widget.type === 'bar' || widget.type === 'area' || widget.type === 'line' || widget.type === 'pie') && (
                                <button 
                                  onClick={() => dataset && openColumnConfigModal(widget, dataset)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-400"
                                  title="Configure columns"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <div className="w-px bg-slate-700 mx-1"></div>

                              {(widget.type === 'bar' || widget.type === 'area' || widget.type === 'line') && (
                                <button 
                                  onClick={() => dataset && openWidgetSortModal(widget, dataset)}
                                  className="p-1.5 text-slate-400 hover:text-green-400"
                                  title="Sort data in chart"
                                >
                                  <ArrowUpDown className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <div className="w-px bg-slate-700 mx-1"></div>

                              {/* Edit/Delete */}
                              <button 
                                onClick={() => {
                                   setEditingWidgetId(widget.id);
                                   setTempWidgetTitle(widget.title);
                                }}
                                className="p-1.5 text-slate-400 hover:text-white"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => { deleteButtonRef.current = e.currentTarget as HTMLButtonElement; removeWidget(widget.id); }} className="p-1.5 text-slate-400 hover:text-red-400">
                                <X className="w-3.5 h-3.5" />
                              </button>
                           </div>

                           {/* Content Layer */}

                          {/* Dataset info icon (top-right) */}
                          {dataset && (
                            <div className="absolute top-2 right-2 z-30">
                              <button title={dataset.fileName} className="p-1.5 bg-slate-800/70 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700">
                                <Info className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                           {dataset ? (
                             <>
                               {/* Inline Title Editor Overlay if active */}
                               {editingWidgetId === widget.id && (
                                 <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-slate-900/95 border-b border-indigo-500 flex gap-2">
                                    <input 
                                      autoFocus
                                      value={tempWidgetTitle}
                                      onChange={(e) => setTempWidgetTitle(e.target.value)}
                                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                                      placeholder="Widget Title"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                           updateWidget(widget.id, { title: tempWidgetTitle });
                                           setEditingWidgetId(null);
                                        }
                                      }}
                                    />
                                    <button 
                                      onClick={() => {
                                         updateWidget(widget.id, { title: tempWidgetTitle });
                                         setEditingWidgetId(null);
                                      }}
                                      className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-500"
                                    >
                                      Save
                                    </button>
                                 </div>
                               )}

                               {(widget.type === 'bar' || widget.type === 'area' || widget.type === 'line' || widget.type === 'pie') && (
                                 <div className="h-full" onDoubleClick={() => { setEditingWidgetId(widget.id); setTempWidgetTitle(widget.title); }}>
                                    <Suspense fallback={<LoadingFallback />}>
                                      <DataVisualizer dataset={dataset} filteredData={widgetData} mode={widget.type} customTitle={widget.title} columnConfig={widget.columnConfig} sortConfig={widget.sortConfig} />
                                    </Suspense>
                                 </div>
                               )}
                               {widget.type === 'table' && (
                                 <div className="h-[500px] flex flex-col">
                                    <div className="px-6 pt-6 pb-2 font-semibold text-white cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => { setEditingWidgetId(widget.id); setTempWidgetTitle(widget.title); }}>
                                      {widget.title}
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                       <Suspense fallback={<LoadingFallback />}>
                                         <DataTable dataset={dataset} filteredData={widgetData} />
                                       </Suspense>
                                    </div>
                                 </div>
                               )}
                             </>
                           ) : (
                             <div className="h-full flex items-center justify-center text-red-400 bg-red-900/10">
                               Source Data Missing
                             </div>
                           )}
                        </div>
                      );
                    })}
                 </div>
               )}
            </div>
          </div>
        )}

        {/* VIEW: RAW DATA (Single File View) */}
        {activeDatasetId && (
          <div className="flex flex-col h-full">
             <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm flex items-center justify-between px-8 shrink-0 z-10 sticky top-0">
                <div className="flex items-center gap-4">
                 <h1 className="text-xl font-bold text-white tracking-tight">Data Source Preview</h1>
                 <div className="bg-slate-800 px-3 py-1 rounded text-sm text-slate-300">
                    {datasets.find(d => d.id === activeDatasetId)?.fileName}
                 </div>
               </div>
               
               <div>
                   {/* Delete Button in Header */}
                   <button 
                     onClick={(e) => {
                       deleteButtonRef.current = e.currentTarget as HTMLButtonElement;
                       const ds = datasets.find(d => d.id === activeDatasetId);
                       if (ds) requestDeleteDataset(ds.id, ds.fileName);
                     }}
                     className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 px-3 py-2 rounded-lg transition-colors text-sm font-medium border border-red-400/20"
                   >
                     <Trash2 className="w-4 h-4" />
                     Delete Source
                   </button>
               </div>
             </header>
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {(() => {
                  const ds = datasets.find(d => d.id === activeDatasetId);
                  if (!ds) return null;
                  return (
                    <Suspense fallback={<LoadingFallback />}>
                      <DataTable dataset={ds} />
                    </Suspense>
                  );
                })()}
             </div>
          </div>
        )}

        {/* VIEW: EMPTY STATE */}
        {!activePageId && !activeDatasetId && (
          <div className="flex-1 flex items-center justify-center p-8">
             <div className="text-center max-w-lg">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-800">
                  <LayoutDashboard className="w-8 h-8 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to Data Deck</h2>
                <p className="text-slate-400 mb-8">Select a dashboard from the sidebar or upload a new data source to begin.</p>
                
                <Suspense fallback={<LoadingFallback />}>
                  <FileUpload onDataLoaded={handleDataLoaded} />
                </Suspense>
             </div>
          </div>
        )}

        {/* FILTER MODAL */}
        {showFilterModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <h3 className="text-lg font-semibold text-white">Add Dashboard Filter</h3>
                <button onClick={() => setShowFilterModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="p-6 space-y-4">
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Column</label>
                   <select 
                     value={tempFilterColumn}
                     onChange={(e) => { setTempFilterColumn(e.target.value); setTempFilterValue(""); }}
                     className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                   >
                     <option value="">Select a column...</option>
                     {availableFilterColumns.map(col => (
                       <option key={col} value={col}>{col}</option>
                     ))}
                   </select>
                 </div>

                 {tempFilterColumn && (
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Value</label>
                     <select 
                       value={tempFilterValue}
                       onChange={(e) => setTempFilterValue(e.target.value)}
                       className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                     >
                       <option value="">Select value...</option>
                       {availableFilterValues.map(val => (
                         <option key={val} value={val}>{val}</option>
                       ))}
                     </select>
                   </div>
                 )}

                 <div className="pt-2">
                   <button 
                     onClick={addFilter}
                     disabled={!tempFilterColumn || !tempFilterValue}
                     className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white py-2 rounded-lg font-medium transition-all"
                   >
                     <Check className="w-4 h-4" />
                     Apply Filter
                   </button>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* ADD WIDGET MODAL */}
        {showAddWidgetModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                  <h3 className="text-xl font-semibold text-white">Add Widget to Dashboard</h3>
                  <button onClick={() => setShowAddWidgetModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="p-6 grid grid-cols-2 gap-8">
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">1. Select Data Source</label>
                     <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {datasets.map(ds => (
                          <div 
                            key={ds.id}
                            className="w-full text-left p-3 rounded-lg bg-slate-800 border border-slate-700"
                          >
                            <div className="font-medium text-slate-200">{ds.fileName}</div>
                            <div className="text-xs text-slate-500 mt-1 mb-2">{ds.data.length} rows</div>
                            
                            <div className="grid grid-cols-2 gap-2">
                               <button 
                                 onClick={() => addWidget(ds.id, 'bar')}
                                 className="px-2 py-1.5 bg-slate-900 hover:bg-indigo-600 rounded text-xs flex items-center justify-center gap-1 transition-colors text-slate-300 hover:text-white"
                               >
                                  <BarChart3 size={12}/> Bar Chart
                               </button>
                               <button 
                                 onClick={() => addWidget(ds.id, 'area')}
                                 className="px-2 py-1.5 bg-slate-900 hover:bg-indigo-600 rounded text-xs flex items-center justify-center gap-1 transition-colors text-slate-300 hover:text-white"
                               >
                                  <AreaChartIcon size={12}/> Area Chart
                               </button>
                               <button 
                                 onClick={() => addWidget(ds.id, 'line')}
                                 className="px-2 py-1.5 bg-slate-900 hover:bg-indigo-600 rounded text-xs flex items-center justify-center gap-1 transition-colors text-slate-300 hover:text-white"
                               >
                                  <LineChartIcon size={12}/> Line Chart
                               </button>
                               <button 
                                 onClick={() => addWidget(ds.id, 'pie')}
                                 className="px-2 py-1.5 bg-slate-900 hover:bg-indigo-600 rounded text-xs flex items-center justify-center gap-1 transition-colors text-slate-300 hover:text-white"
                               >
                                  <PieChartIcon size={12}/> Pie Chart
                               </button>
                               <button 
                                 onClick={() => addWidget(ds.id, 'table')}
                                 className="col-span-2 px-2 py-1.5 bg-slate-900 hover:bg-indigo-600 rounded text-xs flex items-center justify-center gap-1 transition-colors text-slate-300 hover:text-white"
                               >
                                  <TableIcon size={12}/> Data Table
                               </button>
                            </div>
                          </div>
                        ))}
                        {datasets.length === 0 && <div className="text-slate-500 italic text-sm">No data sources available. Please upload a file first.</div>}
                     </div>
                   </div>

                   <div className="bg-slate-800/50 rounded-xl p-6 flex flex-col justify-center text-center border border-slate-800 border-dashed">
                      <LayoutDashboard className="w-12 h-12 text-slate-600 mx-auto mb-4"/>
                      <p className="text-slate-400 text-sm">
                         Mix and match bar, area, line, and pie charts to visualize your Excel data perfectly.
                      </p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* DELETE CONFIRMATION POPOVER */}
        {deleteConfirmState.isOpen && (
          <div className="fixed inset-0 z-[100]" onClick={() => setDeleteConfirmState(prev => ({ ...prev, isOpen: false }))}>
            <div 
              className="absolute bg-slate-900 border border-slate-800 rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 w-72"
              style={{
                top: deleteButtonRef.current ? deleteButtonRef.current.getBoundingClientRect().top + deleteButtonRef.current.getBoundingClientRect().height + 8 : '0',
                left: deleteButtonRef.current ? Math.max(16, deleteButtonRef.current.getBoundingClientRect().left - 200) : '0'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-red-900/20 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Delete?</h3>
                    <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone</p>
                  </div>
                </div>
                
                <div className="bg-slate-800/30 rounded px-2 py-2 mb-4 border border-slate-800/50 max-h-16 overflow-hidden">
                  <p className="text-slate-300 text-xs font-medium break-words line-clamp-2">{deleteConfirmState.name}</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setDeleteConfirmState(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={executeDelete}
                    className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors shadow-lg shadow-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COLUMN CONFIG MODAL */}
        {showColumnConfigModal && columnConfigWidgetId && activePage && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <h3 className="text-lg font-semibold text-white">Configure Chart Columns</h3>
                <button onClick={() => setShowColumnConfigModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="p-6 space-y-4">
                {(() => {
                  const widget = activePage.widgets.find(w => w.id === columnConfigWidgetId);
                  const dataset = widget ? datasets.find(d => d.id === widget.datasetId) : null;
                  if (!dataset) return null;

                  return (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">X-Axis Column</label>
                        <select 
                          value={tempXAxisKey}
                          onChange={(e) => setTempXAxisKey(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">Select column...</option>
                          {dataset.columns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Y-Axis Columns (Values)</label>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto border border-slate-800 rounded-lg p-3 bg-slate-950/50">
                          {dataset.columns.map(col => (
                            <label key={col} className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={tempDataKeys.includes(col)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setTempDataKeys(prev => [...prev, col]);
                                  } else {
                                    setTempDataKeys(prev => prev.filter(k => k !== col));
                                  }
                                }}
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-sm text-slate-300">{col}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button onClick={() => setShowColumnConfigModal(false)} className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700">Cancel</button>
                        <button 
                          onClick={applyColumnConfig} 
                          disabled={!tempXAxisKey || tempDataKeys.length === 0}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
                        >
                          <Check className="w-4 h-4" /> Apply Config
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* WIDGET DATA SORT MODAL */}
        {showWidgetSortModal && widgetSortId && activePage && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <h3 className="text-lg font-semibold text-white">Sort Widget Data</h3>
                <button onClick={() => setShowWidgetSortModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="p-6 space-y-4">
                {(() => {
                  const widget = activePage.widgets.find(w => w.id === widgetSortId);
                  const dataset = widget ? datasets.find(d => d.id === widget.datasetId) : null;
                  if (!dataset) return null;

                  return (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Sort Column</label>
                        <select 
                          value={tempSortKey}
                          onChange={(e) => setTempSortKey(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">Select column...</option>
                          {dataset.columns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Sort Order</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTempSortOrder('asc')}
                            className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                              tempSortOrder === 'asc' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            Ascending
                          </button>
                          <button
                            onClick={() => setTempSortOrder('desc')}
                            className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                              tempSortOrder === 'desc' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            Descending
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button onClick={() => setShowWidgetSortModal(false)} className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700">Cancel</button>
                        <button 
                          onClick={applyWidgetSort} 
                          disabled={!tempSortKey}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
                        >
                          <Check className="w-4 h-4" /> Apply Sort
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* FOLDER ASSIGNMENT MODAL */}
        {showFolderModal && folderModalDatasetId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <h3 className="text-lg font-semibold text-white">Move Dataset to Folder</h3>
                <button onClick={() => { setShowFolderModal(false); setFolderModalDatasetId(null); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-3">Select or Create Folder</label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto border border-slate-800 rounded-lg p-3 bg-slate-950/50">
                    {/* Existing folders */}
                    {getUniqueFolders().map(folder => (
                      <button
                        key={folder}
                        onClick={() => assignDatasetToFolder(folderModalDatasetId, folder)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          tempFolderName === folder
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {folder}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Or Create New Folder</label>
                  <input
                    type="text"
                    placeholder="Folder name..."
                    value={tempFolderName}
                    onChange={(e) => setTempFolderName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button onClick={() => { setShowFolderModal(false); setFolderModalDatasetId(null); }} className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700">Cancel</button>
                  <button 
                    onClick={() => tempFolderName && assignDatasetToFolder(folderModalDatasetId, tempFolderName)}
                    disabled={!tempFolderName}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
                  >
                    <Check className="w-4 h-4" /> Assign
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;