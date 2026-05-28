'use client';

/**
 * file-list/file-row.tsx
 *
 * Eine einzelne Zeile der Datei-Liste mit:
 * - Selection-Checkbox (Audio/Video → Batch, Text/Doc/Folder → Transformation)
 * - File-Icon oder Cover-Thumbnail (bei vorhandenem listMeta)
 * - Datei-Name mit Inline-Rename, Long-Press- und Doppelklick-Geste
 * - Drag&Drop fuer Verschiebung (auch ganzer FileGroups)
 * - Status-Icons (Transcript, Transformation, Story publiziert, Loeschen)
 *
 * Aus `file-list.tsx` extrahiert (Welle 3-I, Schritt 4b). Wird via
 * `import { FileRow } from './file-list/file-row'` von `file-list.tsx`
 * konsumiert.
 *
 * Vertrag siehe `.cursor/rules/welle-3-schale-loader-contracts.mdc` §1, §3.
 */

import * as React from 'react';
import {
  FileText,
  Trash2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useAtom } from 'jotai';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FileLogger } from '@/lib/debug/logger';
import {
  selectedBatchItemsAtom,
  selectedTransformationItemsAtom,
  getMediaType,
} from '@/atoms/transcription-options';
import type { StorageItem } from '@/lib/storage/types';
import { FileIconComponent } from './file-icon';
import { ListCoverThumbnail } from './cover-thumbnail';
import { formatDate, formatFileSize, type FileGroup } from './list-utils';

export interface FileRowProps {
  item: StorageItem;
  isSelected: boolean;
  isActive?: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, item: StorageItem) => void;
  fileGroup?: FileGroup;
  onRename?: (item: StorageItem, newName: string) => Promise<void>;
  compact?: boolean;
  /** Fuer Cover-Thumbnail-Aufloesung (resolve-binary-url) */
  libraryId?: string;
  /**
   * DIVA-Toolbar: Spalten-Keys aus `divaExtraColumnsAtom`. Spezial-Key
   * `_thumbnail` rendert das Preview-Bitmap aus `sidecarEntry.Image`,
   * alle anderen sind reine String-Felder des `OptionvalueEntry`.
   */
  extraColumns?: readonly string[];
  /**
   * Rohes Sidecar-Snapshot (1:1 OptionvalueEntry) — falls die Datei einen
   * DIVA-Match hat. Quelle: `itemSidecarEntriesAtom`.
   */
  sidecarEntry?: Record<string, unknown>;
}

export const FileRow = React.memo(function FileRow({
  item,
  isSelected,
  isActive = false,
  onSelect,
  onDelete,
  fileGroup,
  onRename,
  compact = false,
  libraryId,
  extraColumns,
  sidecarEntry,
}: FileRowProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(item.metadata.name);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastClickTimeRef = React.useRef<number>(0);

  // Zusaetzliche Validierung der Metadaten (defensive gegen Provider-Drift)
  const metadata = React.useMemo(() => ({
    name: item.metadata?.name || 'Unbekannte Datei',
    size: typeof item.metadata?.size === 'number' ? item.metadata.size : 0,
    mimeType: item.metadata?.mimeType || '',
    hasTranscript: !!item.metadata?.hasTranscript || (fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0),
    modifiedAt: item.metadata?.modifiedAt,
  }), [item.metadata, fileGroup]);

  const handleClick = React.useCallback(() => {
    if (!isEditing) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  // Starte Rename-Modus. Abhaengige Dateien (Transcript/Transformation)
  // koennen nicht direkt umbenannt werden — nur die Basis.
  const startRename = React.useCallback(() => {
    if (onRename) {
      if (fileGroup && (
        (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles[0]?.id === item.id) ||
        (fileGroup.transformed && item.id === fileGroup.transformed.id)
      )) {
        toast.info('Hinweis', {
          description: 'Bitte benennen Sie die Haupt-Datei um. Abhaengige Dateien werden automatisch mit umbenannt.',
        });
        return;
      }

      setIsEditing(true);
      setEditName(item.metadata.name);
    }
  }, [onRename, item, fileGroup]);

  // Doppelklick-Erkennung auf den Datei-Namen.
  const handleNameClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;

    if (timeSinceLastClick < 300) {
      startRename();
    } else {
      onSelect();
    }

    lastClickTimeRef.current = currentTime;
  }, [startRename, onSelect]);

  // Long-Press auf Touch-Geraeten (500ms) → Rename-Modus.
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();

    longPressTimerRef.current = setTimeout(() => {
      startRename();
    }, 500);
  }, [startRename]);

  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();

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

  // Cleanup Timer bei Unmount, sonst leakt der setTimeout.
  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleRenameSubmit = React.useCallback(async () => {
    if (onRename && editName.trim() && editName !== item.metadata.name) {
      try {
        await onRename(item, editName.trim());
      } catch (error) {
        FileLogger.error('FileRow', 'Fehler beim Umbenennen', error);
        // Bei Fehler den urspruenglichen Namen wiederherstellen
        setEditName(item.metadata.name);
      }
    }
    setIsEditing(false);
  }, [onRename, editName, item]);

  const handleRenameCancel = React.useCallback(() => {
    setEditName(item.metadata.name);
    setIsEditing(false);
  }, [item.metadata.name]);

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditName(e.target.value);
  }, []);

  const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSubmit, handleRenameCancel]);

  // Focus Input wenn Edit-Modus aktiviert wird.
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Drag&Drop: bei FileGroup ALLE zugehoerigen Items (Transcript, Transformation) mitziehen.
  const handleDragStart = React.useCallback((e: React.DragEvent) => {
    const itemsToMove: Array<{ itemId: string; itemName: string; itemType: string; parentId: string }> = [];

    itemsToMove.push({
      itemId: item.id,
      itemName: item.metadata.name,
      itemType: item.type,
      parentId: item.parentId,
    });

    if (fileGroup) {
      if (item.id === fileGroup.baseItem?.id) {
        if (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0) {
          fileGroup.transcriptFiles.forEach(transcript => {
            itemsToMove.push({
              itemId: transcript.id,
              itemName: transcript.metadata.name,
              itemType: transcript.type,
              parentId: transcript.parentId,
            });
          });
        }

        if (fileGroup.transformed) {
          itemsToMove.push({
            itemId: fileGroup.transformed.id,
            itemName: fileGroup.transformed.metadata.name,
            itemType: fileGroup.transformed.type,
            parentId: fileGroup.transformed.parentId,
          });
        }
      }
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      items: itemsToMove,
      isFileGroup: itemsToMove.length > 1,
    }));

    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, [item, fileGroup]);

  const handleDragEnd = React.useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);

  // Pruefe, ob das Item in einem der beiden Atoms ausgewaehlt ist.
  const isInBatch = selectedBatchItems.some(batchItem => batchItem.item.id === item.id);
  const isInTransformation = selectedTransformationItems.some(transformationItem => transformationItem.item.id === item.id);
  const isInAnyBatch = isInBatch || isInTransformation;

  // Handler fuer Checkbox-Aenderungen.
  // Audio/Video → Batch-Atom, sonst (Text/Doc/Folder) → Transformation-Atom.
  const handleCheckboxChange = React.useCallback((checked: boolean) => {
    const mediaType = getMediaType(item);

    if (mediaType === 'audio' || mediaType === 'video') {
      if (checked) {
        setSelectedBatchItems([...selectedBatchItems, { item, type: mediaType }]);
      } else {
        setSelectedBatchItems(selectedBatchItems.filter(i => i.item.id !== item.id));
      }
    } else if (mediaType === 'text' || mediaType === 'document' || item.type === 'folder') {
      // NEU: Ordner koennen jetzt auch ausgewaehlt werden fuer rekursive Markdown-Ingestion.
      if (checked) {
        setSelectedTransformationItems([
          ...selectedTransformationItems,
          { item, type: item.type === 'folder' ? 'unknown' : mediaType },
        ]);
      } else {
        setSelectedTransformationItems(selectedTransformationItems.filter(i => i.item.id !== item.id));
      }
    }
  }, [item, selectedBatchItems, selectedTransformationItems, setSelectedBatchItems, setSelectedTransformationItems]);

  // Compact-Modus: vereinfachte Darstellung (nur Icon + Name).
  if (compact) {
    return (
      <div
        id={`file-row-${item.id}`}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full px-2 py-1 text-xs hover:bg-muted/50 grid grid-cols-[24px_minmax(0,1fr)] gap-2 items-center cursor-pointer',
          isSelected && 'bg-muted',
          isActive && 'bg-primary/10 border-l-2 border-primary'
        )}
      >
        <FileIconComponent item={item} />
        <span className={cn('truncate', isActive && 'font-medium')} title={metadata.name}>
          {metadata.name}
        </span>
      </div>
    );
  }

  const gridTemplate = buildGridTemplate(extraColumns ?? [])

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
      style={{ gridTemplateColumns: gridTemplate }}
      className={cn(
        'w-full px-4 py-2 text-xs hover:bg-muted/50 grid gap-2 items-center cursor-move',
        isSelected && 'bg-muted',
        isActive && 'bg-primary/10 border-l-2 border-primary'
      )}
    >
      <div className="w-6 flex items-center justify-center">
        <Checkbox
          checked={isInAnyBatch}
          onCheckedChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {/* Cover-Thumbnail wenn vorhanden (nur bei Basis-Datei). Bevorzugt
          coverThumbnailUrl (klein), sonst coverImageUrl. */}
      {(fileGroup?.listMeta?.coverThumbnailUrl || fileGroup?.listMeta?.coverImageUrl) && fileGroup?.baseItem?.id === item.id && libraryId ? (
        <ListCoverThumbnail
          libraryId={libraryId}
          sourceId={item.id}
          sourceName={item.metadata.name}
          parentId={item.parentId}
          coverImageUrl={fileGroup.listMeta.coverThumbnailUrl ?? fileGroup.listMeta.coverImageUrl ?? ''}
        />
      ) : (
        <FileIconComponent item={item} />
      )}
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
        <div className="min-w-0 flex flex-col justify-center">
          <span
            className={cn('text-left truncate cursor-pointer hover:text-primary select-none', isActive && 'font-medium')}
            onClick={handleNameClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            title={fileGroup?.listMeta?.title ?? metadata.name}
          >
            {fileGroup?.listMeta?.number ? `${fileGroup.listMeta.number} · ` : ''}{metadata.name}
          </span>
          {fileGroup?.listMeta?.title ? (
            <span className="text-[10px] text-muted-foreground truncate" title={fileGroup.listMeta.title}>
              {fileGroup.listMeta.title}
            </span>
          ) : null}
        </div>
      )}
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatFileSize(metadata.size)}
      </span>
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatDate(metadata.modifiedAt)}
      </span>
      {(extraColumns ?? []).map((key) => (
        <ExtraColumnCell key={key} columnKey={key} entry={sidecarEntry} />
      ))}
      <div className="flex items-center justify-start gap-1">
        {/* Status-Icon: Zeigt Fortschritt der Story-Ingestion (Transcript → Transformation → Story) */}
        {(() => {
          const hasTransformation = !!fileGroup?.transformed;
          const hasTranscript = !!(fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0);
          const storyPublished = !!fileGroup?.ingestionStatus?.exists;

          if (!hasTranscript && !hasTransformation && !storyPublished) {
            return null;
          }

          let StatusIcon: typeof FileText;
          let statusText: string;
          let iconColor: string;

          if (hasTransformation && fileGroup?.transformed) {
            StatusIcon = Sparkles;
            statusText = storyPublished
              ? `Transformation & Story publiziert: ${fileGroup.transformed.metadata.name}`
              : `Transformation vorhanden: ${fileGroup.transformed.metadata.name}`;
            iconColor = 'text-green-600';
          } else if (hasTranscript && fileGroup?.transcriptFiles?.[0]) {
            StatusIcon = FileText;
            statusText = `Transcript vorhanden: ${fileGroup.transcriptFiles[0].metadata.name}`;
            iconColor = 'text-green-600';
          } else {
            return null;
          }

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`h-6 w-6 flex items-center justify-center ${iconColor}`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{statusText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })()}
        {/* Story publiziert: gleiches Icon wie im Story-Tab der File Preview (Upload, gruen). */}
        {fileGroup?.ingestionStatus?.exists ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-6 w-6 flex items-center justify-center text-green-600" title="Story publiziert">
                  <Upload className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Story publiziert (in RAG/Galerie)</p>
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
              <p>Datei loeschen</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div />
    </div>
  );
});

// ─── DIVA-Zusatzspalten (Stufe 1+) ──────────────────────────────────────────
// Eine kleine, isolierte Render-Komponente pro Zelle. Bewusst hier (statt in
// eigenem File), weil sie ausschliesslich von FileRow konsumiert wird und
// keine Wiederverwendung an anderer Stelle vorgesehen ist.

/** Spalten-Breiten fuer das dynamische grid-template (in px-Strings). */
const EXTRA_COLUMN_WIDTHS: Record<string, string> = {
  _thumbnail: '36px',
  RGB: '64px',
}
const DEFAULT_EXTRA_COLUMN_WIDTH = 'minmax(80px, 160px)'

/**
 * Baut den `grid-template-columns`-String fuer FileRow + Header.
 * Basis-6-Spalten + N Zusatzspalten BEFORE der `auto`-Aktions-Spalte.
 */
export function buildGridTemplate(extraColumns: readonly string[]): string {
  const base = ['24px', '24px', 'minmax(0,1fr)', '56px', '88px']
  const extras = extraColumns.map((k) => EXTRA_COLUMN_WIDTHS[k] ?? DEFAULT_EXTRA_COLUMN_WIDTH)
  return [...base, ...extras, 'auto'].join(' ')
}

function normalizeImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  return trimmed
}

function ExtraColumnCell({
  columnKey,
  entry,
}: {
  columnKey: string
  entry: Record<string, unknown> | undefined
}): React.ReactElement {
  if (!entry) {
    return <span className="text-muted-foreground text-[10px]" aria-hidden="true">—</span>
  }
  if (columnKey === '_thumbnail') {
    const url = normalizeImageUrl(entry.Image)
    if (!url) {
      return (
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground"
          title="Kein Preview-Bild im Sidecar"
        >
          ?
        </span>
      )
    }
    return <ExtraColumnThumbnail url={url} />
  }
  if (columnKey === 'RGB') {
    const rgb = typeof entry.RGB === 'string' ? entry.RGB.trim() : ''
    if (rgb.length === 0) {
      return <span className="text-muted-foreground text-[10px]">—</span>
    }
    const hex = /^[0-9a-fA-F]{6}$/.test(rgb) ? `#${rgb}` : rgb
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-4 w-4 rounded border border-border"
          style={{ backgroundColor: hex }}
          aria-hidden="true"
        />
        <span className="font-mono text-[10px] text-muted-foreground" title={hex}>
          {hex}
        </span>
      </div>
    )
  }
  const raw = entry[columnKey]
  const value = typeof raw === 'string' ? raw : raw === undefined || raw === null ? '' : String(raw)
  if (value.length === 0) {
    return <span className="text-muted-foreground text-[10px]">—</span>
  }
  return (
    <span className="truncate text-[10px]" title={value}>
      {value}
    </span>
  )
}

/**
 * Preview-Thumbnail aus der Liefersystem-URL. Bei Lade-Fehler wird ein
 * Platzhalter mit "!" gezeigt — keine Konsole/Toast (Edge-Case #1: tote
 * URLs sind erwartbar und sollen den Bildschirm nicht zumuellen).
 */
function ExtraColumnThumbnail({ url }: { url: string }): React.ReactElement {
  const [failed, setFailed] = React.useState(false)
  if (failed) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground"
        title={`Preview nicht erreichbar: ${url}`}
      >
        !
      </span>
    )
  }
  return (
    <img
      src={url}
      alt="Liefersystem-Preview"
      title={url}
      onError={() => setFailed(true)}
      className="h-8 w-8 rounded border border-border object-cover"
      loading="lazy"
    />
  )
}
