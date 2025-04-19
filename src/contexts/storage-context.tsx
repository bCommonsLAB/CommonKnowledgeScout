"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { StorageProvider, StorageItem } from "@/lib/storage/types";
import { StorageFactory } from "@/lib/storage/storage-factory";
import { useAtom } from "jotai";
import { libraryAtom, activeLibraryIdAtom } from "@/atoms/library-atom";
import { ClientLibrary } from "@/types/library";

// Definition für den Cache-Store
interface CacheStore {
  [key: string]: any;
}

// Der Storage Context enthält alles, was Komponenten über Dateispeicher wissen müssen
interface StorageContextType {
  // Provider und Library-Informationen
  provider: StorageProvider | null;
  library: ClientLibrary | null;
  rootPath: string;
  isLoading: boolean;
  error: string | null;
  
  // Häufig benötigte Aktionen
  listItems: (folderId: string) => Promise<StorageItem[]>;
  getItem: (itemId: string) => Promise<StorageItem | null>;
  getPath: (itemId: string) => Promise<string>;
  refreshItems: (folderId: string) => Promise<StorageItem[]>;
  
  // Cache-Management
  invalidateCache: () => void;
}

// Standardwerte für den Context
const defaultContext: StorageContextType = {
  provider: null,
  library: null,
  rootPath: '/',
  isLoading: false,
  error: null,
  
  listItems: async () => [],
  getItem: async () => null,
  getPath: async () => '/',
  refreshItems: async () => [],
  
  invalidateCache: () => {}
};

// Context-Erstellung
const StorageContext = createContext<StorageContextType>(defaultContext);

// Typen für die Props des Providers
interface StorageProviderProps {
  children: ReactNode;
}

// Cache für Items, um doppelte Anfragen zu vermeiden
const itemsCache = new Map<string, StorageItem[]>();
const itemCache = new Map<string, StorageItem>();
const pathCache = new Map<string, string>();

/**
 * Der Storage-Provider kümmert sich um:
 * - Initialisierung des StorageProviders
 * - Caching von häufigen Abfragen
 * - Fehlerbehandlung
 * - Bereitstellung von Hilfsmethoden für Komponenten
 */
export const StorageContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [libraries, setLibraries] = useState<ClientLibrary[]>([]);
  const [provider, setProvider] = useState<StorageProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLibrary, setCurrentLibrary] = useState<ClientLibrary | null>(null);
  const [rootPath, setRootPath] = useState<string>('/');

  // Cache für API-Aufrufe
  const cache = useRef<CacheStore>({});
  
  // Funktion zum Zurücksetzen des Caches
  const invalidateCache = useCallback(() => {
    console.log('[StorageContext] Cache zurückgesetzt');
    cache.current = {};
  }, []);

  // Atom-Wert für die aktive Bibliothek
  const [activeLibraryId, setActiveLibraryAtom] = useAtom(activeLibraryIdAtom);

  // Provider initialisieren oder aktualisieren, wenn sich die aktive Bibliothek ändert
  useEffect(() => {
    if (!activeLibraryId || libraries.length === 0) {
      console.log('[StorageContext] Keine aktive Bibliothek oder keine verfügbaren Bibliotheken');
      return;
    }

    console.log(`[StorageContext] Aktive Bibliothek geändert: ${activeLibraryId}`);
    
    // Bibliothek finden
    const selectedLibrary = libraries.find(lib => lib.id === activeLibraryId);
    if (!selectedLibrary) {
      console.error(`[StorageContext] Bibliothek mit ID ${activeLibraryId} nicht gefunden`);
      return;
    }

    // Provider initialisieren
    setIsLoading(true);
    const factory = StorageFactory.getInstance();
    
    console.log(`[StorageContext] Initialisiere Provider für Bibliothek: ${selectedLibrary.label}`);
    
    factory.getProvider(activeLibraryId)
      .then(newProvider => {
        console.log(`[StorageContext] Provider initialisiert: ${newProvider.name}`);
        setProvider(newProvider);
        setCurrentLibrary(selectedLibrary);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(`[StorageContext] Fehler beim Initialisieren des Providers:`, err);
        setError(`Fehler beim Initialisieren des Providers: ${err.message}`);
        setProvider(null);
        setIsLoading(false);
      });
  }, [activeLibraryId, libraries]);

  // Bibliotheken aus der API laden
  useEffect(() => {
    console.log('[StorageContext] Lade Bibliotheken...');
    setIsLoading(true);
    
    fetch('/api/libraries')
      .then(res => {
        if (!res.ok) {
          // Explizite Prüfung auf Fehler-Statuscodes
          if (res.status === 404) {
            throw new Error(`API-Endpunkt nicht gefunden (404). Bitte prüfen, ob '/api/libraries' existiert.`);
          }
          throw new Error(`HTTP-Fehler: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data && Array.isArray(data)) {
          console.log('[StorageContext] Bibliotheken geladen:', data.length);
          setLibraries(data);
          
          // Setze StorageFactory Libraries
          const factory = StorageFactory.getInstance();
          factory.setLibraries(data);
          
          // Setze die erste Bibliothek als aktiv, falls noch keine ausgewählt ist
          if (data.length > 0) {
            const storedLibraryId = localStorage.getItem('activeLibraryId');
            
            // Prüfen, ob die gespeicherte ID existiert
            const validStoredId = storedLibraryId && data.some(lib => lib.id === storedLibraryId);
            
            if (validStoredId) {
              console.log(`[StorageContext] Gespeicherte Bibliothek wird verwendet: ${storedLibraryId}`);
              setActiveLibraryAtom(storedLibraryId);
              
              // Provider für diese Bibliothek initialisieren
              const selectedLibrary = data.find(lib => lib.id === storedLibraryId);
              if (selectedLibrary) {
                const factory = StorageFactory.getInstance();
                factory.getProvider(selectedLibrary.id)
                  .then(provider => {
                    console.log(`[StorageContext] Provider für ${selectedLibrary.label} initialisiert:`, provider.name);
                    setProvider(provider);
                  })
                  .catch(err => {
                    console.error(`[StorageContext] Fehler beim Initialisieren des Providers für ${selectedLibrary.label}:`, err);
                  });
              }
            } else {
              // Verwende die erste verfügbare Bibliothek, wenn keine gültige gespeichert ist
              const firstLibId = data[0].id;
              console.log(`[StorageContext] Setze erste Bibliothek als aktiv: ${firstLibId}`);
              setActiveLibraryAtom(firstLibId);
              localStorage.setItem('activeLibraryId', firstLibId);
              
              // Provider für diese Bibliothek initialisieren
              const selectedLibrary = data[0];
              if (selectedLibrary) {
                const factory = StorageFactory.getInstance();
                factory.getProvider(selectedLibrary.id)
                  .then(provider => {
                    console.log(`[StorageContext] Provider für ${selectedLibrary.label} initialisiert:`, provider.name);
                    setProvider(provider);
                  })
                  .catch(err => {
                    console.error(`[StorageContext] Fehler beim Initialisieren des Providers für ${selectedLibrary.label}:`, err);
                  });
              }
            }
          } else {
            console.warn('[StorageContext] Keine Bibliotheken verfügbar');
            setActiveLibraryAtom("");
            localStorage.removeItem('activeLibraryId');
            setProvider(null);
          }
        } else {
          console.error('[StorageContext] Ungültiges Format der Bibliotheksdaten:', data);
          setError('Fehler beim Laden der Bibliotheken: Ungültiges Format');
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error('[StorageContext] Fehler beim Laden der Bibliotheken:', err);
        setError(`Fehler beim Laden der Bibliotheken: ${err.message}`);
        setIsLoading(false);
        
        // Bei API-Fehlern die Anwendung in einen sicheren Zustand versetzen
        setActiveLibraryAtom("");
        localStorage.removeItem('activeLibraryId');
      });
  }, []);

  // Verzeichnisinhalte laden mit Caching
  const listItems = useCallback(async (folderId: string): Promise<StorageItem[]> => {
    // Aus Cache laden, wenn verfügbar
    const cacheKey = `${activeLibraryId}:${folderId}`;
    if (itemsCache.has(cacheKey)) {
      console.log(`[StorageContext] Cache-Treffer für Ordner: ${folderId}`);
      return itemsCache.get(cacheKey) || [];
    }
    
    if (!provider) {
      console.warn('[StorageContext] listItems: Provider nicht verfügbar');
      return [];
    }
    
    try {
      console.log(`[StorageContext] Lade Items für Ordner: ${folderId}`);
      setIsLoading(true);
      const items = await provider.listItemsById(folderId);
      
      // Ergebnisse cachen
      itemsCache.set(cacheKey, items);
      
      // Einzelne Items auch cachen
      items.forEach(item => {
        itemCache.set(`${activeLibraryId}:${item.id}`, item);
      });
      
      return items;
    } catch (error) {
      console.error("[StorageContext] Fehler beim Auflisten:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [provider, activeLibraryId]);
  
  // Items neu laden, Cache ignorieren
  const refreshItems = useCallback(async (folderId: string): Promise<StorageItem[]> => {
    if (!provider) {
      console.warn('[StorageContext] refreshItems: Provider nicht verfügbar');
      return [];
    }
    
    try {
      console.log(`[StorageContext] Aktualisiere Items für Ordner: ${folderId}`);
      setIsLoading(true);
      const items = await provider.listItemsById(folderId);
      
      // Cache aktualisieren
      const cacheKey = `${activeLibraryId}:${folderId}`;
      itemsCache.set(cacheKey, items);
      
      // Einzelne Items auch aktualisieren
      items.forEach(item => {
        itemCache.set(`${activeLibraryId}:${item.id}`, item);
      });
      
      return items;
    } catch (error) {
      console.error("[StorageContext] Fehler beim Aktualisieren:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [provider, activeLibraryId]);
  
  // Einzelnes Item abrufen mit Caching
  const getItem = useCallback(async (itemId: string): Promise<StorageItem | null> => {
    if (!provider) {
      console.warn('[StorageContext] getItem: Provider nicht verfügbar');
      return null;
    }
    
    // Aus Cache laden, wenn verfügbar
    const cacheKey = `${activeLibraryId}:${itemId}`;
    if (itemCache.has(cacheKey)) {
      console.log(`[StorageContext] Cache-Treffer für Item: ${itemId}`);
      return itemCache.get(cacheKey) || null;
    }
    
    try {
      console.log(`[StorageContext] Lade Item: ${itemId}`);
      setIsLoading(true);
      const item = await provider.getItemById(itemId);
      
      // Item cachen
      itemCache.set(cacheKey, item);
      
      return item;
    } catch (error) {
      console.error("[StorageContext] Fehler beim Laden des Items:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [provider, activeLibraryId]);
  
  // Pfad eines Items abrufen mit Caching
  const getPath = useCallback(async (itemId: string): Promise<string> => {
    if (!provider) {
      console.warn('[StorageContext] getPath: Provider nicht verfügbar');
      return '/';
    }
    
    // Aus Cache laden, wenn verfügbar
    const cacheKey = `${activeLibraryId}:path:${itemId}`;
    if (pathCache.has(cacheKey)) {
      console.log(`[StorageContext] Cache-Treffer für Pfad: ${itemId}`);
      return pathCache.get(cacheKey) || '/';
    }
    
    try {
      console.log(`[StorageContext] Lade Pfad für: ${itemId}`);
      const path = await provider.getPathById(itemId);
      
      // Pfad cachen
      pathCache.set(cacheKey, path);
      
      return path;
    } catch (error) {
      console.error("[StorageContext] Fehler bei Pfadauflösung:", error);
      return '/';
    }
  }, [provider, activeLibraryId]);
  
  // Context-Wert erstellen
  const contextValue: StorageContextType = {
    provider,
    library: currentLibrary,
    rootPath,
    isLoading,
    error,
    
    listItems,
    getItem,
    getPath,
    refreshItems,
    
    invalidateCache
  };
  
  return (
    <StorageContext.Provider value={contextValue}>
      {children}
    </StorageContext.Provider>
  );
}

/**
 * Hook für den Zugriff auf den StorageContext.
 * Ermöglicht einfachen Zugriff in Komponenten.
 */
export function useStorage() {
  const context = useContext(StorageContext);
  
  if (context === undefined) {
    throw new Error('useStorage muss innerhalb eines StorageContextProviders verwendet werden');
  }
  
  return context;
} 