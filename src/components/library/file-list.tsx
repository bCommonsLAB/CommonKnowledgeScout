'use client';

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { File, FileText, FileVideo, FileAudio, Plus, RefreshCw, ChevronUp, ChevronDown, Trash2, Folder as FolderIcon } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { useAtomValue, useAtom } from 'jotai';
import { 
  activeLibraryIdAtom,
  selectedFileAtom, 
  folderItemsAtom,
  sortedFilteredFilesAtom,
  sortFieldAtom,
  sortOrderAtom,
  selectedShadowTwinAtom,
  currentFolderIdAtom
} from '@/atoms/library-atom';
import { toast } from "sonner";
import { Input } from "@/components/ui/input"
import {
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom,
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  ingestionDialogOpenAtom,
  getMediaType,
  fileCategoryFilterAtom,
} from '@/atoms/transcription-options';
import { Checkbox } from "@/components/ui/checkbox"
import { useMemo, useCallback } from "react"
import { FileLogger, StateLogger } from "@/lib/debug/logger"
import { FileCategoryFilter } from './file-category-filter';
import { useFolderNavigation } from "@/hooks/use-folder-navigation";
import { useShadowTwinAnalysis } from "@/hooks/use-shadow-twin-analysis";
import { shadowTwinStateAtom } from "@/atoms/shadow-twin-atom";

// Typen für Sortieroptionen
type SortField = 'type' | 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';

// Typ für gruppierte Dateien
interface FileGroup {
  baseItem?: StorageItem;
  transcriptFiles?: StorageItem[]; // NEU: alle Transkripte
  transformed?: StorageItem;
  shadowTwinFolderId?: string; // Optional: ID des Shadow-Twin-Verzeichnisses
}

// Memoized file icon component
const FileIconComponent = React.memo(function FileIconComponent({ item }: { item: StorageItem }) {
  const mimeType = item.metadata.mimeType || '';
  if (!mimeType) return <File className="h-4 w-4" />;

  if (mimeType.startsWith('video/')) {
    return <FileVideo className="h-4 w-4" />;
  } else if (mimeType.startsWith('audio/')) {
    return <FileAudio className="h-4 w-4" />;
  } else if (mimeType.startsWith('text/')) {
    return <FileText className="h-4 w-4" />;
  }

  return <File className="h-4 w-4" />;
});

// Pure function for file size formatting
const formatFileSize = (size?: number): string => {
  if (!size) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

// Funktion zum Formatieren des Datums
const formatDate = (date?: Date): string => {
  if (!date) return '-';
  
  const options: Intl.DateTimeFormatOptions = { 
    year: '2-digit', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return new Date(date).toLocaleDateString('de-DE', options);
};

// Entfernt: getFileStem Funktion war unbenutzt

// Sortierbare Kopfzelle Komponente
const SortableHeaderCell = React.memo(function SortableHeaderCell({
  label,
  field,
  currentSortField,
  currentSortOrder,
  onSort
}: {
  label: string,
  field: SortField,
  currentSortField: SortField,
  currentSortOrder: SortOrder,
  onSort: (field: SortField) => void
}) {
  const isActive = currentSortField === field;
  
  return (
    <button 
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground"
    >
      <span>{label}</span>
      {isActive && (
        currentSortOrder === 'asc' 
          ? <ChevronUp className="h-3 w-3" /> 
          : <ChevronDown className="h-3 w-3" />
      )}
    </button>
  );
});

interface FileRowProps {
  item: StorageItem;
  isSelected: boolean;
  isActive?: boolean;
  onSelect: () => void;
  onCreateTranscript: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, item: StorageItem) => void;
  fileGroup?: FileGroup;
  onSelectRelatedFile?: (file: StorageItem) => void;
  onRename?: (item: StorageItem, newName: string) => Promise<void>;
  compact?: boolean;
}

const FileRow = React.memo(function FileRow({ 
  item, 
  isSelected, 
  isActive = false,
  onSelect,
  onCreateTranscript,
  onDelete,
  fileGroup,
  onSelectRelatedFile,
  onRename,
  compact = false
}: FileRowProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(item.metadata.name);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastClickTimeRef = React.useRef<number>(0);
  
  // Zusätzliche Validierung der Metadaten
  const metadata = React.useMemo(() => ({
    name: item.metadata?.name || 'Unbekannte Datei',
    size: typeof item.metadata?.size === 'number' ? item.metadata.size : 0,
    mimeType: item.metadata?.mimeType || '',
    hasTranscript: !!item.metadata?.hasTranscript || (fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0),
    modifiedAt: item.metadata?.modifiedAt
  }), [item.metadata, fileGroup]);

  const isTranscribable = React.useMemo(() => {
    const mimeType = metadata.mimeType.toLowerCase();
    const extension = metadata.name.split('.').pop()?.toLowerCase();

    return (
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      extension === 'pdf' ||
      mimeType === 'application/pdf'
    );
  }, [metadata.mimeType, metadata.name]);

  // Memoize the click handler
  const handleClick = React.useCallback(() => {
    if (!isEditing) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  // Memoize the keydown handler
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  // Entfernt: ungenutzter Handler handleTranscriptClick
  // Entfernt: handleTransformedClick - wird jetzt im Shadow-Twin-Icon-Handler behandelt

  // Starte Rename-Modus
  const startRename = React.useCallback(() => {
    if (onRename) {
      // Prüfe ob dies eine abhängige Datei ist
      if (fileGroup && (
        (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles[0]?.id === item.id) ||
        (fileGroup.transformed && item.id === fileGroup.transformed.id)
      )) {
        // Dies ist eine abhängige Datei - zeige Hinweis
        toast.info("Hinweis", {
          description: "Bitte benennen Sie die Haupt-Datei um. Abhängige Dateien werden automatisch mit umbenannt."
        });
        return;
      }
      
      setIsEditing(true);
      setEditName(item.metadata.name);
    }
  }, [onRename, item, fileGroup]);

  // Handler für Dateinamen-Click (Doppelklick-Erkennung)
  const handleNameClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;
    
    if (timeSinceLastClick < 300) {
      // Doppelklick erkannt
      startRename();
    } else {
      // Erster Klick - wähle die Datei aus
      onSelect();
    }
    
    lastClickTimeRef.current = currentTime;
  }, [startRename, onSelect]);

  // Handler für Long-Press (Touch-Geräte)
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    // Starte Long-Press Timer
    longPressTimerRef.current = setTimeout(() => {
      startRename();
    }, 500); // 500ms für Long-Press
  }, [startRename]);

  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    // Lösche Long-Press Timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = React.useCallback(() => {
    // Bei Bewegung Long-Press abbrechen
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cleanup Timer bei Unmount
  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Handler für Rename-Submit
  const handleRenameSubmit = React.useCallback(async () => {
    if (onRename && editName.trim() && editName !== item.metadata.name) {
      try {
        await onRename(item, editName.trim());
      } catch (error) {
        FileLogger.error('FileRow', 'Fehler beim Umbenennen', error);
        // Bei Fehler den ursprünglichen Namen wiederherstellen
        setEditName(item.metadata.name);
      }
    }
    setIsEditing(false);
  }, [onRename, editName, item]);

  // Handler für Rename-Cancel
  const handleRenameCancel = React.useCallback(() => {
    setEditName(item.metadata.name);
    setIsEditing(false);
  }, [item.metadata.name]);

  // Handler für Input-Änderungen
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditName(e.target.value);
  }, []);

  // Handler für Input-Keydown
  const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSubmit, handleRenameCancel]);

  // Focus Input wenn Edit-Modus aktiviert wird
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handler für Drag Start
  const handleDragStart = React.useCallback((e: React.DragEvent) => {
    // Sammle alle Dateien der Gruppe, die verschoben werden sollen
    const itemsToMove = [];
    
    // Füge das aktuelle Item hinzu
    itemsToMove.push({
      itemId: item.id,
      itemName: item.metadata.name,
      itemType: item.type,
      parentId: item.parentId
    });
    
    // Wenn es eine FileGroup gibt, füge auch die zugehörigen Dateien hinzu
    if (fileGroup) {
      // Prüfe ob das aktuelle Item die Basis-Datei ist
      if (item.id === fileGroup.baseItem?.id) {
        // Füge Transkripte hinzu, falls vorhanden
        if (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0) {
          fileGroup.transcriptFiles.forEach(transcript => {
            itemsToMove.push({
              itemId: transcript.id,
              itemName: transcript.metadata.name,
              itemType: transcript.type,
              parentId: transcript.parentId
            });
          });
        }
        
        // Füge transformierte Datei hinzu, falls vorhanden
        if (fileGroup.transformed) {
          itemsToMove.push({
            itemId: fileGroup.transformed.id,
            itemName: fileGroup.transformed.metadata.name,
            itemType: fileGroup.transformed.type,
            parentId: fileGroup.transformed.parentId
          });
        }
      }
    }
    
    // Setze die Drag-Daten
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      items: itemsToMove,
      isFileGroup: itemsToMove.length > 1
    }));
    
    // Visuelles Feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, [item, fileGroup]);

  // Handler für Drag End
  const handleDragEnd = React.useCallback((e: React.DragEvent) => {
    // Stelle Opacity wieder her
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  
  // Prüfe ob das Item in einem der beiden Atome ausgewählt ist
  const isInBatch = selectedBatchItems.some(batchItem => batchItem.item.id === item.id);
  const isInTransformation = selectedTransformationItems.some(transformationItem => transformationItem.item.id === item.id);
  const isInAnyBatch = isInBatch || isInTransformation;

  // Handler für Checkbox-Änderungen
  // Erweitert: Unterstützt jetzt auch Ordner für rekursive Markdown-Ingestion
  const handleCheckboxChange = React.useCallback((checked: boolean) => {
    const mediaType = getMediaType(item);
    
    if (mediaType === 'audio' || mediaType === 'video') {
      // Für Audio/Video: Transcription-Atom verwenden
      if (checked) {
        setSelectedBatchItems([...selectedBatchItems, {
          item,
          type: mediaType
        }]);
      } else {
        setSelectedBatchItems(selectedBatchItems.filter(i => i.item.id !== item.id));
      }
    } else if (mediaType === 'text' || mediaType === 'document' || item.type === 'folder') {
      // Für Text/Dokumente: Transformation-Atom verwenden
      // NEU: Ordner können jetzt auch ausgewählt werden für rekursive Markdown-Ingestion
      if (checked) {
        setSelectedTransformationItems([...selectedTransformationItems, {
          item,
          type: item.type === 'folder' ? 'unknown' : mediaType
        }]);
      } else {
        setSelectedTransformationItems(selectedTransformationItems.filter(i => i.item.id !== item.id));
      }
    }
  }, [item, selectedBatchItems, selectedTransformationItems, setSelectedBatchItems, setSelectedTransformationItems]);

  // Transcripts werden automatisch aus fileGroup geladen

  // Compact-Modus: vereinfachte Darstellung
  if (compact) {
    return (
      <div
        id={`file-row-${item.id}`}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-2 py-1 text-xs hover:bg-muted/50 grid grid-cols-[24px_minmax(0,1fr)] gap-2 items-center cursor-pointer",
          isSelected && "bg-muted",
          isActive && "bg-primary/10 border-l-2 border-primary"
        )}
      >
        <FileIconComponent item={item} />
        <span className={cn("truncate", isActive && "font-medium")} title={metadata.name}>
          {metadata.name}
        </span>
      </div>
    );
  }

  return (
    <div
      id={`file-row-${item.id}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-move",
        isSelected && "bg-muted",
        isActive && "bg-primary/10 border-l-2 border-primary"
      )}
    >
      <div className="w-6 flex items-center justify-center">
        <Checkbox
          checked={isInAnyBatch}
          onCheckedChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <FileIconComponent item={item} />
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editName}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleRenameSubmit}
          onClick={(e) => e.stopPropagation()}
          className="h-6 px-1 py-0 text-xs"
        />
      ) : (
        <span 
          className={cn("text-left truncate cursor-pointer hover:text-primary select-none", isActive && "font-medium")}
          onClick={handleNameClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          title={metadata.name}
        >
          {metadata.name}
        </span>
      )}
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatFileSize(metadata.size)}
      </span>
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatDate(metadata.modifiedAt)}
      </span>
      <div className="flex items-center justify-start gap-1">
        {/* Shadow-Twin-Icon: Zeigt an ob Shadow-Twin existiert (Datei oder Verzeichnis) */}
        {(fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0) || fileGroup?.transformed || fileGroup?.shadowTwinFolderId ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Wenn transformierte Datei vorhanden, diese öffnen, sonst erstes Transkript
                    if (fileGroup?.transformed && onSelectRelatedFile) {
                      onSelectRelatedFile(fileGroup.transformed);
                    } else if (fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && onSelectRelatedFile) {
                      onSelectRelatedFile(fileGroup.transcriptFiles[0]);
                    }
                  }}
                >
                  <FileText className="h-4 w-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {fileGroup?.transformed 
                    ? `Transformierte Datei anzeigen: ${fileGroup.transformed.metadata.name}`
                    : fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0
                    ? `Shadow-Twin anzeigen: ${fileGroup.transcriptFiles[0].metadata.name}`
                    : 'Shadow-Twin vorhanden'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {/* Plus-Symbol nur anzeigen, wenn kein Shadow-Twin vorhanden und transkribierbar */}
        {(!fileGroup?.transcriptFiles || fileGroup.transcriptFiles.length === 0) && !fileGroup?.transformed && isTranscribable && !metadata.hasTranscript ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  role="button"
                  tabIndex={0}
                  className="h-6 w-6 p-0 inline-flex items-center justify-center hover:bg-muted rounded-sm"
                  onClick={onCreateTranscript}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onCreateTranscript(e as unknown as React.MouseEvent<HTMLDivElement>);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript erstellen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {/* Delete direkt neben Dokument-Icons */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => onDelete(e as React.MouseEvent<HTMLButtonElement>, item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Datei löschen</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div />
    </div>
  );
});

interface FileListProps {
  compact?: boolean;
}

export const FileList = React.memo(function FileList({ compact = false }: FileListProps): JSX.Element {
  const { provider, refreshItems, currentLibrary } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  // Mobile-Flag wurde entfernt, FileList lädt unabhängig vom View
  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  const [, setTranscriptionDialogOpen] = useAtom(transcriptionDialogOpenAtom);
  const [, setTransformationDialogOpen] = useAtom(transformationDialogOpenAtom);
  const [, setIngestionDialogOpen] = useAtom(ingestionDialogOpenAtom);
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
  const shadowTwinAnalysisTriggerRef = React.useRef(0);
  useShadowTwinAnalysis(allItemsInFolder ?? [], provider, shadowTwinAnalysisTriggerRef.current);
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom);

  // Kein mobiles Flag mehr notwendig

  const folders = useMemo(() => {
    // Wenn eine folderId in der URL steht und currentFolderId noch 'root' ist,
    // zeige keine Items an (verhindert, dass Root-Items kurz angezeigt werden)
    if (!shouldShowItems) {
      return [];
    }
    const items = allItemsInFolder ?? [];
    // Verstecke dot-Verzeichnisse generell in der Liste
    return items.filter(item => item.type === 'folder' && !item.metadata.name.startsWith('.'));
  }, [allItemsInFolder, shouldShowItems]);

  // Hilfsfunktion zum Finden einer FileGroup in der Map
  const findFileGroup = useCallback((map: Map<string, FileGroup>, stem: string): FileGroup | undefined => {
    return Array.from((map ?? new Map()).values()).find(group => 
      group.baseItem && getBaseName(group.baseItem.metadata.name) === stem
    );
  }, []); // Stabile Utility-Funktion ohne Dependencies

  // NEU: Atome für Sortierung und Filter
  const items = useAtomValue(sortedFilteredFilesAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  
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
  const handleSelectRelatedFile = useCallback((shadowTwin: StorageItem) => {
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
      shadowTwinAnalysisTriggerRef.current += 1;
      
      FileLogger.info('FileList', 'Dateiliste und Shadow-Twins aktualisiert', {
        folderId: currentFolderId,
        itemCount: refreshedItems.length,
        triggerValue: shadowTwinAnalysisTriggerRef.current
      });
      
      toast.success('Dateiliste und Shadow-Twins aktualisiert');
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Aktualisieren der Dateiliste', error);
      toast.error('Fehler beim Aktualisieren der Dateiliste');
    } finally {
      setIsRefreshing(false);
    }
  }, [currentFolderId, refreshItems, setFolderItems]);

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
            shadowTwinAnalysisTriggerRef.current += 1
          }
        }
      } catch {}
    };
    window.addEventListener('library_refresh', onRefresh as unknown as EventListener);
    return () => window.removeEventListener('library_refresh', onRefresh as unknown as EventListener);
  }, [items, handleRefresh, currentFolderId]);

  const handleCreateTranscript = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    FileLogger.info('FileList', 'Create transcript for', { fileName: 'TODO' });
    // TODO: Implement transcript creation
  }, []);

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

  const handleBatchTranscription = () => {
    if (selectedBatchItems.length > 0) {
      setTranscriptionDialogOpen(true);
    }
  };

  const handleBatchTransformation = () => {
    if (selectedTransformationItems.length > 0) {
      setTransformationDialogOpen(true);
    }
  };

  // Markdown‑Ingestion (Batch) – öffnet Dialog für Fortschrittsanzeige
  // Erweitert: Unterstützt jetzt auch rekursive Ordner-Verarbeitung
  const handleBatchIngest = React.useCallback(() => {
    // Prüfe ob Markdown-Dateien oder Ordner ausgewählt sind
    const isMarkdown = (name: string, mime?: string) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.md') || (mime || '').toLowerCase().includes('markdown');
    };

    const hasMarkdownOrFolders = selectedTransformationItems.some(({ item }) => 
      item.type === 'folder' || 
      (item.type === 'file' && isMarkdown(item.metadata.name, item.metadata.mimeType))
    );

    if (!hasMarkdownOrFolders) {
      toast.info("Hinweis", { description: "Keine Markdown‑Dateien oder Ordner ausgewählt" });
      return;
    }

    // Öffne Dialog für Fortschrittsanzeige
    setIngestionDialogOpen(true);
  }, [selectedTransformationItems, setIngestionDialogOpen]);

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

            {/* Dateikategorie-Filter (Icon-only Variante) */}
            <FileCategoryFilter iconOnly />

            {/* Batch-Actions als Icons */}
            {selectedBatchItems.length > 0 && (
              <Button size="icon" title="Transkribieren" aria-label="Transkribieren" onClick={handleBatchTranscription}>
                <FileText className="h-4 w-4" />
              </Button>
            )}
            {selectedTransformationItems.length > 0 && (
              <>
                <Button size="icon" variant="secondary" title="Transformieren" aria-label="Transformieren" onClick={handleBatchTransformation}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button className="h-8 px-2 text-xs" variant="outline" title="Ingestieren" aria-label="Ingestieren" onClick={handleBatchIngest}>
                  Ingest
                </Button>
              </>
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
              // Normal: behalte leichte Einrückung für Checkbox-Spalte
              <div
                key={folder.id}
                role="button"
                tabIndex={0}
                onClick={() => navigateToFolder(folder.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigateToFolder(folder.id) }}
                className="w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)] gap-2 items-center cursor-pointer"
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
              </div>
            )
          ))}
            </div>
          )}

          {/* File Rows */}
          <div className="divide-y">
            {Array.from((fileGroupsWithShadowTwinFolders ?? new Map()).values())
              .map((group) => {
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
                    onCreateTranscript={handleCreateTranscript}
                    onDelete={(e) => handleDeleteClick(e, item)}
                    fileGroup={group}
                    onSelectRelatedFile={handleSelectRelatedFile}
                    onRename={handleRename}
                    compact={compact}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}); 