'use client';

import { StorageItem, StorageFile } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { File } from "lucide-react";
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
          <div className="flex-1 overflow-y-auto">
            {filteredItems.map((item) => {
              const isSelected = selectedItem?.item.id === item.item.id;
              
              return (
                <div
                  key={item.item.id}
                  className={cn(
                    "grid grid-cols-12 gap-2 px-4 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => onSelect?.(item)}
                >
                  <div className="col-span-6 flex items-center gap-2">
                    <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.item.name}</span>
                  </div>
                  <div className="col-span-2 text-muted-foreground">
                    {item.type === 'file' ? formatFileSize((item.item as StorageFile).size) : '-'}
                  </div>
                  <div className="col-span-4 text-muted-foreground">
                    {formatDistanceToNow(item.item.modifiedAt, { 
                      addSuffix: true,
                      locale: de 
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 