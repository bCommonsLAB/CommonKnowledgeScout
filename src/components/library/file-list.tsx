'use client';

import * as React from "react"
import { useCallback } from "react"
import { File, FileText, FileVideo, FileAudio, CheckCircle2, Plus } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { usePerformanceTracking } from "@/hooks/use-performance-tracking"

interface FileListProps {
  items: StorageItem[]
  selectedItem: StorageItem | null
  onSelectAction: (item: StorageItem) => void
  searchTerm?: string
  currentFolderId: string
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
  const isTranscribable = React.useMemo(() => {
    const mimeType = (item.metadata.mimeType || '').toLowerCase();
    const extension = item.metadata.name.split('.').pop()?.toLowerCase();

    return (
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      extension === 'pdf' ||
      mimeType === 'application/pdf'
    );
  }, [item]);

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
        "w-full px-4 py-2 text-sm hover:bg-muted/50 grid grid-cols-[auto_1fr_100px_120px] gap-4 items-center",
        isSelected && "bg-muted"
      )}
    >
      <FileIconComponent item={item} />
      <span className="text-left truncate">{item.metadata.name}</span>
      <span className="text-muted-foreground">
        {formatFileSize(item.metadata.size)}
      </span>
      <div className="flex items-center justify-start gap-2">
        {item.metadata.hasTranscript ? (
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
    </div>
  );
});

export const FileList = React.memo(function FileList({ 
  items,
  selectedItem,
  onSelectAction,
  searchTerm = "",
  currentFolderId
}: FileListProps) {
  // Track performance with minimal dependencies
  usePerformanceTracking('FileList', [currentFolderId]);

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
  const files = React.useMemo(() => 
    items
      .filter(item => item.type === 'file')  // Only show files, not folders
      .filter(item => !item.metadata.name.startsWith('.'))  // Hide hidden files
      .filter(item => !item.metadata.isTwin)  // Hide twin files
      .filter(item => 
        searchTerm === "" || 
        item.metadata.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [items, searchTerm]  // Add dependencies
  );

  return (
    <div className="h-full overflow-auto">
      {files.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Keine Dateien gefunden
        </div>
      ) : (
        <div className="divide-y">
          {/* Header */}
          <div className="px-4 py-2 text-sm font-medium text-muted-foreground grid grid-cols-[auto_1fr_100px_120px] gap-4 items-center">
            <span>Typ</span>
            <span>Name</span>
            <span>Größe</span>
            <span>Transkript</span>
          </div>
          {/* Files */}
          {files.map((item) => (
            <FileRow
              key={item.id}
              item={item}
              isSelected={selectedItem?.id === item.id}
              onSelect={() => onSelectAction(item)}
              onCreateTranscript={(e) => handleCreateTranscript(e, item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.currentFolderId === nextProps.currentFolderId &&
    prevProps.selectedItem?.id === nextProps.selectedItem?.id &&
    prevProps.items === nextProps.items &&
    prevProps.searchTerm === nextProps.searchTerm
  );
}); 