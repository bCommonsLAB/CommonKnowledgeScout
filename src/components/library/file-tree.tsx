'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Folder } from "lucide-react"
import { StorageProvider, StorageItem } from '@/lib/storage/types';
import { cn } from "@/lib/utils"

interface FileTreeProps {
  provider: StorageProvider | null;
  onSelect: (item: StorageItem) => void;
  currentFolderId: string;
  libraryName?: string;
}

interface TreeItemProps {
  item: StorageItem;
  children: StorageItem[];
  onExpand: (folderId: string) => Promise<void>;
  onSelect: (item: StorageItem) => void;
  selectedId: string;
  level: number;
}

// TreeItem Komponente
function TreeItem({
  item,
  children,
  onExpand,
  onSelect,
  selectedId,
  level
}: TreeItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleClick = async () => {
    if (item.type === 'folder') {
      if (!isExpanded) {
        await onExpand(item.id);
      }
      setIsExpanded(!isExpanded);
      onSelect(item);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-1 px-2 hover:bg-accent cursor-pointer",
          selectedId === item.id && "bg-accent",
          level === 0 && "rounded-sm"
        )}
        style={{ paddingLeft: level * 12 + 4 }}
        onClick={handleClick}
      >
        <div className="h-4 w-4 mr-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
        <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
        <span className="truncate text-sm">{item.metadata.name}</span>
      </div>
      {isExpanded && (
        <div>
          {children.length === 0 ? (
            <div className="pl-9 py-1 text-sm text-muted-foreground">
              Keine Unterordner
            </div>
          ) : (
            children.map((child) => (
              <TreeItem
                key={child.id}
                item={child}
                children={[]} // Leeres Array, da Kinder erst beim Aufklappen geladen werden
                onExpand={onExpand}
                onSelect={onSelect}
                selectedId={selectedId}
                level={level + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  provider,
  onSelect,
  currentFolderId,
  libraryName = "/"
}: FileTreeProps) {
  const [rootItems, setRootItems] = React.useState<StorageItem[]>([]);
  const [loadedChildren, setLoadedChildren] = React.useState<Record<string, StorageItem[]>>({});
  const [isLoading, setIsLoading] = React.useState(false);

  // Lade nur erste Ebene beim Start
  React.useEffect(() => {
    const loadRoot = async () => {
      if (!provider) return;
      setIsLoading(true);
      try {
        const items = await provider.listItemsById('root');
        setRootItems(items.filter(item => 
          item.type === 'folder' && 
          !item.metadata.name.startsWith('.')
        ));
      } catch (error) {
        console.error('Failed to load root:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadRoot();
  }, [provider]);

  // Handler für Expand-Click
  const handleExpand = async (folderId: string) => {
    if (loadedChildren[folderId]) return; // Bereits geladen
    
    try {
      const children = await provider?.listItemsById(folderId);
      if (children) {
        const folderChildren = children
          .filter(item => item.type === 'folder')
          .filter(item => !item.metadata.name.startsWith('.'))
          .sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
          
        setLoadedChildren(prev => ({
          ...prev,
          [folderId]: folderChildren
        }));
      }
    } catch (error) {
      console.error('Failed to load children:', error);
    }
  };

  return (
    <div className="overflow-auto p-2">
      {isLoading ? (
        <div className="text-sm text-muted-foreground">
          Lädt...
        </div>
      ) : rootItems.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          Keine Ordner gefunden
        </div>
      ) : (
        rootItems.map((item) => (
          <TreeItem
            key={item.id}
            item={item}
            children={loadedChildren[item.id] || []}
            onExpand={handleExpand}
            onSelect={onSelect}
            selectedId={currentFolderId}
            level={0}
          />
        ))
      )}
    </div>
  );
} 