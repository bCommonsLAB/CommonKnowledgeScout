'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight } from "lucide-react"
import { StorageItem } from '@/lib/storage/types';
import { cn } from "@/lib/utils"
import { useAtom } from 'jotai';
import { useAtomValue } from 'jotai';
import { 
  fileTreeReadyAtom, 
  loadedChildrenAtom,
  expandedFoldersAtom,
  selectedFileAtom,
  activeLibraryIdAtom
} from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { FileLogger, UILogger } from "@/lib/debug/logger"
import { useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { useFolderNavigation } from '@/hooks/use-folder-navigation';
import { toast } from "sonner";

// Ref-Interface für externe Steuerung
export interface FileTreeRef {
  refresh: () => Promise<void>;
  expandToItem: (itemId: string) => Promise<void>;
}

// Props für einzelne Tree-Items
interface TreeItemProps {
  item: StorageItem;
  level: number;
  onMoveItem?: (itemId: string, targetFolderId: string) => Promise<void>;
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
    }
  }, [setSelectedFile, navigateToFolder]);

  const isExpanded = expandedFolders.has(item.id);
  const isSelected = selectedFile?.id === item.id;
  const children = (loadedChildren[item.id] || []).filter(child => {
    if (child.type !== 'folder') return false;
    const name = child.metadata?.name || '';
    return !name.startsWith('.');
  });

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
export const FileTree = forwardRef<FileTreeRef, object>(function FileTree({
}, forwardedRef) {
  const { provider } = useStorage();
  const [, setExpandedFolders] = useAtom(expandedFoldersAtom);
  const [loadedChildren, setLoadedChildren] = useAtom(loadedChildrenAtom);
  const [isReady, setFileTreeReady] = useAtom(fileTreeReadyAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [, setSelectedFile] = useAtom(selectedFileAtom);

  // NEU: Reagieren auf Bibliothekswechsel
  React.useEffect(() => {
    if (activeLibraryId) {
      // Bei Bibliothekswechsel zurücksetzen
      setExpandedFolders(new Set(['root']));
      setLoadedChildren({});
      setFileTreeReady(false);
      setSelectedFile(null);
      
      FileLogger.info('FileTree', 'Bibliothek gewechselt - State zurückgesetzt', {
        libraryId: activeLibraryId
      });
    }
  }, [activeLibraryId, setExpandedFolders, setLoadedChildren, setFileTreeReady, setSelectedFile]);

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
      
      // Prüfe, ob es sich um einen spezifischen Bibliotheksfehler handelt
      if (error instanceof Error) {
        if (error.message.includes('konnte nicht gefunden werden') || 
            error.message.includes('ENOENT') ||
            error.message.includes('LibraryPathNotFoundError')) {
          // Zeige eine benutzerfreundliche Fehlermeldung
          console.warn('🚨 Bibliothek nicht gefunden:', error.message);
          toast.error(`Bibliothek nicht gefunden: ${error.message}`, {
            action: {
              label: 'Erneut versuchen',
              onClick: () => loadRootItems()
            }
          });
        } else if (error.message.includes('Keine Berechtigung')) {
          console.warn('🚨 Keine Berechtigung:', error.message);
          toast.error(`Keine Berechtigung: ${error.message}`, {
            action: {
              label: 'Erneut versuchen',
              onClick: () => loadRootItems()
            }
          });
        } else {
          // Generische Fehlermeldung für andere Fehler
          toast.error(`Fehler beim Laden der Bibliothek: ${error.message}`, {
            action: {
              label: 'Erneut versuchen',
              onClick: () => loadRootItems()
            }
          });
        }
      } else {
        toast.error('Unbekannter Fehler beim Laden der Bibliothek', {
          action: {
            label: 'Erneut versuchen',
            onClick: () => loadRootItems()
          }
        });
      }
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
  }), [provider, setLoadedChildren, setExpandedFolders, loadRootItems]);

  // Initial laden
  useEffect(() => {
    if (provider && !isReady) {
      UILogger.info('FileTree', 'Starting root load', {
        hasProvider: !!provider,
        isReady
      });
      loadRootItems();
    }
  }, [provider, loadRootItems, isReady]);

  // Nach externem Refresh betroffene Ordner neu laden
  useEffect(() => {
    if (!provider) return;
    const onRefresh = async (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { folderId?: string } | undefined;
        const folderId = detail?.folderId || 'root';
        const items = await provider.listItemsById(folderId);
        setLoadedChildren(prev => ({ ...prev, [folderId]: items }));
      } catch (err) {
        FileLogger.warn('FileTree', 'library_refresh handling failed', { err: String(err) });
      }
    };
    window.addEventListener('library_refresh', onRefresh as unknown as EventListener);
    return () => window.removeEventListener('library_refresh', onRefresh as unknown as EventListener);
  }, [provider, setLoadedChildren]);

  // Reset wenn sich die Library ändert
  useEffect(() => {
    if (!provider) {
      setFileTreeReady(false);
    }
  }, [provider, setFileTreeReady]);

  const items = (loadedChildren.root || []).filter(item => {
    if (item.type !== 'folder') return false;
    const name = item.metadata?.name || '';
    return !name.startsWith('.');
  });

  return (
    <div className="w-full flex flex-col">
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