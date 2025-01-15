'use client';

import * as React from "react"
import { File, FileText, FileVideo, FileAudio, FileIcon } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"

interface FileListProps {
  items: StorageItem[]
  selectedItem: StorageItem | null
  onSelect: (item: StorageItem) => void
  searchTerm?: string
  currentFolderId: string
}

export function FileList({
  items,
  selectedItem,
  onSelect,
  searchTerm = ""
}: FileListProps) {
  // Filter files and apply search
  const files = items
    .filter(item => item.type === 'file')
    .filter(item => !item.metadata.name.startsWith('.'))
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

  return (
    <div className="h-full overflow-auto">
      {files.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Keine Dateien gefunden
        </div>
      ) : (
        <div className="divide-y">
          {files.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={cn(
                "w-full px-4 py-2 text-sm hover:bg-muted/50 flex items-center gap-4",
                selectedItem?.id === item.id && "bg-muted"
              )}
            >
              {getFileIcon(item)}
              <span className="flex-1 text-left truncate">{item.metadata.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(item.metadata.size)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 