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

// Exportiere die Library-Props für die TopNav
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
  const [currentPath, setCurrentPath] = React.useState<string>('/')
  const [isLoading, setIsLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

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
      } catch (error) {
        console.error('Failed to load storage provider:', error);
        setActiveProvider(null);
      }
    };

    loadProvider();
  }, [activeLibraryId]);

  // Lade Dateien wenn sich der Provider oder der Pfad ändert
  React.useEffect(() => {
    const loadItems = async () => {
      if (!activeProvider) {
        setCurrentItems([]);
        return;
      }

      setIsLoading(true);
      try {
        const items = await activeProvider.listItems(currentPath);
        setCurrentItems(items);
      } catch (error) {
        console.error('Failed to load items:', error);
        setCurrentItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [activeProvider, currentPath]);

  // Handler für Library-Wechsel
  const handleLibraryChange = (libraryId: string) => {
    setActiveLibraryId(libraryId);
    setSelectedItem(null);
    setCurrentPath('/');
  };

  // Handler für Verzeichniswechsel
  const handleFolderSelect = (item: StorageItem) => {
    if (item.type === 'folder') {
      setCurrentPath(item.item.path);
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
      item.item.name.toLowerCase().includes(query)
    );
  }, [currentItems, searchQuery]);

  // Finde die aktuelle Bibliothek
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);

  // Handler für Pfadwechsel
  const handlePathChange = async (newPath: string) => {
    setCurrentPath(newPath);
    
    // Finde das entsprechende StorageItem für den Tree
    if (activeProvider) {
      try {
        // Wenn wir zum Root navigieren
        if (newPath === '/') {
          setSelectedItem(null);
          return;
        }

        // Lade die Items des übergeordneten Verzeichnisses
        const parentPath = newPath.split('/').slice(0, -1).join('/') || '/';
        const items = await activeProvider.listItems(parentPath);
        
        // Finde das Zielverzeichnis
        const targetFolder = items.find(item => 
          item.type === 'folder' && item.item.path === newPath
        );

        if (targetFolder) {
          // Aktualisiere die Selektion im Tree
          setSelectedItem(targetFolder);
          handleFolderSelect(targetFolder);
        } else {
          console.warn('Target folder not found:', newPath);
          setSelectedItem(null);
        }
      } catch (error) {
        console.error('Failed to sync tree with path:', error);
        setSelectedItem(null);
      }
    }
  };

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
      // Setze den Kontext zurück wenn die Komponente unmounted wird
      const resetEvent = new CustomEvent('libraryContextChange', { detail: null });
      window.dispatchEvent(resetEvent);
    };
  }, [libraries, activeLibraryId]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header Panel */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4 min-w-0">
            <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
              <span className="text-muted-foreground flex-shrink-0">Pfad:</span>
              <div className="flex items-center gap-1 overflow-hidden">
                <button
                  onClick={() => handlePathChange('/')}
                  className={cn(
                    "hover:text-foreground flex-shrink-0 font-medium",
                    currentPath === '/' ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {activeLibrary?.label || '/'}
                </button>
                {currentPath !== '/' && currentPath.split('/').filter(Boolean).map((segment, index, array) => {
                  const segmentPath = '/' + array.slice(0, index + 1).join('/');
                  return (
                    <React.Fragment key={segmentPath}>
                      <span className="text-muted-foreground flex-shrink-0">/</span>
                      <button
                        onClick={() => handlePathChange(segmentPath)}
                        className={cn(
                          "hover:text-foreground truncate",
                          currentPath === segmentPath ? "text-foreground font-medium" : "text-muted-foreground"
                        )}
                      >
                        {segment}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Hier können weitere Header-Elemente hinzugefügt werden */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
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
              <FileTree 
                provider={activeProvider}
                onSelect={handleFolderSelect}
                currentPath={currentPath}
                libraryName={activeLibrary?.label}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={defaultLayout[1]} minSize={30} className="border-r">
              <Tabs defaultValue="all">
                <div className="flex items-center px-4 py-2">
                  <h1 className="text-xl font-bold">Dateien</h1>
                  <TabsList className="ml-auto">
                    <TabsTrigger value="all" className="text-zinc-600 dark:text-zinc-200">
                      Alle Dateien
                    </TabsTrigger>
                    <TabsTrigger value="recent" className="text-zinc-600 dark:text-zinc-200">
                      Zuletzt geöffnet
                    </TabsTrigger>
                  </TabsList>
                </div>
                <Separator />
                <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <form onSubmit={(e) => e.preventDefault()}>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Suchen" 
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </form>
                </div>
                <TabsContent value="all" className="m-0">
                  <FileList 
                    items={filteredItems}
                    selectedItem={selectedItem}
                    onSelect={handleFileSelect}
                    currentPath={currentPath}
                  />
                </TabsContent>
                <TabsContent value="recent" className="m-0">
                  <FileList 
                    items={filteredItems}
                    selectedItem={selectedItem}
                    onSelect={handleFileSelect}
                    currentPath={currentPath}
                  />
                </TabsContent>
              </Tabs>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={defaultLayout[2]} className="hidden lg:block">
              <FilePreview 
                item={selectedItem} 
                className="h-full"
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </TooltipProvider>
      </div>
    </div>
  )
}