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
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [selectedShadowTwin, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);
  
  // Storage Context
  const { 
    provider: providerInstance, 
    error: storageError, 
    listItems,
    libraryStatus,
    currentLibrary
  } = useStorage();
  const { toast } = useToast();
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [mobileView, setMobileView] = React.useState<'list' | 'preview'>('list');

  // Mobile: Tree standardmäßig ausblenden, Desktop: anzeigen
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Desktop ab 1024px, Mobile darunter
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => {
      setIsMobile(matches);
      setIsTreeVisible(!matches);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Mobile-View Wechsellogik: bei Dateiauswahl zur Vorschau wechseln
  React.useEffect(() => {
    if (!isMobile) return;
    if (selectedFile) setMobileView('preview');
  }, [isMobile, selectedFile]);

  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    if (!providerInstance || libraryStatus !== 'ready') {
      NavigationLogger.debug('Library', 'Skipping loadItems - not ready', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    setLoadingState({ isLoading: true, loadingFolderId: currentFolderId });

    try {
      // Prüfe Cache zuerst
      if (libraryState.folderCache?.[currentFolderId]?.children) {
        const cachedItems = libraryState.folderCache[currentFolderId].children;
        NavigationLogger.info('Library', 'Using cached items', {
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
        const newFolderCache = { ...libraryState.folderCache };
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
        // Keine Fehlermeldung für AUTH_REQUIRED anzeigen
      } else {
        StateLogger.error('Library', 'Failed to load items', {
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 3)
          } : error,
          folderId: currentFolderId,
          libraryId: currentLibrary?.id,
          libraryPath: currentLibrary?.path
        });
        
        // Benutzerfreundliche Fehlermeldung anzeigen
        let errorMessage = 'Fehler beim Laden der Dateien';
        
        if (error instanceof Error) {
          if (error.message.includes('Nicht authentifiziert')) {
            errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher.';
          } else if (error.message.includes('Bibliothek nicht gefunden')) {
            errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
          } else if (error.message.includes('Server-Fehler')) {
            errorMessage = 'Server-Fehler beim Laden der Dateien. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
          } else if (error.message.includes('Keine aktive Bibliothek')) {
            errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
          } else {
            errorMessage = error.message;
          }
        }
        
        // Toast-Nachricht anzeigen
        toast({
          title: "Fehler beim Laden der Dateien",
          description: errorMessage,
          variant: "destructive",
        });
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
    setLoadingState,
    toast,
    currentLibrary
  ]);

  // Effect für Initial-Load (beachte Mobile/Tree-Sichtbarkeit)
  useEffect(() => {
    const treeReady = isFileTreeReady || isMobile || !isTreeVisible;
    const isReady = treeReady && providerInstance && libraryStatus === 'ready';
    
    if (!isReady) {
      NavigationLogger.debug('Library', 'Waiting for initialization', {
        isFileTreeReady,
        isMobile,
        isTreeVisible,
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

  // Manuelle Cache-Clear-Funktion für Review-Modus
  const clearCache = useCallback(() => {
    StateLogger.info('Library', 'Manually clearing cache for review mode');
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
    setFolderItems([]);
  }, [setLibraryState, setLastLoadedFolder, setFolderItems]);

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
        onClearCache={clearCache}
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
          // Normal-Layout (Desktop) oder alternierendes Mobile-Layout
          <div className="relative h-full">
            {/* Floating toggle handle - nur Desktop */}
            <button
              type="button"
              onClick={() => setIsTreeVisible(v => !v)}
              className="hidden lg:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full border bg-background/80 shadow-sm hover:bg-background"
              aria-label={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
              title={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
            >
              {isTreeVisible ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {isMobile ? (
              mobileView === 'list' ? (
                <div className="h-full overflow-auto flex flex-col">
                  <FileList />
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 p-2 border-b bg-background">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm px-2 py-1 border rounded-md"
                      onClick={() => {
                        setMobileView('list');
                        setSelectedShadowTwin(null);
                        setSelectedFile(null);
                        loadItems();
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Zurück
                    </button>
                    <div className="text-sm text-muted-foreground truncate">
                      {selectedFile?.metadata.name}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <FilePreview
                      provider={providerInstance}
                      onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                        StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                          folderId,
                          itemsCount: items.length,
                          hasSelectFile: !!selectFileAfterRefresh
                        });
                        setFolderItems(items);
                        if (libraryState.folderCache?.[folderId]) {
                          const cachedFolder = libraryState.folderCache[folderId];
                          if (cachedFolder) {
                            setLibraryState(state => ({
                              ...state,
                              folderCache: {
                                ...(state.folderCache || {}),
                                [folderId]: { ...cachedFolder, children: items }
                              }
                            }));
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              )
            ) : (
              <ResizablePanelGroup direction="horizontal" className="h-full" autoSaveId="library-panels">
                {isTreeVisible && (
                  <>
                    <ResizablePanel id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle />
                  </>
                )}
                <ResizablePanel id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
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