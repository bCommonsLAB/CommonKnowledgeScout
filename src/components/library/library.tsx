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

export function Library({
  libraries,
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: LibraryProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const [selectedItem, setSelectedItem] = React.useState<StorageItem | null>(null)
  const [activeLibraryId, setActiveLibraryId] = React.useState<string>(libraries[0]?.id || '')
  const [activeProvider, setActiveProvider] = React.useState<StorageProvider | null>(null)
  const [currentItems, setCurrentItems] = React.useState<StorageItem[]>([])
  const [currentFolderId, setCurrentFolderId] = React.useState<string>('root')
  const [isLoading, setIsLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [itemsCache, setItemsCache] = React.useState<Map<string, StorageItem>>(new Map())

  // Initialisiere die StorageFactory mit den Libraries
  React.useEffect(() => {
    const factory = StorageFactory.getInstance();
    factory.setLibraries(libraries);
  }, [libraries]);

  // Aktualisiere den aktiven Provider wenn sich die Library ändert
  React.useEffect(() => {
    const loadProvider = async () => {
      if (!activeLibraryId) return;
      
      try {
        const factory = StorageFactory.getInstance();
        const provider = await factory.getProvider(activeLibraryId);
        setActiveProvider(provider);
        // Reset auf Root-Verzeichnis
        setCurrentFolderId('root');
        setSelectedItem(null);
      } catch (error) {
        console.error('Failed to load storage provider:', error);
        setActiveProvider(null);
      }
    };

    loadProvider();
  }, [activeLibraryId]);

  // Lade Dateien wenn sich der Provider oder der Ordner ändert
  React.useEffect(() => {
    const loadItems = async () => {
      if (!activeProvider) {
        setCurrentItems([]);
        return;
      }

      setIsLoading(true);
      try {
        const items = await activeProvider.listItemsById(currentFolderId);
        
        // Update Cache
        const newCache = new Map(itemsCache);
        items.forEach(item => newCache.set(item.id, item));
        setItemsCache(newCache);
        
        setCurrentItems(items);
      } catch (error) {
        console.error('Failed to load items:', error);
        setCurrentItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [activeProvider, currentFolderId]);

  // Handler für Library-Wechsel
  const handleLibraryChange = (libraryId: string) => {
    setActiveLibraryId(libraryId);
    setSelectedItem(null);
    setCurrentFolderId('root');
  };

  // Handler für Verzeichniswechsel
  const handleFolderSelect = (item: StorageItem) => {
    if (item.type === 'folder') {
      setCurrentFolderId(item.id);
      setSelectedItem(null);
    }
  };

  // Handler für Dateiauswahl
  const handleFileSelect = (item: StorageItem) => {
    if (item.type === 'file') {
      setSelectedItem(item);
    }
  };

  // Gefilterte Items basierend auf der Suche
  const filteredItems = React.useMemo(() => {
    if (!searchQuery) return currentItems;
    
    const query = searchQuery.toLowerCase();
    return currentItems.filter(item => 
      item.metadata.name.toLowerCase().includes(query)
    );
  }, [currentItems, searchQuery]);

  // Finde die aktuelle Bibliothek
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);

  // Generiere Breadcrumb-Pfad
  const getBreadcrumbPath = React.useCallback(async () => {
    if (!activeProvider || currentFolderId === 'root') return [];
    
    const path: StorageItem[] = [];
    let currentId = currentFolderId;
    
    while (currentId !== 'root') {
      const item = itemsCache.get(currentId);
      if (!item) break;
      path.unshift(item);
      currentId = item.parentId;
    }
    
    return path;
  }, [currentFolderId, itemsCache, activeProvider]);

  // Breadcrumb-Pfad State
  const [breadcrumbPath, setBreadcrumbPath] = React.useState<StorageItem[]>([]);

  // Aktualisiere Breadcrumb wenn sich der Ordner ändert
  React.useEffect(() => {
    getBreadcrumbPath().then(setBreadcrumbPath);
  }, [currentFolderId, getBreadcrumbPath]);

  // Übermittle die Library-Props an die TopNav
  React.useEffect(() => {
    const event = new CustomEvent('libraryContextChange', {
      detail: {
        libraries,
        activeLibraryId,
        onLibraryChange: handleLibraryChange
      }
    });
    window.dispatchEvent(event);

    return () => {
      const resetEvent = new CustomEvent('libraryContextChange', { detail: null });
      window.dispatchEvent(resetEvent);
    };
  }, [libraries, activeLibraryId]);

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
                  onClick={() => setCurrentFolderId('root')}
                  className={cn(
                    "hover:text-foreground flex-shrink-0 font-medium",
                    currentFolderId === 'root' ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {activeLibrary?.label || '/'}
                </button>
                {breadcrumbPath.map((item) => (
                  <React.Fragment key={item.id}>
                    <span className="text-muted-foreground flex-shrink-0">/</span>
                    <button
                      onClick={() => setCurrentFolderId(item.id)}
                      className={cn(
                        "hover:text-foreground truncate",
                        currentFolderId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
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
                setIsCollapsed(true)
                document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                  true
                )}`
              }}
              onExpand={() => {
                setIsCollapsed(false)
                document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                  false
                )}`
              }}
              className={cn(
                "border-r",
                isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out"
              )}
            >
              <div className={cn(panelStyles)}>
                <div className={cn(treeStyles)}>
                  <FileTree 
                    provider={activeProvider}
                    onSelect={handleFolderSelect}
                    currentFolderId={currentFolderId}
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
                  items={filteredItems}
                  selectedItem={selectedItem}
                  onSelect={handleFileSelect}
                  currentFolderId={currentFolderId}
                />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={defaultLayout[2]} className="hidden lg:block">
              <div className={cn(panelStyles)}>
                <div className={cn(previewStyles)}>
                  <FilePreview 
                    item={selectedItem} 
                    provider={activeProvider}
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