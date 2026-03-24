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
import { NavigationLogger, StateLogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { useFolderNavigation } from "@/hooks/use-folder-navigation"
import { uiPanePrefsAtom } from "@/atoms/ui-prefs-atom"
export function Library() {
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
  const [, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);
  
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
  const router = useRouter();
  const navigateToFolder = useFolderNavigation();
  const openFileIdProcessedRef = React.useRef(false);

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
      urlInitAppliedRef.current = true;
      return;
    }

    if (!providerInstance || libraryStatus !== 'ready') {
      return;
    }

    if (folderIdFromUrl !== currentFolderId) {
      void navigateToFolder(folderIdFromUrl);
    }
    urlInitAppliedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, providerInstance, libraryStatus, currentFolderId]);

  // openFileId aus URL: Dokument im Archiv öffnen (z.B. von Galerie „Im Archiv öffnen“)
  React.useEffect(() => {
    const openFileId = searchParams?.get('openFileId');
    if (!openFileId || openFileIdProcessedRef.current) return;
    if (!providerInstance || libraryStatus !== 'ready') return;
    if (currentLibrary?.id !== activeLibraryId) return;

    openFileIdProcessedRef.current = true;

    void (async () => {
      try {
        const item = await providerInstance.getItemById(openFileId);
        await navigateToFolder(item.parentId || 'root');
        setSelectedFile(item);
        setSelectedShadowTwin(null);
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.delete('openFileId');
        router.replace(params.toString() ? `/library?${params.toString()}` : '/library');
      } catch (err) {
        NavigationLogger.warn('Library', 'openFileId: Item nicht gefunden oder Fehler', {
          openFileId,
          error: err instanceof Error ? err.message : String(err),
        });
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.delete('openFileId');
        router.replace(params.toString() ? `/library?${params.toString()}` : '/library');
      }
    })();
  }, [searchParams, providerInstance, libraryStatus, activeLibraryId, currentLibrary?.id, navigateToFolder, setSelectedFile, setSelectedShadowTwin, router]);

  // Mobile-View Wechsellogik: bei Dateiauswahl zur Vorschau wechseln
  React.useEffect(() => {
    if (!isMobile) return;
    if (selectedFile) setMobileView('preview');
  }, [isMobile, selectedFile]);

  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    console.log('[Library] 🔄 loadItems aufgerufen:', {
      hasProvider: !!providerInstance,
      libraryStatus,
      currentFolderId,
      activeLibraryId,
      currentLibraryId: currentLibrary?.id?.substring(0, 8) + '...',
      loadInFlight: loadInFlightRef.current,
      timestamp: new Date().toISOString()
    });
    
    if (loadInFlightRef.current) {
      console.log('[Library] ⏸️ Load bereits in Flight - überspringe');
      return;
    }
    if (!providerInstance || libraryStatus !== 'ready') {
      console.log('[Library] ⏸️ Provider nicht bereit:', {
        hasProvider: !!providerInstance,
        libraryStatus
      });
      return;
    }

    // Schutz: Wenn Provider/Context noch auf alte Library zeigt, keine Items übernehmen
    if (currentLibrary?.id && currentLibrary.id !== activeLibraryId) {
      console.warn('[Library] ⚠️ Library-Mismatch - überspringe:', {
        currentLibraryId: currentLibrary.id.substring(0, 8) + '...',
        activeLibraryId: activeLibraryId.substring(0, 8) + '...'
      });
      return;
    }

    // RACE-CONDITION-FIX: Setze lastLoadedFolder SOFORT, bevor der API-Call gemacht wird,
    // um doppelte Calls zu vermeiden (wird bei Context-Change zurückgesetzt)
    loadInFlightRef.current = true;
    setLastLoadedFolder(currentFolderId); // Optimistisch setzen
    setLoadingState({ isLoading: true, loadingFolderId: currentFolderId });
    
    console.log('[Library] 🚀 Starte Item-Loading:', {
      folderId: currentFolderId,
      libraryId: activeLibraryId.substring(0, 8) + '...',
      timestamp: new Date().toISOString()
    });

    try {
      // Snapshot zur Vermeidung von Race-Conditions
      const expectedLibraryId = activeLibraryId;
      const expectedFolderId = currentFolderId;

      // Prüfe Cache zuerst (verwende aktuellen State über setLibraryState)
      // WICHTIG: libraryState.folderCache wird über Closure verwendet, nicht über Dependencies
      const currentState = libraryState;
      if (currentState.folderCache?.[currentFolderId]?.children) {
        const cachedItems = currentState.folderCache[currentFolderId].children;
        NavigationLogger.info('Library', 'Using cached items', {
          folderId: currentFolderId,
          itemCount: cachedItems.length,
          cacheHit: true
        });
        // Übernehme nur, wenn der Snapshot noch aktuell ist
        if (expectedLibraryId === activeLibraryId && expectedFolderId === currentFolderId) {
          setFolderItems(cachedItems);
          // lastLoadedFolder wurde bereits oben optimistisch gesetzt
        } else {
          // Context hat sich geändert, setze lastLoadedFolder zurück
          setLastLoadedFolder(null);
        }
        return;
      }

      // Performance-Messung: API-Call für Items
      const apiCallStart = performance.now();
      const items = await listItems(currentFolderId);
      const apiCallDuration = performance.now() - apiCallStart;
      
      console.log('[Library] ✅ Items geladen:', {
        itemCount: items.length,
        folderId: currentFolderId,
        apiCallDuration: `${apiCallDuration.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      });
      
      if (apiCallDuration > 500) {
        console.warn(`[Library Performance] ⚠️ Langsamer API-Call: ${apiCallDuration.toFixed(2)}ms für ${items.length} Items`);
      }

      // Falls während des Ladens die Library oder der Ordner wechselte: Ergebnis verwerfen
      if (expectedLibraryId !== activeLibraryId || expectedFolderId !== currentFolderId) {
        console.warn('[Library] ⚠️ Context geändert während Loading - verwerfe Ergebnis:', {
          expectedLibraryId: expectedLibraryId.substring(0, 8) + '...',
          activeLibraryId: activeLibraryId.substring(0, 8) + '...',
          expectedFolderId,
          currentFolderId
        });
        // Context hat sich geändert, setze lastLoadedFolder zurück
        setLastLoadedFolder(null);
        return;
      }
      
      // Update Cache und State (auch für Root-Items)
      // PERFORMANCE-OPTIMIERUNG: Cache auch für Root-Items verwenden
      // WICHTIG: Verwende aktuellen State über Closure, nicht über Dependencies
      const currentCache = currentState.folderCache;
      const newFolderCache = { ...currentCache };
      if (currentFolderId === 'root') {
        // Root-Items auch cachen (für FileTree und andere Komponenten)
        // Erstelle virtuelles Root-Item im Cache
        if (!newFolderCache['root']) {
          newFolderCache['root'] = {
            id: 'root',
            parentId: '',
            type: 'folder',
            metadata: {
              name: 'root',
              size: 0,
              modifiedAt: new Date(),
              mimeType: 'application/folder'
            },
            children: items
          };
        } else {
          newFolderCache['root'] = {
            ...newFolderCache['root'],
            children: items
          };
        }
      } else {
        const parent = newFolderCache[currentFolderId];
        if (parent) {
          newFolderCache[currentFolderId] = {
            ...parent,
            children: items
          };
        }
      }
      
          setLibraryState(state => ({
            ...state,
            folderCache: newFolderCache
          }));
      
      setFolderItems(items);
      // lastLoadedFolder wurde bereits oben optimistisch gesetzt
      
    } catch (error) {
      if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
        StateLogger.info('Library', 'Auth required');
        // Keine Fehlermeldung für AUTH_REQUIRED anzeigen
      } else if (error instanceof Error && error.name === 'RateLimitError') {
        // Rate-Limit: Freundliche Meldung + automatischer Retry nach 10s
        StateLogger.warn('Library', 'Rate-Limit erreicht, Retry in 10s');
        toast({
          title: "Server vorübergehend überlastet",
          description: "Rate-Limit erreicht. Automatischer Retry in 10 Sekunden...",
        });
        // Sperre lösen, damit der Retry starten kann
        loadInFlightRef.current = false;
        setLastLoadedFolder(null);
        setTimeout(() => {
          loadItems();
        }, 10000);
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
    // WICHTIG: libraryState.folderCache NICHT in Dependencies, um Endlosschleife zu vermeiden!
    // libraryState.folderCache wird innerhalb der Funktion über Closure verwendet
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return;
    }

    // Prüfe, ob eine folderId in der URL steht
    const folderIdFromUrl = searchParams?.get('folderId');
    
    // Wenn eine folderId in der URL steht und currentFolderId noch 'root' ist,
    // verhindere das Laden von Root-Items (wird durch navigateToFolder geladen)
    // Dies verhindert unnötige Root-Loads beim direkten Navigieren zu einem Unterordner
    // WICHTIG: Prüfe direkt folderIdFromUrl, nicht urlInitAppliedRef (Race-Condition vermeiden)
    if (folderIdFromUrl && folderIdFromUrl !== 'root' && currentFolderId === 'root') {
      return;
    }

    // Root-Items laden nur wenn:
    // 1. Wir tatsächlich im Root sind UND
    // 2. Root noch nicht geladen wurde UND
    // 3. Keine folderId in der URL steht (wird durch navigateToFolder geladen)
    if (currentFolderId === 'root' && lastLoadedFolder !== 'root' && !loadInFlightRef.current) {
      loadItems();
      return;
    }

    // WICHTIG: Bei Navigation (z.B. Breadcrumb-Klick) wird currentFolderId sofort gesetzt,
    // aber folderIdFromUrl wird asynchron aktualisiert. Daher prüfen wir hier nur,
    // ob currentFolderId sich geändert hat (lastLoadedFolder !== currentFolderId).
    // Die folderIdFromUrl-Prüfung wird nur beim initialen Laden verwendet (wenn lastLoadedFolder noch null ist).
    // Dies verhindert Race-Conditions bei Breadcrumb-Navigation.
    if (lastLoadedFolder === null && folderIdFromUrl && folderIdFromUrl !== currentFolderId && currentFolderId !== 'root') {
      // Nur beim initialen Laden: Wenn folderIdFromUrl vorhanden ist und nicht mit currentFolderId übereinstimmt,
      // warte auf navigateToFolder, das die URL synchronisiert
      return;
    }

    // Nur laden wenn noch nicht geladen
    if (lastLoadedFolder !== currentFolderId && !loadInFlightRef.current) {
      loadItems();
    }
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems, searchParams]);

  // Zusätzlicher Reset bei Bibliothekswechsel (robust gegen Status-Race)
  // WICHTIG: Nur bei Bibliothekswechsel, nicht bei Ordnerwechsel!
  // currentFolderId wird NICHT in die Dependencies aufgenommen, da sonst der Cache
  // bei jedem Ordnerwechsel zurückgesetzt wird, was den Breadcrumb-Pfad löscht
  const prevActiveLibraryIdRef = React.useRef<string | undefined>(activeLibraryId);
  useEffect(() => {
    if (!activeLibraryId) return;
    
    // Nur zurücksetzen, wenn sich die Bibliothek wirklich geändert hat
    const libraryChanged = prevActiveLibraryIdRef.current !== undefined && 
                          prevActiveLibraryIdRef.current !== activeLibraryId;
    
    if (libraryChanged) {
    setLastLoadedFolder(null);
    setFolderItems([]);
    setLibraryState(state => ({ ...state, folderCache: {} }));
    // WICHTIG: Ordnerauswahl und Shadow-Twin zurücksetzen
    setSelectedFile(null);
    setSelectedShadowTwin(null);
    }
    
    prevActiveLibraryIdRef.current = activeLibraryId;
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, setSelectedFile, setSelectedShadowTwin]);

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
        isTreeVisible={isTreeVisible}
        onToggleTree={() => setUiPrefs({ treeVisible: !isTreeVisible })}
        isCompactList={isListCompact}
        onToggleCompactList={() => setUiPrefs({ listCompact: !isListCompact })}
      >
        <Breadcrumb />
      </LibraryHeader>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        {isReviewMode ? (
          // Review: eine Vorschau — Vergleich Original|Transkript passiert im Transkript-Tab (file-preview), nicht als zweite FilePreview.
          // FileList: dieselbe compact-Präferenz wie im Normal-Layout (nicht erzwingend compact=true — sonst fehlen Kopfzeile/Spalten und wirkt die Liste „zerschossen‘).
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel
              defaultSize={isListCompact ? 28 : 34}
              minSize={isListCompact ? 18 : 22}
              className="min-h-0"
            >
              <div className="h-full overflow-auto flex flex-col">
                <FileList compact={isListCompact} />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel
              defaultSize={isListCompact ? 72 : 66}
              minSize={40}
              className="min-h-0"
            >
              <div className="h-full relative flex flex-col">
                {selectedFile ? (
                  <FilePreviewLazy
                    provider={providerInstance}
                    file={selectedFile}
                    onClearCacheBeforeReview={clearCache}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                    StateLogger.info('Library', 'FilePreview (Review) onRefreshFolder aufgerufen', {
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
                        onClearCacheBeforeReview={clearCache}
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
                        onClearCacheBeforeReview={clearCache}
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
      
    </div>
  );
}