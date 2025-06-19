'use client';

import * as React from "react"
import { File, FileText, FileVideo, FileAudio, Plus, RefreshCw, ChevronUp, ChevronDown, Trash2, ScrollText } from "lucide-react"
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
  sortOrderAtom
} from '@/atoms/library-atom';
import { toast } from "sonner";
import { Input } from "@/components/ui/input"
import {
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom,
  getMediaType
} from '@/atoms/transcription-options';
import { Checkbox } from "@/components/ui/checkbox"
import { useMemo, useCallback } from "react"
import { FileLogger, StateLogger } from "@/lib/debug/logger"

// Typen für Sortieroptionen
type SortField = 'type' | 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';

// Typ für gruppierte Dateien
interface FileGroup {
  baseItem?: StorageItem;
  transcript?: StorageItem;
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

function getFileStem(name: string): string {
  // Entferne Transform-Suffix (.Template.de.md, .Template.en.md, etc.)
  // Wichtig: Das Template kann auch Punkte enthalten!
  const transformMatch = name.match(/^(.*)\.([^.]+)\.(de|en|fr|es|it)\.md$/);
  if (transformMatch) {
    // Prüfe, ob das mittlere Segment ein Sprachkürzel ist
    // Wenn ja, ist es ein einfaches Transcript
    const possibleLang = transformMatch[2];
    if (['de', 'en', 'fr', 'es', 'it'].includes(possibleLang)) {
      // Es ist ein Transcript: name.de.md
      return transformMatch[1];
    }
    // Ansonsten ist es ein Transform: name.Template.de.md
    return transformMatch[1];
  }
  
  // Entferne Transcript-Suffix (.de.md, .en.md, etc.)
  const transcriptMatch = name.match(/^(.*)\.(de|en|fr|es|it)\.md$/);
  if (transcriptMatch) return transcriptMatch[1];
  
  // Für alle anderen Dateien: entferne nur die letzte Endung
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) return name;
  return name.substring(0, lastDot);
}

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

// Memoized file row component
const FileRow = React.memo(function FileRow({ 
  item, 
  isSelected, 
  onSelect,
  onCreateTranscript,
  onDelete,
  fileGroup,
  onSelectRelatedFile,
  onRename
}: { 
  item: StorageItem;
  isSelected: boolean;
  onSelect: () => void;
  onCreateTranscript: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  fileGroup?: FileGroup;
  onSelectRelatedFile?: (file: StorageItem) => void;
  onRename?: (item: StorageItem, newName: string) => Promise<void>;
}) {
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
    hasTranscript: !!item.metadata?.hasTranscript || !!fileGroup?.transcript,
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
    if (fileGroup?.transcript && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transcript);
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
        (fileGroup.transcript && item.id === fileGroup.transcript.id) ||
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
        // Füge Transkript hinzu, falls vorhanden
        if (fileGroup.transcript) {
          itemsToMove.push({
            itemId: fileGroup.transcript.id,
            itemName: fileGroup.transcript.metadata.name,
            itemType: fileGroup.transcript.type,
            parentId: fileGroup.transcript.parentId
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
  const isInBatch = selectedBatchItems.some(batchItem => batchItem.item.id === item.id);

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
        "w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_60px_100px_100px_50px] gap-4 items-center cursor-move",
        isSelected && "bg-muted"
      )}
    >
      <div className="w-6 flex items-center justify-center">
        <Checkbox
          checked={isInBatch}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedBatchItems([...selectedBatchItems, {
                item,
                type: getMediaType(item)
              }]);
            } else {
              setSelectedBatchItems(selectedBatchItems.filter(i => i.item.id !== item.id));
            }
          }}
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
      <span className="text-muted-foreground">
        {formatFileSize(metadata.size)}
      </span>
      <span className="text-muted-foreground">
        {formatDate(metadata.modifiedAt)}
      </span>
      <div className="flex items-center justify-start gap-1">
        {/* Zeige Icons für vorhandene verwandte Dateien */}
        {fileGroup?.transcript ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={handleTranscriptClick}
                >
                  <FileText className="h-4 w-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript anzeigen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : isTranscribable && !metadata.hasTranscript ? (
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
      </div>
      <div className="flex items-center justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
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
    </div>
  );
});

export const FileList = React.memo(function FileList(): JSX.Element {
  const { provider, refreshItems, currentLibrary } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [, setTranscriptionDialogOpen] = useAtom(transcriptionDialogOpenAtom);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initializationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isFileTreeReady = useAtomValue(fileTreeReadyAtom);
  const [, setSelectedFile] = useAtom(selectedFileAtom);
  const [, setFolderItems] = useAtom(folderItemsAtom);

  // NEU: Atome für Sortierung und Filter
  const items = useAtomValue(sortedFilteredFilesAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);

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
    if (!provider || !isFileTreeReady) {
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

    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
    };
  }, [provider, isFileTreeReady, isInitialized, items?.length]);

  // Aktualisierte handleSelect Funktion
  const handleSelect = useCallback((item: StorageItem) => {
    setSelectedFile(item);
  }, [setSelectedFile]);

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

  // Gruppiere die Dateien (ohne Logging im Render!)
  const fileGroups = useMemo(() => {
    if (!items) return new Map<string, FileGroup>();
    const groups: FileGroup[] = [];
    
    // Einfach jede Datei als eigene "Gruppe" behandeln
    for (const item of items) {
      if (item.type === 'file') {
        groups.push({ 
          baseItem: item, 
          transcript: undefined, 
          transformed: undefined 
        });
      }
    }
    
    const groupMap = new Map<string, FileGroup>();
    for (const group of groups) {
      const key = group.baseItem?.metadata.name || Math.random().toString();
      groupMap.set(key, group);
    }
    return groupMap;
  }, [items]);

  // Berechne, ob alle Dateien ausgewählt sind
  const isAllSelected = useMemo(() => {
    if (!items?.length) return false;
    const transcribableItems = items.filter(item => 
      item.type === 'file' && 
      (item.metadata.mimeType.startsWith('audio/') || item.metadata.mimeType.startsWith('video/'))
    );
    return transcribableItems.length > 0 && selectedBatchItems.length === transcribableItems.length;
  }, [items, selectedBatchItems]);

  // Handle Select All
  const handleSelectAll = useCallback((checked: boolean) => {
    const startTime = performance.now();
    
    if (checked) {
      const transcribableItems = items
        .filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
          } catch {
            return false;
          }
        })
        .map(item => ({
          item,
          type: getMediaType(item)
        }));

      StateLogger.info('FileList', 'Selecting all transcribable items', {
        totalItems: items.length,
        transcribableCount: transcribableItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      
      setSelectedBatchItems(transcribableItems);
    } else {
      StateLogger.info('FileList', 'Deselecting all items', {
        previouslySelected: selectedBatchItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      
      setSelectedBatchItems([]);
    }
  }, [items, setSelectedBatchItems, selectedBatchItems.length]);

  // Handle Item Selection
  const handleItemSelect = React.useCallback((item: StorageItem) => {
    const startTime = performance.now();
    
    try {
      const mediaType = getMediaType(item);
      
      StateLogger.debug('FileList', 'Item selection attempt', {
        itemId: item.id,
        itemName: item.metadata.name,
        mediaType,
        isCurrentlySelected: selectedBatchItems.some(i => i.item.id === item.id)
      });
      
      // Nur Audio- und Video-Dateien können für Batch-Transkription ausgewählt werden
      if (mediaType === 'audio' || mediaType === 'video') {
        setSelectedBatchItems(prev => {
          const isAlreadySelected = prev.some(i => i.item.id === item.id);
          const newSelection = isAlreadySelected
            ? prev.filter(i => i.item.id !== item.id)
            : [...prev, { item, type: mediaType }];
            
          StateLogger.info('FileList', 'Batch selection updated', {
            itemId: item.id,
            itemName: item.metadata.name,
            mediaType,
            action: isAlreadySelected ? 'deselected' : 'selected',
            newSelectionCount: newSelection.length,
            duration: `${(performance.now() - startTime).toFixed(2)}ms`
          });
          
          return newSelection;
        });
      }
      
      // Immer die Datei auswählen, unabhängig vom Medientyp
      handleSelect(item);
    } catch (error) {
      StateLogger.warn('FileList', 'Error in item selection', {
        error,
        itemId: item.id,
        itemName: item.metadata.name,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      handleSelect(item);
    }
  }, [handleSelect, selectedBatchItems]);

  // Check if an item is selected
  const isItemSelected = useCallback((item: StorageItem) => {
    return selectedBatchItems.some(selected => selected.item.id === item.id);
  }, [selectedBatchItems]);

  // Löschfunktion
  const handleDeleteClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement delete logic
  }, []);

  // Hilfsfunktion zum Finden einer FileGroup in der Map
  const findFileGroup = (map: Map<string, FileGroup>, stem: string): FileGroup | undefined => {
    return Array.from(map.values()).find(group => 
      group.baseItem && getFileStem(group.baseItem.metadata.name) === stem
    );
  };

  const handleRename = React.useCallback(async (item: StorageItem, newName: string) => {
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Finde die FileGroup für dieses Item
      const itemStem = getFileStem(item.metadata.name);
      const fileGroup = findFileGroup(fileGroups, itemStem);

      if (fileGroup && item.id === fileGroup.baseItem?.id) {
        // Dies ist die Basis-Datei - benenne auch abhängige Dateien um
        const oldStem = getFileStem(item.metadata.name);
        const newStem = getFileStem(newName);
        // Benenne die Basis-Datei um
        await provider.renameItem(item.id, newName);
        // Benenne das Transkript um, falls vorhanden
        if (fileGroup.transcript) {
          const transcriptName = fileGroup.transcript.metadata.name;
          // Ersetze den alten Stem mit dem neuen
          const newTranscriptName = transcriptName.replace(oldStem, newStem);
          try {
            await provider.renameItem(fileGroup.transcript.id, newTranscriptName);
          } catch (error) {
            FileLogger.error('FileList', 'Fehler beim Umbenennen des Transkripts', error);
            toast.warning("Hinweis", {
              description: "Das Transkript konnte nicht umbenannt werden"
            });
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

  React.useEffect(() => {
    // Logging der Library-IDs
    StateLogger.debug('FileList', 'Render', {
      currentLibraryId: currentLibrary?.id,
      activeLibraryIdAtom: activeLibraryId
    });
  }, [currentLibrary, activeLibraryId]);

  if (!isFileTreeReady) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lade Ordnerstruktur...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          {selectedBatchItems.length > 0 && (
            <Button
              size="sm"
              onClick={handleBatchTranscription}
            >
              {selectedBatchItems.length} Datei(en) transkribieren
            </Button>
          )}
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Table Header */}
          <div className="sticky top-0 bg-background border-b">
            <div className="grid grid-cols-[auto_1fr_100px_150px_100px_50px] gap-2 px-4 py-2 text-sm font-medium text-muted-foreground">
              <div className="w-6 flex items-center justify-center">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Alle auswählen"
                />
              </div>
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
              <div className="text-left">Aktionen</div>
              <div />
            </div>
          </div>

          {/* File Rows */}
          <div className="divide-y">
            {Array.from(fileGroups.values())
              .map((group) => {
                const item = group.baseItem || group.transcript || group.transformed;
                if (!item) return null;
                return (
                  <FileRow
                    key={item.id}
                    item={item as StorageItem}
                    isSelected={isItemSelected(item)}
                    onSelect={() => handleItemSelect(item)}
                    onCreateTranscript={handleCreateTranscript}
                    onDelete={handleDeleteClick}
                    fileGroup={group}
                    onSelectRelatedFile={handleSelect}
                    onRename={handleRename}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}); 