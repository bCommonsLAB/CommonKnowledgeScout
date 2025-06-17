"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import { FilePreview } from "./file-preview"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ClientLibrary } from "@/types/library"
import { StorageItem } from "@/lib/storage/types"
import { useSelectedFile } from "@/hooks/use-selected-file"
import { libraryAtom, activeLibraryIdAtom, currentFolderIdAtom, breadcrumbItemsAtom, writeBreadcrumbItemsAtom, librariesAtom, fileTreeReadyAtom } from "@/atoms/library-atom"
import { useStorage, isStorageError } from "@/contexts/storage-context"
import { DebugPanel } from "../debug/debug-panel"
import { TranscriptionDialog } from "./transcription-dialog"
import { NavigationLogger } from "@/lib/utils"

export interface LibraryContextProps {
  libraries: ClientLibrary[];
  activeLibraryId: string;
  onLibraryChange: (libraryId: string) => void;
}

export function Library() {
  const [searchQuery, ] = useState("")

  // Folder States - nur noch für die FileList
  const [folderItems, setFolderItems] = useState<StorageItem[]>([]);

  // Jotai State
  const [, setLibraryState] = useAtom(libraryAtom);
  const [globalActiveLibraryId, ] = useAtom(activeLibraryIdAtom);
  const [currentFolderId, setCurrentFolderId] = useAtom(currentFolderIdAtom);
  const [libraries] = useAtom(librariesAtom);
  const [, setBreadcrumbItems] = useAtom(breadcrumbItemsAtom);
  
  // Den StorageContext nutzen
  const { 
    provider: providerInstance, 
    isLoading, 
    error: storageError, 
    listItems,
    libraryStatus
  } = useStorage();

  // Die aktive Bibliothek aus den globalen Libraries ermitteln
  const currentLibrary = useMemo(() => libraries.find(lib => lib.id === globalActiveLibraryId) || undefined, [libraries, globalActiveLibraryId]);

  // File Selection Hook
  const {
    selected,
    selectFile,
    updateBreadcrumb,
    clearSelection
  } = useSelectedFile();

  // Caches für die FileList
  const folderCache = useMemo(() => new Map<string, StorageItem>(), []);
  const pathCache = useMemo(() => new Map<string, StorageItem[]>(), []);

  // Debounce-Referenz für loadItems
  const loadItemsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // FileTree Ready Status
  const isFileTreeReady = useAtomValue(fileTreeReadyAtom);

  // Referenz für den letzten geladenen Ordner
  const lastLoadedFolderRef = useRef<string | null>(null);
  
  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    if (!providerInstance || libraryStatus !== 'ready') {
      NavigationLogger.log('Library', 'Skip loading - provider not ready', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    // Prüfe ob der Ordner bereits geladen wurde
    if (lastLoadedFolderRef.current === currentFolderId) {
      NavigationLogger.log('Library', 'Skip loading - folder already loaded', {
        folderId: currentFolderId
      });
      return;
    }

    return new Promise<void>((resolve) => {
      if (loadItemsTimeoutRef.current) {
        clearTimeout(loadItemsTimeoutRef.current);
      }

      loadItemsTimeoutRef.current = setTimeout(async () => {
        try {
          NavigationLogger.log('Library', 'Loading folder items', { folderId: currentFolderId });
          
          // Prüfe Cache
          const cachedItems = folderCache.get(currentFolderId)?.children;
          
          if (cachedItems) {
            NavigationLogger.log('Library', 'Using cached items', {
              folderId: currentFolderId,
              itemCount: cachedItems.length
            });
            setFolderItems(cachedItems);
            lastLoadedFolderRef.current = currentFolderId;
            resolve();
            return;
          }

          NavigationLogger.log('Library', 'Fetching items from provider');
          const items = await listItems(currentFolderId);
          NavigationLogger.log('Library', 'Items fetched', {
            itemCount: items.length,
            folderCount: items.filter(i => i.type === 'folder').length,
            fileCount: items.filter(i => i.type === 'file').length,
            items: items.slice(0, 5).map(i => ({ 
              id: i.id, 
              name: i.metadata.name, 
              type: i.type 
            }))
          });
          
          // Update Cache und Items
          if (currentFolderId !== 'root') {
            const parent = folderCache.get(currentFolderId);
            if (parent) {
              folderCache.set(currentFolderId, {
                ...parent,
                children: items
              });
            }
          }
          
          setFolderItems(items);
          lastLoadedFolderRef.current = currentFolderId;
          
        } catch (error) {
          if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
            NavigationLogger.log('Library', 'Auth required');
          } else {
            NavigationLogger.error('Library', 'Failed to load items', error);
          }
          setFolderItems([]);
        }
        
        resolve();
      }, 100);
    });
  }, [currentFolderId, listItems, folderCache, providerInstance, libraryStatus]);

  // Optimierter Effect für FileTree Ready
  useEffect(() => {
    if (isFileTreeReady && providerInstance && libraryStatus === 'ready' && !lastLoadedFolderRef.current) {
      NavigationLogger.log('Library', 'FileTree ready - loading initial items');
      loadItems();
    }
  }, [isFileTreeReady, providerInstance, libraryStatus, loadItems]);

  // Optimierter Effect für currentFolderId
  useEffect(() => {
    let isMounted = true;
    
    const loadCurrentFolder = async () => {
      if (!providerInstance || libraryStatus !== 'ready' || !isFileTreeReady) {
        NavigationLogger.log('Library', 'Skip folder load - not ready', {
          hasProvider: !!providerInstance,
          status: libraryStatus,
          isFileTreeReady
        });
        return;
      }
      
      // Prüfe ob der Ordner bereits geladen wurde
      if (lastLoadedFolderRef.current === currentFolderId) {
        NavigationLogger.log('Library', 'Skip folder load - already loaded', {
          folderId: currentFolderId
        });
        return;
      }
      
      NavigationLogger.log('Library', 'Loading current folder', { 
        folderId: currentFolderId,
        libraryId: globalActiveLibraryId
      });
      
      try {
        await loadItems();
        if (!isMounted) return;
        NavigationLogger.log('Library', 'Folder loaded successfully');
      } catch (error) {
        if (!isMounted) return;
        NavigationLogger.error('Library', 'Error loading folder', error);
      }
    };
    
    loadCurrentFolder();
    
    return () => {
      isMounted = false;
      if (loadItemsTimeoutRef.current) {
        clearTimeout(loadItemsTimeoutRef.current);
      }
    };
  }, [loadItems, providerInstance, currentFolderId, libraryStatus, globalActiveLibraryId, isFileTreeReady]);

  // Reset lastLoadedFolder wenn sich die Library ändert
  useEffect(() => {
    lastLoadedFolderRef.current = null;
  }, [globalActiveLibraryId]);

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
        
        // Breadcrumb-Update mit vollständigem Pfad
        console.log('resolvePath:', path.map(i => i.metadata.name), 'item:', item.metadata.name);
        setBreadcrumbItems(path);
        
        // State-Updates in einer Transaktion
        React.startTransition(() => {
          setCurrentFolderId(item.id);
          setFolderItems(items);
          
          // Speichere den Ordner im localStorage mit der aktiven Bibliothek
          if (globalActiveLibraryId) {
            localStorage.setItem(`folder-${globalActiveLibraryId}`, item.id);
          }
          
          // Lösche die Dateiauswahl nur, wenn wir aus einem anderen Ordner kommen
          if (currentFolderId !== item.id) {
            console.log('Library: Lösche Dateiauswahl beim Wechsel zu anderem Ordner');
            clearSelection();
          }
        });
        
        console.timeEnd('stateUpdates');
      }
    } catch (error) {
      // AUTH_REQUIRED Fehler nicht loggen, da sie bereits in der UI behandelt werden
      if (!isStorageError(error) || error.code !== 'AUTH_REQUIRED') {
        console.error('Failed to select folder:', error);
      }
    } finally {
      console.timeEnd('folderSelect');
    }
  }, [listItems, folderCache, resolvePath, updateBreadcrumb, clearSelection, setBreadcrumbItems, currentFolderId, globalActiveLibraryId]);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (loadItemsTimeoutRef.current) {
        clearTimeout(loadItemsTimeoutRef.current);
      }
    };
  }, []);

  // Lade den letzten Ordner für die aktive Bibliothek
  useEffect(() => {
    let isInitialMount = true;
    
    if (providerInstance && globalActiveLibraryId) {
      // Vermeide doppelte Initialisierung beim ersten Mount
      if (!isInitialMount) {
        // Versuche den letzten Ordner für diese Bibliothek zu laden
        const lastFolderId = localStorage.getItem(`folder-${globalActiveLibraryId}`);
        console.log('[Library] Versuche letzten Ordner zu laden:', {
          libraryId: globalActiveLibraryId,
          lastFolderId
        });
        
        if (lastFolderId) {
          handleFolderSelect({
            id: lastFolderId,
            type: 'folder',
            metadata: {
              name: '',
              size: 0,
              modifiedAt: new Date(),
              mimeType: 'folder'
            },
            parentId: ''
          });
        }
      }
      isInitialMount = false;
    }
    
    return () => {
      if (loadItemsTimeoutRef.current) {
        clearTimeout(loadItemsTimeoutRef.current);
      }
    };
  }, [providerInstance, globalActiveLibraryId, handleFolderSelect]);

  // Lädt die Items für den aktuellen Ordner, sobald der FileTree bereit ist.
  // Dies stellt sicher, dass die FileList nach der Initialisierung immer korrekt angezeigt wird.
  React.useEffect(() => {
    if (isFileTreeReady && currentFolderId) {
      listItems(currentFolderId)
        .then(setFolderItems)
        .catch((err) => {
          setFolderItems([]);
          // Fehlerprotokollierung für Debugging
          console.error('[Library] Fehler beim Laden der Items:', err);
        });
    }
  }, [isFileTreeReady, currentFolderId, listItems]);

  // Komponenten nur rendern, wenn Storage bereit oder Daten werden geladen
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Diese Bibliothek benötigt eine Authentifizierung.</span>
        <span className="text-sm mt-2">Bitte konfigurieren Sie die Bibliothek in den Einstellungen.</span>
        <div className="absolute bottom-4 right-4">
          <DebugPanel />
        </div>
      </div>
    );
  }
  if (libraryStatus !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Lade Storage...</span>
        <div className="absolute bottom-4 right-4">
          <DebugPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-active-library-id={globalActiveLibraryId}>
      <LibraryHeader 
        activeLibrary={currentLibrary}
        onFolderSelect={handleFolderSelect}
        onRootClick={() => {
          if (currentFolderId !== "root") {
            setCurrentFolderId("root");
          }
        }}
        provider={providerInstance}
        error={storageError}
      />
      <div className="flex flex-1 min-h-0">
        <div className="w-64 border-r flex flex-col">
          <div className="flex-1 relative">
            <FileTree
              provider={providerInstance}
              onSelectAction={handleFolderSelect}
              libraryName={currentLibrary?.label}
              onRefreshItems={() => {
                loadItems().catch(error => {
                  // AUTH_REQUIRED Fehler werden bereits behandelt
                  if (!isStorageError(error) || error.code !== 'AUTH_REQUIRED') {
                    console.error('[Library] Fehler beim Refresh der Items:', error);
                  }
                });
              }}
            />
          </div>
        </div>
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={50} minSize={30} className="relative">
            {isFileTreeReady ? (
              <FileList
                items={folderItems}
                selectedItem={selected.item}
                onSelectAction={selectFile}
                searchTerm={searchQuery}
                onRefresh={(folderId, items) => {
                  setFolderItems(items);
                  if (folderCache.has(folderId)) {
                    const cachedFolder = folderCache.get(folderId);
                    if (cachedFolder) {
                      folderCache.set(folderId, {
                        ...cachedFolder,
                        children: items
                      });
                    }
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Lade Ordnerstruktur...
              </div>
            )}
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50} minSize={30} className="relative">
            <FilePreview
              item={selected.item}
              provider={providerInstance}
              className="h-full"
              onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                // Aktualisiere die Dateiliste nach einer Bearbeitung
                setFolderItems(items);
                // Aktualisiere den Cache
                if (folderCache.has(folderId)) {
                  const cachedFolder = folderCache.get(folderId);
                  if (cachedFolder) {
                    folderCache.set(folderId, {
                      ...cachedFolder,
                      children: items
                    });
                  }
                }
                // Wähle die Datei nach dem Refresh aus, falls angegeben
                if (selectFileAfterRefresh) {
                  selectFile(selectFileAfterRefresh);
                }
              }}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      {/* Footer zur besseren Visualisierung der Layout-Struktur */}
      <div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span>Bibliothek: {currentLibrary?.label || 'Keine ausgewählt'}</span>
          <span>•</span>
          <span>Dateien: {folderItems.filter(item => item.type === 'file').length}</span>
          <span>•</span>
          <span>Ordner: {folderItems.filter(item => item.type === 'folder').length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Aktueller Pfad: {currentFolderId === 'root' ? '/' : selected.breadcrumb.items.map(item => item.metadata.name).join('/')}</span>
        </div>
      </div>
      <TranscriptionDialog />
      <div className="absolute bottom-4 right-4">
        <DebugPanel />
      </div>
    </div>
  );
}