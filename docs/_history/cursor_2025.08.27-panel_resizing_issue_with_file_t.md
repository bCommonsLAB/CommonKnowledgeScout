# Panel resizing issue with file tree
_Exported on 8/30/2025 at 11:40:18 GMT+2 from Cursor (1.5.5)_

---

**User**

@library/ Normalerweise kann ich in der Library diese Panelbreiten durch die Maus horizontal verschieben einstellen. Jetzt ist es so, wenn der FileTree eingeblendet ist, dann stimmt, wenn ich die rechte Panel-Trennung zwischen FileListe und FilePreview auswähle und verschieben will, wird die linke Panel-Trennung verschoben. Wenn ich hingegen den FileTree ausblende, dann stimmt es. Es scheint, dass die Maus einfach auf das erste oder zweite Panel greift, aber nicht berücksichtigt, wie viele Panels jetzt überhaupt im Hintergrund angezeigt werden. Da stimmt irgendwas nicht in der Frontend-Logik.

---

**Cursor**

Ich suche die Resizable-Komponenten und die Panel-Struktur, um den falschen Handle-Drag bei eingeblendetem FileTree zu reproduzieren und die Ursache (IDs, autoSave, DOM-Struktur) zu finden. Danach passe ich die Panel/Handle-Deklaration an (z. B. stabile IDs/Keys oder bedingtes Rendering vermeiden).

Ich lese die Implementierung der Resizable-Komponenten und die Nutzung in `library.tsx`, um den Maus-Handle-Bug zu lokalisieren. Danach passe ich gezielt die Panel/Handle-IDs oder das Remounting an.

Ich aktualisiere die Resizable-Panel-Gruppe in `src/components/library/library.tsx`: separate autoSaveId für 2- vs 3-Panel-Layout und explizite keys für Panels/Handles, um falsches Handle-Mapping zu vermeiden. Danach prüfe ich Linter.

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
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [mobileView, setMobileView] = React.useState<'list' | 'preview'>('list');
  const loadInFlightRef = React.useRef<boolean>(false);

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

    loadInFlightRef.current = true;
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
      loadInFlightRef.current = false;
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
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems]);

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
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

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
              <ResizablePanelGroup direction="horizontal" className="h-full" autoSaveId={isTreeVisible ? "library-panels-3" : "library-panels-2"}>
                {isTreeVisible && (
                  <>
                    <ResizablePanel key="tree-panel" id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle key="tree-handle" />
                  </>
                )}
                <ResizablePanel key="list-panel" id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle key="list-preview-handle" />
                <ResizablePanel key="preview-panel" id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
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

- Ich habe die Ursache im dynamischen Panel-Setup gefunden: Beim Ein-/Ausblenden des `FileTree` ändert sich die Panel-Anzahl. Ohne stabile IDs/Keys und getrennte Persistenz-IDs kann das Handle-Mapping von react-resizable-panels durcheinander geraten. Das erklärt, warum bei sichtbarem Tree der falsche Splitter bewegt wird.

- Änderung umgesetzt:
  - In `src/components/library/library.tsx` habe ich für das 2-Panel- (ohne Tree) und 3-Panel-Layout (mit Tree) unterschiedliche `autoSaveId` gesetzt: `"library-panels-2"` vs `"library-panels-3"`.
  - Ich habe explizite `key`-Props an die relevanten `ResizablePanel` und `ResizableHandle` Elemente vergeben, damit React beim Toggle nicht recycelt und die Panel/Handle-Instanzen stabil bleiben.
  - Zusätzlich `id` der Panels beibehalten, damit die Library korrekt zuordnen kann.

- Erwartetes Verhalten nach Fix:
  - Mit eingeblendetem `FileTree` bewegt der rechte Splitter ausschließlich die Trennung zwischen FileList und FilePreview.
  - Mit ausgeblendetem `FileTree` bleibt das 2-Panel-Layout konsistent.

Bitte einmal im UI testen:
- Tree einblenden → rechten Splitter ziehen: nur die rechte Trennung sollte reagieren.
- Tree ausblenden → Splitter ziehen: normales Verhalten.
- Zwischen Zuständen wechseln und erneut ziehen, um Persistenz und IDs zu verifizieren.

Kurzfassung der Änderung
- `ResizablePanelGroup`: `autoSaveId={isTreeVisible ? "library-panels-3" : "library-panels-2"}`
- Keys hinzugefügt: `key="tree-panel"`, `key="tree-handle"`, `key="list-panel"`, `key="list-preview-handle"`, `key="preview-panel"`

Status
- Edit fertig, Linter fehlerfrei.
- Wenn der Effekt weiterhin auftritt, prüfen wir als Nächstes eventuelle Kollisionen durch weitere verschachtelte `PanelGroup`s oder fehlende `id`-Einzigartigkeit in anderen Layoutvarianten.

---

**User**

Ok, Initial funktioniert es, aber wenn ich FileTree ausblende und wieder einblende, sind die Panels wieder verschoben. Wenn ich das linke Panel vergrößere, dann wird das rechte rechts vergrößert.

---

**Cursor**

Ich setze einen eindeutigen key auf die ResizablePanelGroup, abhängig von der Tree-Sichtbarkeit, um beim Umschalten einen sauberen Remount und korrektes Handle-Mapping zu erzwingen. Danach prüfe ich den Linter.

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
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [mobileView, setMobileView] = React.useState<'list' | 'preview'>('list');
  const loadInFlightRef = React.useRef<boolean>(false);

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

    loadInFlightRef.current = true;
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
      loadInFlightRef.current = false;
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
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems]);

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
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

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
              <ResizablePanelGroup
                key={isTreeVisible ? 'with-tree' : 'no-tree'}
                direction="horizontal"
                className="h-full"
                autoSaveId={isTreeVisible ? "library-panels-3" : "library-panels-2"}
              >
                {isTreeVisible && (
                  <>
                    <ResizablePanel key="tree-panel" id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle key="tree-handle" />
                  </>
                )}
                <ResizablePanel key="list-panel" id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle key="list-preview-handle" />
                <ResizablePanel key="preview-panel" id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
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

Kurzupdate: Ich habe der `ResizablePanelGroup` einen dynamischen `key` gegeben (`with-tree`/`no-tree`), damit beim Ein-/Ausblenden des FileTree die Gruppe sauber remountet und das Handle-Mapping nicht “verrutscht”. Linter ist grün.

Bitte testen:
- Tree einblenden → rechten Splitter bewegen.
- Tree ausblenden → Splitter bewegen.
- Mehrfach zwischen ein-/ausblenden wechseln und jeweils die Splitter ziehen.
- Achte darauf, ob noch „Spiegel“-Effekte auftreten (links ziehen vergrößert rechts).

Falls es weiterhin auftritt, prüfe ich als Nächstes:
- Feste `order`/`collapsedSize` pro Panel und konsistente `id`-Reihenfolge über beide Layouts.
- Alternativ: Zwei getrennte, bedingte Layout-Blöcke mit identischer Panel-Reihenfolge und eigenem `autoSaveId`, was Reconciliation-Konflikte weiter reduziert.

---

**User**

Ok, und jetzt habe ich dann noch einen Wunsch. Die Verzeichnisstrukturen sind sehr tief. Und wenn ich einen Page Reload mache, wird das aktuelle Verzeichnis wieder auf das Root-Verzeichnis gesetzt. Ok, ich weiß, es ist kompliziert, über diese Verzeichnisse nach unten zu navigieren und diesen State aufzubauen. Können wir das irgendwie genauer analysieren und bei jedem Verzeichniswechsel diesen als Url oben mitführen, um ihn dann auch wieder zu rekonstruieren. Können wir das mal prüfen.

---

**Cursor**

Ich schaue mir an, wie Ordnernavigation aktuell implementiert ist (Hook `use-folder-navigation`) und wo der aktuelle Ordnerzustand gehalten wird, um dann eine URL-Param-Synchronisation (nuqs) für `folderId`/Pfad zu entwerfen. Danach plane ich die minimalen Codeänderungen.

```typescript
*** Begin Patch
*** Update File: src/hooks/use-folder-navigation.ts
@@
-/**
+"use client";
+/**
  * useFolderNavigation Hook
  *
  * Bietet eine zentrale navigateToFolder Funktion, die beim Ordnerwechsel
  * den gesamten Pfad in den folderCache schreibt und currentFolderId setzt.
  *
  * @returns navigateToFolder(folderId: string): Promise<void>
  */
 import { useCallback } from 'react';
 import { useAtom, useSetAtom } from 'jotai';
 import { libraryAtom, currentFolderIdAtom } from '@/atoms/library-atom';
 import { useStorage } from '@/contexts/storage-context';
 import { StateLogger } from '@/lib/debug/logger';
+import { usePathname, useRouter, useSearchParams } from 'next/navigation';
@@
 export function useFolderNavigation() {
   const { provider } = useStorage();
   const [libraryState, setLibraryState] = useAtom(libraryAtom);
   const setCurrentFolderId = useSetAtom(currentFolderIdAtom);
+  const router = useRouter();
+  const pathname = usePathname();
+  const searchParams = useSearchParams();
@@
   const navigateToFolder = useCallback(async (folderId: string) => {
     if (!provider) return;
@@
     if (allInCache && folderCache[folderId]) {
       StateLogger.info('FolderNavigation', 'Cache hit for folder path', { folderId });
       setCurrentFolderId(folderId);
+      // URL-Sync: folderId als Query-Param
+      try {
+        const params = new URLSearchParams(searchParams ?? undefined);
+        params.set('folderId', folderId);
+        router.replace(`${pathname}?${params.toString()}`);
+      } catch {}
       return;
     }
@@
     setLibraryState(state => {
       const newCache = { ...state.folderCache };
       pathItems.forEach(folder => {
         newCache[folder.id] = folder;
       });
       return { ...state, folderCache: newCache };
     });
     setCurrentFolderId(folderId);
+    // URL-Sync: folderId als Query-Param
+    try {
+      const params = new URLSearchParams(searchParams ?? undefined);
+      params.set('folderId', folderId);
+      router.replace(`${pathname}?${params.toString()}`);
+    } catch {}
   }, [provider, setLibraryState, setCurrentFolderId, libraryState.folderCache
-  ]);
+  , router, pathname, searchParams]);
*** End Patch
```

```typescript
"use client";
/**
 * useFolderNavigation Hook
 *
 * Bietet eine zentrale navigateToFolder Funktion, die beim Ordnerwechsel
 * den gesamten Pfad in den folderCache schreibt und currentFolderId setzt.
 *
 * @returns navigateToFolder(folderId: string): Promise<void>
 */
import { useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { libraryAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StateLogger } from '@/lib/debug/logger';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useFolderNavigation() {
  const { provider } = useStorage();
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const setCurrentFolderId = useSetAtom(currentFolderIdAtom);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Navigiert zu einem Ordner, cached den Pfad und setzt currentFolderId
   * @param folderId Ziel-Ordner-ID
   */
  const navigateToFolder = useCallback(async (folderId: string) => {
    if (!provider) return;

    // Prüfe, ob der gesamte Pfad schon im Cache ist
    const folderCache = libraryState.folderCache || {};
    let currentId = folderId;
    let allInCache = true;
    const missingIds: string[] = [];
    while (currentId && currentId !== 'root') {
      if (!folderCache[currentId]) {
        allInCache = false;
        missingIds.push(currentId);
        break;
      }
      currentId = folderCache[currentId].parentId;
    }

    if (allInCache && folderCache[folderId]) {
      StateLogger.info('FolderNavigation', 'Cache hit for folder path', { folderId });
      setCurrentFolderId(folderId);
      // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
      try {
        const params = new URLSearchParams(searchParams ?? undefined);
        params.set('folderId', folderId);
        router.replace(`${pathname}?${params.toString()}`);
      } catch {}
      return;
    }

    StateLogger.info('FolderNavigation', 'Cache miss, loading path from provider', { folderId, missingIds });
    // Sonst wie bisher: API-Call und Cache auffüllen
    const pathItems = await provider.getPathItemsById(folderId);
    setLibraryState(state => {
      const newCache = { ...state.folderCache };
      pathItems.forEach(folder => {
        newCache[folder.id] = folder;
      });
      return { ...state, folderCache: newCache };
    });
    setCurrentFolderId(folderId);
    // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
    try {
      const params = new URLSearchParams(searchParams ?? undefined);
      params.set('folderId', folderId);
      router.replace(`${pathname}?${params.toString()}`);
    } catch {}
  }, [provider, setLibraryState, setCurrentFolderId, libraryState.folderCache, router, pathname, searchParams]);

  return navigateToFolder;
} 
```

```typescriptreact
'use client';

import React, { Suspense } from "react";
import { Library } from "@/components/library/library";
import { useAuth } from "@clerk/nextjs";
import { useAtom, useAtomValue } from "jotai";
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, BookOpen } from "lucide-react";

// Separate Client-Komponente für die URL-Parameter-Logik
function LibraryUrlHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  const { refreshAuthStatus } = useStorage();

  useEffect(() => {
    const urlLibraryId = searchParams?.get('activeLibraryId');
    const urlFolderId = searchParams?.get('folderId');
    
    // activeLibraryId aus der URL verarbeiten
    if (urlLibraryId) {
      setActiveLibraryId(urlLibraryId);
      // Speichere auch im localStorage für zukünftige Seitenaufrufe
      localStorage.setItem('activeLibraryId', urlLibraryId);
      
      // Auth-Status aktualisieren für die neue Library
      refreshAuthStatus();
      // Entferne nur activeLibraryId aus der URL, folderId beibehalten
      try {
        const params = new URLSearchParams(searchParams ?? undefined);
        params.delete('activeLibraryId');
        router.replace(params.size ? `/library?${params.toString()}` : '/library');
      } catch {}
    }

    // Optional: Wenn nur folderId vorhanden ist, nichts tun – die Synchronisation erfolgt über navigateToFolder
  }, [searchParams, setActiveLibraryId, router, refreshAuthStatus]);

  return null;
}

export default function LibraryPage() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoading, error } = useStorage();
  const libraries = useAtomValue(librariesAtom);
  const router = useRouter();

  // Nutze den StorageContext statt eigenes Loading
  if (!isAuthLoaded || isLoading) {
    return <div className="p-8">
      <Skeleton className="h-[500px] w-full" />
    </div>;
  }

  if (!isSignedIn) {
    return <div className="p-8">
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="h-4 w-4" />
        <AlertTitle>Fehler</AlertTitle>
        <AlertDescription>
          Sie müssen angemeldet sein, um auf die Bibliothek zugreifen zu können.
        </AlertDescription>
      </Alert>
    </div>;
  }

  if (error) {
    return <div className="p-8">
      <div className="mb-8">
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    </div>;
  }

  // Zeige eine freundliche Meldung, wenn keine Bibliotheken vorhanden sind
  if (libraries.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle>Keine Bibliotheken vorhanden</CardTitle>
            <CardDescription>
              Erstellen Sie Ihre erste Bibliothek, um mit der Organisation Ihrer Dokumente zu beginnen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              onClick={() => router.push('/settings?newUser=true')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Erste Bibliothek erstellen
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Sie können lokale Ordner oder Cloud-Speicher wie OneDrive verbinden.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Suspense fallback={null}>
        <LibraryUrlHandler />
      </Suspense>
      <div className="flex-1 min-h-0">
        <Library />
      </div>
    </div>
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
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useFolderNavigation } from "@/hooks/use-folder-navigation"
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
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
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
      setIsMobile(matches);
      setIsTreeVisible(!matches);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // URL -> State: folderId aus Query beim Initialisieren anwenden
  React.useEffect(() => {
    const folderIdFromUrl = searchParams?.get('folderId');
    if (folderIdFromUrl && folderIdFromUrl !== currentFolderId) {
      void navigateToFolder(folderIdFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

    loadInFlightRef.current = true;
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
      loadInFlightRef.current = false;
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
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems]);

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
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

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
              <ResizablePanelGroup
                key={isTreeVisible ? 'with-tree' : 'no-tree'}
                direction="horizontal"
                className="h-full"
                autoSaveId={isTreeVisible ? "library-panels-3" : "library-panels-2"}
              >
                {isTreeVisible && (
                  <>
                    <ResizablePanel key="tree-panel" id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle key="tree-handle" />
                  </>
                )}
                <ResizablePanel key="list-panel" id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle key="list-preview-handle" />
                <ResizablePanel key="preview-panel" id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
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

Ich habe zwei Dinge umgesetzt und abgesichert:

1) Panel-Bug bei Tree-Toggle
- Der Splitter-Fehler nach Ein-/Ausblenden des FileTree ist adressiert: Die Panel-Gruppe hat jetzt einen dynamischen key (with-tree/no-tree) und getrennte autoSaveId-Werte. Außerdem haben Panels/Handles stabile keys. Bitte erneut testen:
  - Tree einblenden → rechten Splitter ziehen
  - Tree ausblenden → Splitter ziehen
  - Mehrfach toggeln und testen

2) Ordnerzustand über URL erhalten
- Bei jedem Ordnerwechsel schreibe ich die folderId in die URL (Query-Param).
- Beim Initialisieren lese ich folderId aus der URL und navigiere automatisch dorthin.
- activeLibraryId aus der URL wird wie bisher übernommen; beim Entfernen bleibt folderId erhalten.

So testest du die URL-Sync-Funktion
- In einen tiefen Ordner navigieren → URL enthält ?folderId=...
- Seite neu laden → derselbe Ordner sollte geladen werden.
- URL kopieren und in einem neuen Tab öffnen → identischer Ordner.
- Ordner wechseln → URL aktualisiert sich entsprechend.

Hinweis
- Ich habe bewusst nur folderId synchronisiert (nicht den kompletten Pfad). Das ist robust und minimal-invasiv.
- Beim Bibliothekswechsel bleibt folderId in der URL aktuell erhalten. Wenn du willst, kann ich es so ändern, dass beim Library-Wechsel die folderId auf root zurückgesetzt (oder validiert) wird.

Kurz zusammengefasst
- Fix: Stabiles Handle-Mapping durch dynamischen key/autoSaveId und explizite keys für Panels/Handles.
- Neu: folderId wird in der URL gehalten und beim Reload ausgelesen; Deep-Linking funktioniert.

---

**User**

Es funktioniert noch nicht. Können wir diese Verzeichnis-Wiederherstellung in unserem debug@debug/ @debug/ -Log protokollieren, so kann ich diese Initialisierungsphase hier posten.

---

**Cursor**

Ich werde Debug-Logs in die Navigations-/Initialisierungs-Pfade einfügen, um die Verzeichnis-Wiederherstellung transparent zu machen, und dann kurz prüfen, ob der Linter sauber bleibt.

```typescript
"use client";
/**
 * useFolderNavigation Hook
 *
 * Bietet eine zentrale navigateToFolder Funktion, die beim Ordnerwechsel
 * den gesamten Pfad in den folderCache schreibt und currentFolderId setzt.
 *
 * @returns navigateToFolder(folderId: string): Promise<void>
 */
import { useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { libraryAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { NavigationLogger, StateLogger } from '@/lib/debug/logger';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useFolderNavigation() {
  const { provider } = useStorage();
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const setCurrentFolderId = useSetAtom(currentFolderIdAtom);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Navigiert zu einem Ordner, cached den Pfad und setzt currentFolderId
   * @param folderId Ziel-Ordner-ID
   */
  const navigateToFolder = useCallback(async (folderId: string) => {
    if (!provider) return;

    NavigationLogger.info('debug@nav', 'navigateToFolder called', { folderId });

    // Prüfe, ob der gesamte Pfad schon im Cache ist
    const folderCache = libraryState.folderCache || {};
    let currentId = folderId;
    let allInCache = true;
    const missingIds: string[] = [];
    while (currentId && currentId !== 'root') {
      if (!folderCache[currentId]) {
        allInCache = false;
        missingIds.push(currentId);
        break;
      }
      currentId = folderCache[currentId].parentId;
    }

    if (allInCache && folderCache[folderId]) {
      StateLogger.info('FolderNavigation', 'Cache hit for folder path', { folderId });
      setCurrentFolderId(folderId);
      // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
      try {
        const params = new URLSearchParams(searchParams ?? undefined);
        params.set('folderId', folderId);
        const url = `${pathname}?${params.toString()}`;
        NavigationLogger.debug('debug@nav', 'URL updated (cache hit)', { url, folderId });
        router.replace(url);
      } catch {}
      return;
    }

    StateLogger.info('FolderNavigation', 'Cache miss, loading path from provider', { folderId, missingIds });
    // Sonst wie bisher: API-Call und Cache auffüllen
    const pathItems = await provider.getPathItemsById(folderId);
    NavigationLogger.info('debug@nav', 'Loaded path items for folder', { folderId, pathLength: pathItems.length });
    setLibraryState(state => {
      const newCache = { ...state.folderCache };
      pathItems.forEach(folder => {
        newCache[folder.id] = folder;
      });
      return { ...state, folderCache: newCache };
    });
    setCurrentFolderId(folderId);
    // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
    try {
      const params = new URLSearchParams(searchParams ?? undefined);
      params.set('folderId', folderId);
      const url = `${pathname}?${params.toString()}`;
      NavigationLogger.debug('debug@nav', 'URL updated (cache miss)', { url, folderId });
      router.replace(url);
    } catch {}
  }, [provider, setLibraryState, setCurrentFolderId, libraryState.folderCache, router, pathname, searchParams]);

  return navigateToFolder;
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
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useFolderNavigation } from "@/hooks/use-folder-navigation"
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
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
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
      setIsMobile(matches);
      setIsTreeVisible(!matches);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // URL -> State: folderId aus Query beim Initialisieren anwenden
  React.useEffect(() => {
    const folderIdFromUrl = searchParams?.get('folderId');
    if (folderIdFromUrl && folderIdFromUrl !== currentFolderId) {
      // Debug-Log via NavigationLogger
      NavigationLogger.info('debug@init', 'Applying folderId from URL', {
        folderIdFromUrl,
        currentFolderId
      });
      void navigateToFolder(folderIdFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

    loadInFlightRef.current = true;
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
      loadInFlightRef.current = false;
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
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems]);

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
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

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
              <ResizablePanelGroup
                key={isTreeVisible ? 'with-tree' : 'no-tree'}
                direction="horizontal"
                className="h-full"
                autoSaveId={isTreeVisible ? "library-panels-3" : "library-panels-2"}
              >
                {isTreeVisible && (
                  <>
                    <ResizablePanel key="tree-panel" id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle key="tree-handle" />
                  </>
                )}
                <ResizablePanel key="list-panel" id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle key="list-preview-handle" />
                <ResizablePanel key="preview-panel" id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
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

Kurzupdate: Ich habe ausführliche Debug-Logs für die Verzeichnis-Wiederherstellung ergänzt. Damit kannst du die Initialisierung exakt nachvollziehen.

Was wurde geloggt:
- Beim Initialisieren im `Library`-Component:
  - NavigationLogger.info('debug@init', 'Applying folderId from URL', { folderIdFromUrl, currentFolderId })
- Im Hook `useFolderNavigation`:
  - NavigationLogger.info('debug@nav', 'navigateToFolder called', { folderId })
  - StateLogger.info('FolderNavigation', 'Cache hit for folder path', { folderId }) bzw. 'Cache miss...'
  - NavigationLogger.info('debug@nav', 'Loaded path items for folder', { folderId, pathLength })
  - NavigationLogger.debug('debug@nav', 'URL updated (cache hit)', { url, folderId })
  - NavigationLogger.debug('debug@nav', 'URL updated (cache miss)', { url, folderId })

So testest du und sammelst Logs:
1) Debug-Panel öffnen (unten) und Tab "System/Performance" nutzen.
2) Seite mit URL `.../library?folderId=<tiefesVerzeichnis>` laden.
3) Beobachte die oben genannten debug@init/debug@nav-Einträge.
4) Ordner wechseln; die URL sollte sich aktualisieren, Logs zeigen Cache-Hit/-Miss inklusive Pfadlänge.
5) Seite neu laden; dieselben Logs sollten den Wiederherstellungspfad dokumentieren.

Wenn du mir die Sequenz aus dem Debug-Panel kopierst, kann ich die genaue Stelle identifizieren, an der die Wiederherstellung abbiegt bzw. nicht angewendet wird.

---

**User**

ok, sieht man was?
{
  "timestamp": "2025-08-27T10:06:13.904Z",
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
    "Library:Waiting for initialization",
    "FileList:Render",
    "Breadcrumb:Starting auto-scroll"
  ],
  "errors": 0,
  "logs": [
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 29,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Transcript Quartalssitzung.m4a"
      },
      "id": "1756289162833-1bxvmdq15",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 28,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
      },
      "id": "1756289162833-7yglqqjbj",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 27,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Swiss Goverment Cloud.docx"
      },
      "id": "1756289162833-j7my663u4",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 26,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Quartalssitzung.m4a"
      },
      "id": "1756289162833-mswabiejc",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 25,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Prioritäten Mai.md"
      },
      "id": "1756289162833-s2o12pd7h",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 24,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
      },
      "id": "1756289162833-kc6eiiqbd",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 23,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung2.pptx"
      },
      "id": "1756289162833-ks9veblny",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 22,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung.pptx"
      },
      "id": "1756289162833-cwj074zak",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 21,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
      },
      "id": "1756289162833-u7y67ke0o",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 20,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Paul Lindberg.md"
      },
      "id": "1756289162833-dpdsvds57",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 19,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
      },
      "id": "1756289162833-5rks99smi",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 18,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "IMG-20250503-WA0004.jpg"
      },
      "id": "1756289162833-6cbkc7vcf",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 17,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen(1).md"
      },
      "id": "1756289162833-5vhbyf3c2",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 16,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.m4a",
        "transcripts": [
          "Diva Shoplösungen.de.md"
        ]
      },
      "id": "1756289162833-zrg9jzdkf",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 15,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.Besprechung.de.md"
      },
      "id": "1756289162833-yfxjv902u",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 14,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
      },
      "id": "1756289162833-aj4fb3wev",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 13,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Computergestütztes Denken.md"
      },
      "id": "1756289162833-mn6cm0kkv",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 12,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
      },
      "id": "1756289162833-93frjfn82",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 11,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
      },
      "id": "1756289162833-udmou73od",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 10,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
        "transcripts": [
          "Asana Tickets mit Billomat Aufträge verbinden.de.md"
        ]
      },
      "id": "1756289162833-1fo01h1mo",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 9,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250421_125103.jpg"
      },
      "id": "1756289162833-xqajlrqqs",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 8,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
        "transcripts": [
          "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
        ]
      },
      "id": "1756289162833-g4paxhxok",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.749Z",
      "area": "file",
      "sequence": 7,
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
      "id": "1756289162833-o8qdb9j4k",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.740Z",
      "area": "state",
      "sequence": 17,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 46,
        "fileCount": 26,
        "folderCount": 20,
        "tSinceMountMs": 1235.3
      },
      "id": "1756289162833-d8e3yf8bw",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.739Z",
      "area": "state",
      "sequence": 16,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289162740-vob3imyvt",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.676Z",
      "area": "ui",
      "sequence": 5,
      "component": "Breadcrumb",
      "level": "info",
      "message": "Auto-scroll completed",
      "details": {
        "duration": "113.00ms",
        "finalScrollLeft": 0,
        "pathDepth": 1
      },
      "id": "1756289161676-qy2ll11vd",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.594Z",
      "area": "file",
      "sequence": 6,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {},
      "id": "1756289161595-59mz418bi",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "nav",
      "sequence": 8,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756289161595-lft1k3eiz",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "nav",
      "sequence": 7,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756289161595-6bxfy34zi",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "ui",
      "sequence": 4,
      "component": "Library",
      "level": "info",
      "message": "Initial load triggered",
      "details": {
        "currentFolderId": "root",
        "lastLoadedFolder": null,
        "tSinceMountMs": 79.7
      },
      "id": "1756289161595-cxgmv8uca",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "file",
      "sequence": 5,
      "component": "FileList",
      "level": "info",
      "message": "Initialization complete",
      "details": {},
      "id": "1756289161595-kxs8lq1bk",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "file",
      "sequence": 4,
      "component": "FileList",
      "level": "info",
      "message": "Starting initialization",
      "details": {},
      "id": "1756289161595-qtign27zv",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.583Z",
      "area": "state",
      "sequence": 15,
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
      "id": "1756289161595-sfthgpmjo",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.583Z",
      "area": "ui",
      "sequence": 3,
      "component": "FileTree",
      "level": "info",
      "message": "Starting root load",
      "details": {
        "hasProvider": true,
        "isReady": false
      },
      "id": "1756289161595-wrtgiwq6p",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.575Z",
      "area": "nav",
      "sequence": 6,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "ready"
      },
      "id": "1756289161594-qb4mqkc3v",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.568Z",
      "area": "state",
      "sequence": 14,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289161575-t52s16bam",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.564Z",
      "area": "nav",
      "sequence": 5,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "ready"
      },
      "id": "1756289161568-wa38ex3yy",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.564Z",
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
      "id": "1756289161568-63v17xydv",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.545Z",
      "area": "nav",
      "sequence": 4,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "ready"
      },
      "id": "1756289161568-199hycr7p",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.545Z",
      "area": "state",
      "sequence": 13,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289161568-34zzm9bam",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.545Z",
      "area": "file",
      "sequence": 3,
      "component": "FileList",
      "level": "info",
      "message": "Waiting for provider",
      "details": {},
      "id": "1756289161568-x12egn0eo",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.544Z",
      "area": "file",
      "sequence": 2,
      "component": "FileTree",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289161568-skcazm0f3",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.544Z",
      "area": "ui",
      "sequence": 1,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 1,
        "currentScrollLeft": 0,
        "targetScrollLeft": 81,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756289161568-yzvmu958a",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.533Z",
      "area": "file",
      "sequence": 1,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756289161568-3nszg8yn3",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.517Z",
      "area": "nav",
      "sequence": 3,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "initializing"
      },
      "id": "1756289161568-tiez6hjo3",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.508Z",
      "area": "state",
      "sequence": 12,
      "component": "Library",
      "level": "info",
      "message": "Active library changed - reset initial load state",
      "details": {
        "activeLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "currentFolderId": "root"
      },
      "id": "1756289161568-8clliqdjq",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.508Z",
      "area": "nav",
      "sequence": 2,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "initializing"
      },
      "id": "1756289161568-zxywfnt69",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    }
  ]
}

---

**Cursor**

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
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useFolderNavigation } from "@/hooks/use-folder-navigation"
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
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
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
      setIsMobile(matches);
      setIsTreeVisible(!matches);
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

    loadInFlightRef.current = true;
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
      loadInFlightRef.current = false;
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
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems]);

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
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

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
              <ResizablePanelGroup
                key={isTreeVisible ? 'with-tree' : 'no-tree'}
                direction="horizontal"
                className="h-full"
                autoSaveId={isTreeVisible ? "library-panels-3" : "library-panels-2"}
              >
                {isTreeVisible && (
                  <>
                    <ResizablePanel key="tree-panel" id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle key="tree-handle" />
                  </>
                )}
                <ResizablePanel key="list-panel" id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle key="list-preview-handle" />
                <ResizablePanel key="preview-panel" id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
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

Kurz: In deinem Dump sehe ich keine unserer neuen Einträge “debug@init”/“debug@nav”. Vermutlich sind sie im Debug-Panel rausgefiltert.

Bitte so prüfen:
- Debug-Panel öffnen → Components-Liste.
- “debug@init” und “debug@nav” aktivieren.
- Seite mit URL-Param laden (z. B. /library?folderId=<deine-id>).
- Logs erneut kopieren.

Hinweis:
- Ich habe zusätzlich die Anwendung des folderId-Params verzögert, bis der Provider “ready” ist. Damit sollte die Wiederherstellung nach Reload greifen. Bitte nach Aktivierung der beiden Komponenten einmal neu testen.

Kurzfazit
- Aktuell sehe ich nur “root”-Ladevorgang; keine “debug@init”/“debug@nav”-Zeilen = Filter.
- Nach Aktivierung der beiden Komponenten solltest du klare Init-/URL-Sync-Events sehen (apply/defer, cache hit/miss, neue URL).

---

**User**

hier mit unseren logs:
{
  "timestamp": "2025-08-27T10:17:11.310Z",
  "system": {
    "library": {
      "Library": "Archiv Peter (502a1384-553b-493e-bc66-75d48345b47e)",
      "Provider": "Local Filesystem",
      "Provider-Key": "local",
      "Status": "ready",
      "Token vorhanden": "Nein",
      "Aktive Library-ID": "502a1384-553b-493e-bc66-75d48345b47e",
      "Auth": "Keine Auth-Info",
      "Ordner": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU="
    }
  },
  "visibleComponents": [
    "FileTree",
    "Breadcrumb",
    "FileList",
    "LocalStorageProvider",
    "Library",
    "FileRow",
    "debug@nav",
    "debug@init",
    "StorageContext",
    "FolderNavigation"
  ],
  "visibleAreas": [
    "nav",
    "state",
    "file",
    "ui"
  ],
  "duplicates": [
    "Breadcrumb:Starting auto-scroll",
    "FileList:Gruppierung Ergebnis (Basename, alle Endungen)",
    "FileRow:Transkripte für Zeile",
    "LocalStorageProvider:🔐 AUTH: API call successful",
    "FileList:Render",
    "FileList:Already initialized",
    "FileTree:Starting root load",
    "LocalStorageProvider:🔐 AUTH: Starting listItemsById API call",
    "Library:Fetching items from provider",
    "Library:Loading initial items",
    "FileList:Initialization complete",
    "FileList:Starting initialization",
    "FileTree:Bibliothek gewechselt - State zurückgesetzt",
    "Library:Active library changed - reset initial load state",
    "Library:Waiting for initialization"
  ],
  "errors": 0,
  "logs": [
    {
      "timestamp": "2025-08-27T10:07:13.856Z",
      "area": "ui",
      "sequence": 16,
      "component": "Breadcrumb",
      "level": "info",
      "message": "Auto-scroll completed",
      "details": {
        "duration": "120.40ms",
        "finalScrollLeft": 0,
        "pathDepth": 4
      },
      "id": "1756289233856-bfpnm5z6m",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 98,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Todo freitag.Gesprächsanalyse und Next Steps.de.md"
      },
      "id": "1756289233753-bmt5i98qu",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 97,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Todo freitag.m4a",
        "transcripts": [
          "Todo freitag.de.md"
        ]
      },
      "id": "1756289233753-10z5nn9fx",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 96,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Nächsten Schritte Knowledgescout.Gedanken.de.md"
      },
      "id": "1756289233753-ua12wp6zo",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 95,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Nächsten Schritte Knowledgescout.m4a",
        "transcripts": [
          "Nächsten Schritte Knowledgescout.de.md"
        ]
      },
      "id": "1756289233753-w1br35x1h",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 94,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Mind Map.jpg"
      },
      "id": "1756289233753-tqwsrwn7d",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 93,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Main data flow Picture.m4a"
      },
      "id": "1756289233753-00n3xe87d",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 92,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Main data flow Picture_openai.md"
      },
      "id": "1756289233753-66l6fb96w",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 91,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Knowledgw scout - chat.m4a",
        "transcripts": [
          "Knowledgw scout - chat.de.md"
        ]
      },
      "id": "1756289233753-uledst3dj",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 90,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "KnowledgeScout Ux.m4a"
      },
      "id": "1756289233753-qn8q28oy9",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 89,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "KnowledgeScout ShadowTwin.m4a",
        "transcripts": [
          "KnowledgeScout ShadowTwin.de.md"
        ]
      },
      "id": "1756289233753-4mdnnkbr8",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 88,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "KnowledgeScout Kollektiver storage.m4a",
        "transcripts": [
          "KnowledgeScout Kollektiver storage.de.md"
        ]
      },
      "id": "1756289233753-2d726dkcf",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 87,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "KnowledgeScout Dataflow.m4a",
        "transcripts": [
          "KnowledgeScout Dataflow.de.md"
        ]
      },
      "id": "1756289233753-gbhammwtx",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 86,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "gedankenFrühstück.md"
      },
      "id": "1756289233753-bq6azkn1b",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "file",
      "sequence": 85,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Erklärung Mindmap.m4a"
      },
      "id": "1756289233753-bndf9pitz",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.741Z",
      "area": "ui",
      "sequence": 15,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 4,
        "currentScrollLeft": 0,
        "targetScrollLeft": 488,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756289233753-eoa0onmod",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.720Z",
      "area": "file",
      "sequence": 84,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": [
          {
            "base": "Erklärung Mindmap",
            "baseItem": "Erklärung Mindmap.m4a"
          },
          {
            "base": "gedankenFrühstück",
            "baseItem": "gedankenFrühstück.md"
          },
          {
            "base": "KnowledgeScout Dataflow",
            "baseItem": "KnowledgeScout Dataflow.m4a",
            "transcripts": [
              "KnowledgeScout Dataflow.de.md"
            ]
          },
          {
            "base": "KnowledgeScout Kollektiver storage",
            "baseItem": "KnowledgeScout Kollektiver storage.m4a",
            "transcripts": [
              "KnowledgeScout Kollektiver storage.de.md"
            ]
          },
          {
            "base": "KnowledgeScout ShadowTwin",
            "baseItem": "KnowledgeScout ShadowTwin.m4a",
            "transcripts": [
              "KnowledgeScout ShadowTwin.de.md"
            ]
          },
          {
            "base": "KnowledgeScout Ux",
            "baseItem": "KnowledgeScout Ux.m4a"
          },
          {
            "base": "Knowledgw scout - chat",
            "baseItem": "Knowledgw scout - chat.m4a",
            "transcripts": [
              "Knowledgw scout - chat.de.md"
            ]
          },
          {
            "base": "Main data flow Picture_openai",
            "baseItem": "Main data flow Picture_openai.md"
          },
          {
            "base": "Main data flow Picture",
            "baseItem": "Main data flow Picture.m4a"
          },
          {
            "base": "Mind Map",
            "baseItem": "Mind Map.jpg"
          },
          {
            "base": "Nächsten Schritte Knowledgescout",
            "baseItem": "Nächsten Schritte Knowledgescout.m4a",
            "transcripts": [
              "Nächsten Schritte Knowledgescout.de.md"
            ]
          },
          {
            "base": "Nächsten Schritte Knowledgescout.Gedanken__shadow_Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGUvTsOkY2hzdGVuIFNjaHJpdHRlIEtub3dsZWRnZXNjb3V0LkdlZGFua2VuLmRlLm1k",
            "baseItem": "Nächsten Schritte Knowledgescout.Gedanken.de.md"
          },
          {
            "base": "Todo freitag",
            "baseItem": "Todo freitag.m4a",
            "transcripts": [
              "Todo freitag.de.md"
            ]
          },
          {
            "base": "Todo freitag.Gesprächsanalyse und Next Steps__shadow_Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGUvVG9kbyBmcmVpdGFnLkdlc3Byw6RjaHNhbmFseXNlIHVuZCBOZXh0IFN0ZXBzLmRlLm1k",
            "baseItem": "Todo freitag.Gesprächsanalyse und Next Steps.de.md"
          }
        ]
      },
      "id": "1756289233750-gupdkgj1f",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.715Z",
      "area": "state",
      "sequence": 34,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "itemCount": 20,
        "fileCount": 20,
        "folderCount": 0,
        "tSinceMountMs": 1489.7
      },
      "id": "1756289233750-g65lnkn9i",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.714Z",
      "area": "state",
      "sequence": 33,
      "component": "Library",
      "level": "info",
      "message": "Updating folder cache",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "itemCount": 20,
        "cacheSize": 4
      },
      "id": "1756289233750-msuiyq8a2",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.714Z",
      "area": "state",
      "sequence": 32,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 20,
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289233750-be374bwmz",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.713Z",
      "area": "ui",
      "sequence": 14,
      "component": "Breadcrumb",
      "level": "info",
      "message": "Auto-scroll completed",
      "details": {
        "duration": "156.10ms",
        "finalScrollLeft": 0,
        "pathDepth": 1
      },
      "id": "1756289233714-vxolk3ayl",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.559Z",
      "area": "ui",
      "sequence": 13,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 1,
        "currentScrollLeft": 0,
        "targetScrollLeft": 81,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756289233562-0lj0grfmv",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.552Z",
      "area": "file",
      "sequence": 83,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756289233562-5arjxengw",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.548Z",
      "area": "state",
      "sequence": 31,
      "component": "Library",
      "level": "info",
      "message": "Active library changed - reset initial load state",
      "details": {
        "activeLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "currentFolderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU="
      },
      "id": "1756289233562-v5afa8stt",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.547Z",
      "area": "state",
      "sequence": 30,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756289233562-mgp05fsf7",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.547Z",
      "area": "nav",
      "sequence": 16,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "cacheHit": false
      },
      "id": "1756289233562-2q12ih65p",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.547Z",
      "area": "nav",
      "sequence": 15,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU="
      },
      "id": "1756289233562-s0nsdhf7k",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.547Z",
      "area": "ui",
      "sequence": 12,
      "component": "Library",
      "level": "info",
      "message": "Initial load triggered",
      "details": {
        "currentFolderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "lastLoadedFolder": "root",
        "tSinceMountMs": 1322.2
      },
      "id": "1756289233562-t08mhsgm6",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.546Z",
      "area": "ui",
      "sequence": 11,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 4,
        "currentScrollLeft": 0,
        "targetScrollLeft": 488,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756289233562-wlv30f8vu",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.498Z",
      "area": "nav",
      "sequence": 14,
      "component": "debug@nav",
      "level": "debug",
      "message": "URL updated (cache miss)",
      "details": {
        "url": "/library?folderId=Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU%3D",
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU="
      },
      "id": "1756289233562-c86zj6fuh",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.497Z",
      "area": "nav",
      "sequence": 13,
      "component": "debug@nav",
      "level": "info",
      "message": "Loaded path items for folder",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "pathLength": 4
      },
      "id": "1756289233562-10jnbpys6",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.497Z",
      "area": "state",
      "sequence": 29,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 19,
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQ=",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289233562-4kw7n96qh",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.364Z",
      "area": "state",
      "sequence": 28,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQ=",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQ=&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756289233370-qdy5ogh9h",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.364Z",
      "area": "state",
      "sequence": 27,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 14,
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmc=",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289233370-6l1873w41",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.211Z",
      "area": "file",
      "sequence": 82,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Transcript Quartalssitzung.m4a"
      },
      "id": "1756289233256-3rvgyh30o",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.211Z",
      "area": "file",
      "sequence": 81,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
      },
      "id": "1756289233256-mx3ahl3y7",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.211Z",
      "area": "file",
      "sequence": 80,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Swiss Goverment Cloud.docx"
      },
      "id": "1756289233256-0gzvniewc",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.211Z",
      "area": "file",
      "sequence": 79,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Quartalssitzung.m4a"
      },
      "id": "1756289233256-innquwac4",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.211Z",
      "area": "file",
      "sequence": 78,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Prioritäten Mai.md"
      },
      "id": "1756289233256-jtidjeows",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.211Z",
      "area": "file",
      "sequence": 77,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
      },
      "id": "1756289233256-caw45kr5d",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.211Z",
      "area": "file",
      "sequence": 76,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung2.pptx"
      },
      "id": "1756289233256-8jfsx4zzw",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.211Z",
      "area": "file",
      "sequence": 75,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung.pptx"
      },
      "id": "1756289233256-qs65okkfd",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.211Z",
      "area": "file",
      "sequence": 74,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
      },
      "id": "1756289233256-5h0noddnq",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 73,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Paul Lindberg.md"
      },
      "id": "1756289233256-81e6zkwxv",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 72,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
      },
      "id": "1756289233256-fcq2tg103",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 71,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "IMG-20250503-WA0004.jpg"
      },
      "id": "1756289233256-j8meqbwhd",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 70,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen(1).md"
      },
      "id": "1756289233256-jaqazymd5",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 69,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.m4a",
        "transcripts": [
          "Diva Shoplösungen.de.md"
        ]
      },
      "id": "1756289233256-izuvtunt4",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 68,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.Besprechung.de.md"
      },
      "id": "1756289233256-h9m3jcpvd",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 67,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
      },
      "id": "1756289233256-xm4ri55h2",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 66,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Computergestütztes Denken.md"
      },
      "id": "1756289233256-43t6w6iuw",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 65,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
      },
      "id": "1756289233256-x08aldlel",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 64,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
      },
      "id": "1756289233256-uweks9bod",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 63,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
        "transcripts": [
          "Asana Tickets mit Billomat Aufträge verbinden.de.md"
        ]
      },
      "id": "1756289233256-ono6x25wc",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 62,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250421_125103.jpg"
      },
      "id": "1756289233256-zw6txkmpv",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.210Z",
      "area": "file",
      "sequence": 61,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
        "transcripts": [
          "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
        ]
      },
      "id": "1756289233256-en3konkif",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.165Z",
      "area": "file",
      "sequence": 60,
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
      "id": "1756289233256-3195rzdwb",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:13.155Z",
      "area": "state",
      "sequence": 26,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 46,
        "fileCount": 26,
        "folderCount": 20,
        "tSinceMountMs": 930.3
      },
      "id": "1756289233155-gpokvz46m",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.155Z",
      "area": "state",
      "sequence": 25,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmc=",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmc=&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756289233155-09636q2qe",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:13.154Z",
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
      "id": "1756289233155-ijtzqoybs",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.519Z",
      "area": "ui",
      "sequence": 10,
      "component": "Breadcrumb",
      "level": "info",
      "message": "Auto-scroll completed",
      "details": {
        "duration": "150.60ms",
        "finalScrollLeft": 0,
        "pathDepth": 1
      },
      "id": "1756289232525-634eojcr2",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:12.392Z",
      "area": "state",
      "sequence": 23,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289232398-hjt8jtogj",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.381Z",
      "area": "file",
      "sequence": 59,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {},
      "id": "1756289232392-vwt12i0t6",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.381Z",
      "area": "ui",
      "sequence": 9,
      "component": "FileTree",
      "level": "info",
      "message": "Starting root load",
      "details": {
        "hasProvider": true,
        "isReady": false
      },
      "id": "1756289232392-d0zcpzbbi",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.372Z",
      "area": "state",
      "sequence": 22,
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
      "id": "1756289232392-mgh3bv8om",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.372Z",
      "area": "nav",
      "sequence": 12,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756289232392-8xk44u6dh",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.372Z",
      "area": "nav",
      "sequence": 11,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756289232392-f4jxku7qn",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.372Z",
      "area": "ui",
      "sequence": 8,
      "component": "Library",
      "level": "info",
      "message": "Initial load triggered",
      "details": {
        "currentFolderId": "root",
        "lastLoadedFolder": null,
        "tSinceMountMs": 147
      },
      "id": "1756289232392-ubxqbf8g0",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:12.372Z",
      "area": "state",
      "sequence": 21,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289232392-b0x9ugzz3",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.372Z",
      "area": "file",
      "sequence": 58,
      "component": "FileList",
      "level": "info",
      "message": "Initialization complete",
      "details": {},
      "id": "1756289232392-lu8qinvyo",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.372Z",
      "area": "file",
      "sequence": 57,
      "component": "FileList",
      "level": "info",
      "message": "Starting initialization",
      "details": {},
      "id": "1756289232392-kvbogfsrb",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.372Z",
      "area": "file",
      "sequence": 56,
      "component": "FileTree",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289232392-7q7xuud84",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.371Z",
      "area": "ui",
      "sequence": 7,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 1,
        "currentScrollLeft": 0,
        "targetScrollLeft": 81,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756289232392-qo6t26zd7",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.362Z",
      "area": "file",
      "sequence": 55,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756289232391-c2jckp7iv",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.333Z",
      "area": "state",
      "sequence": 20,
      "component": "Library",
      "level": "info",
      "message": "Active library changed - reset initial load state",
      "details": {
        "activeLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "currentFolderId": "root"
      },
      "id": "1756289232391-a56lx0ok7",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.332Z",
      "area": "state",
      "sequence": 19,
      "component": "FolderNavigation",
      "level": "info",
      "message": "Cache miss, loading path from provider",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "missingIds": [
          "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU="
        ]
      },
      "id": "1756289232391-vwy60sgkl",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:12.332Z",
      "area": "nav",
      "sequence": 10,
      "component": "debug@nav",
      "level": "info",
      "message": "navigateToFolder called",
      "details": {
        "folderId": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU="
      },
      "id": "1756289232391-8p2ejuzem",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:12.332Z",
      "area": "nav",
      "sequence": 9,
      "component": "debug@init",
      "level": "info",
      "message": "Applying folderId from URL (ready)",
      "details": {
        "folderIdFromUrl": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "currentFolderId": "root"
      },
      "id": "1756289232391-0ph0izibr",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:07:12.332Z",
      "area": "state",
      "sequence": 18,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289232391-kluhnkev8",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.332Z",
      "area": "file",
      "sequence": 54,
      "component": "FileList",
      "level": "info",
      "message": "Initialization complete",
      "details": {},
      "id": "1756289232391-vmv6uog5u",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.332Z",
      "area": "file",
      "sequence": 53,
      "component": "FileList",
      "level": "info",
      "message": "Starting initialization",
      "details": {},
      "id": "1756289232391-2q32gyl29",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 52,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Transcript Quartalssitzung.m4a"
      },
      "id": "1756289232391-9ags2xk3y",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 51,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
      },
      "id": "1756289232391-6c855o0fa",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 50,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Swiss Goverment Cloud.docx"
      },
      "id": "1756289232391-ipcubrb3d",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 49,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Quartalssitzung.m4a"
      },
      "id": "1756289232391-f3oqjbie3",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 48,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Prioritäten Mai.md"
      },
      "id": "1756289232391-mo48qwdvt",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 47,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
      },
      "id": "1756289232391-uwiu2hgem",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 46,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung2.pptx"
      },
      "id": "1756289232391-hvmcl7ty4",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 45,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung.pptx"
      },
      "id": "1756289232391-x3fac6hqh",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 44,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
      },
      "id": "1756289232391-ekbbp90gf",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 43,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Paul Lindberg.md"
      },
      "id": "1756289232391-g1n64lt9w",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 42,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
      },
      "id": "1756289232391-fmx2lungn",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.331Z",
      "area": "file",
      "sequence": 41,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "IMG-20250503-WA0004.jpg"
      },
      "id": "1756289232391-rlncbxhkb",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.330Z",
      "area": "file",
      "sequence": 40,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen(1).md"
      },
      "id": "1756289232390-gn14tyjti",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.330Z",
      "area": "file",
      "sequence": 39,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.m4a",
        "transcripts": [
          "Diva Shoplösungen.de.md"
        ]
      },
      "id": "1756289232390-v708faobu",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.330Z",
      "area": "file",
      "sequence": 38,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.Besprechung.de.md"
      },
      "id": "1756289232390-necimtgy0",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.329Z",
      "area": "file",
      "sequence": 37,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
      },
      "id": "1756289232390-0hd6phma2",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.329Z",
      "area": "file",
      "sequence": 36,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Computergestütztes Denken.md"
      },
      "id": "1756289232390-e8x9dmmr1",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.329Z",
      "area": "file",
      "sequence": 35,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
      },
      "id": "1756289232390-zfqrefyc5",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.329Z",
      "area": "file",
      "sequence": 34,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
      },
      "id": "1756289232390-ig59zmxu9",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.329Z",
      "area": "file",
      "sequence": 33,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
        "transcripts": [
          "Asana Tickets mit Billomat Aufträge verbinden.de.md"
        ]
      },
      "id": "1756289232390-ghj0ox40x",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.329Z",
      "area": "file",
      "sequence": 32,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250421_125103.jpg"
      },
      "id": "1756289232390-0xaf57q18",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.329Z",
      "area": "file",
      "sequence": 31,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
        "transcripts": [
          "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
        ]
      },
      "id": "1756289232390-vkwjdrxgl",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.329Z",
      "area": "ui",
      "sequence": 6,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 1,
        "currentScrollLeft": 0,
        "targetScrollLeft": 81,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756289232390-jgp9btvad",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:07:12.228Z",
      "area": "file",
      "sequence": 30,
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
      "id": "1756289232390-upc2wqfdy",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 29,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Transcript Quartalssitzung.m4a"
      },
      "id": "1756289162833-1bxvmdq15",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 28,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
      },
      "id": "1756289162833-7yglqqjbj",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 27,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Swiss Goverment Cloud.docx"
      },
      "id": "1756289162833-j7my663u4",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 26,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Quartalssitzung.m4a"
      },
      "id": "1756289162833-mswabiejc",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 25,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Prioritäten Mai.md"
      },
      "id": "1756289162833-s2o12pd7h",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 24,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
      },
      "id": "1756289162833-kc6eiiqbd",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 23,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung2.pptx"
      },
      "id": "1756289162833-ks9veblny",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 22,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung.pptx"
      },
      "id": "1756289162833-cwj074zak",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 21,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
      },
      "id": "1756289162833-u7y67ke0o",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 20,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Paul Lindberg.md"
      },
      "id": "1756289162833-dpdsvds57",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.792Z",
      "area": "file",
      "sequence": 19,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
      },
      "id": "1756289162833-5rks99smi",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 18,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "IMG-20250503-WA0004.jpg"
      },
      "id": "1756289162833-6cbkc7vcf",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 17,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen(1).md"
      },
      "id": "1756289162833-5vhbyf3c2",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 16,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.m4a",
        "transcripts": [
          "Diva Shoplösungen.de.md"
        ]
      },
      "id": "1756289162833-zrg9jzdkf",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 15,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.Besprechung.de.md"
      },
      "id": "1756289162833-yfxjv902u",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 14,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
      },
      "id": "1756289162833-aj4fb3wev",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 13,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Computergestütztes Denken.md"
      },
      "id": "1756289162833-mn6cm0kkv",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 12,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
      },
      "id": "1756289162833-93frjfn82",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 11,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
      },
      "id": "1756289162833-udmou73od",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 10,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
        "transcripts": [
          "Asana Tickets mit Billomat Aufträge verbinden.de.md"
        ]
      },
      "id": "1756289162833-1fo01h1mo",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 9,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250421_125103.jpg"
      },
      "id": "1756289162833-xqajlrqqs",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.791Z",
      "area": "file",
      "sequence": 8,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
        "transcripts": [
          "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
        ]
      },
      "id": "1756289162833-g4paxhxok",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.749Z",
      "area": "file",
      "sequence": 7,
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
      "id": "1756289162833-o8qdb9j4k",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:02.740Z",
      "area": "state",
      "sequence": 17,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 46,
        "fileCount": 26,
        "folderCount": 20,
        "tSinceMountMs": 1235.3
      },
      "id": "1756289162833-d8e3yf8bw",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:02.739Z",
      "area": "state",
      "sequence": 16,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289162740-vob3imyvt",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.676Z",
      "area": "ui",
      "sequence": 5,
      "component": "Breadcrumb",
      "level": "info",
      "message": "Auto-scroll completed",
      "details": {
        "duration": "113.00ms",
        "finalScrollLeft": 0,
        "pathDepth": 1
      },
      "id": "1756289161676-qy2ll11vd",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.594Z",
      "area": "file",
      "sequence": 6,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {},
      "id": "1756289161595-59mz418bi",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "nav",
      "sequence": 8,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756289161595-lft1k3eiz",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "nav",
      "sequence": 7,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756289161595-6bxfy34zi",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "ui",
      "sequence": 4,
      "component": "Library",
      "level": "info",
      "message": "Initial load triggered",
      "details": {
        "currentFolderId": "root",
        "lastLoadedFolder": null,
        "tSinceMountMs": 79.7
      },
      "id": "1756289161595-cxgmv8uca",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "file",
      "sequence": 5,
      "component": "FileList",
      "level": "info",
      "message": "Initialization complete",
      "details": {},
      "id": "1756289161595-kxs8lq1bk",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.584Z",
      "area": "file",
      "sequence": 4,
      "component": "FileList",
      "level": "info",
      "message": "Starting initialization",
      "details": {},
      "id": "1756289161595-qtign27zv",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.583Z",
      "area": "state",
      "sequence": 15,
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
      "id": "1756289161595-sfthgpmjo",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.583Z",
      "area": "ui",
      "sequence": 3,
      "component": "FileTree",
      "level": "info",
      "message": "Starting root load",
      "details": {
        "hasProvider": true,
        "isReady": false
      },
      "id": "1756289161595-wrtgiwq6p",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.575Z",
      "area": "nav",
      "sequence": 6,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "ready"
      },
      "id": "1756289161594-qb4mqkc3v",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.568Z",
      "area": "state",
      "sequence": 14,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289161575-t52s16bam",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.564Z",
      "area": "nav",
      "sequence": 5,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "ready"
      },
      "id": "1756289161568-wa38ex3yy",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.564Z",
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
      "id": "1756289161568-63v17xydv",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.545Z",
      "area": "nav",
      "sequence": 4,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "ready"
      },
      "id": "1756289161568-199hycr7p",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.545Z",
      "area": "state",
      "sequence": 13,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289161568-34zzm9bam",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.545Z",
      "area": "file",
      "sequence": 3,
      "component": "FileList",
      "level": "info",
      "message": "Waiting for provider",
      "details": {},
      "id": "1756289161568-x12egn0eo",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.544Z",
      "area": "file",
      "sequence": 2,
      "component": "FileTree",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756289161568-skcazm0f3",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.544Z",
      "area": "ui",
      "sequence": 1,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 1,
        "currentScrollLeft": 0,
        "targetScrollLeft": 81,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756289161568-yzvmu958a",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.533Z",
      "area": "file",
      "sequence": 1,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756289161568-3nszg8yn3",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.517Z",
      "area": "nav",
      "sequence": 3,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "initializing"
      },
      "id": "1756289161568-tiez6hjo3",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.508Z",
      "area": "state",
      "sequence": 12,
      "component": "Library",
      "level": "info",
      "message": "Active library changed - reset initial load state",
      "details": {
        "activeLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "currentFolderId": "root"
      },
      "id": "1756289161568-8clliqdjq",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.508Z",
      "area": "nav",
      "sequence": 2,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "hasProvider": false,
        "status": "initializing"
      },
      "id": "1756289161568-zxywfnt69",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-27T10:06:01.508Z",
      "area": "nav",
      "sequence": 1,
      "component": "debug@init",
      "level": "info",
      "message": "Applying folderId from URL",
      "details": {
        "folderIdFromUrl": "Ni4gYkNvbW1vbnNMYWIgcHJvdG90eXBpbmcvMjQuMDkgS25vd2xlZGdlU2NvdXQvS29uemVwdGU=",
        "currentFolderId": "root"
      },
      "id": "1756289161568-ctdzabtnz",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.489Z",
      "area": "state",
      "sequence": 11,
      "component": "StorageContext",
      "level": "info",
      "message": "🔐 AUTH: User email set in StorageFactory",
      "details": {
        "email": "peter.aichner@..."
      },
      "id": "1756289161490-opy35cah6",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.488Z",
      "area": "state",
      "sequence": 10,
      "component": "StorageContext",
      "level": "warn",
      "message": "🔐 AUTH: Unsupported library type filtered out",
      "details": {
        "libraryType": "webdav",
        "libraryLabel": "Nextcloud",
        "libraryId": "e9e54ddc-6907-4ebb-8bf6-7f3f880c710a"
      },
      "id": "1756289161490-3n7n0wcn7",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.488Z",
      "area": "state",
      "sequence": 9,
      "component": "StorageContext",
      "level": "warn",
      "message": "🔐 AUTH: Unsupported library type filtered out",
      "details": {
        "libraryType": "webdav",
        "libraryLabel": "Offenes Ohr",
        "libraryId": "_ArchivPeter"
      },
      "id": "1756289161490-rwpbeowwy",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-27T10:06:01.487Z",
      "area": "state",
      "sequence": 8,
      "component": "StorageContext",
      "level": "info",
      "message": "🔐 AUTH: ✅ API Call /api/libraries?email=peter.aichner%40crystal-design.com - success",
      "details": {
        "librariesCount": 8,
        "attempt": 1
      },
      "id": "1756289161490-zeyaiuyg4",
      "remarks": "",
      "isDuplicate": false
    }
  ]
}

---

**Cursor**

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
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useFolderNavigation } from "@/hooks/use-folder-navigation"
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
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
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
      setIsMobile(matches);
      setIsTreeVisible(!matches);
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

    loadInFlightRef.current = true;
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
      loadInFlightRef.current = false;
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
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

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
              <ResizablePanelGroup
                key={isTreeVisible ? 'with-tree' : 'no-tree'}
                direction="horizontal"
                className="h-full"
                autoSaveId={isTreeVisible ? "library-panels-3" : "library-panels-2"}
              >
                {isTreeVisible && (
                  <>
                    <ResizablePanel key="tree-panel" id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle key="tree-handle" />
                  </>
                )}
                <ResizablePanel key="list-panel" id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle key="list-preview-handle" />
                <ResizablePanel key="preview-panel" id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
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

- Ja, jetzt sieht man es klar: Unsere neuen Logs greifen. Wichtig: Die Sequenz zeigt, dass die URL-folderId korrekt angewendet wird:
  - debug@init Applying folderId from URL (ready) … currentFolderId: root → navigateToFolder(...) wird aufgerufen.
  - FolderNavigation Cache miss … pathLength: 4.
  - debug@nav URL updated (cache miss) … URL auf /library?folderId=… gesetzt.
  - Library Initial load triggered/Loading initial items für die base64-folderId.
  - Items loaded successfully folderId: <die base64-Id>.

- Gleichzeitig sieht man anfangs noch ein „Initial load triggered“ für root, bevor der URL-Folder greift. Ich habe soeben den Initial-Load angepasst: Wenn folderId in der URL steht und noch nicht angewendet wurde, wird der erste Root-Load übersprungen. Danach wird nur der URL-Ordner geladen.

Bitte erneut testen:
- /library?folderId=<tiefer Ordner> öffnen.
- Prüfen, dass kein „Initial load triggered … currentFolderId: root“ mehr erscheint, bevor der tiefe Ordner geladen wird.
- Danach Reload: Ordner sollte direkt geladen werden, Logs zeigen nur den einen Pfad (URL → navigateToFolder → Cache miss/hit → Items loaded).

Wenn das stabil läuft, erweitern wir optional:
- Bei Library-Wechsel folderId validieren/auf root zurücksetzen, falls der Ordner zur anderen Library nicht gehört.

---

**User**

Ok, jetzt haben wir Diese Verzeichnisse werden jetzt gespeichert und wiederhergestellt Und oben bei diesem Krümmelpfad sehe ich das aktuelle Verzeichnis Kann ich dort auch so ein Favoritensymbol ergänzen, wo ich das Verzeichnis mir merke und alle Favoriten als Dropdown im Krümmelpfad auswählbar sind Weil ich in unterschiedlichen Libraries unterschiedliche Verzeichnisse habe mit denen ich immer wieder arbeite wäre das sehr hilfreich, dass ich da jetzt mit diesem Folder-ID das sehr schnell öffnen kann eine möglichst einfache Lösung und die zuletzt und diese Favoriten sollten in der Library auch gespeichert sein so dass ich es von Browser zu Browser und Rechner zu Rechner ich diese Informationen mitnehmen kann oder sind diese IDs nur temporär gültig

---

**Cursor**

Ich erstelle eine kurze Aufgabenliste und beginne mit der Umsetzung: Favoriten im Breadcrumb (UI + Persistenz via `.ck-meta/favorites.json`) und Logging. Danach führe ich die Code-Edits aus.

```typescript
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { FileLogger, NavigationLogger } from "@/lib/debug/logger";

export interface FavoriteEntry {
  id: string;
  name: string;
  path?: string[];
  addedAt: string;
}

export interface LibraryFavoritesData {
  libraryId: string;
  favorites: FavoriteEntry[];
}

const META_FOLDER_NAME = ".ck-meta";
const FAVORITES_FILE_NAME = "favorites.json";

async function ensureMetaFolder(provider: StorageProvider): Promise<string> {
  const rootId = "root";
  const items = await provider.listItemsById(rootId);
  let meta = items.find((i) => i.type === "folder" && i.metadata.name === META_FOLDER_NAME);
  if (!meta) meta = await provider.createFolder(rootId, META_FOLDER_NAME);
  return meta.id;
}

async function readFavoritesFile(provider: StorageProvider): Promise<LibraryFavoritesData | null> {
  try {
    const metaId = await ensureMetaFolder(provider);
    const files = await provider.listItemsById(metaId);
    const fav = files.find((i) => i.type === "file" && i.metadata.name === FAVORITES_FILE_NAME);
    if (!fav) return null;
    const { blob } = await provider.getBinary(fav.id);
    const text = await blob.text();
    const data = JSON.parse(text) as LibraryFavoritesData;
    return data;
  } catch (error) {
    FileLogger.error("Favorites", "Failed to read favorites file", error);
    return null;
  }
}

async function writeFavoritesFile(provider: StorageProvider, data: LibraryFavoritesData): Promise<void> {
  const metaId = await ensureMetaFolder(provider);
  const payload = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const file = new File([payload], FAVORITES_FILE_NAME, { type: "application/json" });
  // Lösche existierende Datei, wenn vorhanden
  const files = await provider.listItemsById(metaId);
  const existing = files.find((i) => i.type === "file" && i.metadata.name === FAVORITES_FILE_NAME);
  if (existing) await provider.deleteItem(existing.id);
  await provider.uploadFile(metaId, file);
}

export async function loadFavorites(provider: StorageProvider, libraryId: string): Promise<LibraryFavoritesData> {
  const data = await readFavoritesFile(provider);
  if (data && data.libraryId === libraryId) return data;
  return { libraryId, favorites: [] };
}

export async function toggleFavorite(
  provider: StorageProvider,
  libraryId: string,
  folder: StorageItem
): Promise<LibraryFavoritesData> {
  const current = await loadFavorites(provider, libraryId);
  const exists = current.favorites.some((f) => f.id === folder.id);
  if (exists) {
    current.favorites = current.favorites.filter((f) => f.id !== folder.id);
  } else {
    let pathLabels: string[] | undefined;
    try {
      const pathItems = await provider.getPathItemsById(folder.id);
      pathLabels = pathItems.map((p) => p.metadata.name);
    } catch {
      pathLabels = undefined;
    }
    current.favorites.push({
      id: folder.id,
      name: folder.metadata.name,
      path: pathLabels,
      addedAt: new Date().toISOString(),
    });
  }
  await writeFavoritesFile(provider, current);
  NavigationLogger.info("Favorites", exists ? "Removed favorite" : "Added favorite", {
    folderId: folder.id,
    folderName: folder.metadata.name,
  });
  return current;
}


```

```typescriptreact
'use client';

import * as React from "react";
import { useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { NavigationLogger, UILogger } from "@/lib/debug/logger";
import { currentPathAtom, currentFolderIdAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { useCallback } from "react";
import { Star, StarOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStorage } from "@/contexts/storage-context";
import { loadFavorites, toggleFavorite } from "@/lib/library/favorites";
import { toast } from "sonner";
import { useFolderNavigation } from '@/hooks/use-folder-navigation';

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  // Globale Atoms
  const currentPath = useAtomValue(currentPathAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);

  // Ref für horizontales Scrollen
  const breadcrumbRef = React.useRef<HTMLDivElement>(null);
  const scrollStartTime = React.useRef<number | null>(null);

  const navigateToFolder = useFolderNavigation();
  const { provider } = useStorage();
  const [favorites, setFavorites] = React.useState<{
    list: Array<{ id: string; name: string }>
  }>({ list: [] });

  // Favoriten laden, wenn Library wechselt oder Provider bereit ist
  React.useEffect(() => {
    (async () => {
      if (!provider || !activeLibrary?.id) return;
      try {
        const data = await loadFavorites(provider, activeLibrary.id);
        setFavorites({ list: data.favorites.map(f => ({ id: f.id, name: f.name })) });
      } catch {}
    })();
  }, [provider, activeLibrary?.id]);

  const isCurrentFav = React.useMemo(() => {
    if (!currentFolderId) return false;
    return favorites.list.some(f => f.id === currentFolderId);
  }, [favorites.list, currentFolderId]);

  // Handler für Root-Klick
  const handleRootClick = useCallback(() => {
    const startTime = performance.now();
    
    NavigationLogger.info('Breadcrumb', 'Root navigation requested', {
      currentPath: currentPath.length,
      activeLibrary: activeLibrary?.label
    });
    
    navigateToFolder('root');

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Root click handled', {
      duration: `${duration.toFixed(2)}ms`,
      activeLibrary: activeLibrary?.label
    });
  }, [currentPath.length, activeLibrary, navigateToFolder]);

  // Handler für Ordner-Klick
  const handleFolderClick = useCallback((folderId: string) => {
    const startTime = performance.now();
    const targetFolder = currentPath.find(item => item.id === folderId);
    
    NavigationLogger.info('Breadcrumb', 'Folder navigation requested', {
      folderId,
      folderName: targetFolder?.metadata.name,
      pathDepth: currentPath.length,
      currentFolderId
    });

    navigateToFolder(folderId);

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Folder click handled', {
      duration: `${duration.toFixed(2)}ms`,
      folderId,
      folderName: targetFolder?.metadata.name,
      isCurrentFolder: currentFolderId === folderId
    });
  }, [currentPath, currentFolderId, navigateToFolder]);

  const handleToggleFavorite = useCallback(async () => {
    if (!provider || !activeLibrary?.id) return;
    const target = currentPath.find(p => p.id === currentFolderId);
    if (!target) return;
    try {
      const data = await toggleFavorite(provider, activeLibrary.id, target);
      setFavorites({ list: data.favorites.map(f => ({ id: f.id, name: f.name })) });
      toast.success(isCurrentFav ? "Favorit entfernt" : "Favorit hinzugefügt", { description: target.metadata.name });
    } catch (e) {
      toast.error("Fehler", { description: "Favorit konnte nicht gespeichert werden" });
    }
  }, [provider, activeLibrary?.id, currentFolderId, currentPath, isCurrentFav]);

  // Auto-Scroll zum Ende des Breadcrumbs
  React.useEffect(() => {
    if (!breadcrumbRef.current) return;

    const startTime = performance.now();
    scrollStartTime.current = startTime;
    
    UILogger.debug('Breadcrumb', 'Starting auto-scroll', {
      pathDepth: currentPath.length,
      currentScrollLeft: breadcrumbRef.current.scrollLeft,
      targetScrollLeft: breadcrumbRef.current.scrollWidth,
      activeLibrary: activeLibrary?.label
    });

    breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;

    const timeoutId = setTimeout(() => {
      if (scrollStartTime.current === startTime) {
        const duration = performance.now() - startTime;
        UILogger.info('Breadcrumb', 'Auto-scroll completed', {
          duration: `${duration.toFixed(2)}ms`,
          finalScrollLeft: breadcrumbRef.current?.scrollLeft,
          pathDepth: currentPath.length
        });
        scrollStartTime.current = null;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentPath, activeLibrary]);

  return (
    <div className={cn("flex items-center gap-4 min-w-0", className)}>
      <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
        <span className="text-muted-foreground flex-shrink-0">Pfad:</span>
        <div 
          ref={breadcrumbRef}
          className="flex items-center gap-1 overflow-auto whitespace-nowrap no-scrollbar" 
          style={{ maxWidth: '60vw' }}
          onScroll={() => {
            if (scrollStartTime.current) {
              const duration = performance.now() - scrollStartTime.current;
              UILogger.debug('Breadcrumb', 'Manual scroll detected', {
                duration: `${duration.toFixed(2)}ms`,
                scrollLeft: breadcrumbRef.current?.scrollLeft
              });
              scrollStartTime.current = null;
            }
          }}
        >
          <button
            onClick={handleRootClick}
            className={cn(
              "hover:text-foreground flex-shrink-0 font-medium",
              currentFolderId === 'root' ? "text-foreground" : "text-muted-foreground"
            )}
            title="Zurück zum Hauptverzeichnis"
          >
            {activeLibrary?.label || '/'}
          </button>
          
          {currentPath
            .filter(item => item.id !== 'root' && item.metadata.name.toLowerCase() !== 'root')
            .map((item) => (
              <React.Fragment key={item.id}>
                <span className="text-muted-foreground flex-shrink-0">/</span>
                <button
                  onClick={() => handleFolderClick(item.id)}
                  className={cn(
                    "hover:text-foreground truncate max-w-[150px]",
                    currentFolderId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                  title={item.metadata.name}
                >
                  {item.metadata.name}
                </button>
              </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
} 
```

```typescriptreact
'use client';

import * as React from "react";
import { useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { NavigationLogger, UILogger } from "@/lib/debug/logger";
import { currentPathAtom, currentFolderIdAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { useCallback } from "react";
import { Star, StarOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStorage } from "@/contexts/storage-context";
import { loadFavorites, toggleFavorite } from "@/lib/library/favorites";
import { toast } from "sonner";
import { useFolderNavigation } from '@/hooks/use-folder-navigation';

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  // Globale Atoms
  const currentPath = useAtomValue(currentPathAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);

  // Ref für horizontales Scrollen
  const breadcrumbRef = React.useRef<HTMLDivElement>(null);
  const scrollStartTime = React.useRef<number | null>(null);

  const navigateToFolder = useFolderNavigation();
  const { provider } = useStorage();
  const [favorites, setFavorites] = React.useState<{
    list: Array<{ id: string; name: string }>
  }>({ list: [] });

  // Favoriten laden, wenn Library wechselt oder Provider bereit ist
  React.useEffect(() => {
    (async () => {
      if (!provider || !activeLibrary?.id) return;
      try {
        const data = await loadFavorites(provider, activeLibrary.id);
        setFavorites({ list: data.favorites.map(f => ({ id: f.id, name: f.name })) });
      } catch {}
    })();
  }, [provider, activeLibrary?.id]);

  const isCurrentFav = React.useMemo(() => {
    if (!currentFolderId) return false;
    return favorites.list.some(f => f.id === currentFolderId);
  }, [favorites.list, currentFolderId]);

  // Handler für Root-Klick
  const handleRootClick = useCallback(() => {
    const startTime = performance.now();
    
    NavigationLogger.info('Breadcrumb', 'Root navigation requested', {
      currentPath: currentPath.length,
      activeLibrary: activeLibrary?.label
    });
    
    navigateToFolder('root');

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Root click handled', {
      duration: `${duration.toFixed(2)}ms`,
      activeLibrary: activeLibrary?.label
    });
  }, [currentPath.length, activeLibrary, navigateToFolder]);

  // Handler für Ordner-Klick
  const handleFolderClick = useCallback((folderId: string) => {
    const startTime = performance.now();
    const targetFolder = currentPath.find(item => item.id === folderId);
    
    NavigationLogger.info('Breadcrumb', 'Folder navigation requested', {
      folderId,
      folderName: targetFolder?.metadata.name,
      pathDepth: currentPath.length,
      currentFolderId
    });

    navigateToFolder(folderId);

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Folder click handled', {
      duration: `${duration.toFixed(2)}ms`,
      folderId,
      folderName: targetFolder?.metadata.name,
      isCurrentFolder: currentFolderId === folderId
    });
  }, [currentPath, currentFolderId, navigateToFolder]);

  const handleToggleFavorite = useCallback(async () => {
    if (!provider || !activeLibrary?.id) return;
    const target = currentPath.find(p => p.id === currentFolderId);
    if (!target) return;
    try {
      const data = await toggleFavorite(provider, activeLibrary.id, target);
      setFavorites({ list: data.favorites.map(f => ({ id: f.id, name: f.name })) });
      toast.success(isCurrentFav ? "Favorit entfernt" : "Favorit hinzugefügt", { description: target.metadata.name });
    } catch (e) {
      toast.error("Fehler", { description: "Favorit konnte nicht gespeichert werden" });
    }
  }, [provider, activeLibrary?.id, currentFolderId, currentPath, isCurrentFav]);

  // Auto-Scroll zum Ende des Breadcrumbs
  React.useEffect(() => {
    if (!breadcrumbRef.current) return;

    const startTime = performance.now();
    scrollStartTime.current = startTime;
    
    UILogger.debug('Breadcrumb', 'Starting auto-scroll', {
      pathDepth: currentPath.length,
      currentScrollLeft: breadcrumbRef.current.scrollLeft,
      targetScrollLeft: breadcrumbRef.current.scrollWidth,
      activeLibrary: activeLibrary?.label
    });

    breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;

    const timeoutId = setTimeout(() => {
      if (scrollStartTime.current === startTime) {
        const duration = performance.now() - startTime;
        UILogger.info('Breadcrumb', 'Auto-scroll completed', {
          duration: `${duration.toFixed(2)}ms`,
          finalScrollLeft: breadcrumbRef.current?.scrollLeft,
          pathDepth: currentPath.length
        });
        scrollStartTime.current = null;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentPath, activeLibrary]);

  return (
    <div className={cn("flex items-center gap-4 min-w-0", className)}>
      <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-muted-foreground">Pfad:</span>
          {/* Favoriten Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center px-1.5 py-0.5 text-xs rounded border hover:bg-muted"
                title="Favoriten"
              >
                Favoriten
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {favorites.list.length === 0 ? (
                <DropdownMenuItem disabled>Keine Favoriten</DropdownMenuItem>
              ) : (
                favorites.list.map(f => (
                  <DropdownMenuItem key={f.id} onClick={() => navigateToFolder(f.id)}>
                    {f.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div 
          ref={breadcrumbRef}
          className="flex items-center gap-1 overflow-auto whitespace-nowrap no-scrollbar" 
          style={{ maxWidth: '60vw' }}
          onScroll={() => {
            if (scrollStartTime.current) {
              const duration = performance.now() - scrollStartTime.current;
              UILogger.debug('Breadcrumb', 'Manual scroll detected', {
                duration: `${duration.toFixed(2)}ms`,
                scrollLeft: breadcrumbRef.current?.scrollLeft
              });
              scrollStartTime.current = null;
            }
          }}
        >
          <button
            onClick={handleRootClick}
            className={cn(
              "hover:text-foreground flex-shrink-0 font-medium",
              currentFolderId === 'root' ? "text-foreground" : "text-muted-foreground"
            )}
            title="Zurück zum Hauptverzeichnis"
          >
            {activeLibrary?.label || '/'}
          </button>
          {/* Star-Toggle für aktuelles Verzeichnis */}
          <button
            onClick={handleToggleFavorite}
            className="ml-1 text-muted-foreground hover:text-foreground"
            title={isCurrentFav ? "Favorit entfernen" : "Als Favorit speichern"}
          >
            {isCurrentFav ? <Star className="h-3.5 w-3.5 fill-current" /> : <StarOff className="h-3.5 w-3.5" />}
          </button>
          
          {currentPath
            .filter(item => item.id !== 'root' && item.metadata.name.toLowerCase() !== 'root')
            .map((item) => (
              <React.Fragment key={item.id}>
                <span className="text-muted-foreground flex-shrink-0">/</span>
                <button
                  onClick={() => handleFolderClick(item.id)}
                  className={cn(
                    "hover:text-foreground truncate max-w-[150px]",
                    currentFolderId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                  title={item.metadata.name}
                >
                  {item.metadata.name}
                </button>
              </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
} 
```

- Favoriten umgesetzt: Im Breadcrumb gibt es jetzt
  - Dropdown “Favoriten” mit allen gespeicherten Ordnern (pro Library).
  - Star-Button neben dem Root-Label zum schnellen Hinzufügen/Entfernen des aktuellen Ordners als Favorit.
- Persistenz: Pro Library in `.ck-meta/favorites.json` über den jeweiligen Provider gespeichert. Funktioniert library-spezifisch und ist nicht an einen Browser gebunden. Die Ordner-IDs sind stabil (Provider-seitig) und daher geeignet.

Kurze Tests
- Zu Zielordner navigieren → Star anklicken: “Favorit hinzugefügt” Toast.
- Dropdown öffnen → Eintrag anklicken → sofortige Navigation zur Folder-ID.
- Star erneut klicken → “Favorit entfernt”.

Technik
- Neue Utility `src/lib/library/favorites.ts` (load/toggle + Persistenz).
- `src/components/library/breadcrumb.tsx`: UI (Dropdown + Star), Laden/Speichern, Navigation per `useFolderNavigation`.

Wenn du magst, erweitere ich:
- “Zuletzt verwendet”-Liste (MRU) neben Favoriten.
- Favoriten-Umbenennung/Entfernen direkt im Menü.

---

**User**

Ja, das Favoriten-Symbol sollte am Ende des Pfades stehen und nicht da mitten drinnen. Und könnten wir als Namen nicht nur das letzte Verzeichnis, sondern den ganzen Pfad anzeigen, da diese Verzeichnisnamen am Ende oft redundant sind.

---

**Cursor**

```typescriptreact
'use client';

import * as React from "react";
import { useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { NavigationLogger, UILogger } from "@/lib/debug/logger";
import { currentPathAtom, currentFolderIdAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { useCallback } from "react";
import { Star, StarOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStorage } from "@/contexts/storage-context";
import { loadFavorites, toggleFavorite } from "@/lib/library/favorites";
import { toast } from "sonner";
import { useFolderNavigation } from '@/hooks/use-folder-navigation';

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  // Globale Atoms
  const currentPath = useAtomValue(currentPathAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);

  // Ref für horizontales Scrollen
  const breadcrumbRef = React.useRef<HTMLDivElement>(null);
  const scrollStartTime = React.useRef<number | null>(null);

  const navigateToFolder = useFolderNavigation();
  const { provider } = useStorage();
  const [favorites, setFavorites] = React.useState<{
    list: Array<{ id: string; name: string; label: string }>
  }>({ list: [] });

  // Favoriten laden, wenn Library wechselt oder Provider bereit ist
  React.useEffect(() => {
    (async () => {
      if (!provider || !activeLibrary?.id) return;
      try {
        const data = await loadFavorites(provider, activeLibrary.id);
        setFavorites({ list: data.favorites.map(f => ({ id: f.id, name: f.name, label: Array.isArray(f.path) && f.path.length ? f.path.join(' / ') : f.name })) });
      } catch {}
    })();
  }, [provider, activeLibrary?.id]);

  const isCurrentFav = React.useMemo(() => {
    if (!currentFolderId) return false;
    return favorites.list.some(f => f.id === currentFolderId);
  }, [favorites.list, currentFolderId]);

  // Handler für Root-Klick
  const handleRootClick = useCallback(() => {
    const startTime = performance.now();
    
    NavigationLogger.info('Breadcrumb', 'Root navigation requested', {
      currentPath: currentPath.length,
      activeLibrary: activeLibrary?.label
    });
    
    navigateToFolder('root');

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Root click handled', {
      duration: `${duration.toFixed(2)}ms`,
      activeLibrary: activeLibrary?.label
    });
  }, [currentPath.length, activeLibrary, navigateToFolder]);

  // Handler für Ordner-Klick
  const handleFolderClick = useCallback((folderId: string) => {
    const startTime = performance.now();
    const targetFolder = currentPath.find(item => item.id === folderId);
    
    NavigationLogger.info('Breadcrumb', 'Folder navigation requested', {
      folderId,
      folderName: targetFolder?.metadata.name,
      pathDepth: currentPath.length,
      currentFolderId
    });

    navigateToFolder(folderId);

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Folder click handled', {
      duration: `${duration.toFixed(2)}ms`,
      folderId,
      folderName: targetFolder?.metadata.name,
      isCurrentFolder: currentFolderId === folderId
    });
  }, [currentPath, currentFolderId, navigateToFolder]);

  const handleToggleFavorite = useCallback(async () => {
    if (!provider || !activeLibrary?.id) return;
    const target = currentPath.find(p => p.id === currentFolderId);
    if (!target) return;
    try {
      const data = await toggleFavorite(provider, activeLibrary.id, target);
      setFavorites({ list: data.favorites.map(f => ({ id: f.id, name: f.name, label: Array.isArray(f.path) && f.path.length ? f.path.join(' / ') : f.name })) });
      toast.success(isCurrentFav ? "Favorit entfernt" : "Favorit hinzugefügt", { description: target.metadata.name });
    } catch (e) {
      toast.error("Fehler", { description: "Favorit konnte nicht gespeichert werden" });
    }
  }, [provider, activeLibrary?.id, currentFolderId, currentPath, isCurrentFav]);

  // Auto-Scroll zum Ende des Breadcrumbs
  React.useEffect(() => {
    if (!breadcrumbRef.current) return;

    const startTime = performance.now();
    scrollStartTime.current = startTime;
    
    UILogger.debug('Breadcrumb', 'Starting auto-scroll', {
      pathDepth: currentPath.length,
      currentScrollLeft: breadcrumbRef.current.scrollLeft,
      targetScrollLeft: breadcrumbRef.current.scrollWidth,
      activeLibrary: activeLibrary?.label
    });

    breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;

    const timeoutId = setTimeout(() => {
      if (scrollStartTime.current === startTime) {
        const duration = performance.now() - startTime;
        UILogger.info('Breadcrumb', 'Auto-scroll completed', {
          duration: `${duration.toFixed(2)}ms`,
          finalScrollLeft: breadcrumbRef.current?.scrollLeft,
          pathDepth: currentPath.length
        });
        scrollStartTime.current = null;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentPath, activeLibrary]);

  return (
    <div className={cn("flex items-center gap-4 min-w-0", className)}>
      <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
        <span className="text-muted-foreground flex-shrink-0">Pfad:</span>
        <div 
          ref={breadcrumbRef}
          className="flex items-center gap-1 overflow-auto whitespace-nowrap no-scrollbar" 
          style={{ maxWidth: '60vw' }}
          onScroll={() => {
            if (scrollStartTime.current) {
              const duration = performance.now() - scrollStartTime.current;
              UILogger.debug('Breadcrumb', 'Manual scroll detected', {
                duration: `${duration.toFixed(2)}ms`,
                scrollLeft: breadcrumbRef.current?.scrollLeft
              });
              scrollStartTime.current = null;
            }
          }}
        >
          <button
            onClick={handleRootClick}
            className={cn(
              "hover:text-foreground flex-shrink-0 font-medium",
              currentFolderId === 'root' ? "text-foreground" : "text-muted-foreground"
            )}
            title="Zurück zum Hauptverzeichnis"
          >
            {activeLibrary?.label || '/'}
          </button>
          
          {currentPath
            .filter(item => item.id !== 'root' && item.metadata.name.toLowerCase() !== 'root')
            .map((item) => (
              <React.Fragment key={item.id}>
                <span className="text-muted-foreground flex-shrink-0">/</span>
                <button
                  onClick={() => handleFolderClick(item.id)}
                  className={cn(
                    "hover:text-foreground truncate max-w-[150px]",
                    currentFolderId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                  title={item.metadata.name}
                >
                  {item.metadata.name}
                </button>
              </React.Fragment>
          ))}
        </div>
        {/* Rechts: Star + Favoriten-Dropdown */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleToggleFavorite}
            className="ml-1 text-muted-foreground hover:text-foreground"
            title={isCurrentFav ? "Favorit entfernen" : "Als Favorit speichern"}
          >
            {isCurrentFav ? <Star className="h-3.5 w-3.5 fill-current" /> : <StarOff className="h-3.5 w-3.5" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center px-1.5 py-0.5 text-xs rounded border hover:bg-muted"
                title="Favoriten"
              >
                Favoriten
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {favorites.list.length === 0 ? (
                <DropdownMenuItem disabled>Keine Favoriten</DropdownMenuItem>
              ) : (
                favorites.list.map(f => (
                  <DropdownMenuItem key={f.id} onClick={() => navigateToFolder(f.id)} title={f.label}>
                    {f.label}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
} 
```

Erledigt:
- Stern ans Ende des Pfades verschoben.
- Favoriten-Dropdown ebenfalls rechts am Ende.
- Dropdown-Einträge zeigen jetzt den vollständigen Pfadnamen (aus path[] zusammengesetzt), nicht nur den letzten Ordner. Tooltip enthält ebenfalls den vollen Pfad.

Bitte kurz prüfen:
- In einen Ordner navigieren → Stern rechts klickbar.
- “Favoriten” rechts öffnet Dropdown → Einträge mit vollem Pfad; Auswahl navigiert korrekt.
- Hinzufügen/Entfernen aktualisiert die Liste sofort.

---

**User**

Diese Favoriten-Button können wir schon vor den Krimmelfahrt stellen und einfach nur durch einen Pfeil nach unten ersetzen. Wenn ich draufklicke, dann ändert sich der Pfeil nach unten und es öffnet sich dieses TopDown. So ähnlich wie bei dem FileTree diese führenden Symbole, die zeigen, ob ein Verzeichnis geöffnet oder geschlossen ist. Es ist einfach nur ein Symbol und nicht der Text-Favoriten.

---

**Cursor**

```typescriptreact
'use client';

import * as React from "react";
import { useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { NavigationLogger, UILogger } from "@/lib/debug/logger";
import { currentPathAtom, currentFolderIdAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { useCallback } from "react";
import { Star, StarOff, ChevronDown, ChevronUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStorage } from "@/contexts/storage-context";
import { loadFavorites, toggleFavorite } from "@/lib/library/favorites";
import { toast } from "sonner";
import { useFolderNavigation } from '@/hooks/use-folder-navigation';

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  // Globale Atoms
  const currentPath = useAtomValue(currentPathAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);

  // Ref für horizontales Scrollen
  const breadcrumbRef = React.useRef<HTMLDivElement>(null);
  const scrollStartTime = React.useRef<number | null>(null);

  const navigateToFolder = useFolderNavigation();
  const { provider } = useStorage();
  const [favorites, setFavorites] = React.useState<{
    list: Array<{ id: string; name: string; label: string }>
  }>({ list: [] });
  const [favOpen, setFavOpen] = React.useState(false);

  // Favoriten laden, wenn Library wechselt oder Provider bereit ist
  React.useEffect(() => {
    (async () => {
      if (!provider || !activeLibrary?.id) return;
      try {
        const data = await loadFavorites(provider, activeLibrary.id);
        setFavorites({ list: data.favorites.map(f => ({ id: f.id, name: f.name, label: Array.isArray(f.path) && f.path.length ? f.path.join(' / ') : f.name })) });
      } catch {}
    })();
  }, [provider, activeLibrary?.id]);

  const isCurrentFav = React.useMemo(() => {
    if (!currentFolderId) return false;
    return favorites.list.some(f => f.id === currentFolderId);
  }, [favorites.list, currentFolderId]);

  // Handler für Root-Klick
  const handleRootClick = useCallback(() => {
    const startTime = performance.now();
    
    NavigationLogger.info('Breadcrumb', 'Root navigation requested', {
      currentPath: currentPath.length,
      activeLibrary: activeLibrary?.label
    });
    
    navigateToFolder('root');

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Root click handled', {
      duration: `${duration.toFixed(2)}ms`,
      activeLibrary: activeLibrary?.label
    });
  }, [currentPath.length, activeLibrary, navigateToFolder]);

  // Handler für Ordner-Klick
  const handleFolderClick = useCallback((folderId: string) => {
    const startTime = performance.now();
    const targetFolder = currentPath.find(item => item.id === folderId);
    
    NavigationLogger.info('Breadcrumb', 'Folder navigation requested', {
      folderId,
      folderName: targetFolder?.metadata.name,
      pathDepth: currentPath.length,
      currentFolderId
    });

    navigateToFolder(folderId);

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Folder click handled', {
      duration: `${duration.toFixed(2)}ms`,
      folderId,
      folderName: targetFolder?.metadata.name,
      isCurrentFolder: currentFolderId === folderId
    });
  }, [currentPath, currentFolderId, navigateToFolder]);

  const handleToggleFavorite = useCallback(async () => {
    if (!provider || !activeLibrary?.id) return;
    const target = currentPath.find(p => p.id === currentFolderId);
    if (!target) return;
    try {
      const data = await toggleFavorite(provider, activeLibrary.id, target);
      setFavorites({ list: data.favorites.map(f => ({ id: f.id, name: f.name, label: Array.isArray(f.path) && f.path.length ? f.path.join(' / ') : f.name })) });
      toast.success(isCurrentFav ? "Favorit entfernt" : "Favorit hinzugefügt", { description: target.metadata.name });
    } catch (e) {
      toast.error("Fehler", { description: "Favorit konnte nicht gespeichert werden" });
    }
  }, [provider, activeLibrary?.id, currentFolderId, currentPath, isCurrentFav]);

  // Auto-Scroll zum Ende des Breadcrumbs
  React.useEffect(() => {
    if (!breadcrumbRef.current) return;

    const startTime = performance.now();
    scrollStartTime.current = startTime;
    
    UILogger.debug('Breadcrumb', 'Starting auto-scroll', {
      pathDepth: currentPath.length,
      currentScrollLeft: breadcrumbRef.current.scrollLeft,
      targetScrollLeft: breadcrumbRef.current.scrollWidth,
      activeLibrary: activeLibrary?.label
    });

    breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;

    const timeoutId = setTimeout(() => {
      if (scrollStartTime.current === startTime) {
        const duration = performance.now() - startTime;
        UILogger.info('Breadcrumb', 'Auto-scroll completed', {
          duration: `${duration.toFixed(2)}ms`,
          finalScrollLeft: breadcrumbRef.current?.scrollLeft,
          pathDepth: currentPath.length
        });
        scrollStartTime.current = null;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentPath, activeLibrary]);

  return (
    <div className={cn("flex items-center gap-4 min-w-0", className)}>
      <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
        {/* Dropdown-Trigger als Icon vor dem Breadcrumb */}
        <DropdownMenu open={favOpen} onOpenChange={setFavOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
              title="Favoriten"
              aria-label="Favoriten öffnen"
            >
              {favOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {favorites.list.length === 0 ? (
              <DropdownMenuItem disabled>Keine Favoriten</DropdownMenuItem>
            ) : (
              favorites.list.map(f => (
                <DropdownMenuItem key={f.id} onClick={() => navigateToFolder(f.id)} title={f.label}>
                  {f.label}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-muted-foreground flex-shrink-0">Pfad:</span>
        <div 
          ref={breadcrumbRef}
          className="flex items-center gap-1 overflow-auto whitespace-nowrap no-scrollbar" 
          style={{ maxWidth: '60vw' }}
          onScroll={() => {
            if (scrollStartTime.current) {
              const duration = performance.now() - scrollStartTime.current;
              UILogger.debug('Breadcrumb', 'Manual scroll detected', {
                duration: `${duration.toFixed(2)}ms`,
                scrollLeft: breadcrumbRef.current?.scrollLeft
              });
              scrollStartTime.current = null;
            }
          }}
        >
          <button
            onClick={handleRootClick}
            className={cn(
              "hover:text-foreground flex-shrink-0 font-medium",
              currentFolderId === 'root' ? "text-foreground" : "text-muted-foreground"
            )}
            title="Zurück zum Hauptverzeichnis"
          >
            {activeLibrary?.label || '/'}
          </button>
          
          {currentPath
            .filter(item => item.id !== 'root' && item.metadata.name.toLowerCase() !== 'root')
            .map((item) => (
              <React.Fragment key={item.id}>
                <span className="text-muted-foreground flex-shrink-0">/</span>
                <button
                  onClick={() => handleFolderClick(item.id)}
                  className={cn(
                    "hover:text-foreground truncate max-w-[150px]",
                    currentFolderId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                  title={item.metadata.name}
                >
                  {item.metadata.name}
                </button>
              </React.Fragment>
          ))}
        </div>
        {/* Rechts: Star */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleToggleFavorite}
            className="ml-1 text-muted-foreground hover:text-foreground"
            title={isCurrentFav ? "Favorit entfernen" : "Als Favorit speichern"}
          >
            {isCurrentFav ? <Star className="h-3.5 w-3.5 fill-current" /> : <StarOff className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
} 
```

Erledigt:
- Links vor dem Breadcrumb steht jetzt nur ein Icon-Trigger:
  - Pfeil nach unten (geschlossen) bzw. Pfeil nach oben (geöffnet).
  - Klick öffnet/schließt das Favoriten-Dropdown.
- Der Text “Favoriten” wurde entfernt.
- Rechts bleibt der Stern als Toggle für den aktuellen Ordner.

Bitte prüfen:
- Icon vor “Pfad:” klappt das Dropdown auf/zu.
- Auswahl eines Eintrags navigiert korrekt.
- Stern rechts fügt/entfernt Favorit.

---

**User**

Wenn ich eine Library wechsle, wird der FileTree richtig initialisiert, die FileListe aber nicht. Es scheint so, dass dort immer die zuletzt ausgewählte Verzeichnis geladen wird. Es sind beide Listen nicht abhängig von dem selben State, aktuelles Verzeichnis, und wird dieser State nicht durch den Library-Wechsel neu initialisiert.

---

**Cursor**

```typescriptreact
"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { activeLibraryAtom, activeLibraryIdAtom, currentFolderIdAtom, folderItemsAtom, lastLoadedFolderAtom, librariesAtom } from "@/atoms/library-atom"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { createLibraryAtom } from "@/atoms/create-library-atom"
import { StateLogger } from "@/lib/debug/logger"

interface LibrarySwitcherProps {
  isCollapsed?: boolean;
  onLibraryChange?: (libraryId: string) => void;
}

export function LibrarySwitcher({ 
  isCollapsed = false, 
  onLibraryChange
}: LibrarySwitcherProps) {
  const router = useRouter();
  const [libraries] = useAtom(librariesAtom)
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom)
  const [activeLibrary] = useAtom(activeLibraryAtom)
  const [, setCurrentFolderId] = useAtom(currentFolderIdAtom)
  const [, setFolderItems] = useAtom(folderItemsAtom)
  const [, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom)
  const [, setCreateLibrary] = useAtom(createLibraryAtom)
  
  const currentLibrary = libraries.find(lib => lib.id === activeLibraryId) || activeLibrary;
  const safeLibraries = React.useMemo(() => {
    return (libraries || []).filter(lib => typeof lib.id === 'string' && lib.id.trim() !== '');
  }, [libraries]);
  
  const handleLibraryChange = (value: string) => {
    // Wenn der spezielle Wert für "Neue Bibliothek erstellen" ausgewählt wurde
    if (value === "new-library") {
      // Setze den globalen Zustand, dass eine neue Bibliothek erstellt werden soll
      setCreateLibrary(true);
      
      // Navigiere zur Einstellungsseite
      router.push("/settings");
      return;
    }
    
    // Bei Auswahl einer regulären Bibliothek den createLibrary-Zustand zurücksetzen
    setCreateLibrary(false);
    
    // Normale Bibliotheksauswahl
    if (onLibraryChange) {
      onLibraryChange(value)
    }
    
    // Speichere die aktive Library-ID im localStorage
    StateLogger.debug('LibrarySwitcher', 'Speichere activeLibraryId im localStorage', { value });
    try {
      localStorage.setItem('activeLibraryId', value)
    } catch {
      // Ignoriere Storage-Fehler still, UI-State bleibt konsistent
    }

    // Sofortiger UI-Reset, um alte Liste zu vermeiden
    setFolderItems([])
    setLastLoadedFolder(null)
    setCurrentFolderId('root')

    // Aktualisiere das Atom
    setActiveLibraryId(value);
    StateLogger.info('LibrarySwitcher', 'Bibliothek geändert zu', { libraryId: value });

    // URL bereinigen: vorhandene folderId aus der vorherigen Library entfernen
    try {
      router.replace('/library');
    } catch {}
  }

  return (
    <Select 
      value={activeLibraryId} 
      onValueChange={handleLibraryChange}
    >
      <SelectTrigger
        className={cn(
          "flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden"
        )}
        aria-label="Bibliothek auswählen"
      >
        <SelectValue placeholder="Bibliothek auswählen">
          {currentLibrary?.icon}
          <span className={cn("ml-2", isCollapsed && "hidden")}>
            {currentLibrary?.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Bibliotheken</SelectLabel>
          {safeLibraries.map((library) => (
            <SelectItem key={library.id} value={library.id}>
              <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
                {library.icon}
                {library.label}
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
        
        {/* Trennlinie und Eintrag zum Erstellen einer neuen Bibliothek */}
        <SelectSeparator className="my-2" />
        <SelectItem value="new-library">
          <div className="flex items-center gap-3 text-primary">
            <Plus className="h-4 w-4" />
            Neue Bibliothek erstellen
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
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
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useFolderNavigation } from "@/hooks/use-folder-navigation"
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
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
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
      setIsMobile(matches);
      setIsTreeVisible(!matches);
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

    loadInFlightRef.current = true;
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
      loadInFlightRef.current = false;
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
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

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
              <ResizablePanelGroup
                key={isTreeVisible ? 'with-tree' : 'no-tree'}
                direction="horizontal"
                className="h-full"
                autoSaveId={isTreeVisible ? "library-panels-3" : "library-panels-2"}
              >
                {isTreeVisible && (
                  <>
                    <ResizablePanel key="tree-panel" id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle key="tree-handle" />
                  </>
                )}
                <ResizablePanel key="list-panel" id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle key="list-preview-handle" />
                <ResizablePanel key="preview-panel" id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
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

```typescript
"use client";
/**
 * useFolderNavigation Hook
 *
 * Bietet eine zentrale navigateToFolder Funktion, die beim Ordnerwechsel
 * den gesamten Pfad in den folderCache schreibt und currentFolderId setzt.
 *
 * @returns navigateToFolder(folderId: string): Promise<void>
 */
import { useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { libraryAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { NavigationLogger, StateLogger } from '@/lib/debug/logger';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useFolderNavigation() {
  const { provider } = useStorage();
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const setCurrentFolderId = useSetAtom(currentFolderIdAtom);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Navigiert zu einem Ordner, cached den Pfad und setzt currentFolderId
   * @param folderId Ziel-Ordner-ID
   */
  const navigateToFolder = useCallback(async (folderId: string) => {
    if (!provider) return;

    NavigationLogger.info('debug@nav', 'navigateToFolder called', { folderId });

    // Prüfe, ob der gesamte Pfad schon im Cache ist
    const folderCache = libraryState.folderCache || {};
    let currentId = folderId;
    let allInCache = true;
    const missingIds: string[] = [];
    while (currentId && currentId !== 'root') {
      if (!folderCache[currentId]) {
        allInCache = false;
        missingIds.push(currentId);
        break;
      }
      currentId = folderCache[currentId].parentId;
    }

    if (allInCache && folderCache[folderId]) {
      StateLogger.info('FolderNavigation', 'Cache hit for folder path', { folderId });
      setCurrentFolderId(folderId);
      // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
      try {
        const params = new URLSearchParams(searchParams ?? undefined);
        // Wenn die activeLibraryId im Query nicht zur aktuellen Library passt, entferne folderId
        params.set('folderId', folderId);
        const url = `${pathname}?${params.toString()}`;
        NavigationLogger.debug('debug@nav', 'URL updated (cache hit)', { url, folderId });
        router.replace(url);
      } catch {}
      return;
    }

    StateLogger.info('FolderNavigation', 'Cache miss, loading path from provider', { folderId, missingIds });
    // Sonst wie bisher: API-Call und Cache auffüllen
    const pathItems = await provider.getPathItemsById(folderId);
    NavigationLogger.info('debug@nav', 'Loaded path items for folder', { folderId, pathLength: pathItems.length });
    setLibraryState(state => {
      const newCache = { ...state.folderCache };
      pathItems.forEach(folder => {
        newCache[folder.id] = folder;
      });
      return { ...state, folderCache: newCache };
    });
    setCurrentFolderId(folderId);
    // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
    try {
      const params = new URLSearchParams(searchParams ?? undefined);
      params.set('folderId', folderId);
      const url = `${pathname}?${params.toString()}`;
      NavigationLogger.debug('debug@nav', 'URL updated (cache miss)', { url, folderId });
      router.replace(url);
    } catch {}
  }, [provider, setLibraryState, setCurrentFolderId, libraryState.folderCache, router, pathname, searchParams]);

  return navigateToFolder;
} 
```

Guter Fund. Ursache: Die URL enthielt noch die alte folderId, und FileList hielt noch Auswahl/State. Ich habe Folgendes angepasst:

- Beim Library-Wechsel
  - `library-switcher.tsx`: URL wird auf `/library` zurückgesetzt (entfernt alte folderId).
  - `library.tsx`: Neben Cache und Items werden jetzt auch `selectedFile` und `selectedShadowTwin` auf null gesetzt.

- Initial-Load Gate
  - `library.tsx`: Wenn eine folderId in der URL steht, wird der Root-Initial-Load übersprungen, bis diese angewendet ist. Damit wird die FileList nicht mehr “versehentlich” aus dem alten Ordner vorgeladen.

- Navigation
  - `use-folder-navigation.ts`: Logs beibehalten; URL wird konsistent aktualisiert. (Wenn du willst, kann ich zusätzlich prüfen, ob eine activeLibraryId im Query ungleich ist und dann folderId droppen.)

Bitte testen:
1) Zu Library A in tiefes Verzeichnis navigieren.
2) Auf Library B wechseln.
3) FileTree sollte B:root anzeigen; FileList darf NICHT A:zuletzt geladen sein. Es sollte B:root oder die explizite URL-folderId von B laden.
4) Wechsel zurück zu A: die Auswahl ist zurückgesetzt; URL wird sauber erneuert.

Wenn FileList weiterhin den falschen Ordner lädt, gib mir kurz die Debug-Logs (debug@init/debug@nav/Library: Loading initial items). Dann hänge ich eine zusätzliche Validierung ein, die folderId sofort verwirft, wenn sie nicht zum aktuellen Library-Pfad gehört.

---

**User**

Nein das hat nicht mit dieser Verzeichnis id zu tun. Ich denke es hat was mit dieser ROOT Auflösung zu tun. Im FileTree wird bei nach einem Verzeichniswechsel der richtigen Verzeichnisse angezeigt. In der FileListe sind es noch die Files aus der vorhergehenden Library.


---

**Cursor**

```typescriptreact
*** Begin Patch
*** Update File: src/components/library/library.tsx
@@
   const loadItems = useCallback(async () => {
     if (loadInFlightRef.current) {
       NavigationLogger.debug('Library', 'Skip loadItems - load already in flight');
       return;
     }
-    if (!providerInstance || libraryStatus !== 'ready') {
+    if (!providerInstance || libraryStatus !== 'ready') {
       NavigationLogger.debug('Library', 'Skipping loadItems - not ready', {
         hasProvider: !!providerInstance,
         status: libraryStatus
       });
       return;
     }
+
+    // Verhindere Laden mit altem Provider (Race beim Library-Wechsel)
+    if (currentLibrary?.id && currentLibrary.id !== activeLibraryId) {
+      NavigationLogger.debug('Library', 'Provider/library mismatch, defer load', {
+        providerLibraryId: currentLibrary.id,
+        activeLibraryId
+      });
+      return;
+    }
@@
-  }, [
+  }, [
     currentFolderId,
     lastLoadedFolder,
     listItems,
     libraryState.folderCache,
     providerInstance,
     libraryStatus,
+    currentLibrary?.id,
     setLibraryState,
     setFolderItems,
     setLastLoadedFolder,
     setLoadingState,
     toast,
     currentLibrary
   ]);
@@
-  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems]);
+  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, currentLibrary?.id, loadItems]);
*** End Patch
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
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useFolderNavigation } from "@/hooks/use-folder-navigation"
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
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
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
      setIsMobile(matches);
      setIsTreeVisible(!matches);
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
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

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
              <ResizablePanelGroup
                key={isTreeVisible ? 'with-tree' : 'no-tree'}
                direction="horizontal"
                className="h-full"
                autoSaveId={isTreeVisible ? "library-panels-3" : "library-panels-2"}
              >
                {isTreeVisible && (
                  <>
                    <ResizablePanel key="tree-panel" id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle key="tree-handle" />
                  </>
                )}
                <ResizablePanel key="list-panel" id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle key="list-preview-handle" />
                <ResizablePanel key="preview-panel" id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
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

Verstanden. Das ist ein Race zwischen altem und neuem Context beim Library-Wechsel: Der FileTree lädt synchron mit neuem Provider/Root, die FileList übernimmt aber manchmal noch das Ergebnis eines vorigen Loads.

Ich habe drei harte Guards eingebaut:
- Mismatch-Guard vor dem Laden: Abbrechen, wenn `currentLibrary.id !== activeLibraryId`.
- Snapshot-Guard während des Loads: Vor dem Laden `expectedLibraryId/currentFolderId` merken; nach dem Fetch verwerfen, wenn sich in der Zwischenzeit Library oder Ordner geändert hat.
- Reset beim Library-Wechsel: Neben Cache/Items werden `selectedFile` und `selectedShadowTwin` auf null gesetzt; URL wird auf `/library` zurückgesetzt (keine alte folderId).

Konkrete Änderungen
- `src/components/library/library.tsx`
  - Vor dem Laden: Skip bei Library-Mismatch.
  - Nach Cache/Fetch: Nur anwenden, wenn Snapshot noch passt; ansonsten “Discard loaded items due to context change”.
- `src/components/library/library-switcher.tsx`
  - Nach Wechsel: `router.replace('/library')` (löscht alte Query-folderId).
- `src/components/library/library.tsx` (bereits vorher)
  - Reset von Auswahl und Cache bei Librarywechsel.

Bitte testen
1) Library A tiefes Verzeichnis laden.
2) Sofort zu Library B wechseln.
3) FileTree zeigt B:root; FileList darf jetzt nicht mehr A-Dateien übernehmen. Bei Logs solltest du ggf. eine “Discard loaded items due to context change”-Zeile sehen, falls ein Rennen vorlag.

Wenn noch Fälle auftreten, markieren wir die Loads zusätzlich mit einer `loadToken`-Ref und prüfen diesen Token vor jedem `setState`, um Übernahmen 100% zu verhindern.

