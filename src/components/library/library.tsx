/**
 * @fileoverview Library Component - Main Library Interface Component
 * 
 * @description
 * Main library component providing the file browser interface. Combines file tree,
 * file list, and file preview in a resizable panel layout. Handles folder navigation,
 * file selection, transformation dialogs, and mobile responsiveness. Integrates with
 * storage context and Jotai atoms for state management.
 * 
 * @module library
 * 
 * @exports
 * - Library: Main library component
 * 
 * @usedIn
 * - src/app/library/page.tsx: Library page uses this component
 * 
 * @dependencies
 * - @/components/library/library-header: Library header component
 * - @/components/library/file-tree: File tree component
 * - @/components/library/file-list: File list component
 * - @/components/library/file-preview: File preview component
 * - @/contexts/storage-context: Storage context for provider access
 * - @/atoms/library-atom: Library state atoms
 * - @/hooks/use-folder-navigation: Folder navigation hook
 */

"use client"

import * as React from "react"
import { useCallback, useEffect } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import dynamic from 'next/dynamic'
const FilePreviewLazy = dynamic(() => import('./file-preview').then(m => ({ default: m.FilePreview })), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      Lade Vorschau...
    </div>
  )
})
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { 
  libraryAtom, 
  folderItemsAtom,
  loadingStateAtom,
  lastLoadedFolderAtom,
  currentFolderIdAtom,
  reviewModeAtom,
  selectedFileAtom,
  selectedShadowTwinAtom
} from "@/atoms/library-atom"
import { activeLibraryIdAtom } from "@/atoms/library-atom"
import { useStorage, isStorageError } from "@/contexts/storage-context"
import { TranscriptionDialog } from "./transcription-dialog"
import { TransformationDialog } from "./transformation-dialog"
import { IngestionDialog } from "./ingestion-dialog"
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useFolderNavigation } from "@/hooks/use-folder-navigation"
import { uiPanePrefsAtom } from "@/atoms/ui-prefs-atom"
export function Library() {
  // Performance-Messung für Kaltstart (nur Client)
  const startupT0Ref = React.useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0
  );
  // Globale Atoms
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const [, setLoadingState] = useAtom(loadingStateAtom);
  const [lastLoadedFolder, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  
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
  const [uiPrefs, setUiPrefs] = useAtom(uiPanePrefsAtom)
  const isTreeVisible = uiPrefs.treeVisible
  const isListCompact = uiPrefs.listCompact
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [mobileView, setMobileView] = React.useState<'list' | 'preview'>('list');
  const loadInFlightRef = React.useRef<boolean>(false);
  const searchParams = useSearchParams();
  const navigateToFolder = useFolderNavigation();

  // Mobile: Tree standardmäßig ausblenden, Desktop: anzeigen
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Desktop ab 1024px, Mobile darunter
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => {
      // Nur Mobile-Flag setzen; Tree-Visibility bleibt persistent über uiPanePrefsAtom
      setIsMobile(matches);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // URL -> State: folderId aus Query anwenden, wenn Provider bereit ist
  const urlInitAppliedRef = React.useRef(false);
  React.useEffect(() => {
    const folderIdFromUrl = searchParams?.get('folderId');

    if (urlInitAppliedRef.current) return;

    if (!folderIdFromUrl) {
      NavigationLogger.debug('debug@init', 'No folderId in URL', {
        currentFolderId
      });
      urlInitAppliedRef.current = true;
      return;
    }

    if (!providerInstance || libraryStatus !== 'ready') {
      NavigationLogger.debug('debug@init', 'Provider not ready, deferring URL apply', {
        folderIdFromUrl,
        libraryStatus,
        hasProvider: !!providerInstance
      });
      return;
    }

    if (folderIdFromUrl !== currentFolderId) {
      NavigationLogger.info('debug@init', 'Applying folderId from URL (ready)', {
        folderIdFromUrl,
        currentFolderId
      });
      void navigateToFolder(folderIdFromUrl);
    }
    urlInitAppliedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, providerInstance, libraryStatus, currentFolderId]);

  // Mobile-View Wechsellogik: bei Dateiauswahl zur Vorschau wechseln
  React.useEffect(() => {
    if (!isMobile) return;
    if (selectedFile) setMobileView('preview');
  }, [isMobile, selectedFile]);

  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    if (loadInFlightRef.current) {
      NavigationLogger.debug('Library', 'Skip loadItems - load already in flight');
      return;
    }
    if (!providerInstance || libraryStatus !== 'ready') {
      NavigationLogger.debug('Library', 'Skipping loadItems - not ready', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    // Schutz: Wenn Provider/Context noch auf alte Library zeigt, keine Items übernehmen
    if (currentLibrary?.id && currentLibrary.id !== activeLibraryId) {
      NavigationLogger.debug('Library', 'Skip loadItems - library mismatch', {
        providerLibraryId: currentLibrary.id,
        activeLibraryId
      });
      return;
    }

    loadInFlightRef.current = true;
    setLoadingState({ isLoading: true, loadingFolderId: currentFolderId });

    try {
      // Snapshot zur Vermeidung von Race-Conditions
      const expectedLibraryId = activeLibraryId;
      const expectedFolderId = currentFolderId;

      // Prüfe Cache zuerst
      if (libraryState.folderCache?.[currentFolderId]?.children) {
        const cachedItems = libraryState.folderCache[currentFolderId].children;
        NavigationLogger.info('Library', 'Using cached items', {
          folderId: currentFolderId,
          itemCount: cachedItems.length,
          cacheHit: true
        });
        // Übernehme nur, wenn der Snapshot noch aktuell ist
        if (expectedLibraryId === activeLibraryId && expectedFolderId === currentFolderId) {
          setFolderItems(cachedItems);
          setLastLoadedFolder(currentFolderId);
        }
        return;
      }

      NavigationLogger.info('Library', 'Fetching items from provider', {
        folderId: currentFolderId,
        cacheHit: false
      });
      
      const items = await listItems(currentFolderId);

      // Falls während des Ladens die Library oder der Ordner wechselte: Ergebnis verwerfen
      if (expectedLibraryId !== activeLibraryId || expectedFolderId !== currentFolderId) {
        NavigationLogger.debug('Library', 'Discard loaded items due to context change', {
          expectedLibraryId,
          activeLibraryId,
          expectedFolderId,
          currentFolderId
        });
        return;
      }
      
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
        folderCount: items.filter(i => i.type === 'folder').length,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
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
      loadInFlightRef.current = false;
    }
  }, [
    currentFolderId,
    listItems,
    libraryState.folderCache,
    providerInstance,
    libraryStatus,
    setLibraryState,
    setFolderItems,
    setLastLoadedFolder,
    setLoadingState,
    toast,
    currentLibrary,
    activeLibraryId
  ]);

  // Effect für Initial-Load (entkoppelt vom FileTree)
  useEffect(() => {
    const isReady = !!providerInstance && libraryStatus === 'ready';
    
    if (!isReady) {
      NavigationLogger.debug('Library', 'Waiting for initialization', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    // Wenn eine folderId in der URL steht und noch nicht angewendet wurde,
    // verhindere das initiale Laden von "root" (vermeidet Doppel-Load)
    const folderIdFromUrl = searchParams?.get('folderId');
    if (!urlInitAppliedRef.current && folderIdFromUrl && folderIdFromUrl !== currentFolderId) {
      NavigationLogger.debug('debug@init', 'Skip initial root load; URL folderId pending', {
        folderIdFromUrl,
        currentFolderId,
        lastLoadedFolder
      });
      return;
    }

    // Nur laden wenn noch nicht geladen
    if (lastLoadedFolder !== currentFolderId && !loadInFlightRef.current) {
      UILogger.info('Library', 'Initial load triggered', {
        currentFolderId,
        lastLoadedFolder,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
      NavigationLogger.info('Library', 'Loading initial items', {
        folderId: currentFolderId
      });
      loadItems();
    }
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems, searchParams]);

  // Zusätzlicher Reset bei Bibliothekswechsel (robust gegen Status-Race)
  useEffect(() => {
    if (!activeLibraryId) return;
    StateLogger.info('Library', 'Active library changed - reset initial load state', {
      activeLibraryId,
      currentFolderId
    });
    setLastLoadedFolder(null);
    setFolderItems([]);
    setLibraryState(state => ({ ...state, folderCache: {} }));
    // WICHTIG: Ordnerauswahl und Shadow-Twin zurücksetzen
    setSelectedFile(null);
    setSelectedShadowTwin(null);
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId, setSelectedFile, setSelectedShadowTwin]);

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
        isTreeVisible={isTreeVisible}
        onToggleTree={() => setUiPrefs({ treeVisible: !isTreeVisible })}
        isCompactList={isListCompact}
        onToggleCompactList={() => setUiPrefs({ listCompact: !isListCompact })}
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
                {selectedFile ? (
                  <FilePreviewLazy
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
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Keine Datei ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedShadowTwin ? (
                  <FilePreviewLazy
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
            {/* Entfernt: alter Tree-Handle (ersetzt durch Header-Toggle) */}

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
                    {selectedFile ? (
                      <FilePreviewLazy
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
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <ResizablePanelGroup
                key={`layout-${isTreeVisible ? 'tree' : 'notree'}-${isListCompact ? 'compact' : 'list'}`}
                direction="horizontal"
                className="h-full"
                autoSaveId={`library-panels-${isTreeVisible ? '3' : '2'}-${isListCompact ? 'c' : 'n'}`}
              >
                {isTreeVisible && (
                  <>
                    <ResizablePanel key={`tree-panel-${isTreeVisible ? 't' : 'nt'}`} id="tree" defaultSize={15} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle key="tree-handle" />
                  </>
                )}
                <>
                  <ResizablePanel key={`list-panel-${isListCompact ? 'c' : 'n'}-${isTreeVisible ? 't' : 'nt'}`} id="list" defaultSize={isListCompact ? 15 : 30} minSize={15} className="min-h-0 transition-[flex-basis] duration-200 ease-in-out">
                    <div className="h-full overflow-auto flex flex-col">
                      <FileList compact={isListCompact} />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle key="list-preview-handle" />
                </>
                <ResizablePanel key={`preview-panel-${isListCompact ? 'c' : 'n'}-${isTreeVisible ? 't' : 'nt'}`} id="preview" defaultSize={(() => {
                  const tree = isTreeVisible ? 15 : 0;
                  const list = isListCompact ? 15 : 30;
                  const rest = Math.max(10, 100 - (tree + list));
                  return rest;
                })()} className="min-h-0 transition-[flex-basis] duration-200 ease-in-out">
                  <div className="h-full relative flex flex-col">
                    {selectedFile ? (
                      <FilePreviewLazy
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
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
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
      <IngestionDialog />
    </div>
  );
}