'use client';

import * as React from "react"
import { File, FileText, FileVideo, FileAudio, FileIcon, CheckCircle2, Plus } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

interface FileListProps {
  items: StorageItem[]
  selectedItem: StorageItem | null
  onSelectAction: (item: StorageItem) => void
  searchTerm?: string
  currentFolderId: string
}

export function FileList({
  items,
  selectedItem,
  onSelectAction,
  searchTerm = ""
}: FileListProps) {
  // Debug Logging für Transcription Twins
  React.useEffect(() => {
    console.group('%c FileList Debug Info', 'background: #4CAF50; color: white; padding: 4px; border-radius: 4px;');
    console.log('%c Items in current directory:', 'font-weight: bold');
    items.forEach(item => {
      console.log(`${item.type === 'file' ? '📄' : '📁'} ${item.metadata.name}`, {
        type: item.type,
        size: item.metadata.size,
        mimeType: item.metadata.mimeType,
        hasTranscript: item.metadata.hasTranscript || false
      });
    });
    
    const mdFiles = items.filter(item => 
      item.type === 'file' && 
      item.metadata.name.endsWith('.md')
    );
    
    console.log('\n%c Markdown Files:', 'font-weight: bold');
    mdFiles.forEach(f => console.log('📝', f.metadata.name));
    
    const nonMdFiles = items.filter(item => 
      item.type === 'file' && 
      !item.metadata.name.endsWith('.md')
    );
    
    console.log('\n%c Potential Twins:', 'font-weight: bold');
    nonMdFiles.forEach(file => {
      const extension = file.metadata.name.lastIndexOf('.');
      const baseName = extension === -1 
        ? file.metadata.name 
        : file.metadata.name.slice(0, extension);
      
      const twin = mdFiles.find(md => md.metadata.name === `${baseName}.md`);
      if (twin) {
        console.log('🔗', {
          file: file.metadata.name,
          transcript: twin.metadata.name,
          hasTranscriptFlag: file.metadata.hasTranscript || false
        });
      }
    });
    
    console.groupEnd();
  }, [items]);

  // Filter files and apply search
  const files = items
    .filter(item => item.type === 'file')
    .filter(item => !item.metadata.name.startsWith('.'))
    // Hide twin files
    .filter(item => !item.metadata.isTwin)
    .filter(item => 
      searchTerm === "" || 
      item.metadata.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Formatiere Dateigröße
  const formatFileSize = (size?: number) => {
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

  // Bestimme das Icon basierend auf dem MIME-Type
  const getFileIcon = (item: StorageItem) => {
    const mimeType = item.metadata.mimeType;
    if (!mimeType) return <File className="h-4 w-4" />;

    if (mimeType.startsWith('video/')) {
      return <FileVideo className="h-4 w-4" />;
    } else if (mimeType.startsWith('audio/')) {
      return <FileAudio className="h-4 w-4" />;
    } else if (mimeType.startsWith('text/')) {
      return <FileText className="h-4 w-4" />;
    }

    return <File className="h-4 w-4" />;
  };

  // Prüft ob eine Datei transkribierbar ist
  const isTranscribable = (item: StorageItem): boolean => {
    const mimeType = item.metadata.mimeType.toLowerCase();
    const extension = item.metadata.name.split('.').pop()?.toLowerCase();

    return (
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      extension === 'pdf' ||
      mimeType === 'application/pdf'
    );
  };

  const handleCreateTranscript = (e: React.MouseEvent, item: StorageItem) => {
    e.stopPropagation(); // Verhindert, dass die Datei selektiert wird
    console.log('Create transcript for:', item.metadata.name);
    // TODO: Implement transcript creation
  };

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
            <button
              key={item.id}
              onClick={() => onSelectAction(item)}
              className={cn(
                "w-full px-4 py-2 text-sm hover:bg-muted/50 grid grid-cols-[auto_1fr_100px_120px] gap-4 items-center",
                selectedItem?.id === item.id && "bg-muted"
              )}
            >
              {getFileIcon(item)}
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
                ) : isTranscribable(item) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0"
                          onClick={(e) => handleCreateTranscript(e, item)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Transkript erstellen</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 