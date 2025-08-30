# Analyse des Initialisierungsverhaltens im mobilen Modus
_Exported on 8/30/2025 at 11:42:18 GMT+2 from Cursor (1.5.5)_

---

**User**

Können wir das Initialisierungsverhalten im mobilen Modus nochmal analysieren? Diese File List bleibt immer auf dieser Ladeordner Struktur State hängen. Ich denke es hat etwas damit zu tun, dass FileTree in der mobilen Ansicht ausgeblendet ist. Vielleicht gibt es hier Abhängigkeiten im State oder Erase Conditions. Wie könnten wir das genauer analysieren?

---

**Cursor**

Ich starte mit einer schnellen Bestandsaufnahme im Code: Ich suche parallel nach dem Text "Lade Ordnerstruktur…" und nach den Komponenten `file-tree`/`file-list`, um die Initialisierungs- und Lade-Logik zu lokalisieren. Danach prüfe ich, ob in der mobilen Ansicht bedingtes Rendering/Unmounting von `FileTree` Seiteneffekte im State auslöst.

Ich suche parallel nach relevanten Stellen: Render-Gate in `file-list.tsx`, Mobile-Sichtbarkeitslogik in `library.tsx`, und ob Lint/Test-Skripte vorhanden sind. Anschließend passe ich die Render-Bedingung in `file-list.tsx` an, sodass Mobile nicht auf `fileTreeReady` blockiert.

Ich passe die Render-Bedingung in `src/components/library/file-list.tsx` an, damit Mobile nicht mehr auf `fileTreeReady` blockiert. Danach prüfe ich Linter-Warnungen für die Datei.

```typescriptreact
'use client';

import * as React from "react"
import { File, FileText, FileVideo, FileAudio, Plus, RefreshCw, ChevronUp, ChevronDown, Trash2, ScrollText, Folder as FolderIcon, Layers } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { useAtomValue, useAtom } from 'jotai';
import { 
  activeLibraryIdAtom, 
  fileTreeReadyAtom, 
  selectedFileAtom, 
  folderItemsAtom,
  sortedFilteredFilesAtom,
  sortFieldAtom,
  sortOrderAtom,
  selectedShadowTwinAtom
} from '@/atoms/library-atom';
import { toast } from "sonner";
import { Input } from "@/components/ui/input"
import {
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom,
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  getMediaType,
  fileCategoryFilterAtom,
} from '@/atoms/transcription-options';
import { Checkbox } from "@/components/ui/checkbox"
import { useMemo, useCallback } from "react"
import { FileLogger, StateLogger } from "@/lib/debug/logger"
import { FileCategoryFilter } from './file-category-filter';
import { useFolderNavigation } from "@/hooks/use-folder-navigation";

// Typen für Sortieroptionen
type SortField = 'type' | 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';

// Typ für gruppierte Dateien
interface FileGroup {
  baseItem?: StorageItem;
  transcriptFiles?: StorageItem[]; // NEU: alle Transkripte
  transformed?: StorageItem;
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
  onSelect: () => void;
  onCreateTranscript: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, item: StorageItem) => void;
  fileGroup?: FileGroup;
  onSelectRelatedFile?: (file: StorageItem) => void;
  onRename?: (item: StorageItem, newName: string) => Promise<void>;
  compact?: boolean;
  systemFolderId?: string;
}

const FileRow = React.memo(function FileRow({ 
  item, 
  isSelected, 
  onSelect,
  onCreateTranscript,
  onDelete,
  fileGroup,
  onSelectRelatedFile,
  onRename,
  compact = false,
  systemFolderId
}: FileRowProps) {
  const navigateToFolder = useFolderNavigation();
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

  // Handler für Transkript-Icon Click
  const handleTranscriptClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transcriptFiles && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transcriptFiles[0]); // Nur das erste Transkript anzeigen
    }
  }, [fileGroup, onSelectRelatedFile]);

  // Handler für Transformierte-Datei-Icon Click
  const handleTransformedClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transformed && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transformed);
    }
  }, [fileGroup, onSelectRelatedFile]);

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
    } else if (mediaType === 'text' || mediaType === 'document') {
      // Für Text/Dokumente: Transformation-Atom verwenden
      if (checked) {
        setSelectedTransformationItems([...selectedTransformationItems, {
          item,
          type: mediaType
        }]);
      } else {
        setSelectedTransformationItems(selectedTransformationItems.filter(i => i.item.id !== item.id));
      }
    }
  }, [item, selectedBatchItems, selectedTransformationItems, setSelectedBatchItems, setSelectedTransformationItems]);

  React.useEffect(() => {
    if (fileGroup) {
      FileLogger.debug('FileRow', 'Transkripte für Zeile', {
        baseItem: fileGroup.baseItem?.metadata.name,
        transcripts: fileGroup.transcriptFiles?.map(t => t.metadata.name)
      });
    }
  }, [fileGroup]);

  // Compact-Modus: vereinfachte Darstellung
  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-2 py-1 text-sm hover:bg-muted/50 flex items-center gap-2 cursor-pointer",
          isSelected && "bg-muted"
        )}
      >
        <FileIconComponent item={item} />
        <span className="truncate flex-1" title={metadata.name}>
          {metadata.name}
        </span>
        {/* Shadow-Twin-Symbole im compact mode */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={handleTranscriptClick}
          >
            <ScrollText className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // Standard-Modus: vollständige Tabellen-Darstellung
  return (
    <div
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
        isSelected && "bg-muted"
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
          className="text-left truncate cursor-pointer hover:text-primary select-none"
          onClick={handleNameClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          title="Doppelklick zum Umbenennen"
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
        {/* System-Unterordner (z. B. extrahierte Seiten) */}
        {systemFolderId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToFolder(systemFolderId);
                  }}
                >
                  <Layers className="h-4 w-4 text-violet-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Seiten-Ordner öffnen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Zeige Icons für alle vorhandenen Transkripte */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles.map((transcript) => (
          <TooltipProvider key={transcript.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectRelatedFile) onSelectRelatedFile(transcript);
                  }}
                >
                  <FileText className="h-4 w-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript anzeigen: {transcript.metadata.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {/* Plus-Symbol nur anzeigen, wenn kein Transkript vorhanden und transkribierbar */}
        {(!fileGroup?.transcriptFiles || fileGroup.transcriptFiles.length === 0) && isTranscribable && !metadata.hasTranscript ? (
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
        {/* Icon für transformierte Datei */}
        {fileGroup?.transformed && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={handleTransformedClick}
                >
                  <ScrollText className="h-4 w-4 text-green-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transformierte Datei anzeigen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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
  const [isMobile, setIsMobile] = React.useState(false);
  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  const [, setTranscriptionDialogOpen] = useAtom(transcriptionDialogOpenAtom);
  const [, setTransformationDialogOpen] = useAtom(transformationDialogOpenAtom);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initializationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isFileTreeReady = useAtomValue(fileTreeReadyAtom);
  const [, setSelectedFile] = useAtom(selectedFileAtom);
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const currentCategoryFilter = useAtomValue(fileCategoryFilterAtom);
  const allItemsInFolder = useAtomValue(folderItemsAtom);
  const navigateToFolder = useFolderNavigation();

  // Mobile-Flag lokal bestimmen, damit FileList unabhängig vom Tree laden kann
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => setIsMobile(matches);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const folders = useMemo(() => {
    const items = allItemsInFolder ?? [];
    // Verstecke dot-Verzeichnisse generell in der Liste
    return items.filter(item => item.type === 'folder' && !item.metadata.name.startsWith('.'));
  }, [allItemsInFolder]);

  // Hilfsfunktion zum Finden einer FileGroup in der Map
  const findFileGroup = (map: Map<string, FileGroup>, stem: string): FileGroup | undefined => {
    return Array.from((map ?? new Map()).values()).find(group => 
      group.baseItem && getBaseName(group.baseItem.metadata.name) === stem
    );
  };

  // NEU: Atome für Sortierung und Filter
  const items = useAtomValue(sortedFilteredFilesAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  
  // Review-Mode-Atoms
  const [, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);

  // handleSort nutzt jetzt Atome
  const handleSort = React.useCallback((field: SortField) => {
    if (field === sortField) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder, setSortField, setSortOrder]);

  // Initialisierung
  React.useEffect(() => {
    if (!provider || (!isFileTreeReady && !isMobile)) {
      FileLogger.info('FileList', 'Waiting for provider and FileTree', {
        hasProvider: !!provider,
        isFileTreeReady
      });
      return;
    }

    const initialize = async () => {
      if (isInitialized) {
        FileLogger.debug('FileList', 'Already initialized', {
          hasProvider: !!provider,
          hasItems: items?.length > 0,
          isInitialized
        });
        return;
      }

      // [Nav:10] FileList Starting initialization
      FileLogger.info('FileList', 'Starting initialization');

      try {
        // [Nav:13] FileList Initialization complete
        FileLogger.info('FileList', 'Initialization complete');
        setIsInitialized(true);
      } catch (error) {
        FileLogger.error('FileList', 'Error initializing FileList', error);
      }
    };

    initialize();

    const timeoutRef = initializationTimeoutRef.current;
    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    };
  }, [provider, isFileTreeReady, isInitialized, items?.length, isMobile]);

  // NEU: Reagieren auf Bibliothekswechsel
  const prevLibraryIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    StateLogger.debug('FileList', 'Render', {
      currentLibraryId: activeLibraryId,
      activeLibraryIdAtom: activeLibraryId
    });

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
  function getBaseName(name: string): string {
    // ShadowTwin: .de.md, .en.md, etc.
    const shadowTwinMatch = name.match(/^(.*)\.(de|en|fr|es|it)\.md$/);
    if (shadowTwinMatch) return shadowTwinMatch[1];
    // Sonst: alles vor der letzten Endung
    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) return name;
    return name.substring(0, lastDot);
  }

  // Prüft ob eine Datei ein ShadowTwin ist (Markdown mit Sprachkürzel)
  function isShadowTwin(name: string): boolean {
    // Pattern: name.de.md, name.en.md, etc.
    const shadowTwinPattern = /^(.+)\.(de|en|fr|es|it)\.md$/;
    return shadowTwinPattern.test(name);
  }

  // Gruppiere die Dateien nach Basename
  const fileGroups = useMemo(() => {
    if (!items) return new Map<string, FileGroup>();

    // Schritt 1: Gruppiere alle Dateien nach Basename
    const groupsMap = new Map<string, StorageItem[]>();
    for (const item of items) {
      if (item.type !== 'file') continue;
      const base = getBaseName(item.metadata.name);
      if (!groupsMap.has(base)) groupsMap.set(base, []);
      groupsMap.get(base)!.push(item);
    }

    // Schritt 2: Erstelle FileGroups
    const fileGroupsMap = new Map<string, FileGroup>();
    for (const [base, groupItems] of Array.from(groupsMap.entries())) {
      // Finde Hauptdatei (erste Nicht-ShadowTwin-Datei)
      const mainFile = groupItems.find((item) => !isShadowTwin(item.metadata.name));
      // Finde alle ShadowTwins
      const shadowTwins = groupItems.filter((item) => isShadowTwin(item.metadata.name));
      if (mainFile) {
        fileGroupsMap.set(base, {
          baseItem: mainFile,
          transcriptFiles: shadowTwins.length > 0 ? shadowTwins : undefined,
          transformed: undefined
        });
      } else {
        // Keine Hauptdatei: Jede ShadowTwin einzeln anzeigen
        for (const twin of shadowTwins) {
          fileGroupsMap.set(`${base}__shadow_${twin.id}`, {
            baseItem: twin,
            transcriptFiles: undefined,
            transformed: undefined
          });
        }
      }
    }
    // Debug-Logging für Gruppierung
    FileLogger.debug('FileList', 'Gruppierung Ergebnis (Basename, alle Endungen)', {
      groups: Array.from(fileGroupsMap.entries()).map(([base, group]) => ({
        base,
        baseItem: group.baseItem?.metadata.name,
        transcripts: group.transcriptFiles?.map(t => t.metadata.name)
      }))
    });
    return fileGroupsMap;
  }, [items]);

  // Mapping: Basename -> dot-Systemordner (z. B. ".<basename>")
  const systemFolderByBase = useMemo(() => {
    const map = new Map<string, StorageItem>();
    const items = allItemsInFolder ?? [];
    for (const it of items) {
      if (it.type !== 'folder') continue;
      const name = it.metadata.name;
      if (!name.startsWith('.')) continue;
      const base = name.slice(1);
      if (base) map.set(base, it);
    }
    return map;
  }, [allItemsInFolder]);

  // Berechne, ob alle Dateien ausgewählt sind
  const isAllSelected = useMemo(() => {
    if (!fileGroups || !fileGroups.size) return false;
    // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
    const mainItems = Array.from((fileGroups ?? new Map()).values())
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
  }, [fileGroups, selectedBatchItems, selectedTransformationItems, currentCategoryFilter]);
  
  // Erweiterte handleSelect Funktion für Review-Mode
  const handleSelect = useCallback((item: StorageItem, group?: FileGroup) => {
    FileLogger.debug('FileList', 'handleSelect aufgerufen', {
      itemId: item.id,
      itemName: item.metadata.name,
      groupBase: group?.baseItem?.metadata.name,
      transcriptCount: group?.transcriptFiles?.length ?? 0,
      hasTranscripts: !!(group && group.transcriptFiles && group.transcriptFiles.length > 0)
    });
    
    // Nur die ausgewählte Datei setzen - Review-Modus wird über Toggle-Button gesteuert
    setSelectedFile(item);
    
    // Wenn wir im Review-Modus sind und eine Basis-Datei mit Shadow-Twin ausgewählt wird,
    // dann automatisch das Shadow-Twin setzen
    if (group && group.transcriptFiles && group.transcriptFiles.length > 0) {
      const shadowTwin = group.transcriptFiles[0];
      FileLogger.info('FileList', 'Basis-Datei mit Shadow-Twin ausgewählt', {
        twinId: shadowTwin.id,
        twinName: shadowTwin.metadata.name,
        baseFileId: item.id,
        baseFileName: item.metadata.name
      });
      setSelectedShadowTwin(shadowTwin);
    } else {
      FileLogger.info('FileList', 'Datei ohne Shadow-Twin ausgewählt', {
        itemId: item.id,
        itemName: item.metadata.name,
        groupExists: !!group,
        transcriptCount: group?.transcriptFiles?.length ?? 0
      });
      setSelectedShadowTwin(null);
    }
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);
  
  // Erweiterte handleSelectRelatedFile Funktion für Review-Mode
  const handleSelectRelatedFile = useCallback((shadowTwin: StorageItem) => {
    StateLogger.info('FileList', 'Shadow-Twin ausgewählt', {
      shadowTwinId: shadowTwin.id,
      shadowTwinName: shadowTwin.metadata.name
    });
    
    // Setze das Shadow-Twin als ausgewählte Datei, damit es rechts angezeigt wird
    setSelectedFile(shadowTwin);
    setSelectedShadowTwin(null); // Kein zusätzliches Shadow-Twin im normalen Modus
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);

  // Aktualisierte handleRefresh Funktion
  const handleRefresh = useCallback(async () => {
    if (!items || items.length === 0) return;
    
    const parentId = items[0]?.parentId;
    if (!parentId) return;
    
    setIsRefreshing(true);
    
    try {
      const refreshedItems = await refreshItems(parentId);
      setFolderItems(refreshedItems);
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Aktualisieren der Dateiliste', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [items, refreshItems, setFolderItems]);

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
      const fileGroup = findFileGroup(fileGroups, itemStem);

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
  }, [provider, handleRefresh, fileGroups, setSelectedFile, setSelectedBatchItems]);

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
      const fileGroup = findFileGroup(fileGroups, itemStem);

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
  }, [provider, handleRefresh, fileGroups]);

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

  // Intelligente Batch-Auswahl basierend auf Filter
  const handleSelectAll = useCallback((checked: boolean) => {
    const startTime = performance.now();
    if (checked) {
      // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
      const mainItems = Array.from((fileGroups ?? new Map()).values())
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
  }, [fileGroups, currentCategoryFilter, setSelectedBatchItems, setSelectedTransformationItems, selectedBatchItems.length, selectedTransformationItems.length, items.length]);

  React.useEffect(() => {
    // Logging der Library-IDs - verzögert ausführen
    const timeoutId = setTimeout(() => {
      StateLogger.debug('FileList', 'Render', {
        currentLibraryId: currentLibrary?.id,
        activeLibraryIdAtom: activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentLibrary, activeLibraryId]);

  if (!isFileTreeReady && !isMobile) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
  }

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
                <ScrollText className="h-4 w-4" />
              </Button>
            )}
            {selectedTransformationItems.length > 0 && (
              <Button size="icon" variant="secondary" title="Transformieren" aria-label="Transformieren" onClick={handleBatchTransformation}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-auto">
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
                <div
                  key={folder.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToFolder(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigateToFolder(folder.id);
                  }}
                  className="w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-pointer"
                >
                  <div />
                  <FolderIcon className="h-4 w-4" />
                  <span className="text-left truncate select-none">{folder.metadata.name}</span>
                  <span className="text-muted-foreground" />
                  <span className="text-muted-foreground" />
                  <div />
                </div>
              ))}
            </div>
          )}

          {/* File Rows */}
          <div className="divide-y">
            {Array.from((fileGroups ?? new Map()).values())
              .map((group) => {
                // Zeige nur die Hauptdatei (baseItem) an
                const item = group.baseItem;
                if (!item) return null;
                // System-Unterordner-Id, wenn ein ".<basename>"-Folder existiert
                const systemFolder = systemFolderByBase.get(getBaseName(item.metadata.name));
                const systemFolderId = systemFolder?.id;
                return (
                  <FileRow
                    key={item.id}
                    item={item as StorageItem}
                    isSelected={isItemSelected(item)}
                    onSelect={() => handleSelect(item, group)}
                    onCreateTranscript={handleCreateTranscript}
                    onDelete={(e) => handleDeleteClick(e, item)}
                    fileGroup={group}
                    onSelectRelatedFile={handleSelectRelatedFile}
                    onRename={handleRename}
                    compact={compact}
                    systemFolderId={systemFolderId}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}); 
```

Kurzes Update: Ich habe die Stellen identifiziert, die das Hängenbleiben verursachen, und eine minimale Änderung vorgenommen, damit Mobile nicht mehr auf den Tree wartet.

### Analyse
- In `src/components/library/file-list.tsx` gibt es ein Render-Gate:
```1257:1260:src/components/library/file-list.tsx
if (!isFileTreeReady) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
}
```
- Gleichzeitig setzt `src/components/library/library.tsx` den Tree in der mobilen Ansicht unsichtbar und lädt Items, sobald entweder der Tree bereit ist oder Mobile aktiv ist:
```202:225:src/components/library/library.tsx
const treeReady = isFileTreeReady || isMobile || !isTreeVisible;
const isReady = treeReady && providerInstance && libraryStatus === 'ready';
```
- Konflikt: `FileList` blockiert strikt auf `isFileTreeReady`, obwohl wir im Mobile-Modus bewusst ohne Tree arbeiten. Dadurch bleibt die Liste auf „Lade Ordnerstruktur…“.

### Änderung
- Bedingung in `file-list.tsx` angepasst, sodass Mobile nicht blockiert:
```diff
- if (!isFileTreeReady) {
+ if (!isFileTreeReady && !isMobile) {
   return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
}
```
- Linter geprüft: keine Fehler.

### Wie weiter testen
- Mobilansicht erzwingen: DevTools → Toggle device toolbar → Breite < 1024px.
- Schritte:
  - App öffnen, Bibliothek wählen.
  - Beobachten, ob „Lade Ordnerstruktur…“ kurz erscheint und dann Items geladen werden.
  - In Desktop-Ansicht prüfen, dass die Liste weiterhin wartet, bis der Tree geladen ist.

- Edge Cases, auf die achten:
  - Library-Wechsel: `FileTree` setzt `fileTreeReadyAtom` auf false; Mobile sollte weiterhin listen können.
  - Provider noch nicht bereit: `Library` lädt erst bei `libraryStatus === 'ready'`. In diesem Fall zeigt `Library` „Lade Storage…“, nicht die FileList.

Wenn es trotz der Änderung weiter hängt, schaue ich als Nächstes auf:
- Ob `listItems` in `library.tsx` tatsächlich feuert, wenn `treeReady === true` wegen Mobile.
- Ob `folderItemsAtom` befüllt wird und `sortedFilteredFilesAtom` Items liefert.

```typescriptreact
if (!isFileTreeReady) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
}
```

```typescriptreact
const treeReady = isFileTreeReady || isMobile || !isTreeVisible;
const isReady = treeReady && providerInstance && libraryStatus === 'ready';
```

```diff
- if (!isFileTreeReady) {
+ if (!isFileTreeReady && !isMobile) {
   return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
}
```

---

**User**

initialisierung dauert ewig: Wo bleibt er hängen?

{
  "timestamp": "2025-08-26T07:20:12.397Z",
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
    "LocalStorageProvider:🔐 AUTH: API call successful"
  ],
  "errors": 0,
  "logs": [
    {
      "timestamp": "2025-08-26T07:19:45.431Z",
      "area": "state",
      "sequence": 24,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 5,
        "folderId": "dGVtcGxhdGVz",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756192785432-nhz8j0n5i",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.424Z",
      "area": "file",
      "sequence": 52,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Transcript Quartalssitzung.m4a"
      },
      "id": "1756192785430-bzyc6ehao",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.423Z",
      "area": "file",
      "sequence": 51,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
      },
      "id": "1756192785430-d3h484m8j",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.422Z",
      "area": "file",
      "sequence": 50,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Swiss Goverment Cloud.docx"
      },
      "id": "1756192785430-xb1q60aio",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.421Z",
      "area": "file",
      "sequence": 49,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Quartalssitzung.m4a"
      },
      "id": "1756192785430-z2wncimlg",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.421Z",
      "area": "file",
      "sequence": 48,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Prioritäten Mai.md"
      },
      "id": "1756192785430-h4bses23j",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.420Z",
      "area": "file",
      "sequence": 47,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
      },
      "id": "1756192785430-3ptlfzuwa",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.419Z",
      "area": "file",
      "sequence": 46,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung2.pptx"
      },
      "id": "1756192785430-x1kz4ibj5",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.419Z",
      "area": "file",
      "sequence": 45,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung.pptx"
      },
      "id": "1756192785430-ukjjr3r8c",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.418Z",
      "area": "file",
      "sequence": 44,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
      },
      "id": "1756192785430-cd0amt7kh",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.417Z",
      "area": "file",
      "sequence": 43,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Paul Lindberg.md"
      },
      "id": "1756192785430-rnfonjsar",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.417Z",
      "area": "file",
      "sequence": 42,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
      },
      "id": "1756192785430-bbisqb5ys",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.416Z",
      "area": "file",
      "sequence": 41,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "IMG-20250503-WA0004.jpg"
      },
      "id": "1756192785430-eml07hqdd",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.415Z",
      "area": "file",
      "sequence": 40,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen(1).md"
      },
      "id": "1756192785430-009c8shsk",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.415Z",
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
      "id": "1756192785430-0v4lwrd4n",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.414Z",
      "area": "file",
      "sequence": 38,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.Besprechung.de.md"
      },
      "id": "1756192785430-bydfxn8kr",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.413Z",
      "area": "file",
      "sequence": 37,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
      },
      "id": "1756192785430-chd7hs544",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.413Z",
      "area": "file",
      "sequence": 36,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Computergestütztes Denken.md"
      },
      "id": "1756192785430-7tdlcthql",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.412Z",
      "area": "file",
      "sequence": 35,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
      },
      "id": "1756192785430-cprxbgdvi",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.411Z",
      "area": "file",
      "sequence": 34,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
      },
      "id": "1756192785430-5i3pgbwe2",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.410Z",
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
      "id": "1756192785430-msa41jrlu",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.410Z",
      "area": "file",
      "sequence": 32,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250421_125103.jpg"
      },
      "id": "1756192785429-vvkjo5dty",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.409Z",
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
      "id": "1756192785429-bs9d57lxx",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.309Z",
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
      "id": "1756192785429-lrkoy981a",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.302Z",
      "area": "state",
      "sequence": 23,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 46,
        "fileCount": 26,
        "folderCount": 20
      },
      "id": "1756192785302-8hm2k0w93",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:45.302Z",
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
      "id": "1756192785302-9qmbpaqqh",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:19:44.724Z",
      "area": "state",
      "sequence": 21,
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
      "id": "1756192784726-bpb9opkoe",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:19:44.724Z",
      "area": "state",
      "sequence": 20,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756192784725-vv4w9mhop",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    }
  ]
}

---

**Cursor**

Kurzes Update: Deinen Logauszug zeigt, dass Daten und Provider fertig sind; der Hänger ist kein Backend-/Fetch-Thema, sondern ein UI-Gate.

### Wo hängt es?
- In `FileList` gab es ein Render-Gate, das strikt auf `fileTreeReady` wartete. Wenn der `FileTree` mobil ausgeblendet/unmounted ist, bleibt `fileTreeReady` false und die Liste zeigt dauerhaft „Lade Ordnerstruktur…“.
```1257:1260:src/components/library/file-list.tsx
if (!isFileTreeReady) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
}
```
- Zusätzlich gibt es ein Init-Gate im Effekt, das Desktop korrekt blockiert, Mobile aber passieren lässt:
```700:708:src/components/library/file-list.tsx
if (!provider || (!isFileTreeReady && !isMobile)) {
  // wartet auf Provider und ggf. Tree
  return;
}
```

### Belege aus deinen Logs
- „Items loaded successfully … itemCount: 46“ und unmittelbar danach „Gruppierung Ergebnis …“ sowie zahlreiche `FileRow`-Logs. Das heißt: Daten liegen im State vor, Gruppierung/Render-Pipeline läuft. Das „Lade Ordnerstruktur…“ kam allein vom Render-Gate.

### Änderung durchgeführt
- Das Render-Gate in `FileList` wurde mobil-freundlich gemacht:
```diff
- if (!isFileTreeReady) {
+ if (!isFileTreeReady && !isMobile) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
}
```
- Lint: grün.

### Bitte so testen
- Mobilbreite (<1024px) im DevTools-Device-Mode.
- Library öffnen → sollte ohne Tree-Wait direkt rendern.
- Desktop-Verhalten bleibt unverändert: wartet weiter korrekt auf den Tree.

Falls es weiterhin „ewig“ wirkt:
- Prüfe die drei Flags zur Laufzeit in der Konsole: `isMobile`, `isTreeVisible`, `isFileTreeReady`.
- Wenn `isMobile===true` und die Liste trotzdem nicht sichtbar wird, senden wir zusätzlich die Werte aus `file-list.tsx` bei Mount als Log, um Timing zu sehen.

```typescriptreact
if (!isFileTreeReady) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
}
```

```typescriptreact
if (!provider || (!isFileTreeReady && !isMobile)) {
  // wartet auf Provider und ggf. Tree
  return;
}
```

```diff
- if (!isFileTreeReady) {
+ if (!isFileTreeReady && !isMobile) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
}
```

---

**User**

@debug/ können wir diese state Änderungen in unserem debugger loggen? dann kann ich die logs mitteilen.

---

**Cursor**

Ich werde die relevanten Dateien öffnen und parallele Suchen durchführen, um alle betroffenen State-Flags zu identifizieren und gezielte Debug-Logs an den kritischen Punkten einzubauen. Danach prüfe ich Linter-Warnungen.

Ich ergänze jetzt gezielte Debug-Logs in `Library`, `FileList` und `FileTree`, um Gate-States und Zustandswechsel sichtbar zu machen. Danach prüfe ich Linter-Warnungen für die betroffenen Dateien.

```typescriptreact
'use client';

import * as React from "react"
import { File, FileText, FileVideo, FileAudio, Plus, RefreshCw, ChevronUp, ChevronDown, Trash2, ScrollText, Folder as FolderIcon, Layers } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { useAtomValue, useAtom } from 'jotai';
import { 
  activeLibraryIdAtom, 
  fileTreeReadyAtom, 
  selectedFileAtom, 
  folderItemsAtom,
  sortedFilteredFilesAtom,
  sortFieldAtom,
  sortOrderAtom,
  selectedShadowTwinAtom
} from '@/atoms/library-atom';
import { toast } from "sonner";
import { Input } from "@/components/ui/input"
import {
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom,
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  getMediaType,
  fileCategoryFilterAtom,
} from '@/atoms/transcription-options';
import { Checkbox } from "@/components/ui/checkbox"
import { useMemo, useCallback } from "react"
import { FileLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { FileCategoryFilter } from './file-category-filter';
import { useFolderNavigation } from "@/hooks/use-folder-navigation";

// Typen für Sortieroptionen
type SortField = 'type' | 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';

// Typ für gruppierte Dateien
interface FileGroup {
  baseItem?: StorageItem;
  transcriptFiles?: StorageItem[]; // NEU: alle Transkripte
  transformed?: StorageItem;
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
  onSelect: () => void;
  onCreateTranscript: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, item: StorageItem) => void;
  fileGroup?: FileGroup;
  onSelectRelatedFile?: (file: StorageItem) => void;
  onRename?: (item: StorageItem, newName: string) => Promise<void>;
  compact?: boolean;
  systemFolderId?: string;
}

const FileRow = React.memo(function FileRow({ 
  item, 
  isSelected, 
  onSelect,
  onCreateTranscript,
  onDelete,
  fileGroup,
  onSelectRelatedFile,
  onRename,
  compact = false,
  systemFolderId
}: FileRowProps) {
  const navigateToFolder = useFolderNavigation();
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

  // Handler für Transkript-Icon Click
  const handleTranscriptClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transcriptFiles && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transcriptFiles[0]); // Nur das erste Transkript anzeigen
    }
  }, [fileGroup, onSelectRelatedFile]);

  // Handler für Transformierte-Datei-Icon Click
  const handleTransformedClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transformed && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transformed);
    }
  }, [fileGroup, onSelectRelatedFile]);

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
    } else if (mediaType === 'text' || mediaType === 'document') {
      // Für Text/Dokumente: Transformation-Atom verwenden
      if (checked) {
        setSelectedTransformationItems([...selectedTransformationItems, {
          item,
          type: mediaType
        }]);
      } else {
        setSelectedTransformationItems(selectedTransformationItems.filter(i => i.item.id !== item.id));
      }
    }
  }, [item, selectedBatchItems, selectedTransformationItems, setSelectedBatchItems, setSelectedTransformationItems]);

  React.useEffect(() => {
    if (fileGroup) {
      FileLogger.debug('FileRow', 'Transkripte für Zeile', {
        baseItem: fileGroup.baseItem?.metadata.name,
        transcripts: fileGroup.transcriptFiles?.map(t => t.metadata.name)
      });
    }
  }, [fileGroup]);

  // Compact-Modus: vereinfachte Darstellung
  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-2 py-1 text-sm hover:bg-muted/50 flex items-center gap-2 cursor-pointer",
          isSelected && "bg-muted"
        )}
      >
        <FileIconComponent item={item} />
        <span className="truncate flex-1" title={metadata.name}>
          {metadata.name}
        </span>
        {/* Shadow-Twin-Symbole im compact mode */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={handleTranscriptClick}
          >
            <ScrollText className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // Standard-Modus: vollständige Tabellen-Darstellung
  return (
    <div
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
        isSelected && "bg-muted"
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
          className="text-left truncate cursor-pointer hover:text-primary select-none"
          onClick={handleNameClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          title="Doppelklick zum Umbenennen"
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
        {/* System-Unterordner (z. B. extrahierte Seiten) */}
        {systemFolderId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToFolder(systemFolderId);
                  }}
                >
                  <Layers className="h-4 w-4 text-violet-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Seiten-Ordner öffnen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Zeige Icons für alle vorhandenen Transkripte */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles.map((transcript) => (
          <TooltipProvider key={transcript.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectRelatedFile) onSelectRelatedFile(transcript);
                  }}
                >
                  <FileText className="h-4 w-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript anzeigen: {transcript.metadata.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {/* Plus-Symbol nur anzeigen, wenn kein Transkript vorhanden und transkribierbar */}
        {(!fileGroup?.transcriptFiles || fileGroup.transcriptFiles.length === 0) && isTranscribable && !metadata.hasTranscript ? (
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
        {/* Icon für transformierte Datei */}
        {fileGroup?.transformed && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={handleTransformedClick}
                >
                  <ScrollText className="h-4 w-4 text-green-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transformierte Datei anzeigen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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
  const [isMobile, setIsMobile] = React.useState(false);
  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  const [, setTranscriptionDialogOpen] = useAtom(transcriptionDialogOpenAtom);
  const [, setTransformationDialogOpen] = useAtom(transformationDialogOpenAtom);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initializationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isFileTreeReady = useAtomValue(fileTreeReadyAtom);
  const [, setSelectedFile] = useAtom(selectedFileAtom);
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const currentCategoryFilter = useAtomValue(fileCategoryFilterAtom);
  const allItemsInFolder = useAtomValue(folderItemsAtom);
  const navigateToFolder = useFolderNavigation();

  // Mobile-Flag lokal bestimmen, damit FileList unabhängig vom Tree laden kann
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => setIsMobile(matches);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const folders = useMemo(() => {
    const items = allItemsInFolder ?? [];
    // Verstecke dot-Verzeichnisse generell in der Liste
    return items.filter(item => item.type === 'folder' && !item.metadata.name.startsWith('.'));
  }, [allItemsInFolder]);

  // Hilfsfunktion zum Finden einer FileGroup in der Map
  const findFileGroup = (map: Map<string, FileGroup>, stem: string): FileGroup | undefined => {
    return Array.from((map ?? new Map()).values()).find(group => 
      group.baseItem && getBaseName(group.baseItem.metadata.name) === stem
    );
  };

  // NEU: Atome für Sortierung und Filter
  const items = useAtomValue(sortedFilteredFilesAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  
  // Review-Mode-Atoms
  const [, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);

  // handleSort nutzt jetzt Atome
  const handleSort = React.useCallback((field: SortField) => {
    if (field === sortField) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder, setSortField, setSortOrder]);

  // Initialisierung
  React.useEffect(() => {
    if (!provider || (!isFileTreeReady && !isMobile)) {
      FileLogger.info('FileList', 'Waiting for provider and FileTree', {
        hasProvider: !!provider,
        isFileTreeReady,
        isMobile
      });
      return;
    }

    const initialize = async () => {
      if (isInitialized) {
        FileLogger.debug('FileList', 'Already initialized', {
          hasProvider: !!provider,
          hasItems: items?.length > 0,
          isInitialized
        });
        return;
      }

      // [Nav:10] FileList Starting initialization
      FileLogger.info('FileList', 'Starting initialization');

      try {
        // [Nav:13] FileList Initialization complete
        FileLogger.info('FileList', 'Initialization complete');
        setIsInitialized(true);
      } catch (error) {
        FileLogger.error('FileList', 'Error initializing FileList', error);
      }
    };

    initialize();

    const timeoutRef = initializationTimeoutRef.current;
    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    };
  }, [provider, isFileTreeReady, isInitialized, items?.length, isMobile]);

  // NEU: Reagieren auf Bibliothekswechsel
  const prevLibraryIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    StateLogger.debug('FileList', 'Render', {
      currentLibraryId: activeLibraryId,
      activeLibraryIdAtom: activeLibraryId
    });

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
  function getBaseName(name: string): string {
    // ShadowTwin: .de.md, .en.md, etc.
    const shadowTwinMatch = name.match(/^(.*)\.(de|en|fr|es|it)\.md$/);
    if (shadowTwinMatch) return shadowTwinMatch[1];
    // Sonst: alles vor der letzten Endung
    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) return name;
    return name.substring(0, lastDot);
  }

  // Prüft ob eine Datei ein ShadowTwin ist (Markdown mit Sprachkürzel)
  function isShadowTwin(name: string): boolean {
    // Pattern: name.de.md, name.en.md, etc.
    const shadowTwinPattern = /^(.+)\.(de|en|fr|es|it)\.md$/;
    return shadowTwinPattern.test(name);
  }

  // Gruppiere die Dateien nach Basename
  const fileGroups = useMemo(() => {
    if (!items) return new Map<string, FileGroup>();

    // Schritt 1: Gruppiere alle Dateien nach Basename
    const groupsMap = new Map<string, StorageItem[]>();
    for (const item of items) {
      if (item.type !== 'file') continue;
      const base = getBaseName(item.metadata.name);
      if (!groupsMap.has(base)) groupsMap.set(base, []);
      groupsMap.get(base)!.push(item);
    }

    // Schritt 2: Erstelle FileGroups
    const fileGroupsMap = new Map<string, FileGroup>();
    for (const [base, groupItems] of Array.from(groupsMap.entries())) {
      // Finde Hauptdatei (erste Nicht-ShadowTwin-Datei)
      const mainFile = groupItems.find((item) => !isShadowTwin(item.metadata.name));
      // Finde alle ShadowTwins
      const shadowTwins = groupItems.filter((item) => isShadowTwin(item.metadata.name));
      if (mainFile) {
        fileGroupsMap.set(base, {
          baseItem: mainFile,
          transcriptFiles: shadowTwins.length > 0 ? shadowTwins : undefined,
          transformed: undefined
        });
      } else {
        // Keine Hauptdatei: Jede ShadowTwin einzeln anzeigen
        for (const twin of shadowTwins) {
          fileGroupsMap.set(`${base}__shadow_${twin.id}`, {
            baseItem: twin,
            transcriptFiles: undefined,
            transformed: undefined
          });
        }
      }
    }
    // Debug-Logging für Gruppierung
    FileLogger.debug('FileList', 'Gruppierung Ergebnis (Basename, alle Endungen)', {
      groups: Array.from(fileGroupsMap.entries()).map(([base, group]) => ({
        base,
        baseItem: group.baseItem?.metadata.name,
        transcripts: group.transcriptFiles?.map(t => t.metadata.name)
      }))
    });
    return fileGroupsMap;
  }, [items]);

  // Mapping: Basename -> dot-Systemordner (z. B. ".<basename>")
  const systemFolderByBase = useMemo(() => {
    const map = new Map<string, StorageItem>();
    const items = allItemsInFolder ?? [];
    for (const it of items) {
      if (it.type !== 'folder') continue;
      const name = it.metadata.name;
      if (!name.startsWith('.')) continue;
      const base = name.slice(1);
      if (base) map.set(base, it);
    }
    return map;
  }, [allItemsInFolder]);

  // Berechne, ob alle Dateien ausgewählt sind
  const isAllSelected = useMemo(() => {
    if (!fileGroups || !fileGroups.size) return false;
    // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
    const mainItems = Array.from((fileGroups ?? new Map()).values())
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
  }, [fileGroups, selectedBatchItems, selectedTransformationItems, currentCategoryFilter]);
  
  // Erweiterte handleSelect Funktion für Review-Mode
  const handleSelect = useCallback((item: StorageItem, group?: FileGroup) => {
    FileLogger.debug('FileList', 'handleSelect aufgerufen', {
      itemId: item.id,
      itemName: item.metadata.name,
      groupBase: group?.baseItem?.metadata.name,
      transcriptCount: group?.transcriptFiles?.length ?? 0,
      hasTranscripts: !!(group && group.transcriptFiles && group.transcriptFiles.length > 0)
    });
    
    // Nur die ausgewählte Datei setzen - Review-Modus wird über Toggle-Button gesteuert
    setSelectedFile(item);
    
    // Wenn wir im Review-Modus sind und eine Basis-Datei mit Shadow-Twin ausgewählt wird,
    // dann automatisch das Shadow-Twin setzen
    if (group && group.transcriptFiles && group.transcriptFiles.length > 0) {
      const shadowTwin = group.transcriptFiles[0];
      FileLogger.info('FileList', 'Basis-Datei mit Shadow-Twin ausgewählt', {
        twinId: shadowTwin.id,
        twinName: shadowTwin.metadata.name,
        baseFileId: item.id,
        baseFileName: item.metadata.name
      });
      setSelectedShadowTwin(shadowTwin);
    } else {
      FileLogger.info('FileList', 'Datei ohne Shadow-Twin ausgewählt', {
        itemId: item.id,
        itemName: item.metadata.name,
        groupExists: !!group,
        transcriptCount: group?.transcriptFiles?.length ?? 0
      });
      setSelectedShadowTwin(null);
    }
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);
  
  // Erweiterte handleSelectRelatedFile Funktion für Review-Mode
  const handleSelectRelatedFile = useCallback((shadowTwin: StorageItem) => {
    StateLogger.info('FileList', 'Shadow-Twin ausgewählt', {
      shadowTwinId: shadowTwin.id,
      shadowTwinName: shadowTwin.metadata.name
    });
    
    // Setze das Shadow-Twin als ausgewählte Datei, damit es rechts angezeigt wird
    setSelectedFile(shadowTwin);
    setSelectedShadowTwin(null); // Kein zusätzliches Shadow-Twin im normalen Modus
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);

  // Aktualisierte handleRefresh Funktion
  const handleRefresh = useCallback(async () => {
    if (!items || items.length === 0) return;
    
    const parentId = items[0]?.parentId;
    if (!parentId) return;
    
    setIsRefreshing(true);
    
    try {
      const refreshedItems = await refreshItems(parentId);
      setFolderItems(refreshedItems);
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Aktualisieren der Dateiliste', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [items, refreshItems, setFolderItems]);

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
      const fileGroup = findFileGroup(fileGroups, itemStem);

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
  }, [provider, handleRefresh, fileGroups, setSelectedFile, setSelectedBatchItems]);

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
      const fileGroup = findFileGroup(fileGroups, itemStem);

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
  }, [provider, handleRefresh, fileGroups]);

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

  // Intelligente Batch-Auswahl basierend auf Filter
  const handleSelectAll = useCallback((checked: boolean) => {
    const startTime = performance.now();
    if (checked) {
      // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
      const mainItems = Array.from((fileGroups ?? new Map()).values())
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
  }, [fileGroups, currentCategoryFilter, setSelectedBatchItems, setSelectedTransformationItems, selectedBatchItems.length, selectedTransformationItems.length, items.length]);

  React.useEffect(() => {
    // Logging der Library-IDs - verzögert ausführen
    const timeoutId = setTimeout(() => {
      StateLogger.debug('FileList', 'Render', {
        currentLibraryId: currentLibrary?.id,
        activeLibraryIdAtom: activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentLibrary, activeLibraryId]);

  if (!isFileTreeReady && !isMobile) {
    UILogger.info('FileList', 'Render gate: waiting for FileTree', {
      isMobile,
      isFileTreeReady
    });
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
  }

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
                <ScrollText className="h-4 w-4" />
              </Button>
            )}
            {selectedTransformationItems.length > 0 && (
              <Button size="icon" variant="secondary" title="Transformieren" aria-label="Transformieren" onClick={handleBatchTransformation}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-auto">
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
                <div
                  key={folder.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToFolder(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigateToFolder(folder.id);
                  }}
                  className="w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-pointer"
                >
                  <div />
                  <FolderIcon className="h-4 w-4" />
                  <span className="text-left truncate select-none">{folder.metadata.name}</span>
                  <span className="text-muted-foreground" />
                  <span className="text-muted-foreground" />
                  <div />
                </div>
              ))}
            </div>
          )}

          {/* File Rows */}
          <div className="divide-y">
            {Array.from((fileGroups ?? new Map()).values())
              .map((group) => {
                // Zeige nur die Hauptdatei (baseItem) an
                const item = group.baseItem;
                if (!item) return null;
                // System-Unterordner-Id, wenn ein ".<basename>"-Folder existiert
                const systemFolder = systemFolderByBase.get(getBaseName(item.metadata.name));
                const systemFolderId = systemFolder?.id;
                return (
                  <FileRow
                    key={item.id}
                    item={item as StorageItem}
                    isSelected={isItemSelected(item)}
                    onSelect={() => handleSelect(item, group)}
                    onCreateTranscript={handleCreateTranscript}
                    onDelete={(e) => handleDeleteClick(e, item)}
                    fileGroup={group}
                    onSelectRelatedFile={handleSelectRelatedFile}
                    onRename={handleRename}
                    compact={compact}
                    systemFolderId={systemFolderId}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}); 
```

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
      UILogger.info('Library', 'Initial load triggered', {
        currentFolderId,
        lastLoadedFolder,
        isMobile,
        isTreeVisible,
        isFileTreeReady
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

```typescriptreact
'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight } from "lucide-react"
import { StorageItem } from '@/lib/storage/types';
import { cn } from "@/lib/utils"
import { useAtom } from 'jotai';
import { useAtomValue } from 'jotai';
import { 
  fileTreeReadyAtom, 
  loadedChildrenAtom,
  expandedFoldersAtom,
  selectedFileAtom,
  activeLibraryIdAtom
} from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { FileLogger, UILogger } from "@/lib/debug/logger"
import { useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { useFolderNavigation } from '@/hooks/use-folder-navigation';
import { toast } from "sonner";

// Ref-Interface für externe Steuerung
export interface FileTreeRef {
  refresh: () => Promise<void>;
  expandToItem: (itemId: string) => Promise<void>;
}

// Props für einzelne Tree-Items
interface TreeItemProps {
  item: StorageItem;
  level: number;
  onMoveItem?: (itemId: string, targetFolderId: string) => Promise<void>;
}

// TreeItem Komponente
function TreeItem({
  item,
  level,
  onMoveItem
}: TreeItemProps) {
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [loadedChildren, setLoadedChildren] = useAtom(loadedChildrenAtom);
  const { provider } = useStorage();
  const navigateToFolder = useFolderNavigation();

  // Ordner erweitern
  const handleExpand = useCallback(async (folderId: string) => {
    if (!provider) return;
    
    try {
      // Ordnerinhalt laden, wenn noch nicht geladen
      if (!loadedChildren[folderId]) {
        const items = await provider.listItemsById(folderId);
        setLoadedChildren(prev => ({
          ...prev,
          [folderId]: items
        }));
      }

      // Ordner als erweitert markieren
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(folderId)) {
          newSet.delete(folderId);
        } else {
          newSet.add(folderId);
        }
        return newSet;
      });
    } catch (error) {
      FileLogger.error('FileTree', 'Fehler beim Laden des Ordnerinhalts', error);
    }
  }, [provider, loadedChildren, setLoadedChildren, setExpandedFolders]);

  // Element auswählen
  const handleSelect = useCallback((item: StorageItem) => {
    setSelectedFile(item);
    if (item.type === 'folder') {
      navigateToFolder(item.id);
    }
  }, [setSelectedFile, navigateToFolder]);

  const isExpanded = expandedFolders.has(item.id);
  const isSelected = selectedFile?.id === item.id;
  const children = (loadedChildren[item.id] || []).filter(child => {
    if (child.type !== 'folder') return false;
    const name = child.metadata?.name || '';
    return !name.startsWith('.');
  });

  return (
    <div className={cn(
      "px-2 py-1 cursor-pointer hover:bg-accent rounded-md transition-colors",
      isSelected && "bg-accent"
    )}>
      <div 
        className="flex items-center gap-2"
        onClick={() => handleSelect(item)}
      >
        {/* Chevron-Button für Expand/Collapse */}
        <button
          className="p-0 mr-1 focus:outline-none"
          tabIndex={-1}
          aria-label={isExpanded ? "Zuklappen" : "Aufklappen"}
          onClick={e => {
            e.stopPropagation();
            handleExpand(item.id);
          }}
        >
          {isExpanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
        {/* Nur Ordnername anzeigen */}
        <span>{item.metadata.name}</span>
      </div>
      {isExpanded && children.map(child => (
        <TreeItem
          key={child.id}
          item={child}
          level={level + 1}
          onMoveItem={onMoveItem}
        />
      ))}
    </div>
  );
}

// FileTree Hauptkomponente
export const FileTree = forwardRef<FileTreeRef, object>(function FileTree({
}, forwardedRef) {
  const { provider } = useStorage();
  const [, setExpandedFolders] = useAtom(expandedFoldersAtom);
  const [loadedChildren, setLoadedChildren] = useAtom(loadedChildrenAtom);
  const [isReady, setFileTreeReady] = useAtom(fileTreeReadyAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [, setSelectedFile] = useAtom(selectedFileAtom);

  // NEU: Reagieren auf Bibliothekswechsel
  React.useEffect(() => {
    if (activeLibraryId) {
      // Bei Bibliothekswechsel zurücksetzen
      setExpandedFolders(new Set(['root']));
      setLoadedChildren({});
      setFileTreeReady(false);
      setSelectedFile(null);
      
      FileLogger.info('FileTree', 'Bibliothek gewechselt - State zurückgesetzt', {
        libraryId: activeLibraryId
      });
    }
  }, [activeLibraryId, setExpandedFolders, setLoadedChildren, setFileTreeReady, setSelectedFile]);

  // Root-Items laden
  const loadRootItems = useCallback(async () => {
    if (!provider) return;
    
    try {
      const items = await provider.listItemsById('root');
      setLoadedChildren(prev => ({
        ...prev,
        root: items
      }));
      if (!isReady) {
        setFileTreeReady(true);
      }
    } catch (error) {
      FileLogger.error('FileTree', 'Fehler beim Laden der Root-Items', error);
      
      // Prüfe, ob es sich um einen spezifischen Bibliotheksfehler handelt
      if (error instanceof Error) {
        if (error.message.includes('konnte nicht gefunden werden') || 
            error.message.includes('ENOENT') ||
            error.message.includes('LibraryPathNotFoundError')) {
          // Zeige eine benutzerfreundliche Fehlermeldung
          console.warn('🚨 Bibliothek nicht gefunden:', error.message);
          toast.error(`Bibliothek nicht gefunden: ${error.message}`, {
            action: {
              label: 'Erneut versuchen',
              onClick: () => loadRootItems()
            }
          });
        } else if (error.message.includes('Keine Berechtigung')) {
          console.warn('🚨 Keine Berechtigung:', error.message);
          toast.error(`Keine Berechtigung: ${error.message}`, {
            action: {
              label: 'Erneut versuchen',
              onClick: () => loadRootItems()
            }
          });
        } else {
          // Generische Fehlermeldung für andere Fehler
          toast.error(`Fehler beim Laden der Bibliothek: ${error.message}`, {
            action: {
              label: 'Erneut versuchen',
              onClick: () => loadRootItems()
            }
          });
        }
      } else {
        toast.error('Unbekannter Fehler beim Laden der Bibliothek', {
          action: {
            label: 'Erneut versuchen',
            onClick: () => loadRootItems()
          }
        });
      }
    }
  }, [provider, setLoadedChildren, isReady, setFileTreeReady, toast]);

  // Ref-Methoden
  useImperativeHandle(forwardedRef, () => ({
    refresh: loadRootItems,
    expandToItem: async (itemId: string) => {
      if (!provider) return;
      
      try {
        // Pfad zum Item laden
        const path = await provider.getPathById(itemId);
        const pathItems = path.split('/').filter(Boolean);
        
        // Alle Ordner im Pfad erweitern
        let currentPath = '';
        for (const segment of pathItems) {
          currentPath += '/' + segment;
          const items = await provider.listItemsById(currentPath);
          setLoadedChildren(prev => ({
            ...prev,
            [currentPath]: items
          }));
          setExpandedFolders(prev => new Set([...Array.from(prev), currentPath]));
        }
      } catch (error) {
        FileLogger.error('FileTree', 'Fehler beim Expandieren zum Item', error);
      }
    }
  }), [provider, setLoadedChildren, setExpandedFolders]);

  // Initial laden
  useEffect(() => {
    if (provider && !isReady) {
      UILogger.info('FileTree', 'Starting root load', {
        hasProvider: !!provider,
        isReady
      });
      loadRootItems();
    }
  }, [provider, loadRootItems, isReady]);

  // Reset wenn sich die Library ändert
  useEffect(() => {
    if (!provider) {
      setFileTreeReady(false);
    }
  }, [provider, setFileTreeReady]);

  const items = (loadedChildren.root || []).filter(item => {
    if (item.type !== 'folder') return false;
    const name = item.metadata?.name || '';
    return !name.startsWith('.');
  });

  return (
    <div className="w-full flex flex-col">
      {items.map(item => (
        <TreeItem
          key={item.id}
          item={item}
          level={0}
        />
      ))}
    </div>
  );
});

// Setze den Display-Namen für DevTools
FileTree.displayName = 'FileTree'; 
```

Kurzes Update: Ich habe an den kritischen Gates Debug-Logs ergänzt, die exakt zeigen, wann und warum geblockt wird (inkl. Mobile/Tree-Flags). Die Änderung ist lint-frei.

### Was ist jetzt geloggt?
- Library-Initialisierung
```33:56:src/components/library/library.tsx
UILogger.info('Library', 'Initial load triggered', {
  currentFolderId, lastLoadedFolder, isMobile, isTreeVisible, isFileTreeReady
});
```
- FileList-Init-Gate
```700:708:src/components/library/file-list.tsx
FileLogger.info('FileList', 'Waiting for provider and FileTree', {
  hasProvider: !!provider, isFileTreeReady, isMobile
});
```
- FileList-Render-Gate (zeigt, wenn „Lade Ordnerstruktur…“ angezeigt wird)
```1257:1260:src/components/library/file-list.tsx
UILogger.info('FileList', 'Render gate: waiting for FileTree', {
  isMobile, isFileTreeReady
});
```
- FileTree-Start Root-Ladevorgang
```241:245:src/components/library/file-tree.tsx
UILogger.info('FileTree', 'Starting root load', { hasProvider: !!provider, isReady });
```

### So bekommst du aussagekräftige Logs
- Öffne die Seite in Dev-Tools, reproduziere den Hänger.
- Exportiere die App-Logs aus deinem Debug-Panel wie bisher.
- Achte auf die neuen Einträge mit area=ui bzw. component `Library`/`FileList`/`FileTree`.
- Schicke mir den Auszug; damit sehen wir sofort:
  - Ob `FileList` noch am Render-Gate hängt und warum.
  - Ob `Library` den Initial-Load überhaupt triggert.
  - Ob `FileTree` seinen Root-Load startet.

Wenn du willst, erweitere ich das noch um einen Log beim erfolgreichen Befüllen von `folderItemsAtom` und beim Übergang `fileTreeReadyAtom: false → true`.

```typescriptreact
UILogger.info('Library', 'Initial load triggered', {
  currentFolderId, lastLoadedFolder, isMobile, isTreeVisible, isFileTreeReady
});
```

```typescriptreact
FileLogger.info('FileList', 'Waiting for provider and FileTree', {
  hasProvider: !!provider, isFileTreeReady, isMobile
});
```

```typescriptreact
UILogger.info('FileList', 'Render gate: waiting for FileTree', {
  isMobile, isFileTreeReady
});
```

```typescriptreact
UILogger.info('FileTree', 'Starting root load', { hasProvider: !!provider, isReady });
```

---

**User**

was lädt hier am Anfang so ewig?
Hat es was mit der Anmeldung zu tun?
{
  "timestamp": "2025-08-26T07:27:29.443Z",
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
    "FileRow",
    "FilePreview",
    "Library"
  ],
  "visibleAreas": [
    "nav",
    "state",
    "file",
    "ui"
  ],
  "duplicates": [
    "FileList:Render",
    "Library:Waiting for initialization",
    "FileList:Render gate: waiting for FileTree",
    "Breadcrumb:Starting auto-scroll"
  ],
  "errors": 0,
  "logs": [
    {
      "timestamp": "2025-08-26T07:26:35.104Z",
      "area": "file",
      "sequence": 32,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {
        "hasProvider": true,
        "hasItems": true,
        "isInitialized": true
      },
      "id": "1756193195225-x6dbrk0vb",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.103Z",
      "area": "file",
      "sequence": 31,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Transcript Quartalssitzung.m4a"
      },
      "id": "1756193195225-tusgzom1d",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.102Z",
      "area": "file",
      "sequence": 30,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
      },
      "id": "1756193195225-nbalnv4w1",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.102Z",
      "area": "file",
      "sequence": 29,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Swiss Goverment Cloud.docx"
      },
      "id": "1756193195225-r19fizhr4",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.101Z",
      "area": "file",
      "sequence": 28,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Quartalssitzung.m4a"
      },
      "id": "1756193195225-bsk5dd8vj",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.100Z",
      "area": "file",
      "sequence": 27,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Prioritäten Mai.md"
      },
      "id": "1756193195225-z6uk9g0w5",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.100Z",
      "area": "file",
      "sequence": 26,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
      },
      "id": "1756193195225-b55ps3hji",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.099Z",
      "area": "file",
      "sequence": 25,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung2.pptx"
      },
      "id": "1756193195225-wqe78r4nl",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.098Z",
      "area": "file",
      "sequence": 24,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung.pptx"
      },
      "id": "1756193195225-d860j878r",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.097Z",
      "area": "file",
      "sequence": 23,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
      },
      "id": "1756193195225-gn27r73hd",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.097Z",
      "area": "file",
      "sequence": 22,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Paul Lindberg.md"
      },
      "id": "1756193195225-mpfjjvp9z",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.096Z",
      "area": "file",
      "sequence": 21,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
      },
      "id": "1756193195225-n41dyjs9w",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.095Z",
      "area": "file",
      "sequence": 20,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "IMG-20250503-WA0004.jpg"
      },
      "id": "1756193195225-gfkwwqi8x",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.094Z",
      "area": "file",
      "sequence": 19,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen(1).md"
      },
      "id": "1756193195225-ezc5ykel8",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.094Z",
      "area": "file",
      "sequence": 18,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.m4a",
        "transcripts": [
          "Diva Shoplösungen.de.md"
        ]
      },
      "id": "1756193195225-za2ef77d4",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.093Z",
      "area": "file",
      "sequence": 17,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.Besprechung.de.md"
      },
      "id": "1756193195225-etvoqs89x",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.092Z",
      "area": "file",
      "sequence": 16,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
      },
      "id": "1756193195225-7j9nehg5p",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.091Z",
      "area": "file",
      "sequence": 15,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Computergestütztes Denken.md"
      },
      "id": "1756193195225-lty3gjvw3",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.090Z",
      "area": "file",
      "sequence": 14,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
      },
      "id": "1756193195225-s26ej5vd1",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.089Z",
      "area": "file",
      "sequence": 13,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
      },
      "id": "1756193195225-alzb9p26r",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.088Z",
      "area": "file",
      "sequence": 12,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
        "transcripts": [
          "Asana Tickets mit Billomat Aufträge verbinden.de.md"
        ]
      },
      "id": "1756193195225-6lh27618x",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.087Z",
      "area": "file",
      "sequence": 11,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250421_125103.jpg"
      },
      "id": "1756193195224-xrr2wr02x",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:35.085Z",
      "area": "file",
      "sequence": 10,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
        "transcripts": [
          "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
        ]
      },
      "id": "1756193195224-qknsikhv5",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:34.972Z",
      "area": "file",
      "sequence": 9,
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
      "id": "1756193195224-90opz95se",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:34.958Z",
      "area": "state",
      "sequence": 22,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 46,
        "fileCount": 26,
        "folderCount": 20
      },
      "id": "1756193194958-bpekl6f74",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:33.313Z",
      "area": "file",
      "sequence": 8,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {
        "hasProvider": true,
        "hasItems": false,
        "isInitialized": true
      },
      "id": "1756193193318-024g1zln9",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:33.278Z",
      "area": "nav",
      "sequence": 7,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756193193318-xo99oc3dr",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:33.277Z",
      "area": "nav",
      "sequence": 6,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756193193318-44nqsi18s",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:33.276Z",
      "area": "ui",
      "sequence": 8,
      "component": "Library",
      "level": "info",
      "message": "Initial load triggered",
      "details": {
        "currentFolderId": "root",
        "lastLoadedFolder": null,
        "isMobile": false,
        "isTreeVisible": true,
        "isFileTreeReady": true
      },
      "id": "1756193193318-mbnyze62j",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:33.276Z",
      "area": "file",
      "sequence": 7,
      "component": "FileList",
      "level": "info",
      "message": "Initialization complete",
      "details": {},
      "id": "1756193193318-yoh9elkxn",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:33.275Z",
      "area": "file",
      "sequence": 6,
      "component": "FileList",
      "level": "info",
      "message": "Starting initialization",
      "details": {},
      "id": "1756193193318-d5gfns70l",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.431Z",
      "area": "ui",
      "sequence": 7,
      "component": "Breadcrumb",
      "level": "info",
      "message": "Auto-scroll completed",
      "details": {
        "duration": "101.60ms",
        "finalScrollLeft": 0,
        "pathDepth": 1
      },
      "id": "1756193192431-cqjahkhlx",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.373Z",
      "area": "file",
      "sequence": 5,
      "component": "FilePreview",
      "level": "info",
      "message": "FilePreview-Hauptkomponente gerendert",
      "details": {
        "hasExplicitFile": false,
        "hasSelectedFileFromAtom": false,
        "hasProvider": true,
        "providerName": "Local Filesystem",
        "activeLibraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756193192375-efrq41eis",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.369Z",
      "area": "state",
      "sequence": 13,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756193192374-359dozqew",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:26:32.367Z",
      "area": "nav",
      "sequence": 5,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "isFileTreeReady": false,
        "isMobile": false,
        "isTreeVisible": true,
        "hasProvider": true,
        "status": "ready"
      },
      "id": "1756193192374-es7ky77z8",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:26:32.356Z",
      "area": "ui",
      "sequence": 6,
      "component": "FileList",
      "level": "info",
      "message": "Render gate: waiting for FileTree",
      "details": {
        "isMobile": false,
        "isFileTreeReady": false
      },
      "id": "1756193192374-t1oag7xkh",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:26:32.341Z",
      "area": "nav",
      "sequence": 4,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "isFileTreeReady": false,
        "isMobile": false,
        "isTreeVisible": true,
        "hasProvider": true,
        "status": "ready"
      },
      "id": "1756193192373-pwtks86yf",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:26:32.335Z",
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
      "id": "1756193192373-9uim1prl7",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.332Z",
      "area": "ui",
      "sequence": 5,
      "component": "FileTree",
      "level": "info",
      "message": "Starting root load",
      "details": {
        "hasProvider": true,
        "isReady": false
      },
      "id": "1756193192373-sjr4x5du4",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.330Z",
      "area": "ui",
      "sequence": 4,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 1,
        "currentScrollLeft": 0,
        "targetScrollLeft": 81,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756193192373-x6lgkj455",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:26:32.321Z",
      "area": "ui",
      "sequence": 3,
      "component": "FileList",
      "level": "info",
      "message": "Render gate: waiting for FileTree",
      "details": {
        "isMobile": false,
        "isFileTreeReady": false
      },
      "id": "1756193192373-8rsgd0nvq",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:26:32.307Z",
      "area": "nav",
      "sequence": 3,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "isFileTreeReady": false,
        "isMobile": false,
        "isTreeVisible": true,
        "hasProvider": false,
        "status": "ready"
      },
      "id": "1756193192369-699vbkgo3",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.306Z",
      "area": "state",
      "sequence": 9,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756193192369-v4172b2ie",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:26:32.305Z",
      "area": "file",
      "sequence": 3,
      "component": "FileList",
      "level": "info",
      "message": "Waiting for provider and FileTree",
      "details": {
        "hasProvider": false,
        "isFileTreeReady": false,
        "isMobile": false
      },
      "id": "1756193192369-umopip7ri",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.304Z",
      "area": "file",
      "sequence": 2,
      "component": "FileTree",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756193192369-dworsz71l",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.302Z",
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
      "id": "1756193192369-szqof6k5a",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:26:32.292Z",
      "area": "ui",
      "sequence": 1,
      "component": "FileList",
      "level": "info",
      "message": "Render gate: waiting for FileTree",
      "details": {
        "isMobile": false,
        "isFileTreeReady": false
      },
      "id": "1756193192369-01zd9w6dw",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T07:26:32.292Z",
      "area": "file",
      "sequence": 1,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756193192369-1affdtyq3",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.274Z",
      "area": "nav",
      "sequence": 2,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "isFileTreeReady": false,
        "isMobile": false,
        "isTreeVisible": true,
        "hasProvider": false,
        "status": "initializing"
      },
      "id": "1756193192369-x6415axte",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T07:26:32.268Z",
      "area": "nav",
      "sequence": 1,
      "component": "Library",
      "level": "debug",
      "message": "Waiting for initialization",
      "details": {
        "isFileTreeReady": false,
        "isMobile": false,
        "isTreeVisible": false,
        "hasProvider": false,
        "status": "initializing"
      },
      "id": "1756193192274-43wrlf4bp",
      "remarks": "",
      "isDuplicate": false
    }
  ]
}

---

**Cursor**

Kurz: Nein, es liegt nicht an der Anmeldung. Der Start hängt an zwei UI‑Phasen, nicht an Auth.

### Was dauert am Anfang?
- Phase 1 – FileTree-Gate: Desktop wartet, bis `fileTreeReadyAtom` true ist.
  - 07:26:32.292/321/356: FileList „Render gate: waiting for FileTree“.
  - 07:26:32.332: FileTree „Starting root load“.
  - 07:26:33.276: Library „Initial load triggered“ mit `isFileTreeReady: true`.
  - Dauer: ca. 1,0 s (Root-Ordner laden + Flag setzen).

- Phase 2 – Items laden: Danach lädt die Library die Ordnerinhalte.
  - 07:26:33.278: „Fetching items from provider“.
  - 07:26:34.958: „Items loaded successfully (46)“.
  - Dauer: ca. 1,7 s (Dateisystem-Listing).

- Gesamte wahrgenommene Wartezeit: ~2,7 s bis alles sichtbar ist. Auth-Logs fehlen (Provider „Local Filesystem“, Status „ready“, Token „Nein“), also keine Anmelde-Ursache.

### Warum genau?
- Desktop-Layout koppelt initiales Laden an `fileTreeReady`:
  - `Library`: wartet, bis `isFileTreeReady || isMobile || !isTreeVisible`.
  - `FileList`: rendert erst, wenn `isFileTreeReady` (wir haben Mobile bereits entkoppelt).

### Optionen zur Beschleunigung
- Entkoppeln auch auf Desktop: Initiales `loadItems` ohne `fileTreeReady` starten; Tree lädt parallel. Konkret: Bedingung in `Library` vereinfachen auf „Provider bereit + Status ready“.
- Alternativ: FileList-Render-Gate nur blockieren, wenn keine `folderItems` vorhanden sind: `if (!isMobile && !isFileTreeReady && items.length === 0) ...`.
- UI-Skeleton anzeigen statt „Lade Ordnerstruktur…“, damit die Wartezeit leichter wirkt.

Wenn du willst, setze ich die Desktop-Entkopplung jetzt um und messe die neue Startzeit mit `performance.now()` in den Logs.

---

**User**

vor den Laden der Liste:
Kann man hier was erkennen?
ownload the React DevTools for a better development experience: https://react.dev/link/react-devtools
clerk.browser.js:16  Clerk: Clerk has been loaded with development keys. Development instances have strict usage limits and should not be used when deploying your application to production. Learn more: https://clerk.com/docs/deployments/overview
warnOnce @ clerk.browser.js:16
load @ clerk.browser.js:1
loadClerkJS @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2127
_IsomorphicClerk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2000
getOrCreateInstance @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2026
useLoadedIsomorphicClerk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2286
ClerkContextProvider @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2223
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10555
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<ClerkContextProvider>
exports.createElement @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react.development.js:1036
ClerkProviderBase @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2317
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10555
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<ClerkProviderBase>
exports.createElement @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react.development.js:1036
Hoc @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:116
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10555
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<ClerkProvider>
exports.createElement @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react.development.js:1036
NextClientClerkProvider @ C:\src\app-router\client\ClerkProvider.tsx:123
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10555
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<NextClientClerkProvider>
exports.createElement @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react.development.js:1036
ClientClerkProvider @ C:\src\app-router\client\ClerkProvider.tsx:137
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10504
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
"use client"
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2355
initializeModelChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1054
readChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:949
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23077
createChild @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5382
reconcileChildrenArray @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5689
reconcileChildFibersImpl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6012
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6117
reconcileChildren @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8654
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10903
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<ClerkProvider>
ClerkWrapper @ layout.tsx:58
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2041
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
<ClerkWrapper>
RootLayout @ layout.tsx:68
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2041
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
<RootLayout>
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2040
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
"use server"
ResponseInstance @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1587
createResponseFromOptions @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2396
exports.createFromReadableStream @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2717
eval @ C:\Users\peter.aichner\src\client\app-index.tsx:157
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-index.js @ main-app.js?v=1756193362608:160
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
fn @ webpack.js?v=1756193362608:369
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:11
eval @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:78
loadScriptsInSequence @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:20
appBootstrap @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:60
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:10
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-next-dev.js @ main-app.js?v=1756193362608:182
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
__webpack_exec__ @ main-app.js?v=1756193362608:2813
(anonymous) @ main-app.js?v=1756193362608:2814
webpackJsonpCallback @ webpack.js?v=1756193362608:1388
(anonymous) @ main-app.js?v=1756193362608:9
clerk.browser.js:16  Clerk: The prop "afterSignInUrl" is deprecated and should be replaced with the new "fallbackRedirectUrl" or "forceRedirectUrl" props instead. Learn more: https://clerk.com/docs/guides/custom-redirects#redirect-url-props
warnOnce @ clerk.browser.js:16
r @ clerk.browser.js:5
load @ clerk.browser.js:1
loadClerkJS @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2127
_IsomorphicClerk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2000
getOrCreateInstance @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2026
useLoadedIsomorphicClerk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2286
ClerkContextProvider @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2223
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10555
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<ClerkContextProvider>
exports.createElement @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react.development.js:1036
ClerkProviderBase @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:2317
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10555
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<ClerkProviderBase>
exports.createElement @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react.development.js:1036
Hoc @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\@clerk+clerk-react@5.31.9_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\@clerk\clerk-react\dist\index.mjs:116
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10555
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<ClerkProvider>
exports.createElement @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react.development.js:1036
NextClientClerkProvider @ C:\src\app-router\client\ClerkProvider.tsx:123
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10555
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<NextClientClerkProvider>
exports.createElement @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react.development.js:1036
ClientClerkProvider @ C:\src\app-router\client\ClerkProvider.tsx:137
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10504
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
"use client"
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2355
initializeModelChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1054
readChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:949
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23077
createChild @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5382
reconcileChildrenArray @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5689
reconcileChildFibersImpl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6012
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6117
reconcileChildren @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8654
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10903
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<ClerkProvider>
ClerkWrapper @ layout.tsx:58
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2041
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
<ClerkWrapper>
RootLayout @ layout.tsx:68
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2041
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
<RootLayout>
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2040
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
"use server"
ResponseInstance @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1587
createResponseFromOptions @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2396
exports.createFromReadableStream @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2717
eval @ C:\Users\peter.aichner\src\client\app-index.tsx:157
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-index.js @ main-app.js?v=1756193362608:160
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
fn @ webpack.js?v=1756193362608:369
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:11
eval @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:78
loadScriptsInSequence @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:20
appBootstrap @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:60
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:10
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-next-dev.js @ main-app.js?v=1756193362608:182
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
__webpack_exec__ @ main-app.js?v=1756193362608:2813
(anonymous) @ main-app.js?v=1756193362608:2814
webpackJsonpCallback @ webpack.js?v=1756193362608:1388
(anonymous) @ main-app.js?v=1756193362608:9
[NEW] Explain Console errors by using Copilot in Edge: click
         
         to explain an error. 
        Learn more
        Don't show again
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:29:39.387Z][STATE:1][StorageContext][info] ℹ️ 🔐 AUTH: Client-Side Auth State {isSignedIn: undefined, isLoaded: false, hasUserId: false, hasEmail: false, userId: undefined, …}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\hooks\use-storage-provider.tsx:18 [useStorageProvider] useEffect: {activeLibraryId: '', libraries: Array(0)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\hooks\use-storage-provider.tsx:24 [useStorageProvider] Keine aktive Bibliothek, setze Provider auf null
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:29:39.390Z][STATE:2][StorageContext][debug] 🔍 🔐 AUTH: Library Loading Effect triggered {isAuthLoaded: false, isUserLoaded: false, isSignedIn: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:29:39.390Z][STATE:3][StorageContext][debug] 🔍 🔐 AUTH: Waiting for auth/user to load 
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:663 [StorageContext] useEffect: currentLibrary null
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:719 [StorageContext] API-Call ausgelöst. Aktueller Status: initializing
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:725 [StorageContextProvider] Render: {activeLibraryId: '', currentLibraryId: undefined, providerId: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:29:39.990Z][STATE:4][StorageContext][info] ℹ️ 🔐 AUTH: Client-Side Auth State {isSignedIn: true, isLoaded: true, hasUserId: true, hasEmail: true, userId: 'user_2rJ...', …}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:29:39.990Z][STATE:5][StorageContext][debug] 🔍 🔐 AUTH: Library Loading Effect triggered {isAuthLoaded: true, isUserLoaded: true, isSignedIn: true}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:29:39.991Z][STATE:6][StorageContext][info] ℹ️ 🔐 AUTH: Starting library load {userEmail: 'peter.aichner@...'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:206 [StorageContext] Lade Bibliotheken...
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:29:39.991Z][STATE:7][StorageContext][info] ℹ️ 🔐 AUTH: 🚀 API Call /api/libraries?email=peter.aichner%40crystal-design.com - start {attempt: 1}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:29:40.617Z][STATE:8][StorageContext][info] ℹ️ 🔐 AUTH: ✅ API Call /api/libraries?email=peter.aichner%40crystal-design.com - success {librariesCount: 8, attempt: 1}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:268  [StorageContext] Nicht unterstützter Bibliothekstyp "webdav" für Bibliothek "Offenes Ohr" - wird ausgeblendet
StorageContextProvider.useEffect.fetchLibraries.supportedLibraries @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:268
StorageContextProvider.useEffect.fetchLibraries @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:265
await in StorageContextProvider.useEffect.fetchLibraries
StorageContextProvider.useEffect @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:373
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23054
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
commitHookEffectListMount @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:11977
commitHookPassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:12098
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13928
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13940
flushPassiveEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15868
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15504
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
"use client"
RootLayout @ layout.tsx:77
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2355
initializeModelChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1054
readChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:949
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23077
createChild @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5382
reconcileChildrenArray @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5689
reconcileChildFibersImpl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6012
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6117
reconcileChildren @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8654
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10903
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<RootLayout>
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2040
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
"use server"
ResponseInstance @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1587
createResponseFromOptions @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2396
exports.createFromReadableStream @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2717
eval @ C:\Users\peter.aichner\src\client\app-index.tsx:157
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-index.js @ main-app.js?v=1756193362608:160
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
fn @ webpack.js?v=1756193362608:369
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:11
eval @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:78
loadScriptsInSequence @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:20
appBootstrap @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:60
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:10
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-next-dev.js @ main-app.js?v=1756193362608:182
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
__webpack_exec__ @ main-app.js?v=1756193362608:2813
(anonymous) @ main-app.js?v=1756193362608:2814
webpackJsonpCallback @ webpack.js?v=1756193362608:1388
(anonymous) @ main-app.js?v=1756193362608:9
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55  [07:29:40.618Z][STATE:9][StorageContext][warn] ⚠️ 🔐 AUTH: Unsupported library type filtered out {libraryType: 'webdav', libraryLabel: 'Offenes Ohr', libraryId: '_ArchivPeter'}
logToConsole @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55
createLog @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:70
warn @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:182
StorageContextProvider.useEffect.fetchLibraries.supportedLibraries @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:269
StorageContextProvider.useEffect.fetchLibraries @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:265
await in StorageContextProvider.useEffect.fetchLibraries
StorageContextProvider.useEffect @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:373
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23054
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
commitHookEffectListMount @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:11977
commitHookPassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:12098
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13928
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13940
flushPassiveEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15868
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15504
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
"use client"
RootLayout @ layout.tsx:77
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2355
initializeModelChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1054
readChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:949
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23077
createChild @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5382
reconcileChildrenArray @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5689
reconcileChildFibersImpl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6012
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6117
reconcileChildren @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8654
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10903
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<RootLayout>
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2040
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
"use server"
ResponseInstance @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1587
createResponseFromOptions @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2396
exports.createFromReadableStream @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2717
eval @ C:\Users\peter.aichner\src\client\app-index.tsx:157
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-index.js @ main-app.js?v=1756193362608:160
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
fn @ webpack.js?v=1756193362608:369
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:11
eval @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:78
loadScriptsInSequence @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:20
appBootstrap @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:60
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:10
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-next-dev.js @ main-app.js?v=1756193362608:182
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
__webpack_exec__ @ main-app.js?v=1756193362608:2813
(anonymous) @ main-app.js?v=1756193362608:2814
webpackJsonpCallback @ webpack.js?v=1756193362608:1388
(anonymous) @ main-app.js?v=1756193362608:9
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:268  [StorageContext] Nicht unterstützter Bibliothekstyp "webdav" für Bibliothek "Nextcloud" - wird ausgeblendet
StorageContextProvider.useEffect.fetchLibraries.supportedLibraries @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:268
StorageContextProvider.useEffect.fetchLibraries @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:265
await in StorageContextProvider.useEffect.fetchLibraries
StorageContextProvider.useEffect @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:373
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23054
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
commitHookEffectListMount @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:11977
commitHookPassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:12098
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13928
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13940
flushPassiveEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15868
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15504
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
"use client"
RootLayout @ layout.tsx:77
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2355
initializeModelChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1054
readChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:949
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23077
createChild @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5382
reconcileChildrenArray @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5689
reconcileChildFibersImpl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6012
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6117
reconcileChildren @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8654
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10903
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<RootLayout>
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2040
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
"use server"
ResponseInstance @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1587
createResponseFromOptions @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2396
exports.createFromReadableStream @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2717
eval @ C:\Users\peter.aichner\src\client\app-index.tsx:157
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-index.js @ main-app.js?v=1756193362608:160
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
fn @ webpack.js?v=1756193362608:369
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:11
eval @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:78
loadScriptsInSequence @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:20
appBootstrap @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:60
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:10
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-next-dev.js @ main-app.js?v=1756193362608:182
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
__webpack_exec__ @ main-app.js?v=1756193362608:2813
(anonymous) @ main-app.js?v=1756193362608:2814
webpackJsonpCallback @ webpack.js?v=1756193362608:1388
(anonymous) @ main-app.js?v=1756193362608:9
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55  [07:29:40.619Z][STATE:10][StorageContext][warn] ⚠️ 🔐 AUTH: Unsupported library type filtered out {libraryType: 'webdav', libraryLabel: 'Nextcloud', libraryId: 'e9e54ddc-6907-4ebb-8bf6-7f3f880c710a'}
logToConsole @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55
createLog @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:70
warn @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:182
StorageContextProvider.useEffect.fetchLibraries.supportedLibraries @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:269
StorageContextProvider.useEffect.fetchLibraries @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:265
await in StorageContextProvider.useEffect.fetchLibraries
StorageContextProvider.useEffect @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:373
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23054
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
commitHookEffectListMount @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:11977
commitHookPassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:12098
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13928
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13940
flushPassiveEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15868
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15504
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
"use client"
RootLayout @ layout.tsx:77
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2355
initializeModelChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1054
readChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:949
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23077
createChild @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5382
reconcileChildrenArray @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5689
reconcileChildFibersImpl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6012
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6117
reconcileChildren @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8654
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10903
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<RootLayout>
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2040
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
"use server"
ResponseInstance @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1587
createResponseFromOptions @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2396
exports.createFromReadableStream @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2717
eval @ C:\Users\peter.aichner\src\client\app-index.tsx:157
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-index.js @ main-app.js?v=1756193362608:160
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
fn @ webpack.js?v=1756193362608:369
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:11
eval @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:78
loadScriptsInSequence @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:20
appBootstrap @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:60
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:10
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-next-dev.js @ main-app.js?v=1756193362608:182
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
__webpack_exec__ @ main-app.js?v=1756193362608:2813
(anonymous) @ main-app.js?v=1756193362608:2814
webpackJsonpCallback @ webpack.js?v=1756193362608:1388
(anonymous) @ main-app.js?v=1756193362608:9
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:278 [StorageContext] Bibliotheken geladen: 8 total, 6 unterstützt
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:365 StorageFactory: setLibraries aufgerufen mit 6 Bibliotheken
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:375 StorageFactory: Bibliotheksdaten: (6) [{…}, {…}, {…}, {…}, {…}, {…}]
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:392 StorageFactory: Bibliotheksliste hat sich geändert, setze Provider zurück
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:353 [StorageFactory] User E-Mail gesetzt: peter.aichner@crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:29:40.621Z][STATE:11][StorageContext][info] ℹ️ 🔐 AUTH: User email set in StorageFactory {email: 'peter.aichner@...'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:310 [StorageContext] Gespeicherte activeLibraryId aus localStorage: 502a1384-553b-493e-bc66-75d48345b47e
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:321 [StorageContext] Gespeicherte Bibliothek wird verwendet: 502a1384-553b-493e-bc66-75d48345b47e
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\hooks\use-storage-provider.tsx:18 [useStorageProvider] useEffect: {activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', libraries: Array(6)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\hooks\use-storage-provider.tsx:42 [useStorageProvider] Initialisiere Provider für Bibliothek: 502a1384-553b-493e-bc66-75d48345b47e
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:424 StorageFactory: getProvider aufgerufen für Bibliothek 502a1384-553b-493e-bc66-75d48345b47e
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:454 StorageFactory: Erstelle neuen Provider für Bibliothek: {id: '502a1384-553b-493e-bc66-75d48345b47e', label: 'Archiv Peter', path: 'C:\\Users\\peter.aichner\\OneDrive - Crystal Design GmbH\\Archiv Peter', type: 'local'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:466 StorageFactory: LocalStorageProvider erstellt für "C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Archiv Peter"
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:34 [LocalStorageProvider] User E-Mail gesetzt: peter.aichner@crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:470 StorageFactory: User-Email an LocalStorageProvider gesetzt
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:725 [StorageContextProvider] Render: {activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibraryId: undefined, providerId: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\hooks\use-storage-provider.tsx:47 [useStorageProvider] Provider erfolgreich initialisiert: Local Filesystem (ID: 502a1384-553b-493e-bc66-75d48345b47e)
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:105 [StorageContext] Provider-Wechsel: Kein Provider -> Local Filesystem
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:120 [StorageContext] Provider Local Filesystem validiert
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:663 [StorageContext] useEffect: currentLibrary {id: '502a1384-553b-493e-bc66-75d48345b47e', label: 'Archiv Peter', type: 'local', path: 'C:\\Users\\peter.aichner\\OneDrive - Crystal Design GmbH\\Archiv Peter', isEnabled: true, …}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:667 [StorageContext] Bibliothek geladen. Token vorhanden: false Config: {transcription: 'shadowTwin'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:680 [StorageContext] Lokale Bibliothek - Status auf "ready" gesetzt.
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:725 [StorageContextProvider] Render: {activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', providerId: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:663 [StorageContext] useEffect: currentLibrary {id: '502a1384-553b-493e-bc66-75d48345b47e', label: 'Archiv Peter', type: 'local', path: 'C:\\Users\\peter.aichner\\OneDrive - Crystal Design GmbH\\Archiv Peter', isEnabled: true, …}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:667 [StorageContext] Bibliothek geladen. Token vorhanden: false Config: {transcription: 'shadowTwin'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:671 [StorageContext] Provider geladen: Local Filesystem AuthInfo: undefined
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:680 [StorageContext] Lokale Bibliothek - Status auf "ready" gesetzt.
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:719 [StorageContext] API-Call ausgelöst. Aktueller Status: ready
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:725 [StorageContextProvider] Render: {activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', providerId: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\components\ui\sheet.tsx:62  Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.
DescriptionWarning.useEffect @ C:\Users\peter.aichner\projects\src\dialog.tsx:543
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23054
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
commitHookEffectListMount @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:11977
commitHookPassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:12098
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13928
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14018
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13991
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13931
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13921
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14047
recursivelyTraversePassiveMountEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13901
commitPassiveMountOnFiber @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:13940
flushPassiveEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15868
flushPendingEffects @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15829
flushSpawnedWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15795
commitRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15528
commitRootWhenReady @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14758
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14681
performSyncWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16364
flushSyncWorkAcrossRoots_impl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16210
processRootScheduleInMicrotask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16249
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16383
<DescriptionWarning>
exports.jsx @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react-jsx-runtime.development.js:339
eval @ C:\Users\peter.aichner\projects\src\dialog.tsx:418
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateForwardRef @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8678
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10894
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopSync @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15077
renderRootSync @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15057
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14525
performSyncWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16364
flushSyncWorkAcrossRoots_impl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16210
processRootScheduleInMicrotask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16249
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16383
<ForwardRef>
exports.jsx @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react-jsx-runtime.development.js:339
eval @ C:\Users\peter.aichner\projects\src\dialog.tsx:272
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateForwardRef @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8678
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10894
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopSync @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15077
renderRootSync @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15057
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14525
performSyncWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16364
flushSyncWorkAcrossRoots_impl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16210
processRootScheduleInMicrotask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16249
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16383
<ForwardRef>
exports.jsx @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react-jsx-runtime.development.js:339
DialogContent @ C:\Users\peter.aichner\projects\src\dialog.tsx:242
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateForwardRef @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8678
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10894
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopSync @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15077
renderRootSync @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15057
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14525
performSyncWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16364
flushSyncWorkAcrossRoots_impl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16210
processRootScheduleInMicrotask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16249
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16383
<DialogContent>
exports.jsxDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react-jsx-dev-runtime.development.js:346
_c1 @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\components\ui\sheet.tsx:62
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateForwardRef @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8678
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10894
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopSync @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15077
renderRootSync @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15057
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14525
performSyncWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16364
flushSyncWorkAcrossRoots_impl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16210
processRootScheduleInMicrotask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16249
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16383
<DialogContent>
exports.jsxDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react-jsx-dev-runtime.development.js:346
TopNav @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\components\top-nav.tsx:82
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10504
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<...>
exports.jsx @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react-jsx-runtime.development.js:339
LoadableComponent @ C:\src\shared\lib\lazy-dynamic\loadable.tsx:65
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10555
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<LoadableComponent>
exports.jsxDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react\cjs\react-jsx-dev-runtime.development.js:346
TopNavWrapper @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\components\top-nav-wrapper.tsx:20
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:22973
renderWithHooks @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6666
updateFunctionComponent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8930
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10504
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
"use client"
RootLayout @ layout.tsx:80
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2355
initializeModelChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1054
readChunk @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:949
react-stack-bottom-frame @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:23077
createChild @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5382
reconcileChildrenArray @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:5689
reconcileChildFibersImpl @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6012
eval @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:6117
reconcileChildren @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:8654
beginWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:10903
runWithFiberInDEV @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:844
performUnitOfWork @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15257
workLoopConcurrentByScheduler @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15251
renderRootConcurrent @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:15226
performWorkOnRoot @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:14524
performWorkOnRootViaSchedulerTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-dom\cjs\react-dom-client.development.js:16349
performWorkUntilDeadline @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:45
<RootLayout>
buildFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2040
initializeFakeTask @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2027
resolveDebugInfo @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2063
processFullStringRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2261
processFullBinaryRow @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2233
progress @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2479
"use server"
ResponseInstance @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:1587
createResponseFromOptions @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2396
exports.createFromReadableStream @ C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\react-server-dom-webpack\cjs\react-server-dom-webpack-client.browser.development.js:2717
eval @ C:\Users\peter.aichner\src\client\app-index.tsx:157
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-index.js @ main-app.js?v=1756193362608:160
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
fn @ webpack.js?v=1756193362608:369
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:11
eval @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:78
loadScriptsInSequence @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:20
appBootstrap @ C:\Users\peter.aichner\src\client\app-bootstrap.ts:60
eval @ C:\Users\peter.aichner\src\client\app-next-dev.ts:10
(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/app-next-dev.js @ main-app.js?v=1756193362608:182
options.factory @ webpack.js?v=1756193362608:712
__webpack_require__ @ webpack.js?v=1756193362608:37
__webpack_exec__ @ main-app.js?v=1756193362608:2813
(anonymous) @ main-app.js?v=1756193362608:2814
webpackJsonpCallback @ webpack.js?v=1756193362608:1388
(anonymous) @ main-app.js?v=1756193362608:9
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:19.394Z][FILE:1][FileList][debug] 🔍 Gruppierung Ergebnis (Basename, alle Endungen) {groups: Array(0)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:19.394Z][UI:1][FileList][info] ℹ️ Render gate: waiting for FileTree {isMobile: false, isFileTreeReady: false}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.017Z][UI:2][Breadcrumb][debug] 🔍 Starting auto-scroll {pathDepth: 1, currentScrollLeft: 0, targetScrollLeft: 0, activeLibrary: 'Archiv Peter'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\components\library\audio-recorder-client.tsx:144 [AudioRecorder] Storage state: {provider: 'Local Filesystem', isStorageReady: true, activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentFolderId: 'root'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.020Z][FILE:2][FileList][info] ℹ️ Waiting for provider and FileTree {hasProvider: true, isFileTreeReady: false, isMobile: false}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.021Z][STATE:12][FileList][debug] 🔍 Render {currentLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryIdAtom: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:457 [StorageContext][listItems] Aufruf: {requestedLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibrary: {…}, providerId: '502a1384-553b-493e-bc66-75d48345b47e', providerName: 'Local Filesystem'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:57 [LocalStorageProvider] Calling API: /api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=peter.aichner%40crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.024Z][STATE:13][LocalStorageProvider][debug] 🔍 🔐 AUTH: Starting listItemsById API call {folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e', hasUserEmail: true, userEmail: 'peter.aichner@...', url: '/api/storage/filesystem?action=list&fileId=root&li…Id=502a1384-553b-493e-bc66-75d48345b47e&email=***'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.026Z][UI:3][Library][info] ℹ️ Initial load triggered {currentFolderId: 'root', lastLoadedFolder: null, isMobile: false, isTreeVisible: false, isFileTreeReady: false}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.028Z][NAV:1][Library][info] ℹ️ Loading initial items {folderId: 'root'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.029Z][NAV:2][Library][info] ℹ️ Fetching items from provider {folderId: 'root', cacheHit: false}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:457 [StorageContext][listItems] Aufruf: {requestedLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibrary: {…}, providerId: '502a1384-553b-493e-bc66-75d48345b47e', providerName: 'Local Filesystem'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:57 [LocalStorageProvider] Calling API: /api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=peter.aichner%40crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.030Z][STATE:14][LocalStorageProvider][debug] 🔍 🔐 AUTH: Starting listItemsById API call {folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e', hasUserEmail: true, userEmail: 'peter.aichner@...', url: '/api/storage/filesystem?action=list&fileId=root&li…Id=502a1384-553b-493e-bc66-75d48345b47e&email=***'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.063Z][FILE:3][FileList][debug] 🔍 Gruppierung Ergebnis (Basename, alle Endungen) {groups: Array(0)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.064Z][UI:4][FileList][info] ℹ️ Render gate: waiting for FileTree {isMobile: false, isFileTreeReady: false}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.079Z][UI:5][Breadcrumb][debug] 🔍 Starting auto-scroll {pathDepth: 1, currentScrollLeft: 0, targetScrollLeft: 0, activeLibrary: 'Archiv Peter'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.080Z][FILE:4][FileList][info] ℹ️ Waiting for provider and FileTree {hasProvider: true, isFileTreeReady: false, isMobile: false}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.081Z][STATE:15][FileList][debug] 🔍 Render {currentLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryIdAtom: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:457 [StorageContext][listItems] Aufruf: {requestedLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibrary: {…}, providerId: '502a1384-553b-493e-bc66-75d48345b47e', providerName: 'Local Filesystem'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:57 [LocalStorageProvider] Calling API: /api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=peter.aichner%40crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.083Z][STATE:16][LocalStorageProvider][debug] 🔍 🔐 AUTH: Starting listItemsById API call {folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e', hasUserEmail: true, userEmail: 'peter.aichner@...', url: '/api/storage/filesystem?action=list&fileId=root&li…Id=502a1384-553b-493e-bc66-75d48345b47e&email=***'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.085Z][UI:6][Library][info] ℹ️ Initial load triggered {currentFolderId: 'root', lastLoadedFolder: null, isMobile: true, isTreeVisible: false, isFileTreeReady: false}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.086Z][NAV:3][Library][info] ℹ️ Loading initial items {folderId: 'root'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.087Z][NAV:4][Library][info] ℹ️ Fetching items from provider {folderId: 'root', cacheHit: false}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:457 [StorageContext][listItems] Aufruf: {requestedLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibrary: {…}, providerId: '502a1384-553b-493e-bc66-75d48345b47e', providerName: 'Local Filesystem'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:57 [LocalStorageProvider] Calling API: /api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=peter.aichner%40crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.088Z][STATE:17][LocalStorageProvider][debug] 🔍 🔐 AUTH: Starting listItemsById API call {folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e', hasUserEmail: true, userEmail: 'peter.aichner@...', url: '/api/storage/filesystem?action=list&fileId=root&li…Id=502a1384-553b-493e-bc66-75d48345b47e&email=***'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.112Z][FILE:5][FileList][info] ℹ️ Starting initialization 
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.113Z][FILE:6][FileList][info] ℹ️ Initialization complete 
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.120Z][FILE:7][FileList][debug] 🔍 Already initialized {hasProvider: true, hasItems: false, isInitialized: true}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.125Z][STATE:18][FileList][debug] 🔍 Render {currentLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryIdAtom: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.191Z][UI:7][Breadcrumb][info] ℹ️ Auto-scroll completed {duration: '112.70ms', finalScrollLeft: 0, pathDepth: 1}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:118 [LocalStorageProvider] Successfully loaded 46 items
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.659Z][STATE:19][LocalStorageProvider][info] ℹ️ 🔐 AUTH: API call successful {itemCount: 46, folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:481 [StorageContext][listItems] Erfolgreich 46 Items geladen
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:457 [StorageContext][listItems] Aufruf: {requestedLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibrary: {…}, providerId: '502a1384-553b-493e-bc66-75d48345b47e', providerName: 'Local Filesystem'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:57 [LocalStorageProvider] Calling API: /api/storage/filesystem?action=list&fileId=dGVtcGxhdGVz&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=peter.aichner%40crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:20.660Z][STATE:20][LocalStorageProvider][debug] 🔍 🔐 AUTH: Starting listItemsById API call {folderId: 'dGVtcGxhdGVz', libraryId: '502a1384-553b-493e-bc66-75d48345b47e', hasUserEmail: true, userEmail: 'peter.aichner@...', url: '/api/storage/filesystem?action=list&fileId=dGVtcGx…Id=502a1384-553b-493e-bc66-75d48345b47e&email=***'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:118 [LocalStorageProvider] Successfully loaded 5 items
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.244Z][STATE:21][LocalStorageProvider][info] ℹ️ 🔐 AUTH: API call successful {itemCount: 5, folderId: 'dGVtcGxhdGVz', libraryId: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:481 [StorageContext][listItems] Erfolgreich 5 Items geladen
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:118 [LocalStorageProvider] Successfully loaded 46 items
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.260Z][STATE:22][LocalStorageProvider][info] ℹ️ 🔐 AUTH: API call successful {itemCount: 46, folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:481 [StorageContext][listItems] Erfolgreich 46 Items geladen
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.260Z][STATE:23][Library][info] ℹ️ Items loaded successfully {folderId: 'root', itemCount: 46, fileCount: 26, folderCount: 20}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.268Z][FILE:8][FileList][debug] 🔍 Gruppierung Ergebnis (Basename, alle Endungen) {groups: Array(22)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.379Z][FILE:9][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: '01 - Unbekannte Interpet - Unbekannte Titel.mp3', transcripts: Array(1)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.380Z][FILE:10][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: '20250421_125103.jpg', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.381Z][FILE:11][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Asana Tickets mit Billomat Aufträge verbinden.m4a', transcripts: Array(1)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.382Z][FILE:12][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Common Knowledge Scout (Offline) Setup 1.0.0.exe', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.383Z][FILE:13][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.384Z][FILE:14][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Computergestütztes Denken.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.385Z][FILE:15][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'DeepSeek in der Praxis-Analyse _ heise online.pdf', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.385Z][FILE:16][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Diva Shoplösungen.Besprechung.de.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.386Z][FILE:17][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Diva Shoplösungen.m4a', transcripts: Array(1)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.387Z][FILE:18][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Diva Shoplösungen(1).md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.388Z][FILE:19][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'IMG-20250503-WA0004.jpg', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.388Z][FILE:20][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Kombinierte_Transformation_2025-07-06T16-55-52.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.389Z][FILE:21][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Paul Lindberg.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.390Z][FILE:22][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Präsentation Innovationsabteilung_09.07.2025.pptx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.390Z][FILE:23][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Präsentation Innovationsabteilung.pptx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.391Z][FILE:24][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Präsentation Innovationsabteilung2.pptx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.392Z][FILE:25][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Präsentation Knowledge Scout NOI Developers Thursday.pptx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.392Z][FILE:26][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Prioritäten Mai.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.393Z][FILE:27][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Quartalssitzung.m4a', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.394Z][FILE:28][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Swiss Goverment Cloud.docx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.394Z][FILE:29][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'This Simple AI-powered Python Script will Completely Change How You Work.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.395Z][FILE:30][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Transcript Quartalssitzung.m4a', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.396Z][FILE:31][FileList][debug] 🔍 Already initialized {hasProvider: true, hasItems: true, isInitialized: true}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\node_modules\.pnpm\next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0\node_modules\next\dist\compiled\scheduler\cjs\scheduler.development.js:14 [Violation] 'message' handler took 219ms
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:118 [LocalStorageProvider] Successfully loaded 46 items
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.841Z][STATE:24][LocalStorageProvider][info] ℹ️ 🔐 AUTH: API call successful {itemCount: 46, folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:481 [StorageContext][listItems] Erfolgreich 46 Items geladen
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:457 [StorageContext][listItems] Aufruf: {requestedLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibrary: {…}, providerId: '502a1384-553b-493e-bc66-75d48345b47e', providerName: 'Local Filesystem'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:57 [LocalStorageProvider] Calling API: /api/storage/filesystem?action=list&fileId=dGVtcGxhdGVz&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=peter.aichner%40crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:21.842Z][STATE:25][LocalStorageProvider][debug] 🔍 🔐 AUTH: Starting listItemsById API call {folderId: 'dGVtcGxhdGVz', libraryId: '502a1384-553b-493e-bc66-75d48345b47e', hasUserEmail: true, userEmail: 'peter.aichner@...', url: '/api/storage/filesystem?action=list&fileId=dGVtcGx…Id=502a1384-553b-493e-bc66-75d48345b47e&email=***'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:118 [LocalStorageProvider] Successfully loaded 46 items
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.436Z][STATE:26][LocalStorageProvider][info] ℹ️ 🔐 AUTH: API call successful {itemCount: 46, folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:481 [StorageContext][listItems] Erfolgreich 46 Items geladen
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.438Z][STATE:27][Library][info] ℹ️ Items loaded successfully {folderId: 'root', itemCount: 46, fileCount: 26, folderCount: 20}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.449Z][FILE:32][FileList][debug] 🔍 Gruppierung Ergebnis (Basename, alle Endungen) {groups: Array(22)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.537Z][FILE:33][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: '01 - Unbekannte Interpet - Unbekannte Titel.mp3', transcripts: Array(1)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.538Z][FILE:34][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: '20250421_125103.jpg', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.538Z][FILE:35][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Asana Tickets mit Billomat Aufträge verbinden.m4a', transcripts: Array(1)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.539Z][FILE:36][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Common Knowledge Scout (Offline) Setup 1.0.0.exe', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.540Z][FILE:37][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.541Z][FILE:38][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Computergestütztes Denken.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.542Z][FILE:39][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'DeepSeek in der Praxis-Analyse _ heise online.pdf', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.543Z][FILE:40][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Diva Shoplösungen.Besprechung.de.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.543Z][FILE:41][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Diva Shoplösungen.m4a', transcripts: Array(1)}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.544Z][FILE:42][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Diva Shoplösungen(1).md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.545Z][FILE:43][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'IMG-20250503-WA0004.jpg', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.546Z][FILE:44][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Kombinierte_Transformation_2025-07-06T16-55-52.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.547Z][FILE:45][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Paul Lindberg.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.547Z][FILE:46][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Präsentation Innovationsabteilung_09.07.2025.pptx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.548Z][FILE:47][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Präsentation Innovationsabteilung.pptx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.549Z][FILE:48][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Präsentation Innovationsabteilung2.pptx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.550Z][FILE:49][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Präsentation Knowledge Scout NOI Developers Thursday.pptx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.550Z][FILE:50][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Prioritäten Mai.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.551Z][FILE:51][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Quartalssitzung.m4a', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.552Z][FILE:52][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Swiss Goverment Cloud.docx', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.553Z][FILE:53][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'This Simple AI-powered Python Script will Completely Change How You Work.md', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.554Z][FILE:54][FileRow][debug] 🔍 Transkripte für Zeile {baseItem: 'Transcript Quartalssitzung.m4a', transcripts: undefined}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:118 [LocalStorageProvider] Successfully loaded 5 items
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:22.559Z][STATE:28][LocalStorageProvider][info] ℹ️ 🔐 AUTH: API call successful {itemCount: 5, folderId: 'dGVtcGxhdGVz', libraryId: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:481 [StorageContext][listItems] Erfolgreich 5 Items geladen
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:457 [StorageContext][listItems] Aufruf: {requestedLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibrary: {…}, providerId: '502a1384-553b-493e-bc66-75d48345b47e', providerName: 'Local Filesystem'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:57 [LocalStorageProvider] Calling API: /api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=peter.aichner%40crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:30.284Z][STATE:29][LocalStorageProvider][debug] 🔍 🔐 AUTH: Starting listItemsById API call {folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e', hasUserEmail: true, userEmail: 'peter.aichner@...', url: '/api/storage/filesystem?action=list&fileId=root&li…Id=502a1384-553b-493e-bc66-75d48345b47e&email=***'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:118 [LocalStorageProvider] Successfully loaded 46 items
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:30.916Z][STATE:30][LocalStorageProvider][info] ℹ️ 🔐 AUTH: API call successful {itemCount: 46, folderId: 'root', libraryId: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:481 [StorageContext][listItems] Erfolgreich 46 Items geladen
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:457 [StorageContext][listItems] Aufruf: {requestedLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', activeLibraryId: '502a1384-553b-493e-bc66-75d48345b47e', currentLibrary: {…}, providerId: '502a1384-553b-493e-bc66-75d48345b47e', providerName: 'Local Filesystem'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:57 [LocalStorageProvider] Calling API: /api/storage/filesystem?action=list&fileId=dGVtcGxhdGVz&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=peter.aichner%40crystal-design.com
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:30.916Z][STATE:31][LocalStorageProvider][debug] 🔍 🔐 AUTH: Starting listItemsById API call {folderId: 'dGVtcGxhdGVz', libraryId: '502a1384-553b-493e-bc66-75d48345b47e', hasUserEmail: true, userEmail: 'peter.aichner@...', url: '/api/storage/filesystem?action=list&fileId=dGVtcGx…Id=502a1384-553b-493e-bc66-75d48345b47e&email=***'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\storage\storage-factory.ts:118 [LocalStorageProvider] Successfully loaded 5 items
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\lib\debug\logger.ts:55 [07:30:31.502Z][STATE:32][LocalStorageProvider][info] ℹ️ 🔐 AUTH: API call successful {itemCount: 5, folderId: 'dGVtcGxhdGVz', libraryId: '502a1384-553b-493e-bc66-75d48345b47e'}
C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\contexts\storage-context.tsx:481 [StorageContext][listItems] Erfolgreich 5 Items geladen

---

**Cursor**

Ich starte mit einer kurzen Bestandsaufnahme der relevanten Dateien und passe danach die Desktop-Entkopplung sowie State-Change-Logging minimalinvasiv an.

Ich schaue mir die relevanten Dateien an, um die Desktop-Entkopplung und das State-Change-Logging zielgenau einzubauen. Danach passe ich die Initialisierungslogik an und ergänze Messungen mit performance.now().

---

**User**

ich glaube wir haben hier ein Problem mit clerk. Oder? Erste ladezeit dauer 32 Sekunden

---

**Cursor**

Ich habe `library.tsx`, `file-list.tsx` und `file-tree.tsx` geöffnet und den Network-Screenshot mit unseren Logs gegengecheckt. Jetzt spalte ich die große Vorschau-Komponente per dynamic import ab, um den 3.3 MB `page.js`-Bundle direkt zu verkleinern und die gefühlte Erstladezeit zu senken.

```typescriptreact
"use client"

import * as React from "react"
import { useCallback, useEffect } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import dynamic from 'next/dynamic'
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
      UILogger.info('Library', 'Initial load triggered', {
        currentFolderId,
        lastLoadedFolder,
        isMobile,
        isTreeVisible,
        isFileTreeReady
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

Ich habe die Library geöffnet und werde jetzt:
- FilePreview per dynamic import auslagern, um `page.js` zu verkleinern.
- Eine Startzeitmessung mit performance.now() in `Library` einfügen und in Logs ausgeben.

Ich führe die Code-Änderungen jetzt aus.

```typescriptreact
"use client"

import * as React from "react"
import { useCallback, useEffect } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import dynamic from 'next/dynamic'
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

Ich prüfe die Größe von `FilePreview` und splitte sie wirklich per dynamic import, damit `page.js` nicht 3.3 MB lädt. Danach checke ich, ob noch große Imports in `file-preview.tsx` stecken, die weiter gesplittet werden sollten.

