'use client';

import * as React from "react"
import { File, FileText, FileVideo, FileAudio, Plus, RefreshCw, ChevronUp, ChevronDown, Trash2, ScrollText, Folder as FolderIcon, Layers } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { useAtomValue, useAtom } from 'jotai';
import { jobStatusByItemIdAtom } from '@/atoms/job-status';
import { 
  activeLibraryIdAtom, 
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
  isActive?: boolean;
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
  isActive = false,
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

  // Entfernt: ungenutzter Handler handleTranscriptClick

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

  // Zentraler Jobstatus (muss vor möglichen early-returns stehen, um Hook-Order zu garantieren)
  const jobStatusMap = useAtomValue(jobStatusByItemIdAtom);
  const jobStatus = jobStatusMap[item.id];
  const jobStatusIcon = jobStatus ? (
    <span title={jobStatus} className={cn('inline-block h-3 w-3 rounded-full',
      jobStatus === 'queued' && 'bg-blue-600',
      jobStatus === 'running' && 'bg-yellow-600',
      jobStatus === 'completed' && 'bg-green-600',
      jobStatus === 'failed' && 'bg-red-600'
    )} aria-label={`job-${jobStatus}`} />
  ) : null;

  // Pinecone-Doc-Status (kind:'doc') für Shadow‑Twins/Markdowns anzeigen
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [docStatus, setDocStatus] = React.useState<{
    status?: 'ok' | 'stale' | 'not_indexed';
    extract_status?: string;
    template_status?: string;
    ingest_status?: string;
    hasError?: boolean;
  } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Für Markdown/Shadow‑Twins und auch PDFs (Basisdateien)
        const mt = (item.metadata.mimeType || '').toLowerCase();
        const isMd = mt.startsWith('text/') || item.metadata.name.toLowerCase().endsWith('.md');
        const isPdf = mt === 'application/pdf' || item.metadata.name.toLowerCase().endsWith('.pdf');
        if (!isMd && !isPdf) return;

        // Wenn Basisdatei (PDF), versuche Twin (.md) zu verwenden
        let targetId = item.id;
        if (!isMd && isPdf && (metadata as unknown as { transcriptionTwin?: { id?: string } }).transcriptionTwin?.id) {
          targetId = (metadata as unknown as { transcriptionTwin: { id: string } }).transcriptionTwin.id;
          FileLogger.info('FileRow', 'Nutze Twin für Doc-Status', { pdfId: item.id, mdId: targetId });
        }

        FileLogger.info('FileRow', 'Lade Doc-Status', { fileId: targetId, name: item.metadata.name });
        const res = await fetch(`/api/chat/${activeLibraryId}/file-status?fileId=${encodeURIComponent(targetId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setDocStatus({
          status: json.status,
          extract_status: json.extract_status,
          template_status: json.template_status,
          ingest_status: json.ingest_status,
          hasError: json.hasError,
        });
        FileLogger.info('FileRow', 'Doc-Status geladen', { fileId: targetId, status: json.status });
      } catch {
        // ignore
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [item.id, item.metadata.mimeType, item.metadata.name, (metadata as unknown as { transcriptionTwin?: { id?: string } }).transcriptionTwin?.id, activeLibraryId]);

  const docStatusIcon = React.useMemo(() => {
    if (!docStatus) return null;
    const norm = (v?: string) => (v || '').toLowerCase();
    const s = norm(docStatus.status);
    const ext = norm(docStatus.extract_status);
    const tpl = norm(docStatus.template_status);
    const ing = norm(docStatus.ingest_status);

    const noIndex = s === '' || s === 'not_indexed';
    const failed = !!docStatus.hasError || ext === 'failed' || tpl === 'failed' || ing === 'failed';
    // Grün NUR wenn alle drei Schritte completed und keine Fehlermeldung
    const allDone = ext === 'completed' && tpl === 'completed' && ing === 'completed' && !failed;
    const partial = !noIndex && !failed && !allDone; // z.B. stale, pending, none

    const color = noIndex ? 'bg-gray-400' : failed ? 'bg-red-600' : partial ? 'bg-yellow-600' : 'bg-green-600';
    const tt = `Ingestion: ${docStatus.status || '—'} | extract: ${docStatus.extract_status || '—'} | template: ${docStatus.template_status || '—'} | ingest: ${docStatus.ingest_status || '—'}`;
    return <span title={tt} className={cn('inline-block h-3 w-3 rounded-full', color)} aria-label={`doc-${docStatus.status || 'unknown'}`} />
  }, [docStatus]);

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
        {jobStatusIcon}
        {docStatusIcon}
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
  // Mobile-Flag wurde entfernt, FileList lädt unabhängig vom View
  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  const [, setTranscriptionDialogOpen] = useAtom(transcriptionDialogOpenAtom);
  const [, setTransformationDialogOpen] = useAtom(transformationDialogOpenAtom);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initializationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Entkoppelt: Kein Warten mehr auf FileTree-Status
  const [activeFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const currentCategoryFilter = useAtomValue(fileCategoryFilterAtom);
  const allItemsInFolder = useAtomValue(folderItemsAtom);
  const navigateToFolder = useFolderNavigation();
  const listContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Kein mobiles Flag mehr notwendig

  const folders = useMemo(() => {
    const items = allItemsInFolder ?? [];
    // Verstecke dot-Verzeichnisse generell in der Liste
    return items.filter(item => item.type === 'folder' && !item.metadata.name.startsWith('.'));
  }, [allItemsInFolder]);

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
      FileLogger.info('FileList', 'Waiting for provider');
      return;
    }

    const initialize = async () => {
      if (isInitialized) {
        FileLogger.debug('FileList', 'Already initialized');
        return;
      }

      FileLogger.info('FileList', 'Starting initialization');

      try {
        FileLogger.info('FileList', 'Initialization complete');
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

  // Navigationsliste: nur Hauptdateien in der aktuell sichtbaren Reihenfolge
  const mainFileItems = React.useMemo(() => {
    return Array.from((fileGroups ?? new Map()).values())
      .map(g => g.baseItem)
      .filter((it): it is StorageItem => Boolean(it));
  }, [fileGroups]);

  // Hilfsfunktion: Gruppe anhand baseItem.id finden
  const findGroupByBaseItemId = React.useCallback((baseItemId: string) => {
    for (const g of Array.from((fileGroups ?? new Map()).values())) {
      if (g.baseItem && g.baseItem.id === baseItemId) return g;
    }
    return undefined;
  }, [fileGroups]);

  // Auswahl-Helfer für Keyboard-Navigation (dupliziert nicht die UI-spezifischen Click-Handler)
  const selectByKeyboard = React.useCallback((item: StorageItem) => {
    setSelectedFile(item);
    const group = findGroupByBaseItemId(item.id);
    if (group && group.transcriptFiles && group.transcriptFiles.length > 0) {
      setSelectedShadowTwin(group.transcriptFiles[0]);
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
  }, [provider, handleRefresh, fileGroups, setSelectedFile, setSelectedBatchItems, findFileGroup]);

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
  }, [provider, handleRefresh, fileGroups, findFileGroup]);

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
                <ScrollText className="h-4 w-4" />
              </Button>
            )}
            {selectedTransformationItems.length > 0 && (
              <Button size="icon" variant="secondary" title="Transformieren" aria-label="Transformieren" onClick={handleBatchTransformation}>
                <Plus className="h-4 w-4" />
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
                <div />
                <FolderIcon className="h-4 w-4" />
                <span className="text-left truncate select-none" title={folder.metadata.name}>{folder.metadata.name}</span>
              </div>
            )
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