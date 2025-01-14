'use client';

import { StorageItem, StorageFile } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { File, FileText, FileVideo, FileAudio, FileIcon } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface FileListProps {
  items: StorageItem[];
  onSelect?: (item: StorageItem) => void;
  selectedItem?: StorageItem | null;
  currentPath?: string;
}

export function FileList({ items, onSelect, selectedItem, currentPath = '/' }: FileListProps) {
  const formatFileSize = (size: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  // Filtere nur Dateien (keine Ordner) und keine versteckten Dateien
  const filteredItems = items.filter(item => 
    item.type === 'file' && !item.item.name.startsWith('.')
  );

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch(extension) {
      case 'md':
      case 'mdx':
        return <FileText className="h-4 w-4" />;
      case 'mp4':
      case 'avi':
      case 'mov':
        return <FileVideo className="h-4 w-4" />;
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <FileAudio className="h-4 w-4" />;
      case 'pdf':
        return <FileIcon className="h-4 w-4" />;
      case 'txt':
      case 'doc':
      case 'docx':
        return <FileText className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          Keine Dateien gefunden
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-background grid grid-cols-12 gap-2 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
            <div className="col-span-6">Name</div>
            <div className="col-span-2">Größe</div>
            <div className="col-span-4">Geändert</div>
          </div>
          
          {/* Items */}
          <div className="flex-1 overflow-auto">
            {filteredItems.map((item, index) => (
              <div
                key={item.item.path}
                className={cn(
                  "grid grid-cols-12 gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-muted/50",
                  selectedItem?.item.path === item.item.path && "bg-muted"
                )}
                onClick={() => onSelect?.(item)}
              >
                <div className="col-span-6 flex items-center gap-2">
                  {getFileIcon(item.item.name)}
                  <span className="truncate">{item.item.name}</span>
                </div>
                <div className="col-span-2">
                  {item.type === 'file' ? formatFileSize((item.item as unknown as StorageFile).size || 0) : '-'}
                </div>
                <div className="col-span-4">
                  {item.item.modifiedAt ? formatDistanceToNow(new Date(item.item.modifiedAt), { addSuffix: true, locale: de }) : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 