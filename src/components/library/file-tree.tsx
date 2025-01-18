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
  loadedChildren: Record<string, StorageItem[]>;
  parentId?: string;
}

// TreeItem Komponente
function TreeItem({
  item,
  children,
  onExpand,
  onSelect,
  selectedId,
  level,
  loadedChildren,
  parentId
}: TreeItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleClick = async () => {
    if (item.type === 'folder') {
      if (!isExpanded) {
        // Expanding folder
        await onExpand(item.id);
        setIsExpanded(true);
        onSelect(item);
      } else {
        // Collapsing folder - select parent folder or root
        setIsExpanded(false);
        if (parentId) {
          // If we have a parent, select it
          const parentItem: StorageItem = {
            id: parentId,
            type: 'folder',
            metadata: {
              name: '',
              size: 0,
              modifiedAt: new Date(),
              mimeType: 'folder'
            },
            parentId: ''
          };
          onSelect(parentItem);
        } else {
          // If no parent (root level), select root
          const rootItem: StorageItem = {
            id: 'root',
            type: 'folder',
            metadata: {
              name: '',
              size: 0,
              modifiedAt: new Date(),
              mimeType: 'folder'
            },
            parentId: ''
          };
          onSelect(rootItem);
        }
      }
    }
  };

  // Get children from loadedChildren if available
  const currentChildren = loadedChildren[item.id] || children;

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
      {isExpanded && currentChildren.map((child) => (
        <TreeItem
          key={child.id}
          item={child}
          children={[]}
          onExpand={onExpand}
          onSelect={onSelect}
          selectedId={selectedId}
          level={level + 1}
          loadedChildren={loadedChildren}
          parentId={item.id}
        />
      ))}
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
            children={[]}
            onExpand={handleExpand}
            onSelect={onSelect}
            selectedId={currentFolderId}
            level={0}
            loadedChildren={loadedChildren}
          />
        ))
      )}
    </div>
  );
} 