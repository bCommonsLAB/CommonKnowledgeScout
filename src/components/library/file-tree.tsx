'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Folder, File } from "lucide-react"
import { StorageProvider, StorageItem } from '@/lib/storage/types';
import { cn } from "@/lib/utils"
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { 
  currentFolderIdAtom, 
  activeLibraryIdAtom, 
  fileTreeReadyAtom, 
  librariesAtom,
  loadedChildrenAtom,
  expandedFoldersAtom,
  selectedFileAtom
} from '@/atoms/library-atom';
import { StorageAuthButton } from "../shared/storage-auth-button";
import { useStorage, isStorageError } from '@/contexts/storage-context';
import { toast } from 'sonner';
import { NavigationLogger, StateLogger, FileLogger } from "@/lib/debug/logger"
import { useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Tree } from "@/components/ui/tree"
import { useFolderNavigation } from '@/hooks/use-folder-navigation';

// Ref-Interface für externe Steuerung
export interface FileTreeRef {
  refresh: () => Promise<void>;
  expandToItem: (itemId: string) => Promise<void>;
}

// Basis-Props für den FileTree
interface FileTreeProps {
  libraryName?: string;
}

// Props für einzelne Tree-Items
interface TreeItemProps {
  item: StorageItem;
  level: number;
  onMoveItem?: (itemId: string, targetFolderId: string) => Promise<void>;
}

interface TreeNode {
  id: string;
  name: string;
  children: StorageItem[];
  parent: string | null;
}

interface LoadedChildren {
  [key: string]: StorageItem[];
}

// TreeItem Komponente
function TreeItem({
  item,
  level,
  onMoveItem
}: TreeItemProps) {
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [loadedChildren, setLoadedChildren] = useAtom(loadedChildrenAtom);
  const [currentFolderId, setCurrentFolderId] = useAtom(currentFolderIdAtom);
  const { provider } = useStorage();
  const navigateToFolder = useFolderNavigation();

  // Ordner erweitern
  const handleExpand = useCallback(async (folderId: string) => {
    if (!provider) return;
    
    try {
      // Ordnerinhalt laden, wenn noch nicht geladen
      if (!loadedChildren[folderId]) {
        const items = await provider.listItemsById(folderId);
        setLoadedChildren(prev => ({
          ...prev,
          [folderId]: items
        }));
      }

      // Ordner als erweitert markieren
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(folderId)) {
          newSet.delete(folderId);
        } else {
          newSet.add(folderId);
        }
        return newSet;
      });
    } catch (error) {
      FileLogger.error('FileTree', 'Fehler beim Laden des Ordnerinhalts', error);
    }
  }, [provider, loadedChildren, setLoadedChildren, setExpandedFolders]);

  // Element auswählen
  const handleSelect = useCallback((item: StorageItem) => {
    setSelectedFile(item);
    if (item.type === 'folder') {
      navigateToFolder(item.id);
    } else {
      setCurrentFolderId(item.parentId);
    }
  }, [setSelectedFile, setCurrentFolderId, navigateToFolder]);

  const isExpanded = expandedFolders.has(item.id);
  const isSelected = selectedFile?.id === item.id;
  const children = (loadedChildren[item.id] || []).filter(child => child.type === 'folder');

  return (
    <div className={cn(
      "px-2 py-1 cursor-pointer hover:bg-accent rounded-md transition-colors",
      isSelected && "bg-accent"
    )}>
      <div 
        className="flex items-center gap-2"
        onClick={() => handleSelect(item)}
      >
        {/* Chevron-Button für Expand/Collapse */}
        <button
          className="p-0 mr-1 focus:outline-none"
          tabIndex={-1}
          aria-label={isExpanded ? "Zuklappen" : "Aufklappen"}
          onClick={e => {
            e.stopPropagation();
            handleExpand(item.id);
          }}
        >
          {isExpanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
        {/* Nur Ordnername anzeigen */}
        <span>{item.metadata.name}</span>
      </div>
      {isExpanded && children.map(child => (
        <TreeItem
          key={child.id}
          item={child}
          level={level + 1}
          onMoveItem={onMoveItem}
        />
      ))}
    </div>
  );
}

// FileTree Hauptkomponente
export const FileTree = forwardRef<FileTreeRef, FileTreeProps>(function FileTree({
  libraryName
}, forwardedRef) {
  const { provider, libraryStatus } = useStorage();
  const [loadedChildren, setLoadedChildren] = useAtom(loadedChildrenAtom);
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);
  const [isReady, setFileTreeReady] = useAtom(fileTreeReadyAtom);

  // Root-Items laden
  const loadRootItems = useCallback(async () => {
    if (!provider) return;
    
    try {
      const items = await provider.listItemsById('root');
      setLoadedChildren(prev => ({
        ...prev,
        root: items
      }));
      if (!isReady) {
        setFileTreeReady(true);
      }
    } catch (error) {
      FileLogger.error('FileTree', 'Fehler beim Laden der Root-Items', error);
    }
  }, [provider, setLoadedChildren, isReady, setFileTreeReady]);

  // Ref-Methoden
  useImperativeHandle(forwardedRef, () => ({
    refresh: loadRootItems,
    expandToItem: async (itemId: string) => {
      if (!provider) return;
      
      try {
        // Pfad zum Item laden
        const path = await provider.getPathById(itemId);
        const pathItems = path.split('/').filter(Boolean);
        
        // Alle Ordner im Pfad erweitern
        let currentPath = '';
        for (const segment of pathItems) {
          currentPath += '/' + segment;
          const items = await provider.listItemsById(currentPath);
          setLoadedChildren(prev => ({
            ...prev,
            [currentPath]: items
          }));
          setExpandedFolders(prev => new Set([...Array.from(prev), currentPath]));
        }
      } catch (error) {
        FileLogger.error('FileTree', 'Fehler beim Expandieren zum Item', error);
      }
    }
  }), [provider, setLoadedChildren, setExpandedFolders]);

  // Initial laden
  useEffect(() => {
    if (libraryStatus === 'ready' && provider && !isReady) {
      loadRootItems();
    }
  }, [libraryStatus, provider, loadRootItems, isReady]);

  // Reset wenn sich die Library ändert
  useEffect(() => {
    if (libraryStatus !== 'ready') {
      setFileTreeReady(false);
    }
  }, [libraryStatus, setFileTreeReady]);

  const items = (loadedChildren.root || []).filter(item => item.type === 'folder');

  return (
    <div className="w-full">
      {items.map(item => (
        <TreeItem
          key={item.id}
          item={item}
          level={0}
        />
      ))}
    </div>
  );
});

// Setze den Display-Namen für DevTools
FileTree.displayName = 'FileTree'; 