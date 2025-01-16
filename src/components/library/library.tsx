"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { LibrarySwitcher } from "./library-switcher"
import { FilePreview } from "./file-preview"
import { Input } from "@/components/ui/input"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import { ClientLibrary } from "@/types/library"
import { StorageFactory } from "@/lib/storage/storage-factory"
import { StorageProvider, StorageItem } from "@/lib/storage/types"
import { useTranscriptionTwins } from "@/hooks/use-transcription-twins"
import { useSelectedFile } from "@/hooks/use-selected-file"

export interface LibraryContextProps {
  libraries: ClientLibrary[];
  activeLibraryId: string;
  onLibraryChange: (libraryId: string) => void;
}

interface LibraryProps {
  libraries: ClientLibrary[]
  defaultLayout: number[]
  defaultCollapsed?: boolean
  navCollapsedSize: number
}

// Styles für die verschiedenen Panel-Typen
const panelStyles = "h-full flex flex-col min-h-0";
const treeStyles = "h-full overflow-auto";
const fileListStyles = "h-full overflow-auto";
const previewStyles = "h-full overflow-auto";

// Reduziere State durch Zusammenfassung zusammengehöriger States
interface LibraryState {
  isCollapsed: boolean;
  currentFolder: {
    id: string;
    items: StorageItem[];
  };
  provider: {
    id: string;
    instance: StorageProvider | null;
  };
  ui: {
    isLoading: boolean;
    searchQuery: string;
  };
}

export function Library({
  libraries,
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: LibraryProps) {
  // Zusammengefasster State
  const [state, setState] = React.useState<LibraryState>({
    isCollapsed: defaultCollapsed,
    currentFolder: {
      id: 'root',
      items: [],
    },
    provider: {
      id: libraries[0]?.id || '',
      instance: null
    },
    ui: {
      isLoading: false,
      searchQuery: ''
    }
  });

  // Zentraler File-Selection Hook
  const {
    selected,
    selectFile,
    updateBreadcrumb,
    clearSelection,
    isSelected,
    parentId
  } = useSelectedFile();

  // Memoized Folder Cache
  const folderCache = React.useMemo(() => new Map<string, StorageItem>(), []);

  // Optimierter Provider Load
  const loadProvider = React.useCallback(async () => {
    if (!state.provider.id) return;
    
    try {
      const factory = StorageFactory.getInstance();
      const provider = await factory.getProvider(state.provider.id);
      
      setState(prev => ({
        ...prev,
        provider: {
          ...prev.provider,
          instance: provider
        },
        currentFolder: {
          id: 'root',
          items: []
        }
      }));
      clearSelection();
    } catch (error) {
      console.error('Failed to load storage provider:', error);
      setState(prev => ({
        ...prev,
        provider: {
          ...prev.provider,
          instance: null
        }
      }));
    }
  }, [state.provider.id, clearSelection]);

  // Optimierter Items Load
  const loadItems = React.useCallback(async () => {
    if (!state.provider.instance) return;

    setState(prev => ({
      ...prev,
      ui: { ...prev.ui, isLoading: true }
    }));

    try {
      const items = await state.provider.instance.listItemsById(state.currentFolder.id);
      
      // Update Cache und Items in einer Transaktion
      items.forEach(item => {
        if (item.type === 'folder') {
          folderCache.set(item.id, item);
        }
      });
      
      setState(prev => ({
        ...prev,
        currentFolder: {
          ...prev.currentFolder,
          items
        },
        ui: { ...prev.ui, isLoading: false }
      }));
    } catch (error) {
      console.error('Failed to load items:', error);
      setState(prev => ({
        ...prev,
        currentFolder: {
          ...prev.currentFolder,
          items: []
        },
        ui: { ...prev.ui, isLoading: false }
      }));
    }
  }, [state.provider.instance, state.currentFolder.id, folderCache]);

  // Initialisiere StorageFactory - nur einmal
  React.useEffect(() => {
    StorageFactory.getInstance().setLibraries(libraries);
  }, [libraries]);

  // Load Provider wenn ID sich ändert
  React.useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  // Load Items wenn Provider oder Folder sich ändern
  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Handler für Library-Wechsel
  const handleLibraryChange = React.useCallback((libraryId: string) => {
    setState(prev => ({
      ...prev,
      provider: {
        id: libraryId,
        instance: null
      },
      currentFolder: {
        id: 'root',
        items: []
      },
      selectedItem: null
    }));
  }, []);

  // Handler für Ordnerwechsel
  const handleFolderSelect = React.useCallback((item: StorageItem) => {
    if (item.type !== 'folder') return;

    // Berechne neuen Pfad
    const path: StorageItem[] = [];
    let current = item;
    while (current && current.id !== 'root') {
      path.unshift(current);
      const parent = folderCache.get(current.parentId);
      if (!parent || parent.id === current.id) break;
      current = parent;
    }

    setState(prev => ({
      ...prev,
      currentFolder: {
        id: item.id,
        items: prev.currentFolder.items
      }
    }));
    
    updateBreadcrumb(path, item.id);
    clearSelection();
  }, [folderCache, updateBreadcrumb, clearSelection]);

  // Handler für Dateiauswahl
  const handleFileSelect = React.useCallback((item: StorageItem) => {
    if (item.type !== 'file') return;
    selectFile(item);
  }, [selectFile]);

  // Memoized gefilterte Items
  const filteredItems = React.useMemo(() => {
    if (!state.ui.searchQuery) return state.currentFolder.items;
    
    const query = state.ui.searchQuery.toLowerCase();
    return state.currentFolder.items.filter(item => 
      item.metadata.name.toLowerCase().includes(query)
    );
  }, [state.currentFolder.items, state.ui.searchQuery]);

  // Memoized Transcription Check
  const transcriptionEnabled = React.useMemo(() => {
    const activeLib = libraries.find(lib => lib.id === state.provider.id);
    return activeLib?.config?.transcription === 'shadowTwin';
  }, [libraries, state.provider.id]);

  // Debug logging - nur in Development
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Library Config:', {
        activeLibraryId: state.provider.id,
        transcriptionEnabled,
        config: libraries.find(lib => lib.id === state.provider.id)?.config
      });
    }
  }, [state.provider.id, libraries, transcriptionEnabled]);

  // Verarbeite Transcription Twins
  const processedItems = useTranscriptionTwins(filteredItems, transcriptionEnabled);

  // Aktuelle Bibliothek
  const activeLibrary = libraries.find(lib => lib.id === state.provider.id);

  // Library Context Events
  React.useEffect(() => {
    const event = new CustomEvent('libraryContextChange', {
      detail: {
        libraries,
        activeLibraryId: state.provider.id,
        onLibraryChange: handleLibraryChange
      }
    });
    window.dispatchEvent(event);

    return () => {
      window.dispatchEvent(new CustomEvent('libraryContextChange', { detail: null }));
    };
  }, [libraries, state.provider.id, handleLibraryChange]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header Panel */}
      <div className="border-b bg-background flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4 min-w-0">
            <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
              <span className="text-muted-foreground flex-shrink-0">Pfad:</span>
              <div className="flex items-center gap-1 overflow-hidden">
                <button
                  onClick={() => {
                    setState(prev => ({
                      ...prev,
                      currentFolder: {
                        id: 'root',
                        items: []
                      }
                    }));
                    updateBreadcrumb([], 'root');
                  }}
                  className={cn(
                    "hover:text-foreground flex-shrink-0 font-medium",
                    selected.breadcrumb.currentId === 'root' ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {activeLibrary?.label || '/'}
                </button>
                {selected.breadcrumb.items.map((item) => (
                  <React.Fragment key={item.id}>
                    <span className="text-muted-foreground flex-shrink-0">/</span>
                    <button
                      onClick={() => handleFolderSelect(item)}
                      className={cn(
                        "hover:text-foreground truncate",
                        selected.breadcrumb.currentId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
                      )}
                    >
                      {item.metadata.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <TooltipProvider delayDuration={0}>
          <ResizablePanelGroup
            direction="horizontal"
            onLayout={(sizes: number[]) => {
              document.cookie = `react-resizable-panels:layout:library=${JSON.stringify(
                sizes
              )}`
            }}
            className="h-full"
          >
            <ResizablePanel
              defaultSize={defaultLayout[0]}
              collapsedSize={navCollapsedSize}
              collapsible={true}
              minSize={15}
              maxSize={20}
              onCollapse={() => {
                setState(prev => ({ ...prev, isCollapsed: true }));
                document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                  true
                )}`
              }}
              onExpand={() => {
                setState(prev => ({ ...prev, isCollapsed: false }));
                document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                  false
                )}`
              }}
              className={cn(
                "border-r",
                state.isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out"
              )}
            >
              <div className={cn(panelStyles)}>
                <div className={cn(treeStyles)}>
                  <FileTree 
                    provider={state.provider.instance}
                    onSelect={handleFolderSelect}
                    currentFolderId={selected.breadcrumb.currentId}
                    libraryName={activeLibrary?.label}
                  />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={defaultLayout[1]} minSize={30} className="border-r">
              <div className="flex items-center px-4 py-2">
                <h1 className="text-xl font-bold">Dateien</h1>
              </div>
              <Separator />
                <FileList 
                  items={processedItems}
                  selectedItem={selected.item}
                  onSelectAction={handleFileSelect}
                  searchTerm={state.ui.searchQuery}
                  currentFolderId={selected.breadcrumb.currentId}
                />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={defaultLayout[2]} className="hidden lg:block">
              <div className={cn(panelStyles)}>
                <div className={cn(previewStyles)}>
                  <FilePreview 
                    item={selected.item} 
                    provider={state.provider.instance}
                    className="h-full"
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </TooltipProvider>
      </div>
    </div>
  )
}