/**
 * @fileoverview Storage Context - React Context for Storage Provider Management
 * 
 * @description
 * Provides React context for storage provider management across the application.
 * Handles library loading, provider initialization, authentication status, and
 * storage operations. Integrates with Jotai atoms for state management and Clerk
 * for authentication.
 * 
 * @module storage
 * 
 * @exports
 * - StorageContextProvider: React context provider component
 * - useStorage: Hook to access storage context
 * - isStorageError: Type guard for storage errors
 * - LibraryStatus: Type for library loading states
 * 
 * @usedIn
 * - src/app/layout.tsx: Wraps application with storage context
 * - src/components/library: Library components use storage context
 * - src/hooks/use-storage-provider.tsx: Uses storage context
 * 
 * @dependencies
 * - @/lib/storage/storage-factory: Storage provider factory
 * - @/atoms/library-atom: Library state atoms
 * - @clerk/nextjs: Authentication hooks
 * - @/lib/storage/types: Storage types
 */

"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { usePathname } from 'next/navigation';
import { librariesAtom, activeLibraryIdAtom, libraryStatusAtom } from '@/atoms/library-atom';
import { StorageFactory } from '@/lib/storage/storage-factory';
import { ClientLibrary } from "@/types/library";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { useAuth, useUser } from '@clerk/nextjs';
import { StorageProvider, StorageItem, StorageError } from '@/lib/storage/types';
import { AuthLogger } from '@/lib/debug/logger';
import { isSupportedLibraryType } from '@/lib/storage/supported-types';

// Erweitere den StorageProvider um getAuthInfo
interface ExtendedStorageProvider extends StorageProvider {
  getAuthInfo?: () => string;
  disconnect?: () => Promise<void>;
}

// Typ für den Lade-/Statuszustand der Bibliothek
export type LibraryStatus =
  | 'initializing'
  | 'providerLoading'
  | 'waitingForAuth'
  | 'ready';

// Context-Typen
interface StorageContextType {
  libraries: ClientLibrary[];
  currentLibrary: ClientLibrary | null;
  isLoading: boolean;
  error: string | null;
  provider: ExtendedStorageProvider | null;
  refreshCurrentLibrary: () => Promise<void>;
  refreshLibraries: () => Promise<void>;
  listItems: (folderId: string) => Promise<StorageItem[]>;
  refreshItems: (folderId: string) => Promise<StorageItem[]>;
  isAuthRequired: boolean;
  authProvider: string | null;
  libraryStatus: LibraryStatus;
  lastRequestedLibraryId: string | null;
  refreshAuthStatus: () => void;
}

// Erstelle den Context
const StorageContext = createContext<StorageContextType | undefined>(undefined);

// Hook für den Zugriff auf den Context
export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage muss innerhalb eines StorageContextProvider verwendet werden');
  }
  return context;
};

// Type Guard für StorageError
export function isStorageError(error: unknown): error is StorageError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Build-Zeit-sichere Hook-Wrapper
 */
function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    return { isLoaded: true, isSignedIn: false };
  }
}

function useSafeUser() {
  try {
    return useUser();
  } catch {
    return { user: null, isLoaded: true };
  }
}

/**
 * Provider-Komponente für den Storage-Context
 * Verwaltet den Zustand der Bibliotheken und des aktiven Providers
 */
export const StorageContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded: isAuthLoaded, isSignedIn } = useSafeAuth();
  const { user, isLoaded: isUserLoaded } = useSafeUser();
  const pathname = usePathname();

  // Auth-Debug-Logging entfernt (zu viele Logs bei jedem Auth-Status-Update)
  
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [currentLibrary, setCurrentLibrary] = useState<ClientLibrary | null>(null);
  const [provider, setProvider] = useState<ExtendedStorageProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  const [, setLibraryStatusAtom] = useAtom(libraryStatusAtom);
  const providerFromHook = useStorageProvider();
  const [isProviderLoading, setIsProviderLoading] = useState(false);
  const previousProviderRef = React.useRef<ExtendedStorageProvider | null>(null);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus>('initializing');
  const [lastRequestedLibraryId, setLastRequestedLibraryId] = useState<string | null>(null);
  const [hasRedirectedToSettings, setHasRedirectedToSettings] = useState(false);

  // Provider-Wechsel-Logik
  useEffect(() => {
    setLibraryStatus('initializing');
    if (providerFromHook) {
      // Cleanup des alten Providers
      if (previousProviderRef.current) {
        try {
          previousProviderRef.current.disconnect?.();
        } catch (error) {
          AuthLogger.debug('StorageContext', 'Error cleaning up old provider', { error });
        }
      }

      // Validierung des neuen Providers
      try {
        validateProvider(providerFromHook);
      } catch (error) {
        AuthLogger.error('StorageContext', 'Provider validation failed', error);
        setError(error instanceof Error ? error.message : 'Provider-Validierung fehlgeschlagen');
        return;
      }

      // Provider aktualisieren
      setIsProviderLoading(true);
      setProvider(providerFromHook);
      previousProviderRef.current = providerFromHook;
      setIsProviderLoading(false);
      setLibraryStatus('ready');
      setLibraryStatusAtom('ready');
    }
  }, [providerFromHook, setLibraryStatusAtom]);

  // Zusätzlicher Effect: Provider-Cache leeren bei Library-Wechsel
  useEffect(() => {
    if (activeLibraryId && previousProviderRef.current && previousProviderRef.current.id !== activeLibraryId) {
      AuthLogger.debug('StorageContext', 'Aktive Bibliothek geändert, lösche alten Provider aus Cache', {
        alteBibliothek: previousProviderRef.current.id,
        neueBibliothek: activeLibraryId
      });
      
      // Lösche den alten Provider aus dem Factory-Cache
      const factory = StorageFactory.getInstance();
      factory.clearProvider(previousProviderRef.current.id);
    }
  }, [activeLibraryId]);

  // Provider-Validierung
  const validateProvider = (provider: ExtendedStorageProvider) => {
    if (!provider.listItemsById) {
      throw new Error('Provider unterstützt keine Ordnerauflistung');
    }
    // Weitere Validierungen hier...
  };

  // Aktuelle Bibliothek aktualisieren, wenn sich die aktive Bibliothek oder die Bibliotheksliste ändert
  useEffect(() => {
    if (!activeLibraryId || libraries.length === 0) {
      setCurrentLibrary(null);
      setLibraryStatus('initializing');
      setLibraryStatusAtom('loading');
      return;
    }
    const found = libraries.find(lib => lib.id === activeLibraryId) || null;
    setCurrentLibrary(found);
    // Status wird in einem anderen useEffect basierend auf der Library gesetzt
  }, [activeLibraryId, libraries, setLibraryStatusAtom]);

  // Bibliotheken aus der API laden
  useEffect(() => {
    // WICHTIG: Auch auf öffentlichen Seiten müssen die eigenen Libraries geladen werden,
    // wenn der Benutzer angemeldet ist (für LibrarySwitcher im Top-Menü)
    // Öffentliche Libraries werden separat geladen (z.B. in LibraryGrid)
    
    if (!isAuthLoaded || !isUserLoaded) {
      return;
    }
    
    // Wenn nicht angemeldet: Keine Libraries laden (nur öffentliche Libraries werden separat geladen)
    if (!isSignedIn) {
      setIsLoading(false);
      setLibraryStatus('ready');
      setLibraryStatusAtom('ready');
      return;
    }

    const userEmail = user?.primaryEmailAddress?.emailAddress;
    if (!userEmail) {
      AuthLogger.error('StorageContext', 'No user email available', { 
        hasUser: !!user,
        emailAddressesCount: user?.emailAddresses?.length || 0 
      });
      setError("Keine Benutzer-Email verfügbar");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 Sekunde
    let isCancelled = false; // Flag um doppelte Loads zu verhindern

    const fetchLibraries = async () => {
      if (isCancelled) return; // Abbrechen wenn bereits gecancelt
      
      try {
        const apiEndpoint = `/api/libraries?email=${encodeURIComponent(userEmail)}`;
        
        const res = await fetch(apiEndpoint);
        
        if (!res.ok) {
          AuthLogger.apiCall('StorageContext', apiEndpoint, 'error', { 
            status: res.status,
            statusText: res.statusText,
            attempt: retryCount + 1 
          });
          if (res.status === 404 && retryCount < maxRetries) {
            AuthLogger.debug('StorageContext', `API nicht verfügbar, versuche erneut`, { 
              attempt: retryCount + 1, 
              maxRetries 
            });
            retryCount++;
            setTimeout(fetchLibraries, retryDelay);
            return;
          }
          
          // Versuche die Fehlermeldung aus dem Response-Body zu lesen
          let errorMessage = `HTTP-Fehler: ${res.status}`;
          try {
            const errorData = await res.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (jsonError) {
            // Falls JSON-Parsing fehlschlägt, verwende die Standard-Nachricht
            AuthLogger.debug('StorageContext', 'Could not read error message from response', { error: jsonError });
          }
          
          throw new Error(res.status === 404 
            ? `API-Endpunkt nicht gefunden (404). Bitte prüfen, ob '/api/libraries' existiert.`
            : errorMessage);
        }

        const data = await res.json();
        if (isCancelled) return; // Nochmal prüfen nach async Operation
        
        AuthLogger.apiCall('StorageContext', apiEndpoint, 'success', { 
          librariesCount: Array.isArray(data) ? data.length : 0,
          attempt: retryCount + 1 
        });
        
        if (data && Array.isArray(data)) {
          // Erst valide IDs sicherstellen, dann unterstützte Typen filtern
          const supportedLibraries = data
            .filter(lib => typeof lib?.id === 'string' && lib.id.trim() !== '')
            .filter(lib => {
              const isSupported = isSupportedLibraryType(lib.type);
              // Unsupported library types are silently filtered out (normal case)
              return isSupported;
            });
          
          // WICHTIG: Intelligentes State-Merge statt Überschreiben
          // Prüfe ob Libraries bereits im State sind (z.B. von Explore-Seite)
          const existingLibraries = libraries
          const newLibraryIds = new Set(supportedLibraries.map(lib => lib.id))
          
          // Merge-Strategie:
          // 1. Behalte vorhandene Libraries, die nicht in den neuen Libraries sind (z.B. Explore-Libraries)
          // 2. Füge neue Libraries hinzu oder aktualisiere vorhandene
          const librariesToKeep = existingLibraries.filter(lib => !newLibraryIds.has(lib.id))
          const mergedLibraries = [...librariesToKeep, ...supportedLibraries]
          setLibraries(mergedLibraries);
          
          // Setze StorageFactory Libraries (nur unterstützte)
          const factory = StorageFactory.getInstance();
          factory.setLibraries(supportedLibraries);
          
          // Setze User-Email für API-Calls
          factory.setUserEmail(userEmail);
          
          // Prüfe, ob der Benutzer keine unterstützten Bibliotheken hat und noch nicht zur Settings-Seite weitergeleitet wurde
          if (supportedLibraries.length === 0 && !hasRedirectedToSettings && typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            // Nur weiterleiten, wenn wir nicht bereits auf der Settings-Seite sind
            if (!currentPath.startsWith('/settings')) {
              AuthLogger.info('StorageContext', 'New user without libraries - redirecting to settings');
              setHasRedirectedToSettings(true);
              
              // Sanfte Weiterleitung mit kurzer Verzögerung
              setTimeout(() => {
                window.location.href = '/settings?newUser=true';
              }, 500);
              return;
            }
          }
          
          // Setze die erste unterstützte Bibliothek als aktiv, falls noch keine ausgewählt ist
          if (supportedLibraries.length > 0) {
            const storedLibraryId = localStorage.getItem('activeLibraryId');
            
            // Zusätzliche Validierung: Prüfe, ob die ID ein gültiges UUID-Format hat
            const isValidUUID = storedLibraryId && 
              storedLibraryId.length > 10 && 
              isNaN(Number(storedLibraryId));
            
            // Prüfen, ob die gespeicherte ID in den unterstützten Bibliotheken existiert und gültig ist
            const validStoredId = isValidUUID && supportedLibraries.some(lib => lib.id === storedLibraryId);
            
            if (validStoredId) {
              setActiveLibraryId(storedLibraryId);
            } else {
              if (storedLibraryId && !isValidUUID) {
                AuthLogger.warn('StorageContext', 'Invalid library ID found in localStorage - cleaning up', {
                  storedLibraryId
                });
                localStorage.removeItem('activeLibraryId');
              }
              
              const firstLibId = supportedLibraries[0].id;
              setActiveLibraryId(firstLibId);
              localStorage.setItem('activeLibraryId', firstLibId);
            }
          } else {
            AuthLogger.warn('StorageContext', 'No supported libraries available', {
              totalLibraries: data.length,
              supportedLibraries: supportedLibraries.length
            });
            setActiveLibraryId("");
            localStorage.removeItem('activeLibraryId');
            setLibraries([]);
          }
        } else {
          AuthLogger.error('StorageContext', 'Invalid library data format', { data });
          setError('Fehler beim Laden der Bibliotheken: Ungültiges Format');
          setLibraries([]);
        }
      } catch (err) {
        if (isCancelled) return; // Ignoriere Fehler wenn gecancelt
        
        AuthLogger.error('StorageContext', 'Library fetch failed', err);
        
        if (retryCount < maxRetries) {
          AuthLogger.warn('StorageContext', `Retrying library fetch (${retryCount + 1}/${maxRetries})`);
          AuthLogger.debug('StorageContext', 'Fehler, versuche erneut', { 
            attempt: retryCount + 1, 
            maxRetries 
          });
          retryCount++;
          setTimeout(fetchLibraries, retryDelay);
          return;
        }
        // Die Fehlermeldung ist jetzt bereits benutzerfreundlich vom Backend
        const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
        AuthLogger.error('StorageContext', 'Final library fetch failure after retries', { errorMessage });
        setError(errorMessage);
      } finally {
        if (retryCount >= maxRetries || !isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchLibraries();
    
    // Cleanup function
    return () => {
      isCancelled = true;
    };
    // WICHTIG: libraries NICHT in Dependencies, da sonst Endlosschleife:
    // libraries ändert sich → useEffect läuft → setLibraries → libraries ändert sich → ...
    // libraries wird innerhalb fetchLibraries über Closure verwendet, was ausreicht
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, setLibraries, setActiveLibraryId, hasRedirectedToSettings, setLibraryStatusAtom, pathname]);

  // Aktuelle Bibliothek aktualisieren
  const refreshCurrentLibrary = async () => {
    if (!currentLibrary || !provider) return;
    
    try {
      // Aktualisiere die Bibliothek durch Neuladen der Bibliotheken
      await refreshLibraries();
    } catch (error) {
      AuthLogger.error('StorageContext', 'Failed to update library', error);
    }
  };

  // Alle Bibliotheken aktualisieren
  const refreshLibraries = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;
    
    try {
      const res = await fetch(`/api/libraries?email=${encodeURIComponent(user.primaryEmailAddress.emailAddress)}`);
      if (!res.ok) {
        // Versuche die Fehlermeldung aus dem Response-Body zu lesen
        let errorMessage = `HTTP-Fehler: ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Falls JSON-Parsing fehlschlägt, verwende die Standard-Nachricht
        }
        throw new Error(errorMessage);
      }
      
      const data = await res.json();
      if (data && Array.isArray(data)) {
        const filtered = data
          .filter((lib: { id?: unknown }) => typeof lib?.id === 'string' && String(lib.id).trim() !== '')
          .filter((lib: { type?: unknown }) => isSupportedLibraryType(String(lib.type)));
        
        // WICHTIG: Intelligentes State-Merge auch bei refreshLibraries
        const existingLibraries = libraries
        const newLibraryIds = new Set(filtered.map(lib => lib.id))
        
        // Behalte Libraries die nicht in den gefilterten sind (z.B. Explore-Libraries)
        const librariesToKeep = existingLibraries.filter(lib => !newLibraryIds.has(lib.id))
        const mergedLibraries = [...librariesToKeep, ...filtered]
        
        setLibraries(mergedLibraries);
      }
    } catch (error) {
      AuthLogger.error('StorageContext', 'Failed to update libraries', error);
    }
  };

  // Implementiere listItems und refreshItems
  const listItems = async (folderId: string): Promise<StorageItem[]> => {
    // Überprüfe, ob der Provider zur aktuellen Bibliothek passt
    if (!provider || !currentLibrary) {
      AuthLogger.error('StorageContext', 'No provider or current library available for listItems');
      throw new Error('Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.');
    }
    
    // Request-Deduplizierung: Erstelle Key für diesen Request
    const requestKey = `${currentLibrary.id}:${folderId}`;
    
    // Verwende deduplicateRequest um doppelte Requests zu vermeiden
    const { deduplicateRequest } = await import('@/lib/storage/request-deduplicator');
    
    return deduplicateRequest(requestKey, async () => {
      // Wichtig: Stelle sicher, dass der Provider zur aktuellen Bibliothek gehört
      if (provider.id !== currentLibrary.id) {
        AuthLogger.warn('StorageContext', 'Provider ID does not match current library', {
          providerId: provider.id,
          currentLibraryId: currentLibrary.id,
          activeLibraryId
        });
        
        // Versuche den korrekten Provider zu laden
        try {
          const factory = StorageFactory.getInstance();
          const correctProvider = await factory.getProvider(currentLibrary.id);
          AuthLogger.debug('StorageContext', 'Korrekter Provider geladen', { providerName: correctProvider.name });
          
          // Verwende den korrekten Provider für diesen Aufruf
          return await correctProvider.listItemsById(folderId);
        } catch (error) {
          AuthLogger.error('StorageContext', 'Failed to load correct provider', error);
          throw error;
        }
      }
      
      // Logging: Library-IDs vergleichen
      setLastRequestedLibraryId(currentLibrary?.id || null);
      
      // Prüfe zuerst, ob der Provider authentifiziert ist
      if ('isAuthenticated' in provider && typeof provider.isAuthenticated === 'function' && !provider.isAuthenticated()) {
        AuthLogger.debug('StorageContext', 'Provider ist nicht authentifiziert, überspringe Aufruf');
        setIsAuthRequired(true);
        setAuthProvider(provider.name);
        setLibraryStatus('waitingForAuth');
        // Werfe einen AUTH_REQUIRED Fehler, aber logge ihn nicht
        throw new StorageError(
          "Nicht authentifiziert. Bitte authentifizieren Sie sich bei " + provider.name + ".",
          "AUTH_REQUIRED",
          provider.id
        );
      }
      
      try {
        const items = await provider.listItemsById(folderId);
        return items;
      } catch (error) {
        if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
        setIsAuthRequired(true);
        setAuthProvider(provider.name);
        setLibraryStatus('waitingForAuth');
        // Kein Logging für AUTH_REQUIRED
      } else {
        setIsAuthRequired(false);
        setAuthProvider(null);
        setLibraryStatus('ready');
        
        // Verbesserte Fehlerbehandlung
        let errorMessage = 'Unbekannter Fehler beim Laden der Dateien';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Spezifische Fehlermeldungen für häufige Probleme
          if (error.message.includes('Bibliothek nicht gefunden')) {
            errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
          } else if (error.message.includes('Server-Fehler')) {
            errorMessage = 'Server-Fehler beim Laden der Bibliothek. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
          } else if (error.message.includes('Keine Berechtigung')) {
            errorMessage = 'Keine Berechtigung für den Zugriff auf die Bibliothek. Bitte überprüfen Sie die Dateiberechtigungen.';
          } else if (error.message.includes('ENOENT')) {
            errorMessage = 'Der Bibliothekspfad existiert nicht. Bitte überprüfen Sie die Bibliothekskonfiguration.';
          }
        }
        
        AuthLogger.error('StorageContext', 'Error listing items', {
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 3)
          } : error,
          libraryId: currentLibrary.id,
          libraryPath: currentLibrary.path,
          providerName: provider.name
        });
        
        // Erstelle einen benutzerfreundlichen Fehler
        const userFriendlyError = new Error(errorMessage);
        userFriendlyError.name = 'StorageError';
        throw userFriendlyError;
      }
      throw error;
      }
    });
  };

  const refreshItems = async (folderId: string): Promise<StorageItem[]> => {
    // Überprüfe, ob der Provider zur aktuellen Bibliothek passt
    if (!provider || !currentLibrary) {
      AuthLogger.error('StorageContext', 'No provider or current library available for refreshItems');
      return [];
    }
    
    // Wichtig: Stelle sicher, dass der Provider zur aktuellen Bibliothek gehört
    if (provider.id !== currentLibrary.id) {
      AuthLogger.warn('StorageContext', 'Provider ID does not match current library (refresh)', {
        providerId: provider.id,
        currentLibraryId: currentLibrary.id,
        activeLibraryId
      });
      
      // Versuche den korrekten Provider zu laden
      try {
        const factory = StorageFactory.getInstance();
        const correctProvider = await factory.getProvider(currentLibrary.id);
          AuthLogger.debug('StorageContext', 'Korrekter Provider geladen (refresh)', { providerName: correctProvider.name });
        
        // Verwende den korrekten Provider für diesen Aufruf
        return await correctProvider.listItemsById(folderId);
      } catch (error) {
        AuthLogger.error('StorageContext', 'Failed to load correct provider (refresh)', error);
        throw error;
      }
    }
    
    setLastRequestedLibraryId(currentLibrary?.id || null);
    
    // Prüfe zuerst, ob der Provider authentifiziert ist
    if ('isAuthenticated' in provider && typeof provider.isAuthenticated === 'function' && !provider.isAuthenticated()) {
      AuthLogger.debug('StorageContext', 'Provider ist nicht authentifiziert, überspringe Refresh');
      setIsAuthRequired(true);
      setAuthProvider(provider.name);
      setLibraryStatus('waitingForAuth');
      // Werfe einen AUTH_REQUIRED Fehler, aber logge ihn nicht
      throw new StorageError(
        "Nicht authentifiziert. Bitte authentifizieren Sie sich bei " + provider.name + ".",
        "AUTH_REQUIRED",
        provider.id
      );
    }
    
    try {
      return await provider.listItemsById(folderId);
    } catch (error) {
      if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
        setIsAuthRequired(true);
        setAuthProvider(provider.name);
      } else {
        setIsAuthRequired(false);
        setAuthProvider(null);
        console.error('[StorageContext] Fehler beim Aktualisieren der Items:', error);
      }
      throw error;
    }
  };

  // Neue Methode zum manuellen Aktualisieren des Auth-Status
  const refreshAuthStatus = React.useCallback(async () => {
    if (!currentLibrary) return;
    
    AuthLogger.debug('StorageContext', 'Aktualisiere Authentifizierungsstatus manuell');
    
    try {
      // Versuche den Provider zu laden oder zu erstellen
      const factory = StorageFactory.getInstance();
      const provider = await factory.getProvider(currentLibrary.id);
      
      // Prüfe den Authentifizierungsstatus direkt beim Provider
      const isAuth = provider.isAuthenticated();
      
      AuthLogger.debug('StorageContext', 'Provider Authentifizierungsstatus', {
        libraryId: currentLibrary.id,
        providerName: provider.name,
        isAuthenticated: isAuth
      });
      
      if (isAuth) {
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
        setIsAuthRequired(false);
        setAuthProvider(null);
      } else {
        setLibraryStatus('waitingForAuth');
        setLibraryStatusAtom('waitingForAuth');
        setIsAuthRequired(true);
        setAuthProvider(currentLibrary.type);
      }
    } catch (error) {
      AuthLogger.error('StorageContext', 'Fehler beim Prüfen des Authentifizierungsstatus', { error });
      // Bei Fehler annehmen, dass Authentifizierung erforderlich ist
      setLibraryStatus('waitingForAuth');
      setLibraryStatusAtom('waitingForAuth');
      setIsAuthRequired(true);
      setAuthProvider(currentLibrary.type);
    }
  }, [currentLibrary, setLibraryStatusAtom]);

  // Context-Wert
  const value = {
    libraries,
    currentLibrary,
    isLoading: isLoading || isProviderLoading,
    error,
    provider,
    refreshCurrentLibrary,
    refreshLibraries,
    listItems,
    refreshItems,
    isAuthRequired,
    authProvider,
    libraryStatus,
    lastRequestedLibraryId,
    refreshAuthStatus
  };

  React.useEffect(() => {
    if (currentLibrary) {
      // Status-Logik: Nur OAuth-basierte Provider benötigen Authentifizierung
      // Lokale Dateisystem-Bibliotheken sind immer "ready"
      if (currentLibrary.type === 'local') {
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
      } else if (currentLibrary.type === 'onedrive' || currentLibrary.type === 'gdrive') {
        // OAuth-basierte Provider: Token-Status aus localStorage prüfen
        let hasToken = false;
        
        if (typeof window !== 'undefined') {
          try {
            const localStorageKey = `onedrive_tokens_${currentLibrary.id}`;
            const tokensJson = localStorage.getItem(localStorageKey);
            hasToken = !!tokensJson;
          } catch (error) {
            AuthLogger.debug('StorageContext', 'Error checking tokens in localStorage', { error });
          }
        }
        
        if (hasToken) {
          setLibraryStatus('ready');
          setLibraryStatusAtom('ready');
        } else {
          setLibraryStatus('waitingForAuth');
          setLibraryStatusAtom('waitingForAuth');
        }
      } else {
        // Unbekannter Provider-Typ - sicherheitshalber auf ready setzen
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
      }
    }
  }, [currentLibrary, provider, setLibraryStatusAtom]);

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}; 