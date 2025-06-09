'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Folder } from "lucide-react"
import { StorageProvider, StorageItem, StorageError } from '@/lib/storage/types';
import { cn } from "@/lib/utils"
import { useAtom } from 'jotai';
import { currentFolderIdAtom, activeLibraryIdAtom } from '@/atoms/library-atom';
import { StorageAuthButton } from "../shared/storage-auth-button";
import { useStorage, isStorageError } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { toast } from 'sonner';

interface FileTreeProps {
  provider: StorageProvider | null;
  onSelectAction: (item: StorageItem) => void;
  libraryName?: string;
  onRefreshItems?: () => void;
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
  onMoveItem?: (itemId: string, targetFolderId: string) => Promise<void>;
  onRefreshItems?: () => void;
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
  parentId,
  onMoveItem,
  onRefreshItems
}: TreeItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);

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

  // Handler für Drag Over
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  // Handler für Drag Leave
  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    // Prüfe ob wir wirklich das Element verlassen (nicht nur ein Kind-Element)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  // Handler für Drop
  const handleDrop = React.useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      // Prüfe ob es eine FileGroup ist
      if (data.isFileGroup && data.items) {
        // Verschiebe alle Dateien der Gruppe
        const failedItems: string[] = [];
        const successItems: string[] = [];
        
        for (const itemData of data.items) {
          // Verhindere das Verschieben in sich selbst oder in den gleichen Ordner
          if (itemData.itemId === item.id || itemData.parentId === item.id) {
            continue;
          }
          
          try {
            if (onMoveItem) {
              await onMoveItem(itemData.itemId, item.id);
              successItems.push(itemData.itemName);
            }
          } catch (error) {
            console.error(`Fehler beim Verschieben von ${itemData.itemName}:`, error);
            
            // Spezifische Fehlermeldung für "Name already exists"
            let errorMessage = itemData.itemName;
            if (error instanceof Error) {
              if (error.message.includes('already exists') || error.message.includes('Name already exists')) {
                errorMessage = `${itemData.itemName} (existiert bereits im Zielordner)`;
              } else {
                errorMessage = `${itemData.itemName} (${error.message})`;
              }
            }
            failedItems.push(errorMessage);
          }
        }
        
        // Zeige entsprechende Meldung
        if (failedItems.length > 0 && successItems.length > 0) {
          // Teilweise erfolgreich
          toast.warning("Teilweise verschoben", {
            description: `${successItems.length} Datei(en) verschoben. Fehler bei: ${failedItems.join(', ')}`
          });
          // Aktualisiere die Dateiliste auch bei teilweisem Erfolg
          if (onRefreshItems && successItems.length > 0) {
            onRefreshItems();
          }
        } else if (failedItems.length > 0) {
          // Komplett fehlgeschlagen
          toast.error("Fehler beim Verschieben", {
            description: `Dateien konnten nicht verschoben werden: ${failedItems.join(', ')}`
          });
        } else if (data.items.length > 1) {
          // Komplett erfolgreich (Gruppe)
          toast.success("Dateigruppe verschoben", {
            description: `${data.items.length} zusammengehörige Dateien wurden erfolgreich verschoben.`
          });
          // Aktualisiere die Dateiliste
          if (onRefreshItems) {
            onRefreshItems();
          }
        } else {
          // Komplett erfolgreich (einzelne Datei)
          toast.success("Datei verschoben", {
            description: "Die Datei wurde erfolgreich verschoben."
          });
          // Aktualisiere die Dateiliste
          if (onRefreshItems) {
            onRefreshItems();
          }
        }
      } else if (data.items && data.items.length > 0) {
        // Fallback für einzelne Datei (neues Format)
        const itemData = data.items[0];
        
        // Verhindere das Verschieben in sich selbst oder in den gleichen Ordner
        if (itemData.itemId === item.id || itemData.parentId === item.id) {
          return;
        }

        // Rufe die Move-Funktion auf
        if (onMoveItem) {
          try {
            await onMoveItem(itemData.itemId, item.id);
            toast.success("Datei verschoben", {
              description: "Die Datei wurde erfolgreich verschoben."
            });
            // Aktualisiere die Dateiliste
            if (onRefreshItems) {
              onRefreshItems();
            }
          } catch (error) {
            console.error('Fehler beim Verschieben:', error);
            
            // Spezifische Fehlermeldung
            let errorMessage = "Die Datei konnte nicht verschoben werden";
            if (error instanceof Error) {
              if (error.message.includes('already exists') || error.message.includes('Name already exists')) {
                errorMessage = `Eine Datei mit dem Namen "${itemData.itemName}" existiert bereits im Zielordner`;
              } else {
                errorMessage = error.message;
              }
            }
            
            toast.error("Fehler beim Verschieben", {
              description: errorMessage
            });
          }
        }
      } else {
        // Legacy-Format für Abwärtskompatibilität
        // Verhindere das Verschieben in sich selbst oder in den gleichen Ordner
        if (data.itemId === item.id || data.parentId === item.id) {
          return;
        }

        // Rufe die Move-Funktion auf
        if (onMoveItem) {
          try {
            await onMoveItem(data.itemId, item.id);
            toast.success("Datei verschoben", {
              description: "Die Datei wurde erfolgreich verschoben."
            });
            // Aktualisiere die Dateiliste
            if (onRefreshItems) {
              onRefreshItems();
            }
          } catch (error) {
            console.error('Fehler beim Verschieben:', error);
            
            // Spezifische Fehlermeldung
            let errorMessage = "Die Datei konnte nicht verschoben werden";
            if (error instanceof Error) {
              if (error.message.includes('already exists') || error.message.includes('Name already exists')) {
                errorMessage = "Eine Datei mit diesem Namen existiert bereits im Zielordner";
              } else {
                errorMessage = error.message;
              }
            }
            
            toast.error("Fehler beim Verschieben", {
              description: errorMessage
            });
          }
        }
      }
    } catch (error) {
      console.error('Fehler beim Verschieben der Datei:', error);
    }
  }, [item.id, onMoveItem]);

  // Get children from loadedChildren if available
  const currentChildren = loadedChildren[item.id] || children;

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-1 px-2 hover:bg-accent cursor-pointer transition-colors",
          selectedId === item.id && "bg-accent",
          level === 0 && "rounded-sm",
          isDragOver && "bg-primary/20 ring-2 ring-primary"
        )}
        style={{ paddingLeft: level * 12 + 4 }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
          onMoveItem={onMoveItem}
          onRefreshItems={onRefreshItems}
        />
      ))}
    </div>
  );
}

export function FileTree({
  provider,
  onSelectAction,
  libraryName = "/",
  onRefreshItems
}: FileTreeProps) {
  const { currentLibrary, libraryStatus } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [rootItems, setRootItems] = React.useState<StorageItem[]>([]);
  const [loadedChildren, setLoadedChildren] = React.useState<Record<string, StorageItem[]>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Globales Atom für das aktuelle Verzeichnis verwenden
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  
  // Referenz für die letzte Provider-ID, um Änderungen zu verfolgen
  const previousProviderIdRef = React.useRef<string | null>(null);
  
  // Referenz für den letzten Library-Status
  const previousLibraryStatusRef = React.useRef<string | null>(null);
  
  // Referenz für die letzte Anfrage, um veraltete Antworten zu verwerfen
  const lastRequestRef = React.useRef<number>(0);
  
  // Provider ID für Vergleiche extrahieren
  const providerId = React.useMemo(() => provider?.id || null, [provider]);
  
  // Funktion zum Laden der Root-Elemente, jetzt ausgelagert für expliziten Aufruf
  const loadRootItems = React.useCallback(async (currentProvider: StorageProvider) => {
    if (!currentProvider) return;
    
    // Prüfe zuerst den Library-Status
    if (libraryStatus !== 'ready') {
      console.log('FileTree: Überspringe Laden - Library ist nicht bereit', { status: libraryStatus });
      setRootItems([]);
      return;
    }
    
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
      // AUTH_REQUIRED Fehler nicht als Error setzen, da sie bereits in der UI behandelt werden
      if (!isStorageError(err) || err.code !== 'AUTH_REQUIRED') {
        setError(err instanceof Error ? err.message : String(err));
      }
      setRootItems([]); // Stelle sicher, dass wir keine alten Daten anzeigen
    } finally {
      if (requestId === lastRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [libraryStatus, onRefreshItems]);

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
    if (provider && libraryStatus === 'ready') {
      console.log('FileTree: Initial root items load for provider', { 
        providerId: provider.id, 
        providerName: provider.name,
        libraryStatus
      });
      loadRootItems(provider);
    } else {
      console.log('FileTree: Überspringe Initial-Load - Library nicht bereit', { 
        status: libraryStatus,
        hasProvider: !!provider 
      });
      setRootItems([]);
      setLoadedChildren({});
    }
  }, [provider, loadRootItems, libraryStatus]);

  // Reagiere auf Änderungen des Library-Status
  React.useEffect(() => {
    console.log('FileTree: Library-Status geändert', {
      vorheriger: previousLibraryStatusRef.current,
      aktueller: libraryStatus,
      providerVorhanden: !!provider
    });
    
    // Wenn der Status von "waitingForAuth" zu "ready" wechselt, lade neu
    if (previousLibraryStatusRef.current !== 'ready' && libraryStatus === 'ready' && provider) {
      console.log('FileTree: Library wurde bereit, lade Root-Items neu');
      loadRootItems(provider);
    }
    
    previousLibraryStatusRef.current = libraryStatus;
  }, [libraryStatus, provider, loadRootItems]);

  // Handler für Expand-Click
  const handleExpand = async (folderId: string) => {
    if (loadedChildren[folderId]) return; // Bereits geladen
    
    // Prüfe Library-Status
    if (libraryStatus !== 'ready') {
      console.log('FileTree: Überspringe Expand - Library ist nicht bereit', { status: libraryStatus });
      return;
    }
    
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
      // AUTH_REQUIRED Fehler nicht loggen, da sie bereits in der UI behandelt werden
      if (!isStorageError(error) || error.code !== 'AUTH_REQUIRED') {
        console.error('Failed to load children:', error);
      }
    }
  };

  // Handler für Move Item
  const handleMoveItem = React.useCallback(async (itemId: string, targetFolderId: string) => {
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Verschiebe das Item
      await provider.moveItem(itemId, targetFolderId);
      
      // Keine Erfolgsmeldung hier, da sie vom Drop-Handler verwaltet wird
      
      // Aktualisiere die Dateiliste
      if (onRefreshItems) {
        onRefreshItems();
      }
      
      // Lade den Zielordner neu, um die verschobene Datei anzuzeigen
      if (loadedChildren[targetFolderId]) {
        const children = await provider.listItemsById(targetFolderId);
        if (children) {
          const folderChildren = children
            .filter(item => item.type === 'folder')
            .filter(item => !item.metadata.name.startsWith('.'))
            .sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
            
          setLoadedChildren(prev => ({
            ...prev,
            [targetFolderId]: folderChildren
          }));
        }
      }
    } catch (error) {
      console.error('Fehler beim Verschieben:', error);
      // Fehler wird nach oben weitergegeben für bessere Behandlung
      throw error;
    }
  }, [provider, onRefreshItems, loadedChildren]);

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
    <div className="absolute inset-0 overflow-y-auto p-2">
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
            onMoveItem={handleMoveItem}
            onRefreshItems={onRefreshItems}
          />
        ))
      )}
    </div>
  );
} 