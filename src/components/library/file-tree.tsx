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
  activeLibraryIdAtom,
  folderItemsAtom,
  currentFolderIdAtom,
  libraryAtom
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
  currentFolderId?: string;
}

// TreeItem Komponente
function TreeItem({
  item,
  level,
  onMoveItem,
  currentFolderId
}: TreeItemProps) {
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [loadedChildren, setLoadedChildren] = useAtom(loadedChildrenAtom);
  const libraryState = useAtomValue(libraryAtom);
  const { provider, listItems } = useStorage();
  const navigateToFolder = useFolderNavigation();
  const itemRef = React.useRef<HTMLDivElement>(null);

  // Ordner erweitern
  const handleExpand = useCallback(async (folderId: string) => {
    if (!provider) return;
    
    try {
      // Ordnerinhalt laden, wenn noch nicht geladen
      if (!loadedChildren[folderId]) {
        // PERFORMANCE-OPTIMIERUNG: Verwende Cache statt API-Call wenn möglich
        const cachedFolder = libraryState.folderCache?.[folderId];
        if (cachedFolder && cachedFolder.children) {
          // Verwende Cache-Inhalt
          setLoadedChildren(prev => ({
            ...prev,
            [folderId]: cachedFolder.children || []
          }));
          UILogger.debug('FileTree', 'Ordner für Expand aus Cache geladen', {
            folderId,
            itemCount: cachedFolder.children.length
          });
        } else {
          // PERFORMANCE-OPTIMIERUNG: Verwende listItems für Deduplizierung
          const items = await listItems(folderId);
          setLoadedChildren(prev => ({
            ...prev,
            [folderId]: items
          }));
        }
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
  }, [provider, loadedChildren, libraryState.folderCache, listItems, setLoadedChildren, setExpandedFolders]);

  // Element auswählen
  const handleSelect = useCallback((item: StorageItem) => {
    setSelectedFile(item);
    if (item.type === 'folder') {
      navigateToFolder(item.id);
    }
  }, [setSelectedFile, navigateToFolder]);

  const isExpanded = expandedFolders.has(item.id);
  const isSelected = selectedFile?.id === item.id;
  const isCurrentFolder = currentFolderId === item.id;
  const children = (loadedChildren[item.id] || []).filter(child => {
    if (child.type !== 'folder') return false;
    const name = child.metadata?.name || '';
    return !name.startsWith('.');
  });

  // Scroll zum aktuellen Ordner, wenn er dieser Item ist
  React.useEffect(() => {
    if (isCurrentFolder && itemRef.current) {
      // Warte kurz, damit der Tree gerendert ist
      setTimeout(() => {
        try {
          itemRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
          });
        } catch (error) {
          // Ignoriere Scroll-Fehler
          console.debug('[FileTree] Scroll-Fehler ignoriert:', error);
        }
      }, 100);
    }
  }, [isCurrentFolder]);

  return (
    <div 
      ref={itemRef}
      data-folder-id={item.id}
      className={cn(
        "px-2 py-1 cursor-pointer hover:bg-accent rounded-md transition-colors",
        isSelected && "bg-accent",
        isCurrentFolder && "bg-primary/20"
      )}
    >
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
          currentFolderId={currentFolderId}
        />
      ))}
    </div>
  );
}

// FileTree Hauptkomponente
export const FileTree = forwardRef<FileTreeRef, object>(function FileTree({
}, forwardedRef) {
  const { provider, listItems } = useStorage();
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);
  const [loadedChildren, setLoadedChildren] = useAtom(loadedChildrenAtom);
  const [isReady, setFileTreeReady] = useAtom(fileTreeReadyAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [, setSelectedFile] = useAtom(selectedFileAtom);
  const folderItems = useAtomValue(folderItemsAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const libraryState = useAtomValue(libraryAtom);
  
  // Refs um aktuelle Werte im Timeout zu prüfen (Closure-Problem vermeiden)
  const loadedChildrenRef = React.useRef(loadedChildren);
  const isReadyRef = React.useRef(isReady);
  React.useEffect(() => {
    loadedChildrenRef.current = loadedChildren;
    isReadyRef.current = isReady;
  }, [loadedChildren, isReady]);

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

  // Root-Items laden (nur als Fallback wenn folderItemsAtom leer bleibt)
  const loadRootItems = useCallback(async () => {
    if (!provider) return;
    
    // Wenn folderItemsAtom bereits Root-Items enthält (unabhängig von currentFolderId), verwende diese
    // Dies ist wichtig, wenn direkt zu einem Unterverzeichnis navigiert wird
    if (folderItems && folderItems.length > 0 && currentFolderId === 'root') {
      FileLogger.debug('FileTree', 'Verwende Root-Items aus folderItemsAtom', {
        itemCount: folderItems.length,
        currentFolderId
      });
      setLoadedChildren(prev => ({
        ...prev,
        root: folderItems
      }));
      if (!isReady) {
        setFileTreeReady(true);
      }
      return;
    }
    
    // Auch wenn currentFolderId nicht 'root' ist, aber folderItemsAtom Root-Items enthält,
    // verwende diese für den FileTree (Root-Items werden immer benötigt)
    if (folderItems && folderItems.length > 0 && currentFolderId !== 'root') {
      // Prüfe ob folderItemsAtom tatsächlich Root-Items enthält (nicht die Items des aktuellen Ordners)
      // Dies ist der Fall, wenn folderItemsAtom gesetzt ist, aber currentFolderId nicht 'root'
      // In diesem Fall sind folderItems die Items des aktuellen Ordners, nicht Root-Items
      // Daher müssen wir Root-Items separat laden, aber nur wenn sie noch nicht geladen sind
      const hasRootItems = loadedChildren.root && loadedChildren.root.length > 0;
      if (hasRootItems) {
        // Root-Items bereits geladen, nichts tun
        return;
      }
    }
    
    // Fallback: Eigener API-Call nur wenn folderItemsAtom leer ist UND bereits ein Timeout vergangen ist
    // (gibt Library Zeit, die Items zu laden)
    // Verwende listItems aus StorageContext (hat Request-Deduplizierung)
    try {
      const items = await listItems('root');
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
  }, [provider, listItems, setLoadedChildren, isReady, setFileTreeReady, currentFolderId, folderItems, loadedChildren.root]);

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
          // PERFORMANCE-OPTIMIERUNG: Verwende listItems für Deduplizierung
          const items = await listItems(currentPath);
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
  }), [provider, listItems, setLoadedChildren, setExpandedFolders, loadRootItems]);

  // Reagiere auf folderItemsAtom-Änderungen (wenn Library Root-Items lädt)
  // WICHTIG: Läuft auch wenn isReady noch false ist, damit FileTree die Items übernimmt bevor der Timeout läuft
  useEffect(() => {
    if (!provider) return;
    
    // Wenn currentFolderId === 'root' und folderItemsAtom Root-Items enthält, verwende diese
    if (currentFolderId === 'root' && folderItems && folderItems.length > 0) {
      const currentRootItems = loadedChildren.root;
      // Nur aktualisieren wenn sich die Items geändert haben oder noch nicht geladen
      if (!currentRootItems || currentRootItems.length !== folderItems.length) {
        UILogger.debug('FileTree', 'Root-Items aus folderItemsAtom übernommen', {
          itemCount: folderItems.length,
          hadPreviousItems: !!currentRootItems,
          isReady
        });
        setLoadedChildren(prev => ({
          ...prev,
          root: folderItems
        }));
        if (!isReady) {
          setFileTreeReady(true);
        }
      }
    }
  }, [provider, isReady, currentFolderId, folderItems, loadedChildren.root, setLoadedChildren, setFileTreeReady]);

  // Initial laden - nur wenn folderItemsAtom nach kurzer Wartezeit noch leer ist
  useEffect(() => {
    if (!provider || isReady) return;
    
    // Wenn folderItemsAtom bereits Root-Items enthält, verwende diese sofort
    if (currentFolderId === 'root' && folderItems && folderItems.length > 0) {
      UILogger.debug('FileTree', 'Root-Items bereits in folderItemsAtom vorhanden (initial)', {
        itemCount: folderItems.length
      });
      setLoadedChildren(prev => ({
        ...prev,
        root: folderItems
      }));
      setFileTreeReady(true);
      return;
    }
    
    // Warte kurz (1000ms), damit Library Zeit hat, die Items zu laden
    // Der folderItemsAtom-Änderungs-useEffect wird die Items übernehmen, wenn sie geladen sind
    // Dieser Timeout ist nur ein Fallback, falls Library die Items nicht innerhalb von 1s lädt
    const timeoutId = setTimeout(() => {
      // Prüfe ob Root-Items bereits geladen wurden (entweder durch folderItemsAtom oder direkt)
      // Verwende Refs um aktuelle Werte zu bekommen (Closure-Problem vermeiden)
      const currentLoadedChildren = loadedChildrenRef.current;
      const currentIsReady = isReadyRef.current;
      const hasRootItems = currentLoadedChildren.root && currentLoadedChildren.root.length > 0;
      
      // Wenn Root-Items bereits geladen sind, nichts tun
      if (hasRootItems || currentIsReady) {
        UILogger.debug('FileTree', 'Root-Items bereits geladen, überspringe Fallback', {
          hasRootItems,
          isReady: currentIsReady,
          rootItemsCount: currentLoadedChildren.root?.length
        });
        return;
      }
      
      // Prüfe nochmal ob folderItemsAtom jetzt gefüllt ist
      if (currentFolderId === 'root' && folderItems && folderItems.length > 0) {
        // folderItemsAtom wurde gefüllt, aber useEffect hat nicht reagiert - manuell übernehmen
        UILogger.debug('FileTree', 'Root-Items in folderItemsAtom gefunden (timeout check)', {
          itemCount: folderItems.length
        });
        setLoadedChildren(prev => ({
          ...prev,
          root: folderItems
        }));
        setFileTreeReady(true);
      } else {
        // Fallback: Eigener API-Call nur wenn immer noch keine Items vorhanden
        // ABER: Nur wenn currentFolderId === 'root' (sonst brauchen wir Root-Items nicht sofort)
        if (currentFolderId === 'root') {
          UILogger.info('FileTree', 'Starting root load (fallback after timeout)', {
            hasProvider: !!provider,
            isReady,
            hasFolderItems: !!(folderItems && folderItems.length > 0),
            hasLoadedChildren: !!(loadedChildren.root && loadedChildren.root.length > 0)
          });
          loadRootItems();
        } else {
          // Wenn currentFolderId !== 'root', brauchen wir Root-Items nicht sofort
          // Sie werden geladen, wenn der Benutzer zum Root navigiert
          UILogger.debug('FileTree', 'Skipping root load (not at root, will load on demand)', {
            currentFolderId
          });
        }
      }
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [provider, loadRootItems, isReady, currentFolderId, folderItems, setLoadedChildren, setFileTreeReady, loadedChildren.root]);

  // Nach externem Refresh betroffene Ordner neu laden
  useEffect(() => {
    if (!provider) return;
    const onRefresh = async (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { folderId?: string } | undefined;
        const folderId = detail?.folderId || 'root';
        // PERFORMANCE-OPTIMIERUNG: Verwende listItems für Deduplizierung
        const items = await listItems(folderId);
        setLoadedChildren(prev => ({ ...prev, [folderId]: items }));
      } catch (err) {
        FileLogger.warn('FileTree', 'library_refresh handling failed', { err: String(err) });
      }
    };
    window.addEventListener('library_refresh', onRefresh as unknown as EventListener);
    return () => window.removeEventListener('library_refresh', onRefresh as unknown as EventListener);
  }, [provider, listItems, setLoadedChildren]);

  // Reset wenn sich die Library ändert
  useEffect(() => {
    if (!provider) {
      setFileTreeReady(false);
    }
  }, [provider, setFileTreeReady]);

  // Automatisch Pfad erweitern wenn currentFolderId sich ändert (z.B. durch Navigation in FileList)
  useEffect(() => {
    if (!provider || !isReady || currentFolderId === 'root') return;
    
    const folderCache = libraryState.folderCache || {};
    if (!folderCache || Object.keys(folderCache).length === 0) {
      // Cache noch nicht gefüllt - warte auf Cache-Update
      UILogger.debug('FileTree', 'Cache noch leer, warte auf Cache-Update', {
        currentFolderId
      });
      return;
    }
    
    // Pfad zum aktuellen Ordner konstruieren
    const path: string[] = [];
    let currentId = currentFolderId;
    
    while (currentId && currentId !== 'root') {
      const folder = folderCache[currentId];
      if (!folder) {
        // Ordner nicht im Cache - kann nicht erweitert werden
        UILogger.debug('FileTree', 'Ordner nicht im Cache, kann Pfad nicht erweitern', {
          currentId,
          currentFolderId,
          cacheKeys: Object.keys(folderCache)
        });
        return;
      }
      path.unshift(currentId);
      currentId = folder.parentId;
    }
    
    // Prüfe, ob alle Ordner im Pfad bereits erweitert sind
    const currentExpanded = expandedFolders;
    const allExpanded = path.every(folderId => currentExpanded.has(folderId));
    if (allExpanded) {
      // Pfad bereits erweitert - nichts zu tun
      UILogger.debug('FileTree', 'Pfad bereits erweitert', {
        currentFolderId,
        pathLength: path.length
      });
      return;
    }
    
    // Alle Ordner im Pfad erweitern und laden
    const expandPath = async () => {
      for (const folderId of path) {
        // Ordner erweitern (nur wenn noch nicht erweitert)
        if (!currentExpanded.has(folderId)) {
          setExpandedFolders(prev => {
            const newSet = new Set(prev);
            newSet.add(folderId);
            return newSet;
          });
        }
        
        // Ordnerinhalt laden, wenn noch nicht geladen
              if (!loadedChildren[folderId]) {
                try {
                  // PERFORMANCE-OPTIMIERUNG: Verwende Cache statt API-Call wenn möglich
                  const cachedFolder = folderCache[folderId];
                  if (cachedFolder && cachedFolder.children) {
                    // Verwende Cache-Inhalt
                    setLoadedChildren(prev => ({
                      ...prev,
                      [folderId]: cachedFolder.children || []
                    }));
                    UILogger.debug('FileTree', 'Ordner für Pfad-Erweiterung aus Cache geladen', {
                      folderId,
                      itemCount: cachedFolder.children.length
                    });
                  } else {
                    // Fallback: API-Call nur wenn nicht im Cache
                    const items = await provider.listItemsById(folderId);
                    setLoadedChildren(prev => ({
                      ...prev,
                      [folderId]: items
                    }));
                    UILogger.debug('FileTree', 'Ordner für Pfad-Erweiterung geladen', {
                      folderId,
                      itemCount: items.length
                    });
                  }
                } catch (error) {
                  FileLogger.error('FileTree', 'Fehler beim Laden des Ordners für Pfad-Erweiterung', {
                    folderId,
                    error
                  });
                }
              }
      }
      
      UILogger.info('FileTree', 'Pfad automatisch erweitert', {
        currentFolderId,
        pathLength: path.length,
        expandedFolders: path
      });
      
      // Nach dem Erweitern zum aktuellen Ordner scrollen
      // Warte etwas länger, damit der Tree gerendert ist
      setTimeout(() => {
        const tryScroll = (attempts = 0) => {
          const element = document.querySelector(`[data-folder-id="${currentFolderId}"]`) as HTMLElement | null;
          if (element && element.parentElement && element.parentElement.contains(element)) {
            try {
              element.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
              });
              UILogger.debug('FileTree', 'Zum aktuellen Ordner gescrollt', {
                currentFolderId,
                attempts
              });
            } catch (error) {
              console.debug('[FileTree] Scroll-Fehler ignoriert:', error);
            }
          } else if (attempts < 5) {
            // Versuche es nochmal nach kurzer Verzögerung
            setTimeout(() => tryScroll(attempts + 1), 200);
          }
        };
        tryScroll();
      }, 300);
    };
    
    expandPath();
  }, [provider, isReady, currentFolderId, libraryState.folderCache, expandedFolders, setExpandedFolders, setLoadedChildren, loadedChildren]);

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
          currentFolderId={currentFolderId}
        />
      ))}
    </div>
  );
});

// Setze den Display-Namen für DevTools
FileTree.displayName = 'FileTree'; 