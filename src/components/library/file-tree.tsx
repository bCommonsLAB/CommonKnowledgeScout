'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Folder } from "lucide-react"
import { StorageProvider, StorageItem, StorageError } from '@/lib/storage/types';
import { cn } from "@/lib/utils"
import { useAtom } from 'jotai';
import { currentFolderIdAtom, activeLibraryIdAtom } from '@/atoms/library-atom';
import { StorageAuthButton } from "../shared/storage-auth-button";
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';

interface FileTreeProps {
  provider: StorageProvider | null;
  onSelectAction: (item: StorageItem) => void;
  libraryName?: string;
}

interface TreeItemProps {
  item: StorageItem;
  children?: StorageItem[];
  onExpand: (folderId: string) => Promise<void>;
  onSelectAction: (item: StorageItem) => void;
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
  onSelectAction,
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
        onSelectAction(item);
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
          onSelectAction(parentItem);
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
          onSelectAction(rootItem);
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
          onExpand={onExpand}
          onSelectAction={onSelectAction}
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
  onSelectAction,
  libraryName = "/"
}: FileTreeProps) {
  const { currentLibrary } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [rootItems, setRootItems] = React.useState<StorageItem[]>([]);
  const [loadedChildren, setLoadedChildren] = React.useState<Record<string, StorageItem[]>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Globales Atom für das aktuelle Verzeichnis verwenden
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  
  // Referenz für die letzte Provider-ID, um Änderungen zu verfolgen
  const previousProviderIdRef = React.useRef<string | null>(null);
  
  // Referenz für die letzte Anfrage, um veraltete Antworten zu verwerfen
  const lastRequestRef = React.useRef<number>(0);
  
  // Provider ID für Vergleiche extrahieren
  const providerId = React.useMemo(() => provider?.id || null, [provider]);
  
  // Funktion zum Laden der Root-Elemente, jetzt ausgelagert für expliziten Aufruf
  const loadRootItems = React.useCallback(async (currentProvider: StorageProvider) => {
    if (!currentProvider) return;
    
    // Für Anfragenverfolgung
    const requestId = ++lastRequestRef.current;
    console.log(`FileTree: Starting root load (request #${requestId}) for provider ${currentProvider.id}`);
    
    setIsLoading(true);
    try {
      // Den Pfad explizit erfragen, um zu sehen, wohin die Anfrage geht
      try {
        const rootPath = await currentProvider.getPathById('root');
        console.log(`FileTree: Root path for provider ${currentProvider.id} is "${rootPath}", provider name: ${currentProvider.name}`);
      } catch (e) {
        // Fehlerbehandlung für Authentifizierungsfehler
        if (e instanceof StorageError && e.code === 'AUTH_REQUIRED') {
          // Auth-Fehler: Kein Logging, da zentral behandelt
        } else {
          console.warn('FileTree: Could not get root path:', e);
        }
      }
      
      const items = await currentProvider.listItemsById('root');
      
      // Prüfen, ob dies die aktuellste Anfrage ist
      if (requestId !== lastRequestRef.current) {
        console.log(`FileTree: Request #${requestId} obsolete, current is #${lastRequestRef.current}`);
        return;
      }
      
      console.log(`FileTree: Loaded ${items.length} root items for provider ${currentProvider.id}`, {
        itemNames: items.map(i => i.metadata.name).join(', ')
      });
      
      const filteredItems = items.filter(item => 
        item.type === 'folder' && 
        !item.metadata.name.startsWith('.')
      ).sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
      
      console.log(`FileTree: After filtering, ${filteredItems.length} folders remain`);
      setRootItems(filteredItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRootItems([]); // Stelle sicher, dass wir keine alten Daten anzeigen
    } finally {
      if (requestId === lastRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Debug-Logging für Provider-Wechsel
  React.useEffect(() => {
    console.log('FileTree: Provider geändert', {
      vorherigerId: previousProviderIdRef.current,
      aktuellerId: providerId,
      providerVorhanden: !!provider,
      libraryName,
      currentFolderId,
      zeitpunkt: new Date().toISOString()
    });
    
    // Prüfen, ob sich der Provider geändert hat
    if (providerId !== previousProviderIdRef.current) {
      console.log('FileTree: Provider-ID hat sich geändert, setze Zustand zurück');
      // Zustand zurücksetzen
      setRootItems([]);
      setLoadedChildren({});
      previousProviderIdRef.current = providerId;
      
      // Die Aktualisierungsreihenfolge ist wichtig - zuerst zurücksetzen, dann neu laden
      requestAnimationFrame(() => {
        console.log('FileTree: Triggerung forced reload after provider change');
        if (provider) {
          loadRootItems(provider);
        }
      });
    }
  }, [provider, providerId, libraryName, currentFolderId, loadRootItems]);

  // Lade nur erste Ebene beim Start oder durch explizites Signal
  React.useEffect(() => {
    if (provider) {
      console.log('FileTree: Initial root items load for provider', { 
        providerId: provider.id, 
        providerName: provider.name
      });
      loadRootItems(provider);
    } else {
      console.log('FileTree: No provider available, cannot load items');
      setRootItems([]);
      setLoadedChildren({});
    }
  }, [provider, loadRootItems]);

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

  // Fehlerbehandlung für OneDrive Auth
  const isOneDriveAuthError = provider?.name === 'OneDrive' && (error?.toLowerCase().includes('nicht authentifiziert') || error?.toLowerCase().includes('unauthorized'));

  React.useEffect(() => {
    // Logging der Library-IDs
    // eslint-disable-next-line no-console
    console.log('[FileTree] Render:', {
      propProvider: provider?.id,
      contextLibraryId: currentLibrary?.id,
      activeLibraryIdAtom: activeLibraryId
    });
  }, [provider, currentLibrary, activeLibraryId]);

  if (isOneDriveAuthError) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="mb-4 text-sm text-muted-foreground">Sie sind nicht bei OneDrive angemeldet.</p>
        <StorageAuthButton provider="onedrive" />
      </div>
    );
  }

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
            onExpand={handleExpand}
            onSelectAction={onSelectAction}
            selectedId={currentFolderId}
            level={0}
            loadedChildren={loadedChildren}
          />
        ))
      )}
    </div>
  );
} 