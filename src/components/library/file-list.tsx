'use client';

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  RefreshCw,
  Trash2,
  Folder as FolderIcon,
  FolderSync,
  Layers,
  ImagePlus,
  Combine,
} from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { useAtomValue, useAtom } from 'jotai';
import { 
  activeLibraryIdAtom,
  activeLibraryAtom,
  selectedFileAtom, 
  folderItemsAtom,
  sortedFilteredFilesAtom,
  sortFieldAtom,
  sortOrderAtom,
  selectedShadowTwinAtom,
  currentFolderIdAtom
} from '@/atoms/library-atom';
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox"
import {
  selectedBatchItemsAtom,
  selectedTransformationItemsAtom,
  getMediaType,
  fileCategoryFilterAtom,
} from '@/atoms/transcription-options';
import { useMemo, useCallback } from "react"
import { FileLogger, StateLogger } from "@/lib/debug/logger"
import { FileCategoryFilter } from './file-category-filter';
import { useFolderNavigation } from "@/hooks/use-folder-navigation";
import { useShadowTwinAnalysis } from "@/hooks/use-shadow-twin-analysis";
import { shadowTwinAnalysisTriggerAtom, shadowTwinStateAtom } from "@/atoms/shadow-twin-atom";
import { isShadowTwinFolderName } from "@/lib/storage/shadow-twin";
import { shouldFilterShadowTwinFolders } from "@/lib/storage/shadow-twin-folder-name";
import { isImageMediaFromName } from "@/lib/media-types";
import { CompositeMultiCreateDialog, deriveCompositeMultiDefaultFilename } from "./composite-multi-create-dialog";
import {
  CompositeTransformationsCreateDialog,
  deriveCompositeTransformationsDefaultFilename,
  type DialogTemplateEntry,
} from "./composite-transformations-create-dialog";

// Sub-Module aus dem file-list/-Verzeichnis (Welle 3-I, Schritt 4b-Split):
import {
  type SortField,
  type FileGroup,
  formatFileSize,
  formatDate,
} from './file-list/list-utils';
import { SortableHeaderCell } from './file-list/sortable-header-cell';
import { FileRow } from './file-list/file-row';

// `ListCoverThumbnail`, `getFileTypeFromName`, `FileIconComponent`,
// `formatFileSize`, `formatDate`, `SortableHeaderCell`, `FileRow` und die
// zugehoerigen Typen wurden in `./file-list/` ausgelagert
// (Welle 3-I, Schritt 4b — siehe `welle-3-schale-loader-contracts.mdc` §6).

// Lokal nicht-mehr genutzte Funktion: das alte getFileTypeFromName war hier
// definiert, lebt jetzt in `./file-list/list-utils.ts`.

interface FileListProps {
  compact?: boolean;
}

export const FileList = React.memo(function FileList({ compact = false }: FileListProps): JSX.Element {
  // Performance-Messung: Gesamter Render-Zyklus
  const renderStartRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    renderStartRef.current = performance.now();
    return () => {
      if (renderStartRef.current !== null) {
        const duration = performance.now() - renderStartRef.current;
        if (duration > 100) {
          console.log(`[FileList Performance] Gesamter Render-Zyklus: ${duration.toFixed(2)}ms`);
        }
      }
    };
  });
  
  const { provider, refreshItems, currentLibrary } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isFolderSyncing, setIsFolderSyncing] = React.useState(false);
  // Mobile-Flag wurde entfernt, FileList lädt unabhängig vom View
  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initializationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Entkoppelt: Kein Warten mehr auf FileTree-Status
  const [activeFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const currentCategoryFilter = useAtomValue(fileCategoryFilterAtom);
  const allItemsInFolder = useAtomValue(folderItemsAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const navigateToFolder = useFolderNavigation();
  const listContainerRef = React.useRef<HTMLDivElement | null>(null);
  
  // Prüfe, ob eine folderId in der URL steht
  const searchParams = useSearchParams();
  const folderIdFromUrl = searchParams?.get('folderId');
  
  // Zeige nur Items an, wenn currentFolderId mit dem geladenen Ordner übereinstimmt
  // Oder wenn keine folderId in der URL steht (normale Root-Anzeige)
  const shouldShowItems = React.useMemo(() => {
    // Wenn eine folderId in der URL steht, zeige nur Items an, wenn currentFolderId nicht 'root' ist
    // (verhindert, dass Root-Items angezeigt werden, wenn direkt zu einem Unterverzeichnis navigiert wird)
    if (folderIdFromUrl && folderIdFromUrl !== 'root') {
      return currentFolderId !== 'root';
    }
    // Normale Anzeige: zeige Items immer an
    return true;
  }, [folderIdFromUrl, currentFolderId]);

  // Shadow-Twin-Analyse für alle Dateien im Ordner
  // Shadow-Twin-Analyse mit Trigger für manuelles Neustarten
  const [shadowTwinAnalysisTrigger, setShadowTwinAnalysisTrigger] = useAtom(shadowTwinAnalysisTriggerAtom);
  
  // Performance-Messung: Shadow-Twin-Analyse Start
  const shadowTwinAnalysisStartRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (allItemsInFolder && allItemsInFolder.length > 0) {
      shadowTwinAnalysisStartRef.current = performance.now();
      console.log(`[FileList Performance] Shadow-Twin-Analyse gestartet für ${allItemsInFolder.length} Dateien`);
    }
  }, [allItemsInFolder, allItemsInFolder?.length]);
  
  useShadowTwinAnalysis(allItemsInFolder ?? [], provider, shadowTwinAnalysisTrigger);
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom);
  
  // Performance-Messung: Shadow-Twin-Analyse Ende
  React.useEffect(() => {
    if (shadowTwinAnalysisStartRef.current !== null && shadowTwinStates.size > 0) {
      const duration = performance.now() - shadowTwinAnalysisStartRef.current;
      console.log(`[FileList Performance] Shadow-Twin-Analyse abgeschlossen: ${duration.toFixed(2)}ms für ${shadowTwinStates.size} analysierte Dateien`);
      shadowTwinAnalysisStartRef.current = null;
    }
  }, [shadowTwinStates.size]);

  // Kein mobiles Flag mehr notwendig

  // Sortier-Atome VOR folders definieren, da folders diese referenziert
  const items = useAtomValue(sortedFilteredFilesAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);

  const hideShadowTwinFolders = shouldFilterShadowTwinFolders(
    activeLibrary?.config?.shadowTwin as { primaryStore?: string; persistToFilesystem?: boolean } | undefined
  );

  const folders = useMemo(() => {
    if (!shouldShowItems) {
      return [];
    }
    const items = allItemsInFolder ?? [];
    // Shadow-Twin-Ordner nur verstecken, wenn Filesystem-Persistierung aktiv ist.
    // Ohne FS-Persistierung sind `_`-Ordner reguläre Benutzer-Verzeichnisse.
    const filtered = items.filter(
      item => item.type === 'folder' && (!hideShadowTwinFolders || !isShadowTwinFolderName(item.metadata.name))
    );
    
    // Sortiere Ordner nach aktuellem Sortierfeld und -richtung
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.metadata.name.localeCompare(b.metadata.name);
          break;
        case 'size':
          cmp = (a.metadata.size || 0) - (b.metadata.size || 0);
          break;
        case 'date':
          cmp = new Date(a.metadata.modifiedAt ?? 0).getTime() - new Date(b.metadata.modifiedAt ?? 0).getTime();
          break;
        default:
          // Fallback: alphabetisch nach Name
          cmp = a.metadata.name.localeCompare(b.metadata.name);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [allItemsInFolder, shouldShowItems, sortField, sortOrder]);

  // Hilfsfunktion zum Finden einer FileGroup in der Map
  const findFileGroup = useCallback((map: Map<string, FileGroup>, stem: string): FileGroup | undefined => {
    return Array.from((map ?? new Map()).values()).find(group => 
      group.baseItem && getBaseName(group.baseItem.metadata.name) === stem
    );
  }, []); // Stabile Utility-Funktion ohne Dependencies

  // Review-Mode-Atoms
  const [selectedFile] = useAtom(selectedFileAtom);
  const [, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);

  // handleSort nutzt jetzt Atome
  const handleSort = React.useCallback((field: SortField) => {
    if (field === sortField) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder, setSortField, setSortOrder]);

  // Initialisierung - nur auf Provider und Mobile-Flag achten
  React.useEffect(() => {
    if (!provider) {
      // Warte auf Provider (kein Log nötig)
      return;
    }

    const initialize = async () => {
      if (isInitialized) {
        // Bereits initialisiert (kein Log nötig)
        return;
      }

      // Starte Initialisierung (kein Log nötig)

      try {
        // Initialisierung abgeschlossen (kein Log nötig)
        setIsInitialized(true);
      } catch (error) {
        FileLogger.error('FileList', 'Error initializing FileList', error);
      }
    };

    initialize();

    const timeoutRef = initializationTimeoutRef.current;
    return () => {
      if (timeoutRef) clearTimeout(timeoutRef);
    };
  }, [provider, isInitialized]);

  // NEU: Reagieren auf Bibliothekswechsel
  const prevLibraryIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    // Nur bei tatsächlichem Bibliothekswechsel zurücksetzen
    if (prevLibraryIdRef.current !== null && prevLibraryIdRef.current !== activeLibraryId) {
      setIsInitialized(false);
      setSelectedFile(null);
      setFolderItems([]);
      setSelectedBatchItems([]);
      setSelectedTransformationItems([]);
      setSelectedShadowTwin(null);
      StateLogger.info('FileList', 'Bibliothek gewechselt - State zurückgesetzt', {
        libraryId: activeLibraryId
      });
    }
    prevLibraryIdRef.current = activeLibraryId;
  }, [activeLibraryId, setSelectedFile, setFolderItems, setSelectedBatchItems, setSelectedTransformationItems, setSelectedShadowTwin]);

  // Vereinfachte Funktion zum Extrahieren des Basisnamens (ohne Endung, auch für Binärdateien)
  // Variante C: Kein lokales Parsing mehr - nutzt nur noch ShadowTwinState aus API
  function getBaseName(name: string): string {
    // Fallback: alles vor der letzten Endung (für normale Dateien)
    // Wird nur noch für Gruppierung verwendet, wenn kein ShadowTwinState vorhanden ist
    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) return name;
    return name.substring(0, lastDot);
  }

  // Prüft ob eine Datei ein ShadowTwin ist (Markdown mit Sprachkürzel)
  // Variante C: Kein lokales Parsing mehr - nutzt nur noch ShadowTwinState aus API
  // Diese Funktion wird nur noch als Fallback verwendet, wenn ShadowTwinState nicht verfügbar ist
  function isShadowTwin(name: string): boolean {
    // Einfache Heuristik: Markdown-Dateien mit Sprachkürzel
    return name.toLowerCase().endsWith('.md') && /\.(de|en|fr|es|it)\.md$/i.test(name);
  }

  // Gruppiere die Dateien nach Basename (verwendet zentrale Shadow-Twin-Analyse)
  const fileGroups = useMemo(() => {
    const perfStart = performance.now();
    if (!items) return new Map<string, FileGroup>();

    // Schritt 1: Gruppiere alle Dateien nach Basename
    const groupsMap = new Map<string, StorageItem[]>();
    
    for (const item of items) {
      if (item.type === 'file') {
        const base = getBaseName(item.metadata.name);
        if (!groupsMap.has(base)) groupsMap.set(base, []);
        groupsMap.get(base)!.push(item);
      }
    }

    // Schritt 2: Erstelle FileGroups unter Verwendung der zentralen Shadow-Twin-Analyse
    const fileGroupsMap = new Map<string, FileGroup>();
    for (const [base, groupItems] of Array.from(groupsMap.entries())) {
      // Finde Hauptdatei (erste Nicht-ShadowTwin-Datei)
      const mainFile = groupItems.find((item) => !isShadowTwin(item.metadata.name));
      // Finde alle ShadowTwins im gleichen Verzeichnis (alte Logik für Kompatibilität)
      const shadowTwins = groupItems.filter((item) => isShadowTwin(item.metadata.name));
      
      // Verwende lowercase Key für konsistente Gruppierung
      const baseKey = base.toLowerCase();
      
      if (mainFile) {
        // Verwende zentrale Shadow-Twin-Analyse
        const shadowTwinState = shadowTwinStates.get(mainFile.id);
        
        fileGroupsMap.set(baseKey, {
          baseItem: mainFile,
          transcriptFiles: shadowTwinState?.transcriptFiles || (shadowTwins.length > 0 ? shadowTwins : undefined),
          transformed: shadowTwinState?.transformed,
          shadowTwinFolderId: shadowTwinState?.shadowTwinFolderId,
          ingestionStatus: shadowTwinState?.ingestionStatus,
          listMeta: shadowTwinState?.listMeta,
        });
      } else {
        // Keine Hauptdatei: Jede ShadowTwin einzeln anzeigen
        for (const twin of shadowTwins) {
          fileGroupsMap.set(`${baseKey}__shadow_${twin.id}`, {
            baseItem: twin,
            transcriptFiles: undefined,
            transformed: undefined
          });
        }
      }
    }
    
    const perfEnd = performance.now();
    const perfDuration = perfEnd - perfStart;
    if (perfDuration > 10) {
      console.log(`[FileList Performance] fileGroups Berechnung: ${perfDuration.toFixed(2)}ms für ${items.length} Items`);
    }
    
    return fileGroupsMap;
  }, [items, shadowTwinStates]);

  // Verwende fileGroups direkt (Shadow-Twin-Analyse erfolgt bereits über Hook)
  // Wenn eine folderId in der URL steht und currentFolderId noch 'root' ist,
  // zeige keine Items an (verhindert, dass Root-Items kurz angezeigt werden)
  const fileGroupsWithShadowTwinFolders = React.useMemo(() => {
    return shouldShowItems ? fileGroups : new Map<string, FileGroup>();
  }, [shouldShowItems, fileGroups]);

  // Navigationsliste: nur Hauptdateien in der aktuell sichtbaren Reihenfolge
  const mainFileItems = React.useMemo(() => {
    return Array.from((fileGroupsWithShadowTwinFolders ?? new Map()).values())
      .map(g => g.baseItem)
      .filter((it): it is StorageItem => Boolean(it));
  }, [fileGroupsWithShadowTwinFolders]);

  // Hilfsfunktion: Gruppe anhand baseItem.id finden
  const findGroupByBaseItemId = React.useCallback((baseItemId: string) => {
    for (const g of Array.from((fileGroupsWithShadowTwinFolders ?? new Map()).values())) {
      if (g.baseItem && g.baseItem.id === baseItemId) return g;
    }
    return undefined;
  }, [fileGroupsWithShadowTwinFolders]);
  
  // WICHTIG: Automatisch selectedShadowTwin aktualisieren, wenn Shadow-Twin-Analyse abgeschlossen ist
  // und eine Transformation vorhanden ist. Dies stellt sicher, dass nach einer Transformation
  // automatisch die transformierte Datei angezeigt wird, nicht das Transcript.
  // MUSS nach findGroupByBaseItemId definiert werden!
  React.useEffect(() => {
    if (!selectedFile) {
      setSelectedShadowTwin(null);
      return;
    }
    
    const group = findGroupByBaseItemId(selectedFile.id);
    if (group) {
      // Bevorzuge transformierte Datei (hat Frontmatter), sonst Transcript
      if (group.transformed) {
        setSelectedShadowTwin(group.transformed);
      } else if (group.transcriptFiles && group.transcriptFiles.length > 0) {
        setSelectedShadowTwin(group.transcriptFiles[0]);
      } else {
        setSelectedShadowTwin(null);
      }
    } else {
      setSelectedShadowTwin(null);
    }
  }, [selectedFile, shadowTwinStates, findGroupByBaseItemId, setSelectedShadowTwin]);

  // Auswahl-Helfer für Keyboard-Navigation (dupliziert nicht die UI-spezifischen Click-Handler)
  const selectByKeyboard = React.useCallback((item: StorageItem) => {
    setSelectedFile(item);
    const group = findGroupByBaseItemId(item.id);
    // WICHTIG: Bevorzuge transformierte Datei (hat Frontmatter), sonst Transcript
    if (group) {
      if (group.transformed) {
        setSelectedShadowTwin(group.transformed);
      } else if (group.transcriptFiles && group.transcriptFiles.length > 0) {
        setSelectedShadowTwin(group.transcriptFiles[0]);
      } else {
        setSelectedShadowTwin(null);
      }
    } else {
      setSelectedShadowTwin(null);
    }
  }, [setSelectedFile, setSelectedShadowTwin, findGroupByBaseItemId]);

  // Keyboard-Navigation: Pfeil hoch/runter wählt vorherige/nächste Datei
  const handleKeyNav = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    // Eingaben in aktiven Inputs nicht stören
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    if (mainFileItems.length === 0) return;
    e.preventDefault();
    const currentIndex = activeFile ? mainFileItems.findIndex(it => it.id === activeFile.id) : -1;
    const nextIndex = e.key === 'ArrowDown'
      ? Math.min((currentIndex < 0 ? 0 : currentIndex + 1), mainFileItems.length - 1)
      : Math.max((currentIndex < 0 ? 0 : currentIndex - 1), 0);
    const nextItem = mainFileItems[nextIndex];
    if (!nextItem) return;
    selectByKeyboard(nextItem);
    // Sichtbar scrollen
    const rowEl = document.getElementById(`file-row-${nextItem.id}`);
    if (rowEl) rowEl.scrollIntoView({ block: 'nearest' });
  }, [activeFile, mainFileItems, selectByKeyboard]);

  const handleContainerMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    listContainerRef.current?.focus();
  }, []);

  // Alte systemFolderByBase-Logik entfernt (wird nicht mehr benötigt)

  // Berechne, ob alle Dateien ausgewählt sind
  const isAllSelected = useMemo(() => {
    if (!fileGroupsWithShadowTwinFolders || !fileGroupsWithShadowTwinFolders.size) return false;
    // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
    const mainItems = Array.from((fileGroupsWithShadowTwinFolders ?? new Map()).values())
      .map(group => group.baseItem)
      .filter((item): item is StorageItem => item !== undefined);
    // Je nach Filter unterschiedliche Dateien zählen
    let selectableItems: StorageItem[] = [];
    switch (currentCategoryFilter) {
      case 'media':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedBatchItems.length === selectableItems.length;
      case 'text':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && mediaType === 'text';
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedTransformationItems.length === selectableItems.length;
      case 'documents':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && mediaType === 'document';
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedTransformationItems.length === selectableItems.length;
      default:
        // Bei 'all' prüfen ob alle verfügbaren Dateien ausgewählt sind
        const mediaItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
          } catch {
            return false;
          }
        });
        const textItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'text' || mediaType === 'document');
          } catch {
            return false;
          }
        });
        const allMediaSelected = mediaItems.length === 0 || selectedBatchItems.length === mediaItems.length;
        const allTextSelected = textItems.length === 0 || selectedTransformationItems.length === textItems.length;
        return allMediaSelected && allTextSelected;
    }
  }, [fileGroupsWithShadowTwinFolders, selectedBatchItems, selectedTransformationItems, currentCategoryFilter]);
  
  // Erweiterte handleSelect Funktion für Review-Mode
  const handleSelect = useCallback((item: StorageItem, group?: FileGroup) => {
    // Nur die ausgewählte Datei setzen - Review-Modus wird über Toggle-Button gesteuert
    setSelectedFile(item);
    
    // WICHTIG: Wenn eine Basis-Datei mit Shadow-Twin ausgewählt wird,
    // bevorzuge die transformierte Datei (hat Frontmatter mit Metadaten),
    // sonst das erste Transcript
    if (group) {
      if (group.transformed) {
        // Transformierte Datei hat Vorrang (enthält Frontmatter mit Metadaten)
        setSelectedShadowTwin(group.transformed);
      } else if (group.transcriptFiles && group.transcriptFiles.length > 0) {
        // Fallback zu Transcript, wenn keine Transformation vorhanden
        setSelectedShadowTwin(group.transcriptFiles[0]);
      } else {
        setSelectedShadowTwin(null);
      }
    } else {
      setSelectedShadowTwin(null);
    }
  }, [setSelectedFile, setSelectedShadowTwin]);
  
  // Erweiterte handleSelectRelatedFile Funktion für Review-Mode
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSelectRelatedFile = useCallback((shadowTwin: StorageItem) => {
    StateLogger.info('FileList', 'Shadow-Twin ausgewählt', {
      shadowTwinId: shadowTwin.id,
      shadowTwinName: shadowTwin.metadata.name
    });
    
    // Setze das Shadow-Twin als ausgewählte Datei, damit es rechts angezeigt wird
    setSelectedFile(shadowTwin);
    setSelectedShadowTwin(null); // Kein zusätzliches Shadow-Twin im normalen Modus
  }, [setSelectedFile, setSelectedShadowTwin]);

  // Aktualisierte handleRefresh Funktion
  const handleRefresh = useCallback(async () => {
    if (!currentFolderId) return;
    
    setIsRefreshing(true);
    
    try {
      // Dateiliste neu laden
      const refreshedItems = await refreshItems(currentFolderId);
      setFolderItems(refreshedItems);
      
      // Shadow-Twin-Analyse neu starten, indem wir den Trigger erhöhen
      // Dies wird von useShadowTwinAnalysis erkannt und führt zu einer Neu-Analyse
      setShadowTwinAnalysisTrigger((v) => v + 1);
      
      FileLogger.info('FileList', 'Dateiliste und Shadow-Twins aktualisiert', {
        folderId: currentFolderId,
        itemCount: refreshedItems.length,
        triggerValue: shadowTwinAnalysisTrigger + 1
      });
      
      toast.success('Dateiliste und Shadow-Twins aktualisiert');
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Aktualisieren der Dateiliste', error);
      toast.error('Fehler beim Aktualisieren der Dateiliste');
    } finally {
      setIsRefreshing(false);
    }
  }, [currentFolderId, refreshItems, setFolderItems, setShadowTwinAnalysisTrigger, shadowTwinAnalysisTrigger]);

  // Verzeichnis-Sync: Änderungen im aktuellen Ordner (und Unterordner) abgleichen
  const handleFolderSync = useCallback(async () => {
    if (!currentFolderId || !activeLibraryId) return;
    setIsFolderSyncing(true);
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/shadow-twins/sync-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: currentFolderId, recursive: true }),
      });
      const json = await res.json().catch(() => ({})) as {
        report?: { scanned?: number; markdownToCache?: number; markdownToStorage?: number; imagesWritten?: number; sourceNewer?: number; errors?: number };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      const r = json.report;
      if (r) {
        const changes = (r.markdownToCache || 0) + (r.markdownToStorage || 0) + (r.imagesWritten || 0);
        if (changes > 0) {
          toast.success(`${changes} Artefakt${changes > 1 ? 'e' : ''} abgeglichen`, {
            description: [
              r.markdownToCache ? `${r.markdownToCache} → Cache` : '',
              r.markdownToStorage ? `${r.markdownToStorage} → Storage` : '',
              r.imagesWritten ? `${r.imagesWritten} Bilder` : '',
            ].filter(Boolean).join(', '),
          });
          // Dateiliste + Shadow-Twin-Analyse neu laden
          setShadowTwinAnalysisTrigger((v) => v + 1);
        } else {
          toast.info('Alles synchron', { description: `${r.scanned || 0} Dateien geprüft.` });
        }
        if (r.sourceNewer && r.sourceNewer > 0) {
          toast.warning(`${r.sourceNewer} Quelldatei${r.sourceNewer > 1 ? 'en' : ''} neuer`, {
            description: 'Pipeline-Verarbeitung nötig.',
          });
        }
      }
    } catch (error) {
      toast.error('Abgleich fehlgeschlagen', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsFolderSyncing(false);
    }
  }, [currentFolderId, activeLibraryId, setShadowTwinAnalysisTrigger]);

  // Globales Ordner-Refresh-Ereignis (z. B. nach Shadow‑Twin Speicherung)
  React.useEffect(() => {
    const onRefresh = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { 
          folderId?: string
          shadowTwinFolderId?: string | null
          triggerShadowTwinAnalysis?: boolean
        } | undefined;
        const folderId = detail?.folderId;
        const currentParentId = items && items[0] ? items[0].parentId : undefined;
        const shadowTwinFolderId = detail?.shadowTwinFolderId;
        
        // Refresh sowohl Parent als auch Shadow-Twin-Verzeichnis, wenn geöffnet
        // Dies stellt sicher, dass beide Ordner aktualisiert werden, wenn ein Job abgeschlossen wird
        const shouldRefresh = folderId && currentParentId && (
          folderId === currentParentId || 
          (shadowTwinFolderId && shadowTwinFolderId === currentParentId)
        );
        
        if (shouldRefresh) {
          void handleRefresh();
          
          // WICHTIG: Shadow-Twin-Analyse neu triggern, wenn angefordert
          // Dies stellt sicher, dass das Shadow-Twin-State nach einer Transformation neu berechnet wird
          if (detail?.triggerShadowTwinAnalysis) {
            FileLogger.info('FileList', 'Trigger Shadow-Twin-Analyse nach Transformation', {
              folderId,
              shadowTwinFolderId: detail.shadowTwinFolderId,
              currentFolderId,
              currentParentId
            })
            // Erhöhe den Trigger-Wert, um eine erzwungene Neu-Analyse auszulösen
            setShadowTwinAnalysisTrigger((v) => v + 1)
          }
        }
      } catch (error) {
        // CustomEvent.detail kann von externen Triggern beliebig befuellt sein.
        // Wenn das Event-Format unerwartet ist, soll der Refresh-Handler nicht
        // crashen, aber wir loggen, damit Drift sichtbar wird
        // (siehe .cursor/rules/no-silent-fallbacks.mdc).
        FileLogger.warn('FileList', 'library_refresh-Event konnte nicht verarbeitet werden', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    window.addEventListener('library_refresh', onRefresh as unknown as EventListener);
    return () => window.removeEventListener('library_refresh', onRefresh as unknown as EventListener);
  }, [items, handleRefresh, currentFolderId, setShadowTwinAnalysisTrigger]);

  // Entfernt: handleItemSelect war unbenutzt

  // Check if an item is selected (beide Atome prüfen)
  const isItemSelected = useCallback((item: StorageItem) => {
    const mediaType = getMediaType(item);
    if (mediaType === 'audio' || mediaType === 'video') {
      return selectedBatchItems.some(selected => selected.item.id === item.id);
    } else {
      return selectedTransformationItems.some(selected => selected.item.id === item.id);
    }
  }, [selectedBatchItems, selectedTransformationItems]);

  // Löschfunktion
  const handleDeleteClick = React.useCallback(async (e: React.MouseEvent<HTMLButtonElement>, itemToDelete: StorageItem) => {
    e.stopPropagation();
    
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Finde die FileGroup für dieses Item
      const itemStem = getBaseName(itemToDelete.metadata.name);
      const fileGroup = findFileGroup(fileGroupsWithShadowTwinFolders, itemStem);

      // Bestätigungsnachricht vorbereiten
      let confirmMessage = `Möchten Sie "${itemToDelete.metadata.name}" wirklich löschen?`;
      if (fileGroup && itemToDelete.id === fileGroup.baseItem?.id) {
        if (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0 || fileGroup.transformed) {
          confirmMessage = `Möchten Sie "${itemToDelete.metadata.name}" und alle zugehörigen Dateien wirklich löschen?`;
        }
      }

      // Benutzer um Bestätigung bitten
      if (!window.confirm(confirmMessage)) {
        return;
      }

      if (fileGroup && itemToDelete.id === fileGroup.baseItem?.id) {
        // Dies ist die Basis-Datei - lösche auch abhängige Dateien
        // Lösche alle Transkripte, falls vorhanden
        if (fileGroup.transcriptFiles) {
          for (const transcript of fileGroup.transcriptFiles) {
            try {
              await provider.deleteItem(transcript.id);
              FileLogger.info('FileList', 'Transkript gelöscht', {
                transcriptId: transcript.id,
                transcriptName: transcript.metadata.name
              });
            } catch (error) {
              FileLogger.error('FileList', 'Fehler beim Löschen des Transkripts', error);
              toast.warning("Hinweis", {
                description: "Einige Transkripte konnten nicht gelöscht werden"
              });
            }
          }
        }

        // Lösche die transformierte Datei, falls vorhanden
        if (fileGroup.transformed) {
          try {
            await provider.deleteItem(fileGroup.transformed.id);
            FileLogger.info('FileList', 'Transformierte Datei gelöscht', {
              transformedId: fileGroup.transformed.id,
              transformedName: fileGroup.transformed.metadata.name
            });
          } catch (error) {
            FileLogger.error('FileList', 'Fehler beim Löschen der transformierten Datei', error);
            toast.warning("Hinweis", {
              description: "Die transformierte Datei konnte nicht gelöscht werden"
            });
          }
        }

        // Lösche die Basis-Datei
        await provider.deleteItem(itemToDelete.id);
        toast.success("Dateien gelöscht", {
          description: `${itemToDelete.metadata.name} und zugehörige Dateien wurden gelöscht.`
        });
      } else {
        // Dies ist eine abhängige Datei oder keine Gruppe - nur diese Datei löschen
        await provider.deleteItem(itemToDelete.id);
        toast.success("Datei gelöscht", {
          description: `${itemToDelete.metadata.name} wurde gelöscht.`
        });
      }

      // Aktualisiere die Dateiliste
      await handleRefresh();

      // Wenn die gelöschte Datei ausgewählt war, Auswahl aufheben
      setSelectedFile(null);
      
      // Aus der Batch-Auswahl entfernen
      setSelectedBatchItems(prev => prev.filter(i => i.item.id !== itemToDelete.id));

    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Löschen', error);
      toast.error("Fehler", {
        description: `Die Datei konnte nicht gelöscht werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, handleRefresh, fileGroupsWithShadowTwinFolders, setSelectedFile, setSelectedBatchItems, findFileGroup]);

  const handleRename = React.useCallback(async (item: StorageItem, newName: string) => {
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Finde die FileGroup für dieses Item
      const itemStem = getBaseName(item.metadata.name);
      const fileGroup = findFileGroup(fileGroupsWithShadowTwinFolders, itemStem);

      if (fileGroup && item.id === fileGroup.baseItem?.id) {
        // Dies ist die Basis-Datei - benenne auch abhängige Dateien um
        const oldStem = getBaseName(item.metadata.name);
        const newStem = getBaseName(newName);
        // Benenne die Basis-Datei um
        await provider.renameItem(item.id, newName);
        // Benenne alle Transkripte um, falls vorhanden
        if (fileGroup.transcriptFiles) {
          for (const transcript of fileGroup.transcriptFiles) {
            const transcriptName = transcript.metadata.name;
            const newTranscriptName = transcriptName.replace(oldStem, newStem);
            try {
              await provider.renameItem(transcript.id, newTranscriptName);
            } catch (error) {
              FileLogger.error('FileList', 'Fehler beim Umbenennen des Transkripts', error);
              toast.warning("Hinweis", {
                description: "Einige Transkripte konnten nicht umbenannt werden"
              });
            }
          }
        }
        // Benenne die transformierte Datei um, falls vorhanden
        if (fileGroup.transformed) {
          const transformedName = fileGroup.transformed.metadata.name;
          const newTransformedName = transformedName.replace(oldStem, newStem);
          try {
            await provider.renameItem(fileGroup.transformed.id, newTransformedName);
          } catch (error) {
            FileLogger.error('FileList', 'Fehler beim Umbenennen der transformierten Datei', error);
            toast.warning("Hinweis", {
              description: "Die transformierte Datei konnte nicht umbenannt werden"
            });
          }
        }
        toast.success("Dateien umbenannt", {
          description: `${item.metadata.name} und zugehörige Dateien wurden umbenannt.`
        });
      } else {
        // Dies ist eine abhängige Datei oder keine Gruppe - nur diese Datei umbenennen
        await provider.renameItem(item.id, newName);
        toast.success("Datei umbenannt", {
          description: `${item.metadata.name} wurde zu ${newName} umbenannt.`
        });
      }
      await handleRefresh();
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Umbenennen', error);
      toast.error("Fehler", {
        description: `Die Datei konnte nicht umbenannt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
      throw error;
    }
  }, [provider, handleRefresh, fileGroupsWithShadowTwinFolders, findFileGroup]);

  // Sammel-Transkript aus allen ausgewählten Dateien erstellen
  const [isCreatingComposite, setIsCreatingComposite] = React.useState(false);
  const handleCreateCompositeTranscript = React.useCallback(async () => {
    if (!activeLibraryId) return;

    // Alle ausgewählten Dateien zusammenführen (Batch + Transformation)
    const allSelected = [
      ...selectedBatchItems.map(x => x.item),
      ...selectedTransformationItems.map(x => x.item),
    ].filter(item => item.type === 'file');

    if (allSelected.length < 2) {
      toast.info('Mindestens 2 Dateien auswählen', {
        description: 'Für ein Sammel-Transkript werden mindestens 2 Quelldateien benötigt.',
      });
      return;
    }

    setIsCreatingComposite(true);
    try {
      const sourceItems = allSelected.map(item => ({
        id: item.id,
        name: item.metadata.name,
        parentId: item.parentId || currentFolderId || 'root',
      }));

      const res = await fetch(
        `/api/library/${encodeURIComponent(activeLibraryId)}/composite-transcript`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceItems, targetLanguage: 'de' }),
        }
      );

      const json = await res.json();

      if (res.status === 422 && json.missingTranscripts) {
        // Transkripte fehlen – Warnung anzeigen
        toast.warning('Transkripte fehlen', {
          description: `Bitte zuerst transkribieren: ${(json.missingTranscripts as string[]).join(', ')}`,
          duration: 8000,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      toast.success('Sammel-Transkript erstellt', {
        description: `${json.file?.name} (${allSelected.length} Quellen)`,
      });

      // Dateiliste aktualisieren, damit die neue Datei sichtbar wird
      await handleRefresh();
    } catch (error) {
      toast.error('Sammel-Transkript fehlgeschlagen', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsCreatingComposite(false);
    }
  }, [activeLibraryId, selectedBatchItems, selectedTransformationItems, currentFolderId, handleRefresh]);

  // ─────────────────────────────────────────────────────────────────────────
  // Composite-Multi (Bild-Sammelanalyse) – paralleles Konzept zu Sammel-Transkript
  //
  // Auslöser: ≥2 ausgewählte Dateien sind ALLE Bilder. Der Toolbar-Button
  // öffnet einen Dialog, der einen Dateinamen vom User abfragt (Default-
  // Vorschlag wird aus dem gemeinsamen Präfix der Quellen abgeleitet).
  // Nach Bestätigung wird `/api/library/.../composite-multi` aufgerufen.
  // ─────────────────────────────────────────────────────────────────────────

  const allSelectedItems = React.useMemo(() => {
    return [
      ...selectedBatchItems.map(x => x.item),
      ...selectedTransformationItems.map(x => x.item),
    ].filter(item => item.type === 'file');
  }, [selectedBatchItems, selectedTransformationItems]);

  // Sammelanalyse ist nur sinnvoll, wenn ALLE Selektionen Bilder sind.
  // Außerdem hartes Limit aus der Secretary-Spec: max. 10 Bilder.
  const compositeMultiEligible = React.useMemo(() => {
    if (allSelectedItems.length < 2) return false;
    if (allSelectedItems.length > 10) return false;
    return allSelectedItems.every(item => isImageMediaFromName(item.metadata.name));
  }, [allSelectedItems]);

  const [isCompositeMultiDialogOpen, setIsCompositeMultiDialogOpen] = React.useState(false);
  const [isCreatingCompositeMulti, setIsCreatingCompositeMulti] = React.useState(false);

  const compositeMultiDefaultFilename = React.useMemo(() => {
    return deriveCompositeMultiDefaultFilename(allSelectedItems.map(i => i.metadata.name));
  }, [allSelectedItems]);

  const handleConfirmCompositeMulti = React.useCallback(async (args: { filename: string; title?: string }) => {
    if (!activeLibraryId) return;
    if (allSelectedItems.length < 2) return;

    setIsCreatingCompositeMulti(true);
    try {
      const sourceItems = allSelectedItems.map(item => ({
        id: item.id,
        name: item.metadata.name,
        parentId: item.parentId || currentFolderId || 'root',
      }));

      const res = await fetch(
        `/api/library/${encodeURIComponent(activeLibraryId)}/composite-multi`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceItems,
            filename: args.filename,
            title: args.title,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        // 409 (Kollision) gesondert behandeln – der User kann den Namen ändern.
        if (res.status === 409) {
          toast.warning('Dateiname bereits vergeben', {
            description: json.error || 'Bitte einen anderen Namen wählen.',
          });
          return;
        }
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      toast.success('Bild-Sammelanalyse erstellt', {
        description: `${json.file?.name} (${sourceItems.length} Bilder)`,
      });
      setIsCompositeMultiDialogOpen(false);
      await handleRefresh();
    } catch (error) {
      toast.error('Bild-Sammelanalyse fehlgeschlagen', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsCreatingCompositeMulti(false);
    }
  }, [activeLibraryId, allSelectedItems, currentFolderId, handleRefresh]);

  // ─────────────────────────────────────────────────────────────────────────
  // Composite-Transformations: Sammeldatei, deren Wikilinks auf Transformations-
  // Artefakte zeigen ("[[seite1.pdf/template-name]]"). Datei nutzt KEIN neues
  // kind und laeuft durch den normalen composite-transcript-Pipeline-Pfad.
  //
  // Auslöser: >=2 Dateien markiert, alle im selben Verzeichnis (medienneutral).
  // Beim Oeffnen wird per GET-Pre-Fetch die Liste der verfuegbaren Templates
  // ermittelt; die Auswahl ist im Dialog auf ein Template + Sprache begrenzt
  // (Determinismus-Contract aus shadow-twin-contracts.mdc).
  // ─────────────────────────────────────────────────────────────────────────

  const compositeTransformationsEligible = React.useMemo(() => {
    if (allSelectedItems.length < 2) return false;
    const parents = new Set(allSelectedItems.map(i => i.parentId || ''));
    if (parents.size !== 1) return false;
    return true;
  }, [allSelectedItems]);

  const [isCompositeTransformationsDialogOpen, setIsCompositeTransformationsDialogOpen] =
    React.useState(false);
  const [isCreatingCompositeTransformations, setIsCreatingCompositeTransformations] =
    React.useState(false);
  const [compositeTransformationsTemplates, setCompositeTransformationsTemplates] =
    React.useState<DialogTemplateEntry[]>([]);
  const [isLoadingCompositeTransformationsTemplates, setIsLoadingCompositeTransformationsTemplates] =
    React.useState(false);

  const compositeTransformationsDefaultFilename = React.useMemo(() => {
    return deriveCompositeTransformationsDefaultFilename(
      allSelectedItems.map(i => i.metadata.name),
    );
  }, [allSelectedItems]);

  // Beim Oeffnen des Dialogs: Pool-Pre-Fetch (welche Templates sind verfuegbar?).
  const handleOpenCompositeTransformationsDialog = React.useCallback(async () => {
    if (!activeLibraryId) return;
    if (!compositeTransformationsEligible) return;
    setIsCompositeTransformationsDialogOpen(true);
    setIsLoadingCompositeTransformationsTemplates(true);
    setCompositeTransformationsTemplates([]);
    try {
      const sourceIds = allSelectedItems.map(i => i.id).join(',');
      const sourceNames = allSelectedItems.map(i => i.metadata.name).join(',');
      const url = `/api/library/${encodeURIComponent(activeLibraryId)}/composite-transformations?sourceIds=${encodeURIComponent(sourceIds)}&sourceNames=${encodeURIComponent(sourceNames)}&targetLanguage=de`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const list: DialogTemplateEntry[] = Array.isArray(json.templates) ? json.templates : [];
      setCompositeTransformationsTemplates(list);
    } catch (error) {
      toast.error('Templates konnten nicht geladen werden', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoadingCompositeTransformationsTemplates(false);
    }
  }, [activeLibraryId, allSelectedItems, compositeTransformationsEligible]);

  const handleConfirmCompositeTransformations = React.useCallback(
    async (args: { filename: string; templateName: string; title?: string }) => {
      if (!activeLibraryId) return;
      if (allSelectedItems.length < 2) return;

      setIsCreatingCompositeTransformations(true);
      try {
        const sourceItems = allSelectedItems.map(item => ({
          id: item.id,
          name: item.metadata.name,
          parentId: item.parentId || currentFolderId || 'root',
        }));

        const res = await fetch(
          `/api/library/${encodeURIComponent(activeLibraryId)}/composite-transformations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceItems,
              templateName: args.templateName,
              targetLanguage: 'de',
              filename: args.filename,
              title: args.title,
            }),
          },
        );

        const json = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            toast.warning('Dateiname bereits vergeben', {
              description: json.error || 'Bitte einen anderen Namen waehlen.',
            });
            return;
          }
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        toast.success('Sammel-Transformationen erstellt', {
          description: `${json.file?.name} (${sourceItems.length} Quellen, Template "${args.templateName}")`,
        });
        setIsCompositeTransformationsDialogOpen(false);
        await handleRefresh();
      } catch (error) {
        toast.error('Sammel-Transformationen fehlgeschlagen', {
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsCreatingCompositeTransformations(false);
      }
    },
    [activeLibraryId, allSelectedItems, currentFolderId, handleRefresh],
  );

  // Bulk-Löschung für ausgewählte Dateien (unabhängig von Batch/Transformation-Selektor)
  const handleBulkDelete = React.useCallback(async () => {
    if (!provider) return;
    const targets = [
      ...selectedBatchItems.map(x => x.item),
      ...selectedTransformationItems.map(x => x.item),
    ];
    if (targets.length === 0) return;
    const confirmMsg = targets.length === 1
      ? `"${targets[0].metadata.name}" wirklich löschen?`
      : `${targets.length} Dateien wirklich löschen?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const parentId = targets[0].parentId || 'root';
      for (const t of targets) {
        try { await provider.deleteItem(t.id); } catch (err) {
          FileLogger.error('FileList', 'Bulk Delete failed', { id: t.id, name: t.metadata.name, err });
        }
      }
      const refreshed = await refreshItems(parentId);
      setFolderItems(refreshed);
      setSelectedBatchItems([]);
      setSelectedTransformationItems([]);
    } catch (error) {
      FileLogger.error('FileList', 'Bulk Delete error', error);
    }
  }, [provider, selectedBatchItems, selectedTransformationItems, refreshItems, setFolderItems, setSelectedBatchItems, setSelectedTransformationItems]);

  // Intelligente Batch-Auswahl basierend auf Filter
  const handleSelectAll = useCallback((checked: boolean) => {
    const startTime = performance.now();
    if (checked) {
      // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
      const mainItems = Array.from((fileGroupsWithShadowTwinFolders ?? new Map()).values())
        .map(group => group.baseItem)
        .filter((item): item is StorageItem => item !== undefined);
      const selectableItems = mainItems.filter(item => {
        try {
          const mediaType = getMediaType(item);
          // Je nach Filter unterschiedliche Dateien auswählen
          switch (currentCategoryFilter) {
            case 'media':
              return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
            case 'text':
              return item.type === 'file' && mediaType === 'text';
            case 'documents':
              return item.type === 'file' && mediaType === 'document';
            default:
              // Bei 'all' alle Dateien auswählen, die für eine Operation geeignet sind
              return item.type === 'file' && (
                mediaType === 'audio' || 
                mediaType === 'video' || 
                mediaType === 'text' || 
                mediaType === 'document'
              );
          }
        } catch {
          return false;
        }
      });
      StateLogger.info('FileList', 'Selecting all items based on filter', {
        filter: currentCategoryFilter,
        totalItems: items.length,
        selectableCount: selectableItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      // Je nach Filter unterschiedliche Atome verwenden
      if (currentCategoryFilter === 'media') {
        setSelectedBatchItems(selectableItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      } else if (currentCategoryFilter === 'text') {
        setSelectedTransformationItems(selectableItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      } else {
        // Bei 'all' oder 'documents' beide Atome füllen
        const mediaItems = selectableItems.filter(item => {
          const mediaType = getMediaType(item);
          return mediaType === 'audio' || mediaType === 'video';
        });
        const textItems = selectableItems.filter(item => {
          const mediaType = getMediaType(item);
          return mediaType === 'text' || mediaType === 'document';
        });
        setSelectedBatchItems(mediaItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
        setSelectedTransformationItems(textItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      }
    } else {
      StateLogger.info('FileList', 'Deselecting all items', {
        previouslySelected: selectedBatchItems.length + selectedTransformationItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      setSelectedBatchItems([]);
      setSelectedTransformationItems([]);
    }
  }, [fileGroupsWithShadowTwinFolders, currentCategoryFilter, setSelectedBatchItems, setSelectedTransformationItems, selectedBatchItems.length, selectedTransformationItems.length, items.length]);

  React.useEffect(() => {
    // Logging der Library-IDs - verzögert ausführen (entfernt - nicht operationell wichtig)
    const timeoutId = setTimeout(() => {
      // Render-Log entfernt
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentLibrary, activeLibraryId]);

  // Entkoppelt: kein Render-Gate mehr basierend auf FileTree

  return (
    <div className="h-full flex flex-col">
      {/* Header - versteckt im compact mode */}
      {!compact && (
        <div className="border-b px-2 py-2 flex items-center justify-between bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Aktualisieren"
              aria-label="Aktualisieren"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleFolderSync}
                    disabled={isFolderSyncing || !currentFolderId}
                    aria-label="Änderungen abgleichen"
                  >
                    <FolderSync className={cn("h-4 w-4", isFolderSyncing && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Änderungen in diesem Verzeichnis abgleichen</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Dateikategorie-Filter (Icon-only Variante) */}
            <FileCategoryFilter iconOnly />

            {/* Batch-Actions: Sammel-Transkript / Löschen (Ingest nur noch über Vorschau/Pipeline/Wizard) */}
            {/* Sammel-Transkript: sichtbar wenn ≥2 Dateien insgesamt ausgewählt */}
            {(selectedBatchItems.length + selectedTransformationItems.length) >= 2 && (
              <Button
                size="icon"
                variant="outline"
                title="Sammel-Transkript erstellen"
                aria-label="Sammel-Transkript erstellen"
                onClick={handleCreateCompositeTranscript}
                disabled={isCreatingComposite}
              >
                <Layers className={cn("h-4 w-4", isCreatingComposite && "animate-spin")} />
              </Button>
            )}
            {/* Bild-Sammelanalyse: nur sichtbar wenn ALLE Selektionen Bilder sind (2..10) */}
            {compositeMultiEligible && (
              <Button
                size="icon"
                variant="outline"
                title="Bild-Sammelanalyse erstellen (mehrere Bilder gemeinsam analysieren)"
                aria-label="Bild-Sammelanalyse erstellen"
                onClick={() => setIsCompositeMultiDialogOpen(true)}
                disabled={isCreatingCompositeMulti}
              >
                <ImagePlus className={cn("h-4 w-4", isCreatingCompositeMulti && "animate-spin")} />
              </Button>
            )}
            {/* Sammel-Transformationen: medienneutral, ab 2 Quellen im selben Verzeichnis. */}
            {compositeTransformationsEligible && (
              <Button
                size="icon"
                variant="outline"
                title="Sammel-Transformationen erstellen (Wikilinks zeigen auf Transformations-Artefakte)"
                aria-label="Sammel-Transformationen erstellen"
                onClick={handleOpenCompositeTransformationsDialog}
                disabled={isCreatingCompositeTransformations}
              >
                <Combine className={cn("h-4 w-4", isCreatingCompositeTransformations && "animate-spin")} />
              </Button>
            )}
            {(selectedBatchItems.length + selectedTransformationItems.length) > 0 && (
              <Button size="icon" variant="destructive" title="Ausgewählte löschen" aria-label="Ausgewählte löschen" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* File List */}
      <div ref={listContainerRef} className="flex-1 overflow-auto focus:outline-none" tabIndex={0} onKeyDown={handleKeyNav} onMouseDown={handleContainerMouseDown}>
        <div>
          {/* Table Header - versteckt im compact mode */}
          {!compact && (
            <div className="sticky top-0 bg-background border-b">
              <div className="grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 px-4 py-2 text-sm font-medium text-muted-foreground">
                <div className="w-6 flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Alle auswählen"
                  />
                </div>
                <div className="w-6" />
                <SortableHeaderCell
                  label="Name"
                  field="name"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Größe"
                  field="size"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Geändert"
                  field="date"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <div />
              </div>
            </div>
          )}

          {/* Folder Rows (oberhalb der Dateien, unabhängig von Datei-Gruppierung) */}
          {folders.length > 0 && (
            <div className="divide-y">
          {folders.map((folder) => (
            compact ? (
              // Kompakt: ohne Einrückung, nur Icon + Name (2 Spalten)
              <div
                key={folder.id}
                role="button"
                tabIndex={0}
                onClick={() => navigateToFolder(folder.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigateToFolder(folder.id) }}
                className="w-full px-2 py-1 text-xs hover:bg-muted/50 grid grid-cols-[24px_minmax(0,1fr)] gap-2 items-center cursor-pointer"
              >
                <Checkbox
                  checked={selectedTransformationItems.some(transformationItem => transformationItem.item.id === folder.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedTransformationItems([...selectedTransformationItems, {
                        item: folder,
                        type: 'unknown'
                      }]);
                    } else {
                      setSelectedTransformationItems(selectedTransformationItems.filter(i => i.item.id !== folder.id));
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <FolderIcon className="h-4 w-4" />
                <span className="text-left truncate select-none" title={folder.metadata.name}>{folder.metadata.name}</span>
              </div>
            ) : (
              // Normal: gleiches 6-Spalten-Grid wie Dateien (Checkbox, Icon, Name, Größe, Datum, Aktionen)
              <div
                key={folder.id}
                role="button"
                tabIndex={0}
                onClick={() => navigateToFolder(folder.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigateToFolder(folder.id) }}
                className="w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-pointer"
              >
                <div className="w-6 flex items-center justify-center">
                  <Checkbox
                    checked={selectedTransformationItems.some(transformationItem => transformationItem.item.id === folder.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTransformationItems([...selectedTransformationItems, {
                          item: folder,
                          type: 'unknown'
                        }]);
                      } else {
                        setSelectedTransformationItems(selectedTransformationItems.filter(i => i.item.id !== folder.id));
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <FolderIcon className="h-4 w-4" />
                <span className="text-left truncate select-none" title={folder.metadata.name}>{folder.metadata.name}</span>
                {/* Größe: Ordner zeigen keinen Wert (Strich) */}
                <span className="text-muted-foreground tabular-nums text-[10px]">
                  {formatFileSize(folder.metadata.size)}
                </span>
                {/* Änderungsdatum des Ordners */}
                <span className="text-muted-foreground tabular-nums text-[10px]">
                  {formatDate(folder.metadata.modifiedAt)}
                </span>
                {/* Platzhalter für Aktionen-Spalte */}
                <div />
              </div>
            )
          ))}
            </div>
          )}

          {/* File Rows */}
          <div className="divide-y">
            {(() => {
              const renderStart = performance.now();
              const groups = Array.from((fileGroupsWithShadowTwinFolders ?? new Map()).values());
              const rows = groups.map((group) => {
                // Zeige nur die Hauptdatei (baseItem) an
                const item = group.baseItem;
                if (!item) return null;
                // Alte systemFolderId-Logik entfernt
                const isActive = !!activeFile && activeFile.id === item.id
                return (
                  <FileRow
                    key={item.id}
                    item={item as StorageItem}
                    isSelected={isItemSelected(item)}
                    isActive={isActive}
                    onSelect={() => handleSelect(item, group)}
                    onDelete={(e) => handleDeleteClick(e, item)}
                    fileGroup={group}
                    onRename={handleRename}
                    compact={compact}
                    libraryId={activeLibraryId ?? undefined}
                  />
                );
              });
              const renderEnd = performance.now();
              const renderDuration = renderEnd - renderStart;
              if (renderDuration > 50) {
                console.log(`[FileList Performance] FileRow Rendering: ${renderDuration.toFixed(2)}ms für ${groups.length} Dateien`);
              }
              return rows;
            })()}
          </div>
        </div>
      </div>

      {/* Composite-Multi-Erstellungsdialog – nur fuer Bild-Selektionen */}
      <CompositeMultiCreateDialog
        open={isCompositeMultiDialogOpen}
        onOpenChange={setIsCompositeMultiDialogOpen}
        imageCount={allSelectedItems.length}
        defaultFilename={compositeMultiDefaultFilename}
        onConfirm={handleConfirmCompositeMulti}
        isSubmitting={isCreatingCompositeMulti}
      />

      {/* Sammel-Transformations-Dialog – medienneutral, mit Template-Dropdown */}
      <CompositeTransformationsCreateDialog
        open={isCompositeTransformationsDialogOpen}
        onOpenChange={setIsCompositeTransformationsDialogOpen}
        sourceCount={allSelectedItems.length}
        defaultFilename={compositeTransformationsDefaultFilename}
        templates={compositeTransformationsTemplates}
        isLoadingTemplates={isLoadingCompositeTransformationsTemplates}
        onConfirm={handleConfirmCompositeTransformations}
        isSubmitting={isCreatingCompositeTransformations}
      />
    </div>
  );
}); 