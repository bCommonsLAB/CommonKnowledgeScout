"use client"

import * as React from "react"
import { useCallback, useEffect } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import { FilePreview } from "./file-preview"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { 
  libraryAtom, 
  fileTreeReadyAtom, 
  folderItemsAtom,
  loadingStateAtom,
  lastLoadedFolderAtom,
  currentFolderIdAtom,
  reviewModeAtom,
  selectedFileAtom,
  selectedShadowTwinAtom
} from "@/atoms/library-atom"
import { useStorage, isStorageError } from "@/contexts/storage-context"
import { TranscriptionDialog } from "./transcription-dialog"
import { TransformationDialog } from "./transformation-dialog"
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"

export function Library() {
  // Globale Atoms
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const [, setLoadingState] = useAtom(loadingStateAtom);
  const [lastLoadedFolder, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const isFileTreeReady = useAtomValue(fileTreeReadyAtom);
  
  // Review-Mode Atoms
  const [isReviewMode] = useAtom(reviewModeAtom);
  const [selectedFile] = useAtom(selectedFileAtom);
  const [selectedShadowTwin, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);
  
  // Storage Context
  const { 
    provider: providerInstance, 
    error: storageError, 
    listItems,
    libraryStatus
  } = useStorage();

  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    StateLogger.info('Library', 'Starting loadItems', {
      currentFolderId,
      lastLoadedFolder,
      hasProvider: !!providerInstance,
      libraryStatus: libraryStatus
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
  }, [libraryStatus, setLibraryState, setLastLoadedFolder]);

  // Reset selectedShadowTwin wenn Review-Modus verlassen wird
  useEffect(() => {
    if (!isReviewMode) {
      setSelectedShadowTwin(null);
    }
  }, [isReviewMode, setSelectedShadowTwin]);

  // ENTFERNT: Der folgende useEffect war problematisch und hat das Shadow-Twin 
  // bei jedem Klick zurückgesetzt, auch wenn die Datei ein Shadow-Twin hat.
  // Die Shadow-Twin-Logik wird bereits korrekt in der FileList-Komponente 
  // in der handleSelect-Funktion behandelt.

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
        provider={providerInstance}
        error={storageError}
        onUploadComplete={loadItems}
      >
        <Breadcrumb />
      </LibraryHeader>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        {isReviewMode ? (
          // Review-Layout: 3 Panels ohne FileTree - FileList (compact) | FilePreview (Basis-Datei) | FilePreview (Shadow-Twin)
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={25} minSize={20} className="min-h-0">
              <div className="h-full overflow-auto flex flex-col">
                <FileList compact={true} />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                <FilePreview
                  provider={providerInstance}
                  file={selectedFile}
                  onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                    StateLogger.info('Library', 'FilePreview (Basis) onRefreshFolder aufgerufen', {
                      folderId,
                      itemsCount: items.length,
                      hasSelectFile: !!selectFileAfterRefresh
                    });
                    
                    // Aktualisiere die Dateiliste
                    setFolderItems(items);
                    
                    // Aktualisiere den Cache
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
                    
                    // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                    if (selectFileAfterRefresh) {
                      StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                        fileId: selectFileAfterRefresh.id,
                        fileName: selectFileAfterRefresh.metadata.name
                      });
                    }
                  }}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedShadowTwin ? (
                  <FilePreview
                    provider={providerInstance}
                    file={selectedShadowTwin}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                      StateLogger.info('Library', 'FilePreview (Shadow-Twin) onRefreshFolder aufgerufen', {
                        folderId,
                        itemsCount: items.length,
                        hasSelectFile: !!selectFileAfterRefresh
                      });
                      
                      // Aktualisiere die Dateiliste
                      setFolderItems(items);
                      
                      // Aktualisiere den Cache
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
                      
                      // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                      if (selectFileAfterRefresh) {
                        StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                          fileId: selectFileAfterRefresh.id,
                          fileName: selectFileAfterRefresh.metadata.name
                        });
                      }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Kein Shadow-Twin ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          // Normal-Layout: FileTree | FileList | FilePreview
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={20} minSize={15} className="min-h-0">
              <div className="h-full overflow-auto flex flex-col">
                <FileTree />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={40} className="min-h-0">
              <div className="h-full overflow-auto flex flex-col">
                <FileList />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={40} className="min-h-0">
              <div className="h-full relative flex flex-col">
                <FilePreview
                  provider={providerInstance}
                  onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                    StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                      folderId,
                      itemsCount: items.length,
                      hasSelectFile: !!selectFileAfterRefresh
                    });
                    
                    // Aktualisiere die Dateiliste
                    setFolderItems(items);
                    
                    // Aktualisiere den Cache
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
                    
                    // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                    if (selectFileAfterRefresh) {
                      StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                        fileId: selectFileAfterRefresh.id,
                        fileName: selectFileAfterRefresh.metadata.name
                      });
                    }
                  }}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
      
      {/* Dialoge */}
      <TranscriptionDialog />
      <TransformationDialog 
        onRefreshFolder={(folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => {
          StateLogger.info('Library', 'TransformationDialog onRefreshFolder aufgerufen', {
            folderId,
            itemsCount: items.length,
            hasSelectFile: !!selectFileAfterRefresh
          });
          
          // Aktualisiere die Dateiliste
          setFolderItems(items);
          
          // Aktualisiere den Cache
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
          
          // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
          if (selectFileAfterRefresh) {
            StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
              fileId: selectFileAfterRefresh.id,
              fileName: selectFileAfterRefresh.metadata.name
            });
          }
        }}
      />
    </div>
  );
}