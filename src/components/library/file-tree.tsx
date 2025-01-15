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
  item: StorageItem
  level: number
  onSelect: (item: StorageItem) => void
  loadChildren: (item: StorageItem) => Promise<StorageItem[]>
  selectedId: string
}

/**
 * Individual tree item component that handles expansion and child loading.
 */
function TreeItem({
  item,
  level,
  onSelect,
  loadChildren,
  selectedId
}: TreeItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<StorageItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false)

  // Lade Kinder nur wenn expandiert und noch nicht geladen
  React.useEffect(() => {
    const load = async () => {
      if (isExpanded && !hasLoadedOnce && !isLoading) {
        setIsLoading(true)
        try {
          const items = await loadChildren(item)
          setChildren(items)
          setHasLoadedOnce(true)
        } catch (error) {
          console.error('Failed to load children:', error)
          setChildren([])
        } finally {
          setIsLoading(false)
        }
      }
    }

    load()
  }, [isExpanded, hasLoadedOnce, isLoading, item, loadChildren])

  const handleNodeClick = (e: React.MouseEvent) => {
    // Wenn auf den Chevron geklickt wurde, nur aufklappen
    const isChevronClick = (e.target as HTMLElement).closest('.chevron-button');
    if (isChevronClick) {
      setIsExpanded(!isExpanded);
    } else {
      // Ansonsten aufklappen und selektieren
      setIsExpanded(!isExpanded);
      onSelect(item);
    }
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-1 px-2 hover:bg-accent cursor-pointer",
          selectedId === item.id && "bg-accent",
          level === 0 && "rounded-sm"
        )}
        style={{ paddingLeft: level * 12 + 4 }}
        onClick={handleNodeClick}
      >
        <div className="chevron-button h-4 w-4 mr-1 hover:bg-accent-foreground/10 rounded">
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
          {isLoading ? (
            <div className="pl-9 py-1 text-sm text-muted-foreground">
              Lädt...
            </div>
          ) : children.length === 0 ? (
            <div className="pl-9 py-1 text-sm text-muted-foreground">
              Keine Unterordner
            </div>
          ) : (
            children.map((child) => (
              <TreeItem
                key={child.id}
                item={child}
                level={level + 1}
                onSelect={onSelect}
                loadChildren={loadChildren}
                selectedId={selectedId}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function FileTree({
  provider,
  onSelect,
  currentFolderId,
  libraryName = "/"
}: FileTreeProps) {
  const [items, setItems] = React.useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Lade Root-Verzeichnis
  React.useEffect(() => {
    const loadRootItems = async () => {
      if (!provider) {
        setItems([]);
        return;
      }

      setIsLoading(true);
      try {
        const rootItems = await provider.listItemsById('root');
        setItems(rootItems);
      } catch (error) {
        console.error('Failed to load root items:', error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRootItems();
  }, [provider]);

  // Lade Unterverzeichnisse
  const loadChildren = React.useCallback(async (item: StorageItem) => {
    if (!provider || item.type !== 'folder') return [];

    try {
      const children = await provider.listItemsById(item.id);
      return children
        .filter(item => item.type === 'folder')
        .filter(item => !item.metadata.name.startsWith('.'))
        .sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
    } catch (error) {
      console.error('Failed to load children:', error);
      return [];
    }
  }, [provider]);

  // Filter nur Ordner
  const folders = items
    .filter(item => item.type === 'folder')
    .filter(item => !item.metadata.name.startsWith('.'))
    .sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));

  return (
    <div className="overflow-auto p-2">
      {folders.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          Keine Ordner gefunden
        </div>
      ) : (
        folders.map((item) => (
          <TreeItem
            key={item.id}
            item={item}
            level={0}
            onSelect={onSelect}
            loadChildren={loadChildren}
            selectedId={currentFolderId}
          />
        ))
      )}
    </div>
  );
} 