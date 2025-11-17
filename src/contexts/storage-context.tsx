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

  // Auth-Debug-Logging
  React.useEffect(() => {
    AuthLogger.clientAuth('StorageContext', {
      isSignedIn,
      isLoaded: isAuthLoaded,
      userId: user?.id,
      email: user?.primaryEmailAddress?.emailAddress
    });
  }, [isAuthLoaded, isSignedIn, user?.id, user?.primaryEmailAddress?.emailAddress]);
  
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
      console.log(`[StorageContext] Provider-Wechsel: ${previousProviderRef.current?.name || 'Kein Provider'} -> ${providerFromHook.name}`);
      
      // Cleanup des alten Providers
      if (previousProviderRef.current) {
        try {
          previousProviderRef.current.disconnect?.();
          console.log(`[StorageContext] Alten Provider ${previousProviderRef.current.name} aufgeräumt`);
        } catch (error) {
          console.error('[StorageContext] Fehler beim Aufräumen des alten Providers:', error);
        }
      }

      // Validierung des neuen Providers
      try {
        validateProvider(providerFromHook);
        console.log(`[StorageContext] Provider ${providerFromHook.name} validiert`);
      } catch (error) {
        console.error('[StorageContext] Provider-Validierung fehlgeschlagen:', error);
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
      console.log('[StorageContext] Aktive Bibliothek geändert, lösche alten Provider aus Cache', {
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
    AuthLogger.debug('StorageContext', 'Library Loading Effect triggered', {
      isAuthLoaded,
      isUserLoaded,
      isSignedIn
    });

    // OPTIMIERUNG: Auf öffentlichen Seiten (Homepage/Explore) keine Libraries laden
    // Auch wenn der Benutzer angemeldet ist, werden Libraries auf Explore-Seiten nicht benötigt
    // Sie werden dort direkt aus der API geladen
    const isPublicPage = pathname === '/' || (pathname && pathname.startsWith('/explore'));
    
    if (isPublicPage) {
      AuthLogger.debug('StorageContext', 'Public page detected, skipping library load', {
        pathname,
        isSignedIn,
        isAuthLoaded,
        isUserLoaded
      });
      setIsLoading(false);
      setLibraryStatus('ready');
      setLibraryStatusAtom('ready');
      return;
    }

    if (!isAuthLoaded || !isUserLoaded) {
      AuthLogger.debug('StorageContext', 'Waiting for auth/user to load');
      return;
    }
    
    if (!isSignedIn) {
      AuthLogger.warn('StorageContext', 'User not signed in');
      setError("Sie müssen angemeldet sein, um auf die Bibliothek zugreifen zu können.");
      setIsLoading(false);
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

    AuthLogger.info('StorageContext', 'Starting library load', { 
      userEmail: `${userEmail.split('@')[0]}@...` 
    });
    console.log('[StorageContext] Lade Bibliotheken...');
    setIsLoading(true);
    
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 Sekunde
    let isCancelled = false; // Flag um doppelte Loads zu verhindern

    const fetchLibraries = async () => {
      if (isCancelled) return; // Abbrechen wenn bereits gecancelt
      
      try {
        const apiEndpoint = `/api/libraries?email=${encodeURIComponent(userEmail)}`;
        AuthLogger.apiCall('StorageContext', apiEndpoint, 'start', { attempt: retryCount + 1 });
        
        const res = await fetch(apiEndpoint);
        
        if (!res.ok) {
          AuthLogger.apiCall('StorageContext', apiEndpoint, 'error', { 
            status: res.status,
            statusText: res.statusText,
            attempt: retryCount + 1 
          });
          if (res.status === 404 && retryCount < maxRetries) {
            console.log(`[StorageContext] API nicht verfügbar, versuche erneut (${retryCount + 1}/${maxRetries})...`);
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
            console.warn('[StorageContext] Konnte Fehlermeldung nicht aus Response lesen:', jsonError);
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
              if (!isSupported) {
                console.warn(`[StorageContext] Nicht unterstützter Bibliothekstyp "${lib.type}" für Bibliothek "${lib.label}" - wird ausgeblendet`);
                AuthLogger.warn('StorageContext', `Unsupported library type filtered out`, {
                  libraryType: lib.type,
                  libraryLabel: lib.label,
                  libraryId: lib.id
                });
              }
              return isSupported;
            });
          
          console.log(`[StorageContext] Bibliotheken geladen: ${data.length} total, ${supportedLibraries.length} unterstützt`);
          
          // WICHTIG: Intelligentes State-Merge statt Überschreiben
          // Prüfe ob Libraries bereits im State sind (z.B. von Explore-Seite)
          const existingLibraries = libraries
          const newLibraryIds = new Set(supportedLibraries.map(lib => lib.id))
          
          // Merge-Strategie:
          // 1. Behalte vorhandene Libraries, die nicht in den neuen Libraries sind (z.B. Explore-Libraries)
          // 2. Füge neue Libraries hinzu oder aktualisiere vorhandene
          const librariesToKeep = existingLibraries.filter(lib => !newLibraryIds.has(lib.id))
          const mergedLibraries = [...librariesToKeep, ...supportedLibraries]
          
          console.log(`[StorageContext] State-Merge: ${existingLibraries.length} vorhanden, ${supportedLibraries.length} neu, ${mergedLibraries.length} nach Merge`);
          setLibraries(mergedLibraries);
          
          // Setze StorageFactory Libraries (nur unterstützte)
          const factory = StorageFactory.getInstance();
          factory.setLibraries(supportedLibraries);
          
          // Setze User-Email für API-Calls
          factory.setUserEmail(userEmail);
          AuthLogger.info('StorageContext', 'User email set in StorageFactory', {
            email: `${userEmail.split('@')[0]}@...`
          });
          
          // Prüfe, ob der Benutzer keine unterstützten Bibliotheken hat und noch nicht zur Settings-Seite weitergeleitet wurde
          if (supportedLibraries.length === 0 && !hasRedirectedToSettings && typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            // Nur weiterleiten, wenn wir nicht bereits auf der Settings-Seite sind
            if (!currentPath.startsWith('/settings')) {
              console.log('[StorageContext] Neuer Benutzer ohne Bibliotheken - leite zur Settings-Seite weiter');
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
            console.log('[StorageContext] Gespeicherte activeLibraryId aus localStorage:', storedLibraryId);
            
            // Zusätzliche Validierung: Prüfe, ob die ID ein gültiges UUID-Format hat
            const isValidUUID = storedLibraryId && 
              storedLibraryId.length > 10 && 
              isNaN(Number(storedLibraryId));
            
            // Prüfen, ob die gespeicherte ID in den unterstützten Bibliotheken existiert und gültig ist
            const validStoredId = isValidUUID && supportedLibraries.some(lib => lib.id === storedLibraryId);
            
            if (validStoredId) {
              console.log(`[StorageContext] Gespeicherte Bibliothek wird verwendet: ${storedLibraryId}`);
              setActiveLibraryId(storedLibraryId);
            } else {
              if (storedLibraryId && !isValidUUID) {
                console.warn(`[StorageContext] Ungültige Library-ID im localStorage gefunden: "${storedLibraryId}" - wird bereinigt`);
                localStorage.removeItem('activeLibraryId');
              }
              
              const firstLibId = supportedLibraries[0].id;
              console.log(`[StorageContext] Setze erste unterstützte Bibliothek als aktiv: ${firstLibId}`);
              setActiveLibraryId(firstLibId);
              localStorage.setItem('activeLibraryId', firstLibId);
            }
          } else {
            console.warn('[StorageContext] Keine unterstützten Bibliotheken verfügbar');
            AuthLogger.warn('StorageContext', 'No supported libraries available', {
              totalLibraries: data.length,
              supportedLibraries: supportedLibraries.length
            });
            setActiveLibraryId("");
            localStorage.removeItem('activeLibraryId');
            setLibraries([]);
          }
        } else {
          console.error('[StorageContext] Ungültiges Format der Bibliotheksdaten:', data);
          setError('Fehler beim Laden der Bibliotheken: Ungültiges Format');
          setLibraries([]);
        }
      } catch (err) {
        if (isCancelled) return; // Ignoriere Fehler wenn gecancelt
        
        AuthLogger.error('StorageContext', 'Library fetch failed', err);
        console.error('[StorageContext] Fehler beim Laden der Bibliotheken:', err);
        
        if (retryCount < maxRetries) {
          AuthLogger.warn('StorageContext', `Retrying library fetch (${retryCount + 1}/${maxRetries})`);
          console.log(`[StorageContext] Fehler, versuche erneut (${retryCount + 1}/${maxRetries})...`);
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
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, setLibraries, setActiveLibraryId, hasRedirectedToSettings, libraries, setLibraryStatusAtom, pathname]);

  // Aktuelle Bibliothek aktualisieren
  const refreshCurrentLibrary = async () => {
    if (!currentLibrary || !provider) return;
    
    try {
      // Aktualisiere die Bibliothek durch Neuladen der Bibliotheken
      await refreshLibraries();
    } catch (error) {
      console.error('[StorageContext] Fehler beim Aktualisieren der Bibliothek:', error);
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
      console.error('[StorageContext] Fehler beim Aktualisieren der Bibliotheken:', error);
    }
  };

  // Implementiere listItems und refreshItems
  const listItems = async (folderId: string): Promise<StorageItem[]> => {
    // Überprüfe, ob der Provider zur aktuellen Bibliothek passt
    if (!provider || !currentLibrary) {
      console.error('[StorageContext] Kein Provider oder keine aktuelle Bibliothek verfügbar für listItems');
      throw new Error('Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.');
    }
    
    // Wichtig: Stelle sicher, dass der Provider zur aktuellen Bibliothek gehört
    if (provider.id !== currentLibrary.id) {
      console.warn('[StorageContext][listItems] Provider-ID stimmt nicht mit aktueller Bibliothek überein!', {
        providerId: provider.id,
        currentLibraryId: currentLibrary.id,
        activeLibraryId
      });
      
      // Versuche den korrekten Provider zu laden
      try {
        const factory = StorageFactory.getInstance();
        const correctProvider = await factory.getProvider(currentLibrary.id);
        console.log('[StorageContext][listItems] Korrekter Provider geladen:', correctProvider.name);
        
        // Verwende den korrekten Provider für diesen Aufruf
        return await correctProvider.listItemsById(folderId);
      } catch (error) {
        console.error('[StorageContext][listItems] Fehler beim Laden des korrekten Providers:', error);
        throw error;
      }
    }
    
    // Logging: Library-IDs vergleichen
    setLastRequestedLibraryId(currentLibrary?.id || null);
    console.log('[StorageContext][listItems] Aufruf:', {
      requestedLibraryId: currentLibrary?.id,
      activeLibraryId,
      currentLibrary,
      providerId: provider.id,
      providerName: provider.name
    });
    
    // Prüfe zuerst, ob der Provider authentifiziert ist
    if ('isAuthenticated' in provider && typeof provider.isAuthenticated === 'function' && !provider.isAuthenticated()) {
      console.log('[StorageContext][listItems] Provider ist nicht authentifiziert, überspringe Aufruf');
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
      console.log(`[StorageContext][listItems] Erfolgreich ${items.length} Items geladen`);
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
        
        console.error('[StorageContext] Fehler beim Auflisten der Items:', {
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
  };

  const refreshItems = async (folderId: string): Promise<StorageItem[]> => {
    // Überprüfe, ob der Provider zur aktuellen Bibliothek passt
    if (!provider || !currentLibrary) {
      console.error('[StorageContext] Kein Provider oder keine aktuelle Bibliothek verfügbar für refreshItems');
      return [];
    }
    
    // Wichtig: Stelle sicher, dass der Provider zur aktuellen Bibliothek gehört
    if (provider.id !== currentLibrary.id) {
      console.warn('[StorageContext][refreshItems] Provider-ID stimmt nicht mit aktueller Bibliothek überein!', {
        providerId: provider.id,
        currentLibraryId: currentLibrary.id,
        activeLibraryId
      });
      
      // Versuche den korrekten Provider zu laden
      try {
        const factory = StorageFactory.getInstance();
        const correctProvider = await factory.getProvider(currentLibrary.id);
        console.log('[StorageContext][refreshItems] Korrekter Provider geladen:', correctProvider.name);
        
        // Verwende den korrekten Provider für diesen Aufruf
        return await correctProvider.listItemsById(folderId);
      } catch (error) {
        console.error('[StorageContext][refreshItems] Fehler beim Laden des korrekten Providers:', error);
        throw error;
      }
    }
    
    setLastRequestedLibraryId(currentLibrary?.id || null);
    console.log('[StorageContext][refreshItems] Aufruf:', {
      requestedLibraryId: currentLibrary?.id,
      activeLibraryId,
      currentLibrary,
      providerId: provider.id,
      providerName: provider.name
    });
    
    // Prüfe zuerst, ob der Provider authentifiziert ist
    if ('isAuthenticated' in provider && typeof provider.isAuthenticated === 'function' && !provider.isAuthenticated()) {
      console.log('[StorageContext][refreshItems] Provider ist nicht authentifiziert, überspringe Aufruf');
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
    
    console.log('[StorageContext] Aktualisiere Authentifizierungsstatus manuell');
    
    try {
      // Versuche den Provider zu laden oder zu erstellen
      const factory = StorageFactory.getInstance();
      const provider = await factory.getProvider(currentLibrary.id);
      
      // Prüfe den Authentifizierungsstatus direkt beim Provider
      const isAuth = provider.isAuthenticated();
      
      console.log('[StorageContext] Provider Authentifizierungsstatus:', {
        libraryId: currentLibrary.id,
        providerName: provider.name,
        isAuthenticated: isAuth
      });
      
      if (isAuth) {
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
        setIsAuthRequired(false);
        setAuthProvider(null);
        console.log('[StorageContext] Provider ist authentifiziert - Status auf "ready" gesetzt');
      } else {
        setLibraryStatus('waitingForAuth');
        setLibraryStatusAtom('waitingForAuth');
        setIsAuthRequired(true);
        setAuthProvider(currentLibrary.type);
        console.log('[StorageContext] Provider ist NICHT authentifiziert - Status auf "waitingForAuth" gesetzt');
      }
    } catch (error) {
      console.error('[StorageContext] Fehler beim Prüfen des Authentifizierungsstatus:', error);
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
            console.error('[StorageContext] Fehler beim Prüfen der Tokens im localStorage:', error);
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