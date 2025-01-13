'use client';

import * as React from 'react';
import { Folder, File } from 'lucide-react';
import { StorageProvider, StorageItem } from '@/lib/storage/types';
import { Tree } from '../ui/tree';

export interface FileTreeProps {
  provider: StorageProvider | null;
  onSelect?: (item: StorageItem) => void;
  currentPath?: string;
  libraryName?: string;
}

interface FileTreeItemProps {
  item: StorageItem;
  level?: number;
  onSelect?: (item: StorageItem) => void;
  currentPath?: string;
}

function FileTreeItem({ item, level = 0, onSelect, currentPath }: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [children, setChildren] = React.useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Expandiere den Pfad automatisch wenn er Teil des aktuellen Pfads ist
  React.useEffect(() => {
    if (currentPath && currentPath.startsWith(item.item.path) && item.item.path !== '/') {
      loadChildren();
      setIsExpanded(true);
    }
  }, [currentPath]);

  const loadChildren = async () => {
    if (!isExpanded && children.length === 0) {
      setIsLoading(true);
      try {
        const items = await item.provider.listItems(item.item.path);
        // Nur Ordner anzeigen und versteckte Dateien ausfiltern
        const folders = items
          .filter((i: StorageItem) => i.type === 'folder' && !i.item.name.startsWith('.'))
          // Provider zu jedem Item hinzufügen
          .map(child => ({
            ...child,
            provider: item.provider
          }));
        setChildren(folders);
      } catch (error) {
        console.error('Failed to load children:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClick = () => {
    if (item.type === 'folder') {
      loadChildren();
      setIsExpanded(!isExpanded);
    }
    onSelect?.(item);
  };

  // Bestimme das Icon basierend auf dem Item-Typ
  const icon = item.type === 'folder' ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />;

  return (
    <Tree.Item
      label={item.item.name}
      icon={icon}
      isExpanded={isExpanded}
      isSelected={item.item.path === currentPath}
      hasChildren={item.type === 'folder'}
      level={level}
      onClick={handleClick}
    >
      {!isLoading && children.map((child) => (
        <FileTreeItem
          key={child.item.path}
          item={child}
          level={level + 1}
          onSelect={onSelect}
          currentPath={currentPath}
        />
      ))}
    </Tree.Item>
  );
}

export function FileTree({ provider, onSelect, currentPath, libraryName }: FileTreeProps) {
  const [rootItems, setRootItems] = React.useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const loadRootItems = async () => {
      if (!provider) {
        setRootItems([]);
        return;
      }

      setIsLoading(true);
      try {
        const items = await provider.listItems('/');
        // Nur Ordner anzeigen und versteckte Dateien ausfiltern
        const folders = items
          .filter((i: StorageItem) => i.type === 'folder' && !i.item.name.startsWith('.'))
          // Provider zu jedem Item hinzufügen
          .map(item => ({
            ...item,
            provider // Provider-Referenz hinzufügen
          }));
        setRootItems(folders);
      } catch (error) {
        console.error('Failed to load root items:', error);
        setRootItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRootItems();
  }, [provider]);

  if (!provider) {
    return (
      <Tree.Root>
        <div className="p-2 text-sm text-muted-foreground">
          Kein Storage Provider verfügbar
        </div>
      </Tree.Root>
    );
  }

  return (
    <Tree.Root>
      {isLoading ? (
        <div className="p-2 text-sm text-muted-foreground">
          Lade Verzeichnisse...
        </div>
      ) : rootItems.length === 0 ? (
        <div className="p-2 text-sm text-muted-foreground">
          Keine Verzeichnisse gefunden
        </div>
      ) : (
        rootItems.map((item) => (
          <FileTreeItem
            key={item.item.path}
            item={item}
            onSelect={onSelect}
            currentPath={currentPath}
          />
        ))
      )}
    </Tree.Root>
  );
} 