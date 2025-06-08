"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAtom } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import { FilePreview } from "./file-preview"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ClientLibrary } from "@/types/library"
import { StorageItem } from "@/lib/storage/types"
import { useSelectedFile } from "@/hooks/use-selected-file"
import { libraryAtom, activeLibraryIdAtom, currentFolderIdAtom, breadcrumbItemsAtom, writeBreadcrumbItemsAtom, librariesAtom } from "@/atoms/library-atom"
import { useStorage, isStorageError } from "@/contexts/storage-context"
import { DebugPanel } from "../debug/debug-panel"
import { StorageAuthButton } from "../shared/storage-auth-button"

export interface LibraryContextProps {
  libraries: ClientLibrary[];
  activeLibraryId: string;
  onLibraryChange: (libraryId: string) => void;
}

export function Library() {
  const [searchQuery, ] = useState("")

  // Folder States - alte lokale State entfernen und durch Atom ersetzen
  const [folderItems, setFolderItems] = useState<StorageItem[]>([]);

  // Jotai State
  const [, setLibraryState] = useAtom(libraryAtom);
  const [globalActiveLibraryId, ] = useAtom(activeLibraryIdAtom);
  const [currentFolderId, setCurrentFolderId] = useAtom(currentFolderIdAtom);
  const [libraries] = useAtom(librariesAtom); // Verwende den globalen Libraries-Zustand
  
  // Den StorageContext nutzen statt eigenen Provider zu erstellen
  const { 
    provider: providerInstance, 
    isLoading, 
    error: storageError, 
    listItems,
    libraryStatus,
    authProvider
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

  // Die aktive Bibliothek aus den globalen Libraries ermitteln
  const currentLibrary = useMemo(() => libraries.find(lib => lib.id === globalActiveLibraryId) || undefined, [libraries, globalActiveLibraryId]);

  // File Selection Hook
  const {
    selected,
    selectFile,
    updateBreadcrumb,
    clearSelection
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
    // Setze den Jotai-Zustand mit den globalen Bibliotheken
    setLibraryState({
      libraries,
      activeLibraryId: globalActiveLibraryId || (libraries.length > 0 ? libraries[0].id : ''),
      currentFolderId: 'root' // Initialisiere das Verzeichnis
    });
  }, [libraries, globalActiveLibraryId, setLibraryState]);

  // Reset currentFolderId when active library changes
  useEffect(() => {
    console.log('Library: Aktive Bibliothek geändert, setze currentFolderId zurück');
    setCurrentFolderId('root');
    setFolderItems([]); // Leere auch die Dateiliste
  }, [globalActiveLibraryId, setCurrentFolderId]);

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

  // Debug logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Library Config:', libraryConfig);
    }
  }, [libraryConfig]);

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
      if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
        // Kein Logging für AUTH_REQUIRED
      } else {
        console.error('Library: Failed to load items:', error);
      }
      setFolderItems([]);
      // Breadcrumb nur zurücksetzen, wenn wir wirklich im Root-Verzeichnis sind
      if (currentFolderId === 'root') {
        updateBreadcrumb([], 'root');
        setBreadcrumbItems([]);
      } else {
        console.warn('Library: Fehler beim Laden der Items, behalte aber den Breadcrumb für:', currentFolderId);
      }
    }
  }, [currentFolderId, listItems, folderCache, resolvePath, updateBreadcrumb, setBreadcrumbItems, selected.breadcrumb.items.length, providerInstance]);

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
  }, [loadItems, providerInstance, currentFolderId, selected.breadcrumb.items, setBreadcrumbItems]);

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
  }, [listItems, folderCache, resolvePath, updateBreadcrumb, clearSelection, setBreadcrumbItems, currentFolderId, setCurrentFolderId]);

  // Komponenten nur rendern, wenn Storage bereit oder Daten werden geladen
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Bitte authentifizieren Sie sich beim Storage-Provider.</span>
        {authProvider && (
          <div className="mt-4">
            <StorageAuthButton provider={authProvider} />
          </div>
        )}
        <div className="absolute bottom-4 right-4">
          <DebugPanel />
        </div>
      </div>
    );
  }
  if (libraryStatus !== "ready" && libraryStatus !== "loadingData") {
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
    <div className="flex flex-col h-screen overflow-hidden" data-active-library-id={globalActiveLibraryId}>
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
      <div className="flex flex-1 overflow-hidden">
        <FileTree
          provider={providerInstance}
          onSelectAction={handleFolderSelect}
          libraryName={currentLibrary?.label}
        />
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={50} minSize={30}>
            <FileList
              items={folderItems}
              selectedItem={selected.item}
              onSelectAction={selectFile}
              searchTerm={searchQuery}
              onRefresh={(folderId, items) => {
                // Aktualisiere die Dateiliste nach einem Refresh
                setFolderItems(items);
                // Optional: Cache aktualisieren
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
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50} minSize={30}>
            <FilePreview
              item={selected.item}
              provider={providerInstance}
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
      <div className="absolute bottom-4 right-4">
        <DebugPanel />
      </div>
    </div>
  );
}