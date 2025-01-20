"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState, Profiler } from "react"
import { flushSync } from 'react-dom';

import { LibrarySwitcher } from "./library-switcher"
import { LibraryHeader } from "./library-header"
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
import { usePerformanceTracking } from "@/hooks/use-performance-tracking"

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

if (process.env.NODE_ENV === 'development') {
  Library.whyDidYouRender = {
    customName: 'Library',
    logOwnerReasons: true,
    trackAllPureComponents: true,
  };
}

// Performance monitoring
const onRenderCallback: React.ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  if (process.env.NODE_ENV === 'development' && actualDuration > 100) {
    console.log(`[Render Profiler] ${id} took ${actualDuration.toFixed(2)}ms (${phase})`);
    console.log(`Base duration: ${baseDuration.toFixed(2)}ms`);
    console.log(`Commit time: ${commitTime.toFixed(2)}ms`);
  }
};

export function Library({
  libraries,
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: LibraryProps) {
  // UI States
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Folder States
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [folderItems, setFolderItems] = useState<StorageItem[]>([]);

  // Provider States
  const [providerId, setProviderId] = useState(libraries[0]?.id || '');
  const [providerInstance, setProviderInstance] = useState<StorageProvider | null>(null);

  // File Selection Hook
  const {
    selected,
    selectFile,
    updateBreadcrumb,
    clearSelection,
    isSelected,
    parentId
  } = useSelectedFile();

  // Caches
  const folderCache = useMemo(() => new Map<string, StorageItem>(), []);
  const pathCache = useMemo(() => new Map<string, StorageItem[]>(), []);

  // Memoized values
  const memoizedProviderInstance = useMemo(() => providerInstance, [providerId]);
  
  const transcriptionEnabled = useMemo(() => {
    const activeLib = libraries.find(lib => lib.id === providerId);
    return activeLib?.config?.transcription === 'shadowTwin';
  }, [libraries, providerId]);

  const libraryConfig = useMemo(() => ({
    activeLibraryId: providerId,
    transcriptionEnabled,
    config: libraries.find(lib => lib.id === providerId)?.config
  }), [providerId, transcriptionEnabled, libraries]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return folderItems;
    
    const query = searchQuery.toLowerCase();
    return folderItems.filter(item => 
      item.metadata.name.toLowerCase().includes(query)
    );
  }, [folderItems, searchQuery]);

  const processedItems = useMemo(() => {
    console.time('processItems');
    // Filter out folders before passing to FileList
    const result = filteredItems.filter(item => item.type === 'file');
    console.timeEnd('processItems');
    return result;
  }, [filteredItems]);

  // Apply transcription processing at the top level
  const transcriptionItems = useTranscriptionTwins(processedItems, transcriptionEnabled);
  const finalItems = useMemo(() => 
    transcriptionEnabled ? transcriptionItems : processedItems,
    [transcriptionEnabled, transcriptionItems, processedItems]
  );

  // Performance tracking
  usePerformanceTracking('Library-Provider', [providerId]);
  usePerformanceTracking('Library-Folder', [currentFolderId]);
  usePerformanceTracking('Library-UI', [isCollapsed, searchQuery]);

  // Debug logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Library Config:', libraryConfig);
    }
  }, [libraryConfig]);

  // Handler für Library-Wechsel
  const handleLibraryChange = useCallback((newLibraryId: string) => {
    setProviderId(newLibraryId);
    setProviderInstance(null);
    setCurrentFolderId('root');
    setFolderItems([]);
    clearSelection();
  }, [clearSelection]);

  // Library Context Events
  useEffect(() => {
    const event = new CustomEvent('libraryContextChange', {
      detail: {
        libraries,
        activeLibraryId: providerId,
        onLibraryChange: handleLibraryChange
      }
    });
    window.dispatchEvent(event);

    return () => {
      window.dispatchEvent(new CustomEvent('libraryContextChange', { detail: null }));
    };
  }, [libraries, providerId, handleLibraryChange]);

  // Current library reference
  const activeLibrary = libraries.find(lib => lib.id === providerId);

  // Optimierte Pfadauflösung
  const resolvePath = useCallback(async (
    itemId: string, 
    cache: Map<string, StorageItem>
  ): Promise<StorageItem[]> => {
    if (pathCache.has(itemId)) {
      return pathCache.get(itemId)!;
    }
    
    const path: StorageItem[] = [];
    let current = cache.get(itemId);
    
    while (current && current.id !== 'root') {
      path.unshift(current);
      current = cache.get(current.parentId);
      
      // Wenn Parent nicht im Cache, lade es
      if (current?.parentId && !cache.get(current.parentId) && providerInstance) {
        try {
          const parent = await providerInstance.getItemById(current.parentId);
          cache.set(parent.id, parent);
        } catch (error) {
          console.error('Failed to load parent:', error);
          break;
        }
      }
    }
    
    pathCache.set(itemId, path);
    return path;
  }, [pathCache, providerInstance]);

  // Optimierter Items Load mit Caching
  const loadItems = useCallback(async () => {
    if (!providerInstance) {
      console.log('Library: loadItems skipped - no provider instance');
      return;
    }

    console.log('Library: Starting loadItems', {
      currentFolderId,
      hasCachedItems: !!folderCache.get(currentFolderId)?.children,
      providerName: providerInstance.name
    });

    setIsLoading(true);
    try {
      // Prüfe Cache
      const cachedItems = folderCache.get(currentFolderId)?.children;
      if (cachedItems) {
        console.log('Library: Using cached items', {
          itemCount: cachedItems.length,
          folderId: currentFolderId
        });
        // Resolve path even for cached items
        const path = await resolvePath(currentFolderId, folderCache);
        flushSync(() => {
          setFolderItems(cachedItems);
          updateBreadcrumb(path, currentFolderId);
        });
        return;
      }

      console.log('Library: Fetching items from provider');
      const items = await providerInstance.listItemsById(currentFolderId);
      console.log('Library: Items fetched successfully', {
        itemCount: items.length,
        folderCount: items.filter(i => i.type === 'folder').length,
        fileCount: items.filter(i => i.type === 'file').length
      });
      
      // Update Cache und Items in einer Transaktion
      items.forEach(item => {
        if (item.type === 'folder') {
          folderCache.set(item.id, {
            ...item,
            children: []
          });
        }
      });
      
      // Cache die Items unter dem Parent
      if (currentFolderId !== 'root') {
        const parent = folderCache.get(currentFolderId);
        if (parent) {
          folderCache.set(currentFolderId, {
            ...parent,
            children: items
          });
        }
      }
      
      // Resolve path and update breadcrumb along with items
      const path = await resolvePath(currentFolderId, folderCache);
      flushSync(() => {
        console.log('Library: Updating UI with new items');
        setFolderItems(items);
        updateBreadcrumb(path, currentFolderId);
      });
    } catch (error) {
      console.error('Library: Failed to load items:', error);
      setFolderItems([]);
      updateBreadcrumb([], 'root');
    } finally {
      setIsLoading(false);
      console.log('Library: loadItems completed');
    }
  }, [providerInstance, currentFolderId, folderCache, resolvePath, updateBreadcrumb]);

  // Initialisiere StorageFactory - nur einmal
  useEffect(() => {
    StorageFactory.getInstance().setLibraries(libraries);
  }, [libraries]);

  // Optimierter Provider Load
  const loadProvider = useCallback(async () => {
    if (!providerId) return;
    
    setIsLoading(true);
    try {
      const factory = StorageFactory.getInstance();
      const provider = await factory.getProvider(providerId);
      setProviderInstance(provider);
      setCurrentFolderId('root');
      setFolderItems([]);
      clearSelection();
    } catch (error) {
      console.error('Failed to load storage provider:', error);
      setProviderInstance(null);
    } finally {
      setIsLoading(false);
    }
  }, [providerId, clearSelection]);

  // Load Provider wenn ID sich ändert
  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  // Load Items wenn Provider oder Folder sich ändern
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Optimierter Folder Select Handler
  const handleFolderSelect = useCallback(async (item: StorageItem) => {
    if (item.type !== 'folder') return;
    
    console.time('folderSelect');
    setIsLoading(true);
    try {
      console.time('parallelLoading');
      // Parallel fetch von Folder Contents und Path Resolution
      const [items, path] = await Promise.all([
        providerInstance?.listItemsById(item.id),
        resolvePath(item.id, folderCache)
      ]);
      console.timeEnd('parallelLoading');
      
      if (items) {
        console.time('cacheUpdate');
        // Cache aktualisieren
        items.forEach(child => {
          if (child.type === 'folder') {
            folderCache.set(child.id, {
              ...child,
              children: []
            });
          }
        });
        
        // Parent Cache aktualisieren
        const parent = folderCache.get(item.id);
        if (parent) {
          folderCache.set(item.id, {
            ...parent,
            children: items
          });
        }
        console.timeEnd('cacheUpdate');
        
        console.time('stateUpdates');
        // Batch state updates using flushSync to ensure breadcrumb updates synchronously
        flushSync(() => {
          setCurrentFolderId(item.id);
          setFolderItems(items);
          // Update breadcrumb with the resolved path
          updateBreadcrumb(path, item.id);
          clearSelection();
        });
        console.timeEnd('stateUpdates');
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    } finally {
      setIsLoading(false);
      console.timeEnd('folderSelect');
    }
  }, [providerInstance, folderCache, resolvePath, updateBreadcrumb, clearSelection]);

  // Handler für Dateiauswahl
  const handleFileSelect = useCallback((item: StorageItem) => {
    if (item.type !== 'file') return;
    selectFile(item);
  }, [selectFile]);

  // Handler für Upload-Abschluss
  const handleUploadComplete = useCallback(() => {
    console.log('Library: Upload completed, invalidating cache and refreshing items');
    // Cache für den aktuellen Ordner invalidieren
    const currentFolder = folderCache.get(currentFolderId);
    if (currentFolder) {
      folderCache.set(currentFolderId, {
        ...currentFolder,
        children: undefined // Cache invalidieren
      });
    }
    loadItems();
  }, [loadItems, currentFolderId, folderCache]);

  return (
    <Profiler id="Library" onRender={onRenderCallback}>
      <div className="flex flex-col h-screen overflow-hidden">
        <LibraryHeader 
          activeLibrary={activeLibrary}
          breadcrumbItems={selected.breadcrumb.items}
          currentFolderId={selected.breadcrumb.currentId}
          onFolderSelect={handleFolderSelect}
          onRootClick={() => {
            setCurrentFolderId('root');
            setFolderItems([]);
            updateBreadcrumb([], 'root');
          }}
          provider={providerInstance}
          onUploadComplete={handleUploadComplete}
        />

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
                  setIsCollapsed(true);
                  document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                    true
                  )}`
                }}
                onExpand={() => {
                  setIsCollapsed(false);
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
                      provider={providerInstance}
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
                  items={finalItems}
                  selectedItem={selected.item}
                  onSelectAction={handleFileSelect}
                  searchTerm={searchQuery}
                  currentFolderId={selected.breadcrumb.currentId}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={defaultLayout[2]} className="hidden lg:block">
                <div className={cn(panelStyles)}>
                  <div className={cn(previewStyles)}>
                    <FilePreview 
                      item={selected.item} 
                      provider={providerInstance}
                      className="h-full"
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </TooltipProvider>
        </div>
      </div>
    </Profiler>
  );
}