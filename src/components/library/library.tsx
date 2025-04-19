"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState, Profiler } from "react"
import { useAtom } from "jotai"

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
import { libraryAtom, activeLibraryIdAtom, currentFolderIdAtom, breadcrumbItemsAtom, writeBreadcrumbItemsAtom } from "@/atoms/library-atom"
import { useStorage } from "@/contexts/storage-context"

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
  const [localError, setLocalError] = useState<string | null>(null);

  // Folder States - alte lokale State entfernen und durch Atom ersetzen
  const [folderItems, setFolderItems] = useState<StorageItem[]>([]);

  // Jotai State
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const [globalActiveLibraryId, setGlobalActiveLibraryId] = useAtom(activeLibraryIdAtom);
  const [currentFolderId, setCurrentFolderId] = useAtom(currentFolderIdAtom);
  
  // Den StorageContext nutzen statt eigenen Provider zu erstellen
  const { 
    provider: providerInstance, 
    isLoading, 
    error: storageError, 
    listItems, 
    refreshItems 
  } = useStorage();

  // Debug-Logging für Storage Context
  useEffect(() => {
    console.log('[Library] StorageContext Status:', {
      providerVorhanden: !!providerInstance,
      providerTyp: providerInstance ? providerInstance.name : 'keiner',
      providerID: providerInstance?.id,
      isLoading,
      error: storageError
    });
  }, [providerInstance, isLoading, storageError]);

  // Die aktive Bibliothek aus den übergebenen Libraries ermitteln
  const currentLibrary = useMemo(() => libraries.find(lib => lib.id === globalActiveLibraryId) || undefined, [libraries, globalActiveLibraryId]);

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
  
  // Verwende globalen Breadcrumb-Zustand
  const [, setBreadcrumbItems] = useAtom(breadcrumbItemsAtom);
  const [, setWriteBreadcrumb] = useAtom(writeBreadcrumbItemsAtom);

  // Initialisiere Jotai-Zustand bei Komponenteninitialisierung
  useEffect(() => {
    console.log('Library: Initialisiere Jotai-Zustand mit', libraries.length, 'Bibliotheken');
    // Setze den Jotai-Zustand mit den übergebenen Bibliotheken
    setLibraryState({
      libraries,
      activeLibraryId: globalActiveLibraryId || (libraries.length > 0 ? libraries[0].id : ''),
      currentFolderId: 'root' // Initialisiere das Verzeichnis
    });
  }, [libraries, globalActiveLibraryId, setLibraryState]);

  // Stelle sicher, dass der Breadcrumb nicht verloren geht
  useEffect(() => {
    // Cache für den letzten bekannten Breadcrumb-Zustand
    let lastBreadcrumbHash = JSON.stringify(selected.breadcrumb.items.map(item => item.id));
    
    // Timer mit niedrigerer Frequenz, um Performance zu verbessern
    const syncTimer = setInterval(() => {
      const breadcrumbItems = selected.breadcrumb.items;
      
      // Nur aktualisieren, wenn:
      // 1. Wir tatsächlich Items haben
      // 2. Nicht im Root-Verzeichnis sind
      // 3. Der aktuelle Breadcrumb anders ist als der letzte bekannte
      if (breadcrumbItems.length > 0 && selected.breadcrumb.currentId !== 'root') {
        // Erstelle einen Hash des aktuellen Zustands zur Vergleichbarkeit
        const currentHash = JSON.stringify(breadcrumbItems.map(item => item.id));
        
        // Prüfe, ob sich der Zustand geändert hat
        if (currentHash !== lastBreadcrumbHash) {
          console.log('Library: AUTO-SYNC Breadcrumb (geändert)', {
            items: breadcrumbItems.map(item => item.metadata.name).join('/'),
            currentId: selected.breadcrumb.currentId
          });
          
          // Aktualisiere den Zustand und den Cache
          lastBreadcrumbHash = currentHash;
          setWriteBreadcrumb(breadcrumbItems);
        }
      }
    }, 3000); // Niedrigere Frequenz: alle 3 Sekunden

    return () => clearInterval(syncTimer);
  }, [selected.breadcrumb, setWriteBreadcrumb]);

  // Memoized values
  const transcriptionEnabled = useMemo(() => {
    const activeLib = libraries.find(lib => lib.id === globalActiveLibraryId);
    return activeLib?.config?.transcription === 'shadowTwin';
  }, [libraries, globalActiveLibraryId]);

  const libraryConfig = useMemo(() => ({
    activeLibraryId: globalActiveLibraryId,
    transcriptionEnabled,
    config: libraries.find(lib => lib.id === globalActiveLibraryId)?.config
  }), [globalActiveLibraryId, transcriptionEnabled, libraries]);

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
  usePerformanceTracking('Library-Provider', [globalActiveLibraryId]);
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
    console.log('Library: handleLibraryChange aufgerufen mit', newLibraryId);
    
    // Vorherige Bibliothek identifizieren
    const previousLibrary = libraries.find(lib => lib.id === globalActiveLibraryId);
    const newLibrary = libraries.find(lib => lib.id === newLibraryId);
    
    console.log('Library: Wechsel von', {
      von: {
        id: previousLibrary?.id || 'keine',
        label: previousLibrary?.label || 'keine',
        path: previousLibrary?.path || 'keine'
      },
      nach: {
        id: newLibrary?.id || 'unbekannt',
        label: newLibrary?.label || 'unbekannt',
        path: newLibrary?.path || 'unbekannt'
      }
    });
    
    // Ordner zurücksetzen
    setCurrentFolderId('root');
    setFolderItems([]);
    
    // Auswahl zurücksetzen
    clearSelection();
    
    // Aktualisiere den Jotai-Zustand mit vollständigem State
    setLibraryState({
      libraries,
      activeLibraryId: newLibraryId,
      currentFolderId: 'root'
    });
    
    console.log('Library: Bibliothek gewechselt zu', newLibraryId, '- Cache und Zustand zurückgesetzt');
  }, [clearSelection, setLibraryState, libraries, globalActiveLibraryId]);

  // Optimierte Pfadauflösung - Nutze jetzt den StorageContext
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

  // Optimierter Items Load mit Caching - jetzt mit StorageContext
  const loadItems = useCallback(async () => {
    if (!providerInstance) {
      console.log('Library: loadItems skipped - no provider instance');
      return;
    }

    console.log('Library: Starting loadItems', {
      currentFolderId,
      hasCachedItems: !!folderCache.get(currentFolderId)?.children,
    });

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
        
        // Kein flushSync mehr verwenden, sondern getrennte State-Updates
        setFolderItems(cachedItems);
        
        // Breadcrumb nur aktualisieren, wenn es nicht Root ist oder wenn der aktuelle Breadcrumb leer ist
        if (currentFolderId !== 'root' || selected.breadcrumb.items.length === 0) {
          console.log('Library: Aktualisiere Breadcrumb für gecachte Items', { 
            folderId: currentFolderId,
            pathLength: path.length 
          });
          updateBreadcrumb(path, currentFolderId);
          // Aktualisiere auch das globale Atom
          setBreadcrumbItems(path);
        } else {
          console.log('Library: Überspringe Breadcrumb-Update für Root bei vorhandenem Breadcrumb');
        }
        
        return;
      }

      console.log('Library: Fetching items from provider');
      // Nutze den StorageContext für das Laden der Items
      const items = await listItems(currentFolderId);
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
      
      // Kein flushSync mehr verwenden, sondern getrennte State-Updates
      console.log('Library: Updating UI with new items');
      setFolderItems(items);
      
      // Breadcrumb nur aktualisieren, wenn es nicht Root ist oder wenn der aktuelle Breadcrumb leer ist
      if (currentFolderId !== 'root' || selected.breadcrumb.items.length === 0) {
        console.log('Library: Aktualisiere Breadcrumb für neue Items', { 
          folderId: currentFolderId,
          pathLength: path.length 
        });
        updateBreadcrumb(path, currentFolderId);
        // Aktualisiere auch das globale Atom
        setBreadcrumbItems(path);
      } else {
        console.log('Library: Überspringe Breadcrumb-Update für Root bei vorhandenem Breadcrumb');
      }
      
    } catch (error) {
      console.error('Library: Failed to load items:', error);
      setFolderItems([]);
      
      // Breadcrumb nur zurücksetzen, wenn wir wirklich im Root-Verzeichnis sind
      if (currentFolderId === 'root') {
        updateBreadcrumb([], 'root');
        // Aktualisiere auch das globale Atom
        setBreadcrumbItems([]);
      } else {
        console.warn('Library: Fehler beim Laden der Items, behalte aber den Breadcrumb für:', currentFolderId);
      }
    }
  }, [currentFolderId, listItems, folderCache, resolvePath, updateBreadcrumb, setBreadcrumbItems, selected.breadcrumb.items.length]);

  // Load Items wenn Provider oder Folder sich ändern
  useEffect(() => {
    if (providerInstance) {
      console.log('Library: Loading items for current folder due to provider or folder change');
      loadItems().then(() => {
        console.log('Library: Initial items loaded, ensuring breadcrumb is updated');
        
        // Stelle sicher, dass nach dem Laden der Breadcrumb nur aktualisiert wird, wenn nötig
        if (selected.breadcrumb.items.length > 0 && currentFolderId !== 'root') {
          console.log('Library: Stelle sicher, dass Breadcrumb für Nicht-Root-Ordner erhalten bleibt:', currentFolderId);
          setBreadcrumbItems(selected.breadcrumb.items);
        }
      });
    }
  }, [loadItems, providerInstance, currentFolderId]);

  // Optimierter Folder Select Handler
  const handleFolderSelect = useCallback(async (item: StorageItem) => {
    if (item.type !== 'folder') return;
    
    console.time('folderSelect');
    try {
      console.time('parallelLoading');
      // Parallel fetch von Folder Contents und Path Resolution
      const [items, path] = await Promise.all([
        listItems(item.id),
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
        // Kein flushSync mehr verwenden, sondern getrennte State-Updates
        setCurrentFolderId(item.id);
        setFolderItems(items);
        
        // Update breadcrumb with the resolved path - wichtig für die Navigation
        console.log('Library: Breadcrumb wird aktualisiert beim Ordnerwechsel zu', item.metadata.name);
        updateBreadcrumb(path, item.id);
        
        // Aktualisiere auch das globale Atom
        setBreadcrumbItems(path);
        
        // Lösche die Dateiauswahl nur, wenn wir aus einem anderen Ordner kommen
        // oder wenn der Benutzer explizit auf einen anderen Ordner als den aktuellen klickt
        if (currentFolderId !== item.id) {
          console.log('Library: Lösche Dateiauswahl beim Wechsel zu anderem Ordner');
          clearSelection();
        } else {
          console.log('Library: Behalte Dateiauswahl beim Klick auf aktuellen Ordner');
        }
        
        console.timeEnd('stateUpdates');
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    } finally {
      console.timeEnd('folderSelect');
    }
  }, [listItems, folderCache, resolvePath, updateBreadcrumb, clearSelection, setBreadcrumbItems, currentFolderId]);

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
    refreshItems(currentFolderId).then(items => {
      setFolderItems(items);
    });
  }, [refreshItems, currentFolderId, folderCache]);

  return (
    <Profiler id="Library" onRender={onRenderCallback}>
      <div className="flex flex-col h-screen overflow-hidden">
        <LibraryHeader 
          activeLibrary={currentLibrary}
          onFolderSelect={handleFolderSelect}
          onRootClick={() => {
            // Prüfe, ob wir bereits im Root-Verzeichnis sind
            if (currentFolderId !== 'root') {
              console.log('Library: Wechsle zum Root-Verzeichnis');
              setCurrentFolderId('root');
              loadItems(); // Lade Items statt direkt zu leeren
              
              // Erst nach dem Laden der Items den Breadcrumb aktualisieren
              // Dies passiert bereits in loadItems
            } else {
              console.log('Library: Bereits im Root-Verzeichnis, nur Breadcrumb leeren');
              // Im Root-Verzeichnis bereits, setze nur den Breadcrumb zurück
              updateBreadcrumb([], 'root');
              setBreadcrumbItems([]);
            }
          }}
          provider={providerInstance}
          onUploadComplete={handleUploadComplete}
          error={storageError || localError}
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
                      libraryName={currentLibrary?.label}
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