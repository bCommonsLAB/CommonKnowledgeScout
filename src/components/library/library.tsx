"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import { FilePreview } from "./file-preview"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ClientLibrary } from "@/types/library"
import { StorageItem } from "@/lib/storage/types"
import { useSelectedFile } from "@/hooks/use-selected-file"
import { 
  libraryAtom, 
  activeLibraryIdAtom, 
  currentFolderIdAtom, 
  librariesAtom, 
  fileTreeReadyAtom,
  folderItemsAtom,
  loadingStateAtom,
  lastLoadedFolderAtom,
  currentPathAtom
} from "@/atoms/library-atom"
import { useStorage, isStorageError } from "@/contexts/storage-context"
import { TranscriptionDialog } from "./transcription-dialog"
import { NavigationLogger, StateLogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { StorageProvider } from "@/lib/storage/types"

export interface LibraryContextProps {
  libraries: ClientLibrary[];
  activeLibraryId: string;
  onLibraryChange: (libraryId: string) => void;
}

interface LibraryHeaderProps {
  activeLibrary: ClientLibrary | undefined;
  provider: StorageProvider | null;
  error: string | null;
  onUploadComplete: () => void;
  children?: React.ReactNode;
}

export function Library() {
  // Globale Atoms
  const [folderItems, setFolderItems] = useAtom(folderItemsAtom);
  const [loadingState, setLoadingState] = useAtom(loadingStateAtom);
  const [lastLoadedFolder, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom);
  const [currentFolderId, setCurrentFolderId] = useAtom(currentFolderIdAtom);
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const globalActiveLibraryId = useAtomValue(activeLibraryIdAtom);
  const libraries = useAtomValue(librariesAtom);
  const isFileTreeReady = useAtomValue(fileTreeReadyAtom);
  const currentPath = useAtomValue(currentPathAtom);
  
  // Storage Context
  const { 
    provider: providerInstance, 
    error: storageError, 
    listItems,
    libraryStatus
  } = useStorage();

  // Die aktive Bibliothek aus den globalen Libraries ermitteln
  const currentLibrary = useMemo(() => 
    libraries.find(lib => lib.id === globalActiveLibraryId), 
    [libraries, globalActiveLibraryId]
  );

  // File Selection Hook
  const { selected, selectFile, clearSelection } = useSelectedFile();

  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    StateLogger.info('Library', 'Starting loadItems', {
      currentFolderId,
      lastLoadedFolder,
      hasProvider: !!providerInstance,
      libraryStatus
    });

    if (!providerInstance || libraryStatus !== 'ready') {
      NavigationLogger.info('Library', 'Skip loading - provider not ready', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    // Prüfe ob der Ordner bereits geladen wurde
    if (lastLoadedFolder === currentFolderId) {
      StateLogger.info('Library', 'Skip loading - folder already loaded', {
        folderId: currentFolderId,
        cacheSize: Object.keys(libraryState.folderCache || {}).length
      });
      return;
    }

    try {
      setLoadingState({ isLoading: true, loadingFolderId: currentFolderId });
      
      // Prüfe Cache im globalen State
      const folderCache = libraryState.folderCache || {};
      const cachedItems = folderCache[currentFolderId]?.children;
      
      if (cachedItems) {
        StateLogger.info('Library', 'Using cached items', {
          folderId: currentFolderId,
          itemCount: cachedItems.length,
          cacheHit: true
        });
        setFolderItems(cachedItems);
        setLastLoadedFolder(currentFolderId);
        return;
      }

      NavigationLogger.info('Library', 'Fetching items from provider', {
        folderId: currentFolderId,
        cacheHit: false
      });
      
      const items = await listItems(currentFolderId);
      
      // Update Cache und State
      if (currentFolderId !== 'root') {
        const newFolderCache = { ...folderCache };
        const parent = newFolderCache[currentFolderId];
        if (parent) {
          newFolderCache[currentFolderId] = {
            ...parent,
            children: items
          };
          StateLogger.info('Library', 'Updating folder cache', {
            folderId: currentFolderId,
            itemCount: items.length,
            cacheSize: Object.keys(newFolderCache).length
          });
          setLibraryState(state => ({
            ...state,
            folderCache: newFolderCache
          }));
        }
      }
      
      setFolderItems(items);
      setLastLoadedFolder(currentFolderId);
      
      StateLogger.info('Library', 'Items loaded successfully', {
        folderId: currentFolderId,
        itemCount: items.length,
        fileCount: items.filter(i => i.type === 'file').length,
        folderCount: items.filter(i => i.type === 'folder').length
      });
      
    } catch (error) {
      if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
        StateLogger.info('Library', 'Auth required');
      } else {
        StateLogger.error('Library', 'Failed to load items', error);
      }
      setFolderItems([]);
    } finally {
      setLoadingState({ isLoading: false, loadingFolderId: null });
    }
  }, [
    currentFolderId,
    lastLoadedFolder,
    listItems,
    libraryState.folderCache,
    providerInstance,
    libraryStatus,
    setLibraryState,
    setFolderItems,
    setLastLoadedFolder,
    setLoadingState
  ]);

  // Effect für FileTree Ready
  useEffect(() => {
    const isReady = isFileTreeReady && providerInstance && libraryStatus === 'ready';
    
    if (!isReady) {
      NavigationLogger.debug('Library', 'Waiting for initialization', {
        isFileTreeReady,
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    // Nur laden wenn noch nicht geladen
    if (lastLoadedFolder !== currentFolderId) {
      NavigationLogger.info('Library', 'Loading initial items', {
        folderId: currentFolderId
      });
      loadItems();
    }
  }, [isFileTreeReady, providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, loadItems]);

  // Reset Cache wenn sich die Library ändert
  useEffect(() => {
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
  }, [globalActiveLibraryId, setLibraryState, setLastLoadedFolder]);

  // Optimierter Folder Select Handler
  const handleFolderSelect = useCallback(async (item: StorageItem) => {
    if (item.type !== 'folder') return;
    
    NavigationLogger.info('Library', 'Folder selection started', {
      folderId: item.id,
      folderName: item.metadata.name
    });

    try {
      // Lade Items
      const items = await listItems(item.id);
      
      if (items) {
        // Cache aktualisieren
        const newFolderCache = { ...(libraryState.folderCache || {}) };
        items.forEach(child => {
          if (child.type === 'folder') {
            newFolderCache[child.id] = {
              ...child,
              children: []
            };
          }
        });
        
        // Parent Cache aktualisieren
        const parent = newFolderCache[item.id];
        if (parent) {
          newFolderCache[item.id] = {
            ...parent,
            children: items
          };
        }

        // State-Updates in einer Transaktion
        React.startTransition(() => {
          setLibraryState(state => ({
            ...state,
            folderCache: newFolderCache
          }));
          setCurrentFolderId(item.id);
          setFolderItems(items);
          setLastLoadedFolder(item.id);
          
          // Speichere den Ordner im localStorage
          if (globalActiveLibraryId) {
            localStorage.setItem(`folder-${globalActiveLibraryId}`, item.id);
          }
          
          // Lösche die Dateiauswahl nur bei Ordnerwechsel
          if (currentFolderId !== item.id) {
            clearSelection();
          }
        });

        NavigationLogger.info('Library', 'Folder selection completed', {
          itemCount: items.length,
          folderCount: items.filter(i => i.type === 'folder').length,
          fileCount: items.filter(i => i.type === 'file').length
        });
      }
    } catch (error) {
      if (!isStorageError(error) || error.code !== 'AUTH_REQUIRED') {
        StateLogger.error('Library', 'Failed to select folder', error);
      }
    }
  }, [
    listItems,
    libraryState.folderCache,
    setLibraryState,
    setCurrentFolderId,
    setFolderItems,
    setLastLoadedFolder,
    clearSelection,
    currentFolderId,
    globalActiveLibraryId
  ]);

  // Breadcrumb Navigation Handler
  const handleBreadcrumbNav = useCallback(async (folderId: string) => {
    if (!providerInstance || !currentLibrary) return;

    try {
      // Erstelle ein StorageItem für die Navigation
      const item = folderId === 'root' 
        ? {
            id: 'root',
            type: 'folder' as const,
            metadata: {
              name: currentLibrary.label || '/',
              size: 0,
              modifiedAt: new Date(),
              mimeType: 'application/folder'
            },
            parentId: ''
          }
        : await providerInstance.getItemById(folderId);

      if (item) {
        handleFolderSelect(item);
      }
    } catch (error) {
      StateLogger.error('Library', 'Failed to navigate via breadcrumb', error);
    }
  }, [providerInstance, currentLibrary, handleFolderSelect]);

  // Render-Logik für verschiedene Status
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Diese Bibliothek benötigt eine Authentifizierung.</span>
        <span className="text-sm mt-2">Bitte konfigurieren Sie die Bibliothek in den Einstellungen.</span>
      </div>
    );
  }
  
  if (libraryStatus !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Lade Storage...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <LibraryHeader
        activeLibrary={currentLibrary}
        provider={providerInstance}
        error={storageError}
        onUploadComplete={loadItems}
      >
        <Breadcrumb />
      </LibraryHeader>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={20} minSize={15} className="min-h-0">
            <div className="h-full overflow-auto">
              <FileTree
                libraryName={currentLibrary?.label}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={80} className="min-h-0">
            <div className="h-full overflow-auto">
              <FileList
                items={folderItems}
                selectedItem={selected.item}
                onSelectAction={selectFile}
                searchTerm=""
                onRefresh={(folderId, items) => {
                  setFolderItems(items);
                  if (libraryState.folderCache?.[folderId]) {
                    const cachedFolder = libraryState.folderCache[folderId];
                    if (cachedFolder) {
                      setLibraryState(state => ({
                        ...state,
                        folderCache: {
                          ...(state.folderCache || {}),
                          [folderId]: {
                            ...cachedFolder,
                            children: items
                          }
                        }
                      }));
                    }
                  }
                }}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      {/* Dialoge */}
      <TranscriptionDialog />
    </div>
  );
}