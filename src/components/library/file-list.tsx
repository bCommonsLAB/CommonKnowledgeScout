'use client';

import * as React from "react"
import { useCallback } from "react"
import { File, FileText, FileVideo, FileAudio, CheckCircle2, Plus, RefreshCw } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";

interface FileListProps {
  items: StorageItem[]
  selectedItem: StorageItem | null
  onSelectAction: (item: StorageItem) => void
  searchTerm?: string
  onRefresh?: (folderId: string, items: StorageItem[]) => void
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

// Memoized file row component
const FileRow = React.memo(function FileRow({ 
  item, 
  isSelected, 
  onSelect,
  onCreateTranscript 
}: { 
  item: StorageItem;
  isSelected: boolean;
  onSelect: () => void;
  onCreateTranscript: (e: React.MouseEvent) => void;
}) {
  // Zusätzliche Validierung der Metadaten
  const metadata = React.useMemo(() => ({
    name: item.metadata?.name || 'Unbekannte Datei',
    size: typeof item.metadata?.size === 'number' ? item.metadata.size : 0,
    mimeType: item.metadata?.mimeType || '',
    hasTranscript: !!item.metadata?.hasTranscript
  }), [item.metadata]);

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
    onSelect();
  }, [onSelect]);

  // Memoize the keydown handler
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onSelect();
    }
  }, [onSelect]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-full px-4 py-2 text-sm hover:bg-muted/50 grid grid-cols-[auto_1fr_100px_120px_50px] gap-4 items-center",
        isSelected && "bg-muted"
      )}
    >
      <FileIconComponent item={item} />
      <span className="text-left truncate">{metadata.name}</span>
      <span className="text-muted-foreground">
        {formatFileSize(metadata.size)}
      </span>
      <div className="flex items-center justify-start gap-2">
        {metadata.hasTranscript ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkription verfügbar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : isTranscribable ? (
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
                      onCreateTranscript(e as any);
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
      </div>
      <div></div> {/* Leere Zelle für die fünfte Spalte */}
    </div>
  );
});

export const FileList = React.memo(function FileList({ 
  items,
  selectedItem,
  onSelectAction,
  searchTerm = "",
  onRefresh
}: FileListProps) {
  const { refreshItems } = useStorage();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  
  // Prüft ob eine Datei ein unaufgelöstes Template enthält
  const hasUnresolvedTemplate = React.useCallback((item: StorageItem): boolean => {
    if (!item?.metadata?.name) return false;
    return item.metadata.name.includes('{{') && item.metadata.name.includes('}}');
  }, []);

  // Aktuellen Ordner bestimmen und Dateiliste neu laden
  const handleRefresh = React.useCallback(async () => {
    if (!items || items.length === 0) return;
    
    // Alle Dateien haben den gleichen Elternordner
    const parentId = items[0]?.parentId;
    if (!parentId) return;
    
    setIsRefreshing(true);
    
    try {
      // Dateiliste neu laden und Cache explizit leeren
      const refreshedItems = await refreshItems(parentId);
      
      // Benachrichtige die Eltern-Komponente über die Aktualisierung
      if (onRefresh) {
        onRefresh(parentId, refreshedItems);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Dateiliste:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [items, refreshItems, onRefresh]);

  // Debug Logging - measure actual render time
  const renderStartRef = React.useRef<number>(0);
  
  React.useLayoutEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Store start time in ref at beginning of render
      renderStartRef.current = performance.now();
      
      // Measure time after render is complete
      const measureRenderTime = () => {
        const renderTime = performance.now() - renderStartRef.current;
        if (renderTime > 1) {
          console.log(`FileList render time: ${renderTime.toFixed(2)}ms`);
        }
      };
      
      // Schedule measurement for after paint
      requestAnimationFrame(measureRenderTime);
    }
  });

  const handleCreateTranscript = React.useCallback((e: React.MouseEvent, item: StorageItem) => {
    e.stopPropagation();
    console.log('Create transcript for:', item.metadata.name);
    // TODO: Implement transcript creation
  }, []);

  // Filter files
  const files = React.useMemo(() => {
    if (!items || items.length === 0) {
      console.log(`FileList: Keine Dateien zum Filtern`);
      return [];
    }
    
    return items
      .filter(item => item.type === 'file')
      .filter(item => !item.metadata.name.startsWith('.'))
      .filter(item => !item.metadata.isTwin)
      .filter(item => 
        searchTerm === "" || 
        item.metadata.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  }, [items, searchTerm]);

  // Modifizierter Select-Handler mit Template-Warnung
  const handleSelect = React.useCallback((item: StorageItem) => {
    if (hasUnresolvedTemplate(item)) {
      console.warn('Warnung: Datei enthält nicht aufgelöste Template-Variablen:', item.metadata.name);
    }
    onSelectAction(item);
  }, [onSelectAction, hasUnresolvedTemplate]);

  return (
    <div className="h-full overflow-auto">
      {!items || files.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {!items ? 'Provider nicht verfügbar' : 'Keine Dateien gefunden'}
        </div>
      ) : (
        <div className="divide-y">
          {/* Header */}
          <div className="px-4 py-2 text-sm font-medium text-muted-foreground grid grid-cols-[auto_1fr_100px_120px_50px] gap-4 items-center">
            <span>Typ</span>
            <span>Name</span>
            <span>Größe</span>
            <span>Transkript</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-6 w-6 p-0"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4", 
                      isRefreshing && "animate-spin"
                    )} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Dateiliste aktualisieren</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {/* Files */}
          {files.map((item) => (
            <FileRow
              key={item.id}
              item={item}
              isSelected={selectedItem?.id === item.id}
              onSelect={() => handleSelect(item)}
              onCreateTranscript={(e) => handleCreateTranscript(e, item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Zusätzliche Prüfung für selectedItem
  if (prevProps.selectedItem && nextProps.selectedItem) {
    return (
      prevProps.selectedItem.id === nextProps.selectedItem.id &&
      prevProps.items === nextProps.items &&
      prevProps.searchTerm === nextProps.searchTerm
    );
  }
  return (
    (!prevProps.selectedItem && !nextProps.selectedItem) &&
    prevProps.items === nextProps.items &&
    prevProps.searchTerm === nextProps.searchTerm
  );
}); 