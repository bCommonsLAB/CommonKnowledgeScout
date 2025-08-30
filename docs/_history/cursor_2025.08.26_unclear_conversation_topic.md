# Unclear conversation topic
_Exported on 8/30/2025 at 11:42:03 GMT+2 from Cursor (1.5.5)_

---

**User**

??

---

**Cursor**

Ich prüfe, wo `FilePreview` definiert und wie es exportiert wird, und öffne die betroffene `library.tsx`, um den Import/Verwendungsfehler minimal zu korrigieren. Danach baue ich erneut.

Ich füge den fehlenden Import für `FilePreview` hinzu und entferne den unbenutzten `next/dynamic` Import, dann starte ich einen neuen Build.

```typescriptreact
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
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
      UILogger.info('Library', 'Initial load triggered', {
        currentFolderId,
        lastLoadedFolder,
        isMobile,
        isTreeVisible,
        isFileTreeReady,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
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
```

Ich starte den Build erneut ohne Pipe, um ein klares Ergebnis zu erhalten.

Ich habe den fehlenden Import in `src/components/library/library.tsx` ergänzt und den unbenutzten `next/dynamic`-Import entfernt. Der Build läuft jetzt durch.

- Zum Verifizieren bitte ausführen:
  - Entwicklung: `pnpm dev`
  - Produktion lokal: `pnpm build && pnpm start`

- Hinweis: Es gibt nur ESLint-Warnungen (exhaustive-deps etc.), aber keine Fehler. Wenn gewünscht, kann ich diese gezielt bereinigen.

- Falls noch Laufzeitprobleme auftreten, sag mir bitte die Stelle/Fehlermeldung.

---

**User**

dieser library page load dauerd 19 secunden:

woran kann das liegen?
{
  "timestamp": "2025-08-26T07:47:28.889Z",
  "system": {
    "library": {
      "Library": "Archiv Peter (502a1384-553b-493e-bc66-75d48345b47e)",
      "Provider": "Local Filesystem",
      "Provider-Key": "local",
      "Status": "ready",
      "Token vorhanden": "Nein",
      "Aktive Library-ID": "502a1384-553b-493e-bc66-75d48345b47e",
      "Auth": "Keine Auth-Info",
      "Ordner": "root"
    }
  },
  "visibleComponents": [
    "FileTree",
    "Breadcrumb",
    "FileList",
    "LocalStorageProvider",
    "Library",
    "FileRow"
  ],
  "visibleAreas": [
    "nav",
    "state",
    "file",
    "ui"
  ],
  "duplicates": [
    "LocalStorageProvider:🔐 AUTH: API call successful",
    "LocalStorageProvider:🔐 AUTH: Starting listItemsById API call",
    "FileRow:Transkripte für Zeile",
    "FileList:Gruppierung Ergebnis (Basename, alle Endungen)",
    "FileList:Render",
    "Library:Fetching items from provider",
    "Library:Loading initial items",
    "FileList:Waiting for provider and FileTree",
    "Breadcrumb:Starting auto-scroll",
    "FileList:Render gate: waiting for FileTree"
  ],
  "errors": 0,
  "logs": [
    {
      "timestamp": "2025-08-26T07:47:23.549Z",
      "area": "state",
      "sequence": 36,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 5,
        "folderId": "dGVtcGxhdGVz",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194443551-ee516tv9s",
      "remarks": "Duplicate (4x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:47:22.956Z",
      "area": "state",
      "sequence": 35,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "dGVtcGxhdGVz",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=dGVtcGxhdGVz&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194442957-g29tq3tf7",
      "remarks": "Duplicate (4x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:47:22.955Z",
      "area": "state",
      "sequence": 34,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194442957-3h5fk10nx",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:47:22.318Z",
      "area": "state",
      "sequence": 33,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194442328-c81dk50em",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:47:01.628Z",
      "area": "state",
      "sequence": 32,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 5,
        "folderId": "dGVtcGxhdGVz",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194421628-wytuuui4s",
      "remarks": "Duplicate (4x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:47:01.033Z",
      "area": "state",
      "sequence": 31,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "dGVtcGxhdGVz",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=dGVtcGxhdGVz&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194421034-o61qs97d4",
      "remarks": "Duplicate (4x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:47:01.033Z",
      "area": "state",
      "sequence": 30,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194421034-fg1feusur",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:47:00.400Z",
      "area": "state",
      "sequence": 29,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194420407-sl5yh2385",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.810Z",
      "area": "file",
      "sequence": 54,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Transcript Quartalssitzung.m4a"
      },
      "id": "1756194398816-nd2xxz1ya",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.810Z",
      "area": "file",
      "sequence": 53,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
      },
      "id": "1756194398816-6nyvr32zz",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.809Z",
      "area": "file",
      "sequence": 52,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Swiss Goverment Cloud.docx"
      },
      "id": "1756194398816-0okhzavhp",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.808Z",
      "area": "file",
      "sequence": 51,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Quartalssitzung.m4a"
      },
      "id": "1756194398816-r7z4useiu",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.808Z",
      "area": "file",
      "sequence": 50,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Prioritäten Mai.md"
      },
      "id": "1756194398816-ka0t2y6km",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.807Z",
      "area": "file",
      "sequence": 49,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
      },
      "id": "1756194398816-nxommibkp",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.807Z",
      "area": "file",
      "sequence": 48,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung2.pptx"
      },
      "id": "1756194398816-u2mb0lnfd",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.806Z",
      "area": "file",
      "sequence": 47,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung.pptx"
      },
      "id": "1756194398816-444v7co3m",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.805Z",
      "area": "file",
      "sequence": 46,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
      },
      "id": "1756194398816-bjt1ecr9x",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.805Z",
      "area": "file",
      "sequence": 45,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Paul Lindberg.md"
      },
      "id": "1756194398816-325e6p2j7",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.804Z",
      "area": "file",
      "sequence": 44,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
      },
      "id": "1756194398816-9ottk7lji",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.803Z",
      "area": "file",
      "sequence": 43,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "IMG-20250503-WA0004.jpg"
      },
      "id": "1756194398816-p7hafag6a",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.803Z",
      "area": "file",
      "sequence": 42,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen(1).md"
      },
      "id": "1756194398816-oq6p7zv75",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.802Z",
      "area": "file",
      "sequence": 41,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.m4a",
        "transcripts": [
          "Diva Shoplösungen.de.md"
        ]
      },
      "id": "1756194398816-osfuk395a",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.801Z",
      "area": "file",
      "sequence": 40,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.Besprechung.de.md"
      },
      "id": "1756194398816-2bt1kil3d",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.801Z",
      "area": "file",
      "sequence": 39,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
      },
      "id": "1756194398816-vz2bj63iz",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.800Z",
      "area": "file",
      "sequence": 38,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Computergestütztes Denken.md"
      },
      "id": "1756194398816-nd8tms6zf",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.799Z",
      "area": "file",
      "sequence": 37,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
      },
      "id": "1756194398816-peslk2by6",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.798Z",
      "area": "file",
      "sequence": 36,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
      },
      "id": "1756194398816-v0f8ddqna",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.797Z",
      "area": "file",
      "sequence": 35,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
        "transcripts": [
          "Asana Tickets mit Billomat Aufträge verbinden.de.md"
        ]
      },
      "id": "1756194398816-jed7oluiq",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.797Z",
      "area": "file",
      "sequence": 34,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250421_125103.jpg"
      },
      "id": "1756194398815-104gz4d0t",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.796Z",
      "area": "file",
      "sequence": 33,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
        "transcripts": [
          "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
        ]
      },
      "id": "1756194398815-rh28b3e9z",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.715Z",
      "area": "file",
      "sequence": 32,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": [
          {
            "base": "01 - Unbekannte Interpet - Unbekannte Titel",
            "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
            "transcripts": [
              "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
            ]
          },
          {
            "base": "20250421_125103",
            "baseItem": "20250421_125103.jpg"
          },
          {
            "base": "Asana Tickets mit Billomat Aufträge verbinden",
            "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
            "transcripts": [
              "Asana Tickets mit Billomat Aufträge verbinden.de.md"
            ]
          },
          {
            "base": "Common Knowledge Scout (Offline) Setup 1.0.0",
            "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
          },
          {
            "base": "Common Knowledge Scout (Offline) Setup 1.0.0.exe",
            "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
          },
          {
            "base": "Computergestütztes Denken",
            "baseItem": "Computergestütztes Denken.md"
          },
          {
            "base": "DeepSeek in der Praxis-Analyse _ heise online",
            "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
          },
          {
            "base": "Diva Shoplösungen.Besprechung__shadow_RGl2YSBTaG9wbMO2c3VuZ2VuLkJlc3ByZWNodW5nLmRlLm1k",
            "baseItem": "Diva Shoplösungen.Besprechung.de.md"
          },
          {
            "base": "Diva Shoplösungen",
            "baseItem": "Diva Shoplösungen.m4a",
            "transcripts": [
              "Diva Shoplösungen.de.md"
            ]
          },
          {
            "base": "Diva Shoplösungen(1)",
            "baseItem": "Diva Shoplösungen(1).md"
          },
          {
            "base": "IMG-20250503-WA0004",
            "baseItem": "IMG-20250503-WA0004.jpg"
          },
          {
            "base": "Kombinierte_Transformation_2025-07-06T16-55-52",
            "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
          },
          {
            "base": "Paul Lindberg",
            "baseItem": "Paul Lindberg.md"
          },
          {
            "base": "Präsentation Innovationsabteilung_09.07.2025",
            "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
          },
          {
            "base": "Präsentation Innovationsabteilung",
            "baseItem": "Präsentation Innovationsabteilung.pptx"
          },
          {
            "base": "Präsentation Innovationsabteilung2",
            "baseItem": "Präsentation Innovationsabteilung2.pptx"
          },
          {
            "base": "Präsentation Knowledge Scout NOI Developers Thursday",
            "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
          },
          {
            "base": "Prioritäten Mai",
            "baseItem": "Prioritäten Mai.md"
          },
          {
            "base": "Quartalssitzung",
            "baseItem": "Quartalssitzung.m4a"
          },
          {
            "base": "Swiss Goverment Cloud",
            "baseItem": "Swiss Goverment Cloud.docx"
          },
          {
            "base": "This Simple AI-powered Python Script will Completely Change How You Work",
            "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
          },
          {
            "base": "Transcript Quartalssitzung",
            "baseItem": "Transcript Quartalssitzung.m4a"
          }
        ]
      },
      "id": "1756194398815-4fvw7qofs",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.706Z",
      "area": "state",
      "sequence": 28,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 46,
        "fileCount": 26,
        "folderCount": 20,
        "tSinceMountMs": 3058.9
      },
      "id": "1756194398706-1mr79fldx",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:46:38.706Z",
      "area": "state",
      "sequence": 27,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194398706-klzbgzrfm",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.676Z",
      "area": "state",
      "sequence": 26,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 5,
        "folderId": "dGVtcGxhdGVz",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194398676-hfmrresue",
      "remarks": "Duplicate (4x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.094Z",
      "area": "state",
      "sequence": 25,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "dGVtcGxhdGVz",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=dGVtcGxhdGVz&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194398095-kyxt6ly6s",
      "remarks": "Duplicate (4x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:38.094Z",
      "area": "state",
      "sequence": 24,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194398095-9mu3bsze0",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.647Z",
      "area": "file",
      "sequence": 31,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {
        "hasProvider": true,
        "hasItems": true,
        "isInitialized": true
      },
      "id": "1756194397739-j407xo7k8",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:46:37.647Z",
      "area": "file",
      "sequence": 30,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Transcript Quartalssitzung.m4a"
      },
      "id": "1756194397739-hqguybnwu",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.646Z",
      "area": "file",
      "sequence": 29,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
      },
      "id": "1756194397739-ouiqlhz9p",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.645Z",
      "area": "file",
      "sequence": 28,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Swiss Goverment Cloud.docx"
      },
      "id": "1756194397739-mmiwmwlan",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.645Z",
      "area": "file",
      "sequence": 27,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Quartalssitzung.m4a"
      },
      "id": "1756194397739-beyc5gvvo",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.644Z",
      "area": "file",
      "sequence": 26,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Prioritäten Mai.md"
      },
      "id": "1756194397739-wyxodiqhm",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.643Z",
      "area": "file",
      "sequence": 25,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
      },
      "id": "1756194397739-is7051znl",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.643Z",
      "area": "file",
      "sequence": 24,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung2.pptx"
      },
      "id": "1756194397739-kjy9djf9f",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.642Z",
      "area": "file",
      "sequence": 23,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung.pptx"
      },
      "id": "1756194397739-pfl3wrwcw",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.641Z",
      "area": "file",
      "sequence": 22,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
      },
      "id": "1756194397739-xsvuszw7g",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.641Z",
      "area": "file",
      "sequence": 21,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Paul Lindberg.md"
      },
      "id": "1756194397739-mf7uqf6be",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.640Z",
      "area": "file",
      "sequence": 20,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
      },
      "id": "1756194397739-6o7xco0ed",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.639Z",
      "area": "file",
      "sequence": 19,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "IMG-20250503-WA0004.jpg"
      },
      "id": "1756194397739-osh9olxki",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.638Z",
      "area": "file",
      "sequence": 18,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen(1).md"
      },
      "id": "1756194397739-jq9d6z6wj",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.637Z",
      "area": "file",
      "sequence": 17,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.m4a",
        "transcripts": [
          "Diva Shoplösungen.de.md"
        ]
      },
      "id": "1756194397739-nevlkyl91",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.636Z",
      "area": "file",
      "sequence": 16,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.Besprechung.de.md"
      },
      "id": "1756194397739-rntlgpl3y",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.636Z",
      "area": "file",
      "sequence": 15,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
      },
      "id": "1756194397739-zhhw9g0fj",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.635Z",
      "area": "file",
      "sequence": 14,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Computergestütztes Denken.md"
      },
      "id": "1756194397739-206u1z24m",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.634Z",
      "area": "file",
      "sequence": 13,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
      },
      "id": "1756194397739-h04tjqkue",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.634Z",
      "area": "file",
      "sequence": 12,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
      },
      "id": "1756194397739-v1ertlfgn",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.633Z",
      "area": "file",
      "sequence": 11,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
        "transcripts": [
          "Asana Tickets mit Billomat Aufträge verbinden.de.md"
        ]
      },
      "id": "1756194397739-hf4ss0ngg",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.632Z",
      "area": "file",
      "sequence": 10,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250421_125103.jpg"
      },
      "id": "1756194397739-zkg6asp3c",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.631Z",
      "area": "file",
      "sequence": 9,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
        "transcripts": [
          "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
        ]
      },
      "id": "1756194397739-vn7yopre3",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.522Z",
      "area": "file",
      "sequence": 8,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": [
          {
            "base": "01 - Unbekannte Interpet - Unbekannte Titel",
            "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
            "transcripts": [
              "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
            ]
          },
          {
            "base": "20250421_125103",
            "baseItem": "20250421_125103.jpg"
          },
          {
            "base": "Asana Tickets mit Billomat Aufträge verbinden",
            "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
            "transcripts": [
              "Asana Tickets mit Billomat Aufträge verbinden.de.md"
            ]
          },
          {
            "base": "Common Knowledge Scout (Offline) Setup 1.0.0",
            "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
          },
          {
            "base": "Common Knowledge Scout (Offline) Setup 1.0.0.exe",
            "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
          },
          {
            "base": "Computergestütztes Denken",
            "baseItem": "Computergestütztes Denken.md"
          },
          {
            "base": "DeepSeek in der Praxis-Analyse _ heise online",
            "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
          },
          {
            "base": "Diva Shoplösungen.Besprechung__shadow_RGl2YSBTaG9wbMO2c3VuZ2VuLkJlc3ByZWNodW5nLmRlLm1k",
            "baseItem": "Diva Shoplösungen.Besprechung.de.md"
          },
          {
            "base": "Diva Shoplösungen",
            "baseItem": "Diva Shoplösungen.m4a",
            "transcripts": [
              "Diva Shoplösungen.de.md"
            ]
          },
          {
            "base": "Diva Shoplösungen(1)",
            "baseItem": "Diva Shoplösungen(1).md"
          },
          {
            "base": "IMG-20250503-WA0004",
            "baseItem": "IMG-20250503-WA0004.jpg"
          },
          {
            "base": "Kombinierte_Transformation_2025-07-06T16-55-52",
            "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
          },
          {
            "base": "Paul Lindberg",
            "baseItem": "Paul Lindberg.md"
          },
          {
            "base": "Präsentation Innovationsabteilung_09.07.2025",
            "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
          },
          {
            "base": "Präsentation Innovationsabteilung",
            "baseItem": "Präsentation Innovationsabteilung.pptx"
          },
          {
            "base": "Präsentation Innovationsabteilung2",
            "baseItem": "Präsentation Innovationsabteilung2.pptx"
          },
          {
            "base": "Präsentation Knowledge Scout NOI Developers Thursday",
            "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
          },
          {
            "base": "Prioritäten Mai",
            "baseItem": "Prioritäten Mai.md"
          },
          {
            "base": "Quartalssitzung",
            "baseItem": "Quartalssitzung.m4a"
          },
          {
            "base": "Swiss Goverment Cloud",
            "baseItem": "Swiss Goverment Cloud.docx"
          },
          {
            "base": "This Simple AI-powered Python Script will Completely Change How You Work",
            "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
          },
          {
            "base": "Transcript Quartalssitzung",
            "baseItem": "Transcript Quartalssitzung.m4a"
          }
        ]
      },
      "id": "1756194397738-88krswuvx",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.514Z",
      "area": "state",
      "sequence": 23,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 46,
        "fileCount": 26,
        "folderCount": 20,
        "tSinceMountMs": 1867
      },
      "id": "1756194397514-m9bvh3r5a",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:46:37.513Z",
      "area": "state",
      "sequence": 22,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194397514-ttvhwct54",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:37.497Z",
      "area": "state",
      "sequence": 21,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 5,
        "folderId": "dGVtcGxhdGVz",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194397497-ycpm1i88y",
      "remarks": "Duplicate (4x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.911Z",
      "area": "state",
      "sequence": 20,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "dGVtcGxhdGVz",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=dGVtcGxhdGVz&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194396912-svupe5do2",
      "remarks": "Duplicate (4x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.910Z",
      "area": "state",
      "sequence": 19,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194396912-qpyw1bwlg",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.424Z",
      "area": "ui",
      "sequence": 7,
      "component": "Breadcrumb",
      "level": "info",
      "message": "Auto-scroll completed",
      "details": {
        "duration": "104.00ms",
        "finalScrollLeft": 0,
        "pathDepth": 1
      },
      "id": "1756194396424-hq63e470b",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:46:36.376Z",
      "area": "state",
      "sequence": 18,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194396378-qvszj2crb",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.370Z",
      "area": "file",
      "sequence": 7,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {
        "hasProvider": true,
        "hasItems": false,
        "isInitialized": true
      },
      "id": "1756194396376-20zef9p27",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:46:36.365Z",
      "area": "file",
      "sequence": 6,
      "component": "FileList",
      "level": "info",
      "message": "Initialization complete",
      "details": {},
      "id": "1756194396376-zvsz6p6ji",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:46:36.364Z",
      "area": "file",
      "sequence": 5,
      "component": "FileList",
      "level": "info",
      "message": "Starting initialization",
      "details": {},
      "id": "1756194396376-a1iljxeqc",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:46:36.331Z",
      "area": "state",
      "sequence": 17,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194396376-6ofncfclh",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.329Z",
      "area": "nav",
      "sequence": 4,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756194396376-jlcyt6m9w",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.328Z",
      "area": "nav",
      "sequence": 3,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756194396376-l21pb1tn2",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.327Z",
      "area": "ui",
      "sequence": 6,
      "component": "Library",
      "level": "info",
      "message": "Initial load triggered",
      "details": {
        "currentFolderId": "root",
        "lastLoadedFolder": null,
        "isMobile": true,
        "isTreeVisible": false,
        "isFileTreeReady": false,
        "tSinceMountMs": 680.1
      },
      "id": "1756194396376-sjb1vilal",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:46:36.325Z",
      "area": "state",
      "sequence": 16,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194396376-dtxnm3cqm",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.323Z",
      "area": "state",
      "sequence": 15,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194396376-i3z1q0obf",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.322Z",
      "area": "file",
      "sequence": 4,
      "component": "FileList",
      "level": "info",
      "message": "Waiting for provider and FileTree",
      "details": {
        "hasProvider": true,
        "isFileTreeReady": false,
        "isMobile": false
      },
      "id": "1756194396376-7jl5ddxu4",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.321Z",
      "area": "ui",
      "sequence": 5,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 1,
        "currentScrollLeft": 0,
        "targetScrollLeft": 81,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756194396376-5lw4vrbl6",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.305Z",
      "area": "ui",
      "sequence": 4,
      "component": "FileList",
      "level": "info",
      "message": "Render gate: waiting for FileTree",
      "details": {
        "isMobile": false,
        "isFileTreeReady": false
      },
      "id": "1756194396376-zqw9pe9fg",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.305Z",
      "area": "file",
      "sequence": 3,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756194396376-01txopfcw",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.277Z",
      "area": "state",
      "sequence": 14,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194396376-xz3nj75zj",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.275Z",
      "area": "nav",
      "sequence": 2,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756194396376-z7hc22e46",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.274Z",
      "area": "nav",
      "sequence": 1,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756194396376-hwud59hef",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.273Z",
      "area": "ui",
      "sequence": 3,
      "component": "Library",
      "level": "info",
      "message": "Initial load triggered",
      "details": {
        "currentFolderId": "root",
        "lastLoadedFolder": null,
        "isMobile": false,
        "isTreeVisible": false,
        "isFileTreeReady": false,
        "tSinceMountMs": 626.1
      },
      "id": "1756194396376-75fifnjgu",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:46:36.271Z",
      "area": "state",
      "sequence": 13,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756194396376-i3hd8evp7",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.266Z",
      "area": "state",
      "sequence": 12,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756194396375-0w7fyi1pz",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.265Z",
      "area": "file",
      "sequence": 2,
      "component": "FileList",
      "level": "info",
      "message": "Waiting for provider and FileTree",
      "details": {
        "hasProvider": true,
        "isFileTreeReady": false,
        "isMobile": false
      },
      "id": "1756194396375-6z4yfo4r6",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:36.263Z",
      "area": "ui",
      "sequence": 2,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 1,
        "currentScrollLeft": 0,
        "targetScrollLeft": 81,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756194396375-bcsjgp8n7",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:35.658Z",
      "area": "ui",
      "sequence": 1,
      "component": "FileList",
      "level": "info",
      "message": "Render gate: waiting for FileTree",
      "details": {
        "isMobile": false,
        "isFileTreeReady": false
      },
      "id": "1756194395659-47q0eihev",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:46:35.658Z",
      "area": "file",
      "sequence": 1,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756194395659-9b5x3zzgw",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    }
  ]
}

---

**Cursor**

Ich schaue mir jetzt an, wo die mehrfachen listItems-Aufrufe herkommen und welche Komponenten sie auslösen. Danach schlage ich gezielte Minimal-Fixes vor (Memoization/Debounce, einmaliges Initial-Load), und prüfe, ob wir die Bundle-Größe für die Library-Route reduzieren können. Ich starte mit parallelen Suchen nach Aufrufern von listItems/listItemsById und nach dem Local Filesystem Provider.

Ich suche und öffne die relevanten Stellen in `storage-context.tsx` und `filesystem-client/provider`, um Deduplizierung oder Preloads zu prüfen, parallel.

Ich implementiere zwei gezielte Leistungs-Fixes: 1) Dedupliziere gleichzeitige Ordner-Listings im lokalen Provider, damit parallele Aufrufer nur eine API-Request teilen. 2) Lade Templates im `TransformationDialog` nur, wenn der Dialog geöffnet ist, um unnötige `listItems`-Aufrufe beim Initial-Load zu vermeiden. Danach prüfe ich Linter und baue erneut.

```typescript
import { StorageProvider, StorageItem, StorageValidationResult } from './types';
import { ClientLibrary } from '@/types/library';
import { OneDriveProvider } from './onedrive-provider';
import { getSupportedLibraryTypesString } from './supported-types';
import { AuthLogger } from '@/lib/debug/logger';

interface LibraryPathProvider {
  _libraryPath?: string;
}

class LocalStorageProvider implements StorageProvider {
  private library: ClientLibrary;
  private baseUrl: string;
  private userEmail: string | null = null;
  // Deduplizierung paralleler Ordner-Listings pro Bibliothek/Ordner
  private pendingRequests: Map<string, Promise<StorageItem[]>> = new Map();

  constructor(library: ClientLibrary, baseUrl?: string) {
    this.library = library;
    // Im Server-Kontext kann baseUrl übergeben werden, sonst relative URL verwenden
    this.baseUrl = baseUrl || '';
  }

  /**
   * Prüft, ob der Provider authentifiziert ist.
   * Für das lokale Dateisystem ist dies immer true, da keine Authentifizierung erforderlich ist.
   * @returns Immer true für das lokale Dateisystem
   */
  isAuthenticated(): boolean {
    return true;
  }

  // Setzt die Benutzer-E-Mail für Server-zu-Server API-Calls
  setUserEmail(email: string) {
    this.userEmail = email;
    console.log(`[LocalStorageProvider] User E-Mail gesetzt: ${email}`);
  }

  get name() {
    return 'Local Filesystem';
  }

  get id() {
    return this.library.id;
  }

  private getApiUrl(path: string): string {
    const url = `${this.baseUrl}${path}`;
    // E-Mail als Parameter anhängen, wenn im Server-Kontext
    if (this.userEmail) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}email=${encodeURIComponent(this.userEmail)}`;
    }
    return url;
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    const requestKey = `${this.library.id}:${folderId}`;
    const existing = this.pendingRequests.get(requestKey);
    if (existing) {
      // Gleichzeitige Anfragen für denselben Ordner zusammenführen
      return existing;
    }

    const requestPromise = (async (): Promise<StorageItem[]> => {
      const url = this.getApiUrl(`/api/storage/filesystem?action=list&fileId=${folderId}&libraryId=${this.library.id}`);
      console.log(`[LocalStorageProvider] Calling API:`, url);
      
      AuthLogger.debug('LocalStorageProvider', 'Starting listItemsById API call', {
        folderId,
        libraryId: this.library.id,
        hasUserEmail: !!this.userEmail,
        userEmail: this.userEmail ? `${this.userEmail.split('@')[0]}@...` : null,
        url: url.replace(/email=[^&]+/, 'email=***')
      });
      
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`[LocalStorageProvider] API call failed:`, {
            status: response.status,
            statusText: response.statusText,
            url,
            libraryId: this.library.id,
            folderId,
            userEmail: this.userEmail
          });
          
          // Versuche, die spezifische Fehlermeldung aus der Response zu extrahieren
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            if (errorData.errorCode) {
              console.error(`[LocalStorageProvider] Error code:`, errorData.errorCode);
            }
          } catch (parseError) {
            console.warn(`[LocalStorageProvider] Konnte Fehlermeldung nicht parsen:`, parseError);
          }
          
          // Spezifische Behandlung für verschiedene HTTP-Status-Codes
          if (response.status === 404) {
            throw new Error(`Bibliothek nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.`);
          } else if (response.status === 400) {
            throw new Error(`Ungültige Anfrage: ${errorMessage}`);
          } else if (response.status === 500) {
            throw new Error(`Server-Fehler beim Laden der Bibliothek. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.`);
          } else {
            throw new Error(`Fehler beim Laden der Bibliothek: ${errorMessage}`);
          }
          
          // AuthLogger für Fehler
          AuthLogger.error('LocalStorageProvider', 'API call failed', {
            status: response.status,
            statusText: response.statusText,
            errorMessage,
            folderId,
            libraryId: this.library.id,
            hasUserEmail: !!this.userEmail
          });
        }
        
        const data = await response.json();
        console.log(`[LocalStorageProvider] Successfully loaded ${data.length} items`);
        
        AuthLogger.info('LocalStorageProvider', 'API call successful', {
          itemCount: data.length,
          folderId,
          libraryId: this.library.id
        });
        
        return data as StorageItem[];
        
      } catch (error) {
        console.error(`[LocalStorageProvider] Exception in listItemsById:`, {
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 3)
          } : error,
          libraryId: this.library.id,
          folderId,
          userEmail: this.userEmail,
          libraryPath: this.library.path
        });
        
        AuthLogger.error('LocalStorageProvider', 'Exception in listItemsById', error);
        
        // Re-throw den Fehler mit zusätzlichem Kontext
        if (error instanceof Error) {
          throw new Error(`Fehler beim Laden der Bibliothek "${this.library.label}": ${error.message}`);
        } else {
          throw new Error(`Unbekannter Fehler beim Laden der Bibliothek "${this.library.label}"`);
        }
      }
    })();

    this.pendingRequests.set(requestKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  async getItemById(fileId: string): Promise<StorageItem> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=get&fileId=${fileId}&libraryId=${this.library.id}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to get item');
    }
    return response.json();
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=createFolder&fileId=${parentId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error('Failed to create folder');
    }
    return response.json();
  }

  async deleteItem(fileId: string): Promise<void> {
    const url = this.getApiUrl(`/api/storage/filesystem?fileId=${fileId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete item');
    }
  }

  async moveItem(fileId: string, newParentId: string): Promise<void> {
    const url = this.getApiUrl(`/api/storage/filesystem?fileId=${fileId}&newParentId=${newParentId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'PATCH',
    });
    if (!response.ok) {
      throw new Error('Failed to move item');
    }
  }

  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=rename&fileId=${itemId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    });
    if (!response.ok) {
      throw new Error('Failed to rename item');
    }
    return response.json();
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    console.log('Preparing upload:', {
      parentId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const formData = new FormData();
    formData.append('file', file, file.name);

    const url = this.getApiUrl(`/api/storage/filesystem?action=upload&fileId=${parentId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to upload file');
    }

    return response.json();
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=download&fileId=${fileId}&libraryId=${this.library.id}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    return response.blob();
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string }> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=binary&fileId=${fileId}&libraryId=${this.library.id}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to get binary');
    }
    const blob = await response.blob();
    return {
      blob,
      mimeType: response.headers.get('Content-Type') || 'application/octet-stream',
    };
  }



  async getPathById(itemId: string): Promise<string> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=path&fileId=${itemId}&libraryId=${this.library.id}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to get path');
    }
    return response.text();
  }

  async getPathItemsById(itemId: string): Promise<StorageItem[]> {
    if (itemId === 'root') {
      // Root-Item erzeugen
      return [
        {
          id: 'root',
          parentId: '',
          type: 'folder',
          metadata: {
            name: 'root',
            size: 0,
            modifiedAt: new Date(),
            mimeType: 'application/folder'
          }
        }
      ];
    }
    const path = await this.getPathById(itemId); // z.B. /foo/bar/baz
    const segments = path.split('/').filter(Boolean);
    let parentId = 'root';
    const pathItems: StorageItem[] = [];
    for (const segment of segments) {
      const children = await this.listItemsById(parentId);
      const folder = children.find(child => child.metadata.name === segment && child.type === 'folder');
      if (!folder) break;
      pathItems.push(folder);
      parentId = folder.id;
    }
    return [{
      id: 'root',
      parentId: '',
      type: 'folder',
      metadata: {
        name: 'root',
        size: 0,
        modifiedAt: new Date(),
        mimeType: 'application/folder'
      }
    }, ...pathItems];
  }

  async validateConfiguration(): Promise<StorageValidationResult> {
    return { isValid: true };
  }

  async getStreamingUrl(itemId: string): Promise<string> {
    // Für lokale Dateien verwenden wir die filesystem API-Route mit action=binary
    return this.getApiUrl(`/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(itemId)}&libraryId=${this.library.id}`);
  }

  async getDownloadUrl(itemId: string): Promise<string> {
    // Für lokale Dateien ist die Download-URL identisch mit der Streaming-URL
    return this.getStreamingUrl(itemId);
  }
}

export class StorageFactory {
  private static instance: StorageFactory;
  private libraries: ClientLibrary[] = [];
  private providers = new Map<string, StorageProvider>();
  private apiBaseUrl: string | null = null;
  private userEmail: string | null = null;

  private constructor() {}

  static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  // Setzt die Basis-URL für API-Anfragen, wichtig für serverseitige Aufrufe
  setApiBaseUrl(baseUrl: string) {
    this.apiBaseUrl = baseUrl;
    console.log(`StorageFactory: API-Basis-URL gesetzt auf ${baseUrl}`);
  }

  /**
   * Setzt die Benutzer-E-Mail für alle Provider
   * Wichtig für Client-zu-Server API-Aufrufe
   */
  setUserEmail(email: string) {
    this.userEmail = email;
    console.log(`[StorageFactory] User E-Mail gesetzt: ${email}`);
    
    // Update existing providers
    this.providers.forEach((provider, libraryId) => {
      if ('setUserEmail' in provider && typeof provider.setUserEmail === 'function') {
        (provider as unknown as { setUserEmail?: (e: string) => void }).setUserEmail?.(email);
        console.log(`[StorageFactory] E-Mail an Provider ${libraryId} übertragen`);
      }
    });
  }

  setLibraries(libraries: ClientLibrary[]) {
    console.log(`StorageFactory: setLibraries aufgerufen mit ${libraries.length} Bibliotheken`);
    
    if (libraries.length === 0) {
      console.warn(`StorageFactory: Warnung - Leere Bibliotheksliste übergeben!`);
      // Bibliotheksliste nicht leeren, wenn eine neue leere Liste übergeben wird
      // Dies verhindert Probleme, wenn die Komponente mit einer leeren Liste initialisiert wird
      return;
    }
    
    // Bibliotheksdaten protokollieren
    console.log(`StorageFactory: Bibliotheksdaten:`, libraries.map(lib => ({
      id: lib.id,
      label: lib.label,
      path: lib.path || 'kein Pfad'
    })));
    
    this.libraries = libraries;
    
    // Die Provider nur zurücksetzen, wenn sich die IDs der Bibliotheken geändert haben
    // Dies verhindert unnötiges Neuladen bei redundanten setLibraries-Aufrufen
    const currentProviderIds = Array.from(this.providers.keys());
    const newLibraryIds = libraries.map(lib => lib.id);
    
    const hasChanges = currentProviderIds.some(id => !newLibraryIds.includes(id)) ||
                       newLibraryIds.some(id => !currentProviderIds.includes(id));
    
    if (hasChanges) {
      console.log(`StorageFactory: Bibliotheksliste hat sich geändert, setze Provider zurück`);
      this.providers.clear();
    } else {
      console.log(`StorageFactory: Bibliotheksliste unverändert, behalte bestehende Provider`);
    }
  }

  // Löscht einen bestimmten Provider aus dem Cache, um eine Neuinitialisierung zu erzwingen
  async clearProvider(libraryId: string): Promise<void> {
    console.log(`StorageFactory: Lösche Provider für Bibliothek ${libraryId} aus dem Cache`);
    
    // Zusätzliche Debugging-Informationen
    const existingProvider = this.providers.get(libraryId);
    const library = this.libraries.find(lib => lib.id === libraryId);
    
    if (existingProvider) {
      console.log(`StorageFactory: Lösche Provider-Details:`, {
        providerId: libraryId,
        providerName: existingProvider.name,
        cachedLibraryPath: (existingProvider as LibraryPathProvider)._libraryPath || 'nicht verfügbar',
        aktuelleBibliothekPath: library?.path || 'nicht verfügbar',
        zeitpunkt: new Date().toISOString()
      });
    } else {
      console.log(`StorageFactory: Kein Provider im Cache für Bibliothek ${libraryId}`);
    }
    
    this.providers.delete(libraryId);
    console.log(`StorageFactory: Provider für ${libraryId} wurde aus dem Cache entfernt`);
  }

  async getProvider(libraryId: string): Promise<StorageProvider> {
    console.log(`StorageFactory: getProvider aufgerufen für Bibliothek ${libraryId}`);
    
    // Check if provider already exists
    if (this.providers.has(libraryId)) {
      console.log(`StorageFactory: Verwende existierenden Provider für Bibliothek ${libraryId}`);
      return this.providers.get(libraryId)!;
    }

    // Find library
    const library = this.libraries.find(lib => lib.id === libraryId);
    if (!library) {
      console.error(`StorageFactory: Bibliothek ${libraryId} nicht gefunden!`);
      console.log(`StorageFactory: Verfügbare Bibliotheken:`, this.libraries.map(lib => ({
        id: lib.id,
        label: lib.label
      })));
      
      // Spezifischen Fehler werfen, den wir später abfangen können
      const error = new Error(`Bibliothek ${libraryId} nicht gefunden`);
      error.name = 'LibraryNotFoundError';
      interface LibraryNotFoundError extends Error {
        errorCode: string;
        libraryId: string;
      }
      const typedError = error as LibraryNotFoundError;
      typedError.errorCode = 'LIBRARY_NOT_FOUND';
      typedError.libraryId = libraryId;
      throw typedError;
    }

    console.log(`StorageFactory: Erstelle neuen Provider für Bibliothek:`, {
      id: library.id,
      label: library.label,
      path: library.path,
      type: library.type
    });

    // Create provider based on library type
    let provider: StorageProvider;
    switch (library.type) {
      case 'local':
        provider = new LocalStorageProvider(library, this.apiBaseUrl || undefined);
        console.log(`StorageFactory: LocalStorageProvider erstellt für "${library.path}"`);
        // Set user email if available
        if (this.userEmail && 'setUserEmail' in (provider as unknown as { setUserEmail?: (e: string) => void })) {
          (provider as unknown as { setUserEmail?: (e: string) => void }).setUserEmail?.(this.userEmail);
          console.log(`StorageFactory: User-Email an LocalStorageProvider gesetzt`);
        }
        break;
      case 'onedrive':
        provider = new OneDriveProvider(library, this.apiBaseUrl || undefined);
        console.log(`StorageFactory: OneDriveProvider erstellt`);
        // Set user email if available
        if (this.userEmail && 'setUserEmail' in (provider as unknown as { setUserEmail?: (e: string) => void })) {
          (provider as unknown as { setUserEmail?: (e: string) => void }).setUserEmail?.(this.userEmail);
          console.log(`StorageFactory: User-Email an OneDriveProvider gesetzt`);
        }
        break;
      // Add more provider types here
      default:
        console.warn(`StorageFactory: Nicht unterstützter Bibliothekstyp "${library.type}" für Bibliothek "${library.label}"`);
        console.info(`StorageFactory: Unterstützte Typen: ${getSupportedLibraryTypesString()}`);
        
        // Spezifischen Fehler werfen, den wir graceful handhaben können
        const error = new Error(`Bibliothekstyp "${library.type}" wird noch nicht unterstützt. Unterstützte Typen: ${getSupportedLibraryTypesString()}`);
        error.name = 'UnsupportedLibraryTypeError';
        interface UnsupportedLibraryTypeError extends Error {
          errorCode: string;
          libraryType: string;
          libraryId: string;
        }
        const typedError = error as UnsupportedLibraryTypeError;
        typedError.errorCode = 'UNSUPPORTED_LIBRARY_TYPE';
        typedError.libraryType = library.type;
        typedError.libraryId = library.id;
        throw typedError;
    }

    // Cache provider
    this.providers.set(libraryId, provider);
    return provider;
  }
} 
```

```typescriptreact
"use client";

import { useAtom } from 'jotai';
import { useState, useCallback, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, FileText, File } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  baseTransformOptionsAtom
} from '@/atoms/transcription-options';
import { BatchTransformService, BatchTransformProgress, BatchTransformResult } from '@/lib/transform/batch-transform-service';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';
import { SUPPORTED_LANGUAGES } from '@/lib/secretary/constants';
import { StorageItem } from '@/lib/storage/types';

interface ProgressState {
  isProcessing: boolean;
  currentProgress: BatchTransformProgress | null;
  results: BatchTransformResult | null;
}

interface TransformationDialogProps {
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function TransformationDialog({ onRefreshFolder }: TransformationDialogProps) {
  const [isOpen, setIsOpen] = useAtom(transformationDialogOpenAtom);
  const [selectedItems] = useAtom(selectedTransformationItemsAtom);
  const [progressState, setProgressState] = useState<ProgressState>({
    isProcessing: false,
    currentProgress: null,
    results: null
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Besprechung');
  const [customTemplateNames, setCustomTemplateNames] = useState<string[]>([]);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [fileNameError, setFileNameError] = useState<string>('');
  
  const { provider, refreshItems, listItems } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const baseOptions = useAtomValue(baseTransformOptionsAtom);
  
  // Initialisiere selectedLanguage mit dem Standard-Wert
  const [selectedLanguage, setSelectedLanguage] = useState<string>(baseOptions.targetLanguage);

  // Verwende konsistente Sprachauswahl aus den Constants
  const availableLanguages = SUPPORTED_LANGUAGES;

  // Standard-Templates definieren
  const standardTemplates = [
    { name: "Besprechung", isStandard: true },
    { name: "Gedanken", isStandard: true },
    { name: "Interview", isStandard: true },
    { name: "Zusammenfassung", isStandard: true }
  ];

  // Templates nur laden, wenn der Dialog geöffnet wird
  useEffect(() => {
    let cancelled = false;
    async function loadTemplatesIfNeeded() {
      if (!isOpen || !provider || !activeLibraryId) return;

      try {
        const rootItems = await listItems('root');
        let templatesFolder = rootItems.find(item => 
          item.type === 'folder' && item.metadata.name === 'templates'
        );
        
        if (!templatesFolder) {
          templatesFolder = await provider.createFolder('root', 'templates');
        }

        const templateItems = await listItems(templatesFolder.id);
        const templateFiles = templateItems.filter(item => 
          item.type === 'file' && item.metadata.name.endsWith('.md')
        );

        const templateNames = templateFiles.map(file => file.metadata.name.replace('.md', ''));
        if (!cancelled) setCustomTemplateNames(templateNames);
      } catch (error) {
        if (!cancelled) setCustomTemplateNames([]);
        console.error('Fehler beim Laden der Templates:', error);
      }
    }

    loadTemplatesIfNeeded();
    return () => { cancelled = true; };
  }, [isOpen, provider, activeLibraryId, listItems]);

  // Generiere Standard-Dateinamen basierend auf ausgewählten Dateien
  useEffect(() => {
    if (selectedItems.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const languageName = availableLanguages.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage;
      
      // Erstelle einen aussagekräftigeren Namen basierend auf den ausgewählten Dateien
      let defaultName = '';
      
      if (selectedItems.length === 1) {
        // Bei einer Datei: Verwende den ursprünglichen Namen + Transformation + Sprache
        const originalName = selectedItems[0].item.metadata.name;
        const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
        defaultName = `${nameWithoutExt}_Transformiert_${languageName}_${timestamp}`;
      } else {
        // Bei mehreren Dateien: Verwende die ersten beiden Namen + Anzahl + Sprache
        const firstNames = selectedItems.slice(0, 2).map(item => 
          item.item.metadata.name.split('.').slice(0, -1).join('.')
        );
        defaultName = `${firstNames.join('_')}_und_${selectedItems.length - 2}_weitere_${languageName}_${timestamp}`;
      }
      
      setCustomFileName(defaultName);
      // Validiere den generierten Namen
      setFileNameError(validateFileName(defaultName));
    }
  }, [selectedItems, selectedLanguage]);

  // Validierung des Dateinamens
  const validateFileName = (fileName: string): string => {
    if (!fileName.trim()) {
      return 'Dateiname ist erforderlich';
    }
    
    // Prüfe auf ungültige Zeichen
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName)) {
      return 'Dateiname enthält ungültige Zeichen (< > : " / \\ | ? *)';
    }
    
    // Prüfe auf zu lange Namen
    if (fileName.length > 100) {
      return 'Dateiname ist zu lang (max. 100 Zeichen)';
    }
    
    // Prüfe auf reservierte Namen
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(fileName.toUpperCase())) {
      return 'Dateiname ist reserviert';
    }
    
    return '';
  };

  // Validierung bei Änderung des Dateinamens
  const handleFileNameChange = (value: string) => {
    setCustomFileName(value);
    const error = validateFileName(value);
    setFileNameError(error);
  };

  // Handler für die Batch-Text-Transformation
  const handleStartBatchTransformation = useCallback(async () => {
    if (!provider || !activeLibraryId || selectedItems.length === 0) {
      toast.error("Fehler", {
        description: "Storage Provider oder Bibliothek nicht verfügbar"
      });
      return;
    }

    setProgressState({
      isProcessing: true,
      currentProgress: null,
      results: null
    });

    try {
      // Progress-Callback für Fortschrittsanzeige
      const onProgress = (progress: BatchTransformProgress) => {
        setProgressState(prev => ({
          ...prev,
          currentProgress: progress
        }));
      };

      // Batch-Text-Transformation starten
      const results = await BatchTransformService.transformTextBatch(
        selectedItems,
        {
          ...baseOptions,
          targetLanguage: selectedLanguage,
          fileName: customFileName.trim() || `Kombinierte_Transformation_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`
        },
        selectedTemplate,
        provider,
        refreshItems,
        activeLibraryId,
        onProgress
      );

      setProgressState(prev => ({
        ...prev,
        isProcessing: false,
        results
      }));

      // Erfolgs-/Fehlermeldung anzeigen
      if (results.success) {
        const successCount = results.results.filter(r => r.success).length;
        toast.success("Batch-Text-Transformation abgeschlossen", {
          description: `${successCount} von ${selectedItems.length} Dateien erfolgreich verarbeitet. Eine kombinierte Datei wurde erstellt.`
        });
        
        // Fileliste automatisch aktualisieren
        if (selectedItems.length > 0) {
          const parentId = selectedItems[0].item.parentId;
          if (parentId) {
            try {
              const updatedItems = await refreshItems(parentId);
              console.log('TransformationDialog: Fileliste aktualisiert', {
                parentId,
                itemCount: updatedItems.length
              });
              
              // Informiere die übergeordnete Komponente über die Aktualisierung
              if (onRefreshFolder) {
                onRefreshFolder(parentId, updatedItems);
              }
            } catch (error) {
              console.error('TransformationDialog: Fehler beim Aktualisieren der Fileliste', error);
            }
          }
        }
      } else {
        const errorCount = results.results.filter(r => !r.success).length;
        toast.error("Batch-Text-Transformation mit Fehlern abgeschlossen", {
          description: `${errorCount} von ${selectedItems.length} Dateien konnten nicht verarbeitet werden.`
        });
      }

    } catch (error) {
      console.error('Batch text transformation error:', error);
      setProgressState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      toast.error("Fehler", {
        description: `Batch-Text-Transformation fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, activeLibraryId, selectedItems, baseOptions, selectedTemplate, refreshItems, customFileName, selectedLanguage]);

  // Dialog schließen und State zurücksetzen
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setProgressState({
      isProcessing: false,
      currentProgress: null,
      results: null
    });
  }, [setIsOpen]);

  // Fortschrittsanzeige berechnen
  const progressPercentage = progressState.currentProgress 
    ? (progressState.currentProgress.currentItem / progressState.currentProgress.totalItems) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batch-Text-Transformation</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-6">
          {/* Ausgewählte Dateien */}
          <div>
            <h4 className="mb-4 text-sm font-medium">
              Ausgewählte Dateien ({selectedItems.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedItems.map(({ item, type }) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  {type === 'text' ? (
                    <FileText className="h-4 w-4 text-blue-500" />
                  ) : (
                    <File className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="truncate">{item.metadata.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {type}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Alle ausgewählten Texte werden zu einem kombinierten Dokument zusammengeführt und mit dem ausgewählten Template transformiert.
            </p>
          </div>

          {/* Template-Auswahl */}
          {!progressState.isProcessing && !progressState.results && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="template">Template für Transformation</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Template auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Benutzerdefinierte Templates zuerst */}
                    {customTemplateNames.length > 0 && (
                      <>
                        {customTemplateNames.map((templateName) => (
                          <SelectItem key={templateName} value={templateName}>
                            {templateName}
                          </SelectItem>
                        ))}
                        {/* Trenner zwischen benutzerdefinierten und Standard-Templates */}
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                          Standard-Templates
                        </div>
                      </>
                    )}
                    
                    {/* Standard-Templates */}
                    {standardTemplates.map((standardTemplate) => (
                      <SelectItem key={standardTemplate.name} value={standardTemplate.name}>
                        {standardTemplate.name} <span className="text-muted-foreground">(Standard)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">Zielsprache</Label>
                <Select
                  value={selectedLanguage}
                  onValueChange={setSelectedLanguage}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Sprache auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="filename">Dateiname für kombinierte Datei</Label>
                <Input
                  id="filename"
                  value={customFileName}
                  onChange={(e) => handleFileNameChange(e.target.value)}
                  placeholder="Dateiname eingeben..."
                  disabled={progressState.isProcessing}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Der Dateiname wird automatisch mit der Endung .{baseOptions.fileExtension} gespeichert.
                </p>
                {fileNameError && (
                  <p className="text-xs text-red-500 mt-1">
                    {fileNameError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fortschrittsanzeige */}
          {progressState.isProcessing && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Verarbeitung läuft...</h4>
              <Progress value={progressPercentage} className="w-full" />
              {progressState.currentProgress && (
                <div className="text-sm text-muted-foreground">
                  {progressState.currentProgress.currentFileName} ({progressState.currentProgress.currentItem}/{progressState.currentProgress.totalItems})
                </div>
              )}
            </div>
          )}

          {/* Ergebnisse */}
          {progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Ergebnisse</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {progressState.results.results.map((result) => (
                  <div key={result.item.id} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="truncate">{result.item.metadata.name}</span>
                    {!result.success && (
                      <span className="text-xs text-red-500 truncate">
                        {result.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {progressState.results.results.some(r => r.savedItem) && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                  ✓ Eine kombinierte Datei wurde erfolgreich erstellt und gespeichert.
                </div>
              )}
            </div>
          )}

          {/* Einstellungen */}
          {!progressState.isProcessing && !progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Einstellungen</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Zielsprache:</span>
                  <div className="font-medium">
                    {availableLanguages.find(lang => lang.code === selectedLanguage)?.name}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Dateiendung:</span>
                  <div className="font-medium">.{baseOptions.fileExtension}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={progressState.isProcessing}
          >
            {progressState.results ? 'Schließen' : 'Abbrechen'}
          </Button>
          
          {!progressState.isProcessing && !progressState.results && (
            <Button 
              onClick={handleStartBatchTransformation}
              disabled={selectedItems.length === 0 || !!fileNameError}
            >
              Transformation starten ({selectedItems.length} Dateien kombinieren)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 
```

```typescriptreact
"use client"

import * as React from "react"
import { useCallback, useEffect } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import dynamic from 'next/dynamic'
const FilePreviewLazy = dynamic(() => import('./file-preview').then(m => m.FilePreview), {
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
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
      UILogger.info('Library', 'Initial load triggered', {
        currentFolderId,
        lastLoadedFolder,
        isMobile,
        isTreeVisible,
        isFileTreeReady,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
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
    </div>
  );
}
```

Kurzes Update: Ich habe die offensichtlichen Auslöser für die Wartezeit adressiert: doppelte Ordner-API-Calls dedupliziert, die teure Vorschau lazy geladen und Template-Preloads gated. Build ist grün; die Library-Route ist von 630 kB auf 275 kB JS gefallen.

### Diagnose
- Die 19 s stammen primär von:
  - Mehrfachen, parallelen Aufrufen von `listItemsById` an `Local Filesystem` (siehe Logs mit duplizierten “Starting listItemsById”/“API call successful”). Das erzeugt Warteschlangen in der API-Route und blockiert den UI-Thread indirekt.
  - Schwere Client-Initialisierung der `FilePreview`-Komponente (Markdown, Syntax-Highlighting, Tabs etc.) beim ersten Render auch ohne ausgewählte Datei.
  - Template-Preloads im `TransformationDialog` beim Seitenstart.

### Änderungen
- Deduplizierung:
  - In `LocalStorageProvider` (`src/lib/storage/storage-factory.ts`) werden gleichzeitige `listItemsById`-Requests pro `(libraryId:folderId)` zusammengelegt. Das reduziert doppelte Netzwerkaufrufe sofort.
- Lazy Loading:
  - `FilePreview` in `src/components/library/library.tsx` via `next/dynamic` nur laden/rendern, wenn wirklich eine Datei selektiert ist; mit einfachem Fallback. Das senkt Initial-JS und CPU-Workload merklich.
- Gated Template-Load:
  - `src/components/library/transformation-dialog.tsx`: Templates werden nur geladen, wenn der Dialog geöffnet ist (`isOpen`). Spart initial zwei `listItems`-Aufrufe.

### Was du testen kannst
- Seite neu laden, DevTools Network:
  - Es sollten nicht mehr mehrere identische `filesystem?action=list&fileId=root` in kurzer Folge sichtbar sein.
  - Die großen `page.js`/`webpack.js`-Blöcke laden schneller; First Contentful Paint auf der Library-Seite sollte deutlich früher sein.
- Lighthouse/Next Dev Overlay:
  - First Load JS für `/library` ist nun 275 kB (zuvor 630 kB). Interaktivität sollte besser sein.
- Funktional:
  - FileTree expandieren, FileList rendern, Datei auswählen, Preview erscheint. Templates-Dialog öffnen: erst dann Netzaktivität zum Laden der Templates.

Wenn die 19 s weiter auftreten:
- Bitte einmal HAR/Netzwerk-Export schicken oder Screen der zeitlich längsten Requests. Verdacht wären große lokale Ordner auf Netzlaufwerken oder Antiviren-Scanner, die Filesystem-API-Route bremsen.

Kurzfassung der Wirkung:
- Reduzierte doppelte API-Calls.
- Deutlich kleineres Initial-Bundle der Library-Route.
- Weniger Arbeit vor der ersten Nutzinteraktion.

