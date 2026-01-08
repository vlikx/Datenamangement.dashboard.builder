import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { DataVisualizer } from './components/DataVisualizer';
import { DataTable } from './components/DataTable';
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
  AreaChart as AreaChartIcon,
  MoveHorizontal,
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
  BrainCircuit,
  Sparkles
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

  // Widget Title Editing State
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [tempWidgetTitle, setTempWidgetTitle] = useState("");

  // Filter UI State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempFilterColumn, setTempFilterColumn] = useState<string>("");
  const [tempFilterValue, setTempFilterValue] = useState<string>("");

  // Delete Confirmation State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: 'dashboard' | 'dataset' | null;
    id: string | null;
    name: string;
  }>({ isOpen: false, type: null, id: null, name: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        let importedDatasetsCount = 0;
        let importedPagesCount = 0;

        if (json.datasets && Array.isArray(json.datasets)) {
          for (const ds of json.datasets) {
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

        alert(`Restored ${importedDatasetsCount} datasets and ${importedPagesCount} dashboards.`);
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
    if (!page) return;

    let title = "New Widget";
    if (type === 'bar') title = "Metric Breakdown";
    if (type === 'area') title = "Trend Analysis";
    if (type === 'line') title = "Growth Trend";
    if (type === 'pie') title = "Distribution";
    if (type === 'table') title = "Data Table";

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
                          onClick={() => requestDeletePage(page.id, page.name)}
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
                {datasets.map(ds => (
                  <div key={ds.id} 
                    className={`group flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-3'} py-2 rounded-lg text-sm font-medium transition-all ${
                      activeDatasetId === ds.id 
                        ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700' 
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                    title={isSidebarCollapsed ? ds.fileName : undefined}
                  >
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
                      <button 
                        onClick={(e) => { e.stopPropagation(); requestDeleteDataset(ds.id, ds.fileName); }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400 transition-all z-20"
                        title="Delete Dataset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
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
             <div className="grid grid-cols-2 gap-2">
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
                   onClick={() => requestDeletePage(activePage.id, activePage.name)}
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
               </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
               {activePage.widgets.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                    <BarChart3 className="w-16 h-16 mb-4 stroke-1" />
                    <p className="text-lg font-medium">This dashboard is empty</p>
                    <p>Add widgets to start analyzing your data</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1920px] mx-auto pb-20">
                    {activePage.widgets.map((widget, index) => {
                      const dataset = datasets.find(d => d.id === widget.datasetId);
                      const isFullWidth = widget.width === 'full';
                      const colSpan = isFullWidth ? 'md:col-span-2' : 'md:col-span-1';
                      
                      // Calculate filtered data specifically for this widget
                      const widgetData = dataset ? getFilteredData(dataset) : [];

                      return (
                        <div key={widget.id} className={`${colSpan} min-h-[400px] flex flex-col relative group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all hover:border-slate-700`}>
                           
                           {/* Widget Controls Overlay */}
                           <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 rounded-lg p-1 border border-slate-800 backdrop-blur-sm">
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
                              <button onClick={() => removeWidget(widget.id)} className="p-1.5 text-slate-400 hover:text-red-400">
                                <X className="w-3.5 h-3.5" />
                              </button>
                           </div>

                           {/* Content Layer */}
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
                                    <DataVisualizer dataset={dataset} filteredData={widgetData} mode={widget.type} customTitle={widget.title} />
                                 </div>
                               )}
                               {widget.type === 'table' && (
                                 <div className="h-[500px] flex flex-col">
                                    <div className="px-6 pt-6 pb-2 font-semibold text-white cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => { setEditingWidgetId(widget.id); setTempWidgetTitle(widget.title); }}>
                                      {widget.title}
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                       <DataTable dataset={dataset} filteredData={widgetData} />
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
                     onClick={() => {
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
                  return <DataTable dataset={ds} />;
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
                
                <FileUpload onDataLoaded={handleDataLoaded} />
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

        {/* DELETE CONFIRMATION MODAL */}
        {deleteConfirmState.isOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-900/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Confirm Deletion</h3>
                    <p className="text-sm text-slate-400">Are you sure you want to delete this?</p>
                  </div>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3 mb-6 border border-slate-800">
                  <p className="text-slate-200 font-medium text-center break-words">{deleteConfirmState.name}</p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteConfirmState(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={executeDelete}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-red-500/20"
                  >
                    Delete
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