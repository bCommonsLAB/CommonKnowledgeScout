"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { librariesAtom, activeLibraryIdAtom, libraryStatusAtom } from '@/atoms/library-atom';
import { StorageFactory } from '@/lib/storage/storage-factory';
import { ClientLibrary } from "@/types/library";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { useAuth, useUser } from '@clerk/nextjs';
import { StorageProvider, StorageItem, StorageError } from '@/lib/storage/types';
import { StorageContextLogger } from '@/lib/storage/storage-logger';

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
 * Provider-Komponente für den Storage-Context
 * Verwaltet den Zustand der Bibliotheken und des aktiven Providers
 */
export const StorageContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  
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
      StorageContextLogger.info('Provider-Wechsel', {
        from: previousProviderRef.current?.name || 'Kein Provider',
        to: providerFromHook.name
      });
      
      // Cleanup des alten Providers
      if (previousProviderRef.current) {
        try {
          previousProviderRef.current.disconnect?.();
          StorageContextLogger.info('Alten Provider aufgeräumt', { providerName: previousProviderRef.current.name });
        } catch (error) {
          StorageContextLogger.error('Fehler beim Aufräumen des alten Providers', error);
        }
      }

      // Validierung des neuen Providers
      try {
        validateProvider(providerFromHook);
        StorageContextLogger.info('Provider validiert', { providerName: providerFromHook.name });
      } catch (error) {
        StorageContextLogger.error('Provider-Validierung fehlgeschlagen', error);
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
  }, [providerFromHook]);

  // Zusätzlicher Effect: Provider-Cache leeren bei Library-Wechsel
  useEffect(() => {
    if (activeLibraryId && previousProviderRef.current && previousProviderRef.current.id !== activeLibraryId) {
      StorageContextLogger.info('Aktive Bibliothek geändert, lösche alten Provider aus Cache', {
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
  }, [activeLibraryId, libraries]);

  // Bibliotheken aus der API laden
  useEffect(() => {
    if (!isAuthLoaded || !isUserLoaded) return;
    if (!isSignedIn) {
      setError("Sie müssen angemeldet sein, um auf die Bibliothek zugreifen zu können.");
      setIsLoading(false);
      return;
    }

    const userEmail = user?.primaryEmailAddress?.emailAddress;
    if (!userEmail) {
      setError("Keine Benutzer-Email verfügbar");
      setIsLoading(false);
      return;
    }

    StorageContextLogger.info('Lade Bibliotheken');
    setIsLoading(true);
    
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 Sekunde
    let isCancelled = false; // Flag um doppelte Loads zu verhindern

    const fetchLibraries = async () => {
      if (isCancelled) return; // Abbrechen wenn bereits gecancelt
      
      try {
        const res = await fetch(`/api/libraries?email=${encodeURIComponent(userEmail)}`);
        if (!res.ok) {
          if (res.status === 404 && retryCount < maxRetries) {
            StorageContextLogger.info('API nicht verfügbar, versuche erneut', { retryCount: retryCount + 1, maxRetries });
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
            StorageContextLogger.warn('Konnte Fehlermeldung nicht aus Response lesen', { error: jsonError });
          }
          
          throw new Error(res.status === 404 
            ? `API-Endpunkt nicht gefunden (404). Bitte prüfen, ob '/api/libraries' existiert.`
            : errorMessage);
        }

        const data = await res.json();
        if (isCancelled) return; // Nochmal prüfen nach async Operation
        
        if (data && Array.isArray(data)) {
          StorageContextLogger.info('Bibliotheken geladen', { count: data.length });
          setLibraries(data);
          
          // Setze StorageFactory Libraries
          const factory = StorageFactory.getInstance();
          factory.setLibraries(data);
          
          // Prüfe, ob der Benutzer keine Bibliotheken hat und noch nicht zur Settings-Seite weitergeleitet wurde
          if (data.length === 0 && !hasRedirectedToSettings && typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            // Nur weiterleiten, wenn wir nicht bereits auf der Settings-Seite sind
            if (!currentPath.startsWith('/settings')) {
              StorageContextLogger.info('Neuer Benutzer ohne Bibliotheken - leite zur Settings-Seite weiter');
              setHasRedirectedToSettings(true);
              
              // Sanfte Weiterleitung mit kurzer Verzögerung
              setTimeout(() => {
                window.location.href = '/settings?newUser=true';
              }, 500);
              return;
            }
          }
          
          // Setze die erste Bibliothek als aktiv, falls noch keine ausgewählt ist
          if (data.length > 0) {
            const storedLibraryId = localStorage.getItem('activeLibraryId');
            StorageContextLogger.info('Gespeicherte activeLibraryId aus localStorage', { storedLibraryId });
            
            // Zusätzliche Validierung: Prüfe, ob die ID ein gültiges UUID-Format hat
            const isValidUUID = storedLibraryId && 
              storedLibraryId.length > 10 && 
              isNaN(Number(storedLibraryId));
            
            // Prüfen, ob die gespeicherte ID existiert und gültig ist
            const validStoredId = isValidUUID && data.some(lib => lib.id === storedLibraryId);
            
            if (validStoredId) {
              StorageContextLogger.info('Gespeicherte Bibliothek wird verwendet', { storedLibraryId });
              setActiveLibraryId(storedLibraryId);
            } else {
              if (storedLibraryId && !isValidUUID) {
                StorageContextLogger.warn('Ungültige Library-ID im localStorage gefunden - wird bereinigt', { storedLibraryId });
                localStorage.removeItem('activeLibraryId');
              }
              
              const firstLibId = data[0].id;
              StorageContextLogger.info('Setze erste Bibliothek als aktiv', { firstLibId });
              setActiveLibraryId(firstLibId);
              localStorage.setItem('activeLibraryId', firstLibId);
            }
          } else {
            StorageContextLogger.warn('Keine Bibliotheken verfügbar');
            setActiveLibraryId("");
            localStorage.removeItem('activeLibraryId');
            setLibraries([]);
          }
        } else {
          StorageContextLogger.error('Ungültiges Format der Bibliotheksdaten', { data });
          setError('Fehler beim Laden der Bibliotheken: Ungültiges Format');
          setLibraries([]);
        }
      } catch (err) {
        if (isCancelled) return; // Ignoriere Fehler wenn gecancelt
        
        StorageContextLogger.error('Fehler beim Laden der Bibliotheken', err);
        if (retryCount < maxRetries) {
          StorageContextLogger.info('Fehler, versuche erneut', { retryCount: retryCount + 1, maxRetries });
          retryCount++;
          setTimeout(fetchLibraries, retryDelay);
          return;
        }
        // Die Fehlermeldung ist jetzt bereits benutzerfreundlich vom Backend
        const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
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
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, setLibraries, setActiveLibraryId, hasRedirectedToSettings]);

  // Aktuelle Bibliothek aktualisieren
  const refreshCurrentLibrary = async () => {
    if (!currentLibrary || !provider) return;
    
    try {
      // Aktualisiere die Bibliothek durch Neuladen der Bibliotheken
      await refreshLibraries();
    } catch (error) {
      StorageContextLogger.error('Fehler beim Aktualisieren der Bibliothek', error);
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
        setLibraries(data);
      }
    } catch (error) {
      StorageContextLogger.error('Fehler beim Aktualisieren der Bibliotheken', error);
    }
  };

  // Implementiere listItems und refreshItems
  const listItems = async (folderId: string): Promise<StorageItem[]> => {
    // Überprüfe, ob der Provider zur aktuellen Bibliothek passt
    if (!provider || !currentLibrary) {
      StorageContextLogger.error('Kein Provider oder keine aktuelle Bibliothek verfügbar für listItems');
      throw new Error('Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.');
    }
    
    // Wichtig: Stelle sicher, dass der Provider zur aktuellen Bibliothek gehört
    if (provider.id !== currentLibrary.id) {
      StorageContextLogger.warn('Provider-ID stimmt nicht mit aktueller Bibliothek überein', {
        providerId: provider.id,
        currentLibraryId: currentLibrary.id,
        activeLibraryId
      });
      
      // Versuche den korrekten Provider zu laden
      try {
        const factory = StorageFactory.getInstance();
        const correctProvider = await factory.getProvider(currentLibrary.id);
        StorageContextLogger.info('Korrekter Provider geladen', { providerName: correctProvider.name });
        
        // Verwende den korrekten Provider für diesen Aufruf
        return await correctProvider.listItemsById(folderId);
      } catch (error) {
        StorageContextLogger.error('Fehler beim Laden des korrekten Providers', error);
        throw error;
      }
    }
    
    // Logging: Library-IDs vergleichen
    setLastRequestedLibraryId(currentLibrary?.id || null);
    StorageContextLogger.info('listItems Aufruf', {
      requestedLibraryId: currentLibrary?.id,
      activeLibraryId,
      currentLibrary,
      providerId: provider.id,
      providerName: provider.name
    });
    
    // Prüfe zuerst, ob der Provider authentifiziert ist
    if ('isAuthenticated' in provider && typeof provider.isAuthenticated === 'function' && !provider.isAuthenticated()) {
      StorageContextLogger.info('Provider ist nicht authentifiziert, überspringe Aufruf');
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
      StorageContextLogger.info('Erfolgreich Items geladen', { itemCount: items.length });
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
        
        StorageContextLogger.error('Fehler beim Auflisten der Items', {
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
      StorageContextLogger.error('Kein Provider oder keine aktuelle Bibliothek verfügbar für refreshItems');
      return [];
    }
    
    // Wichtig: Stelle sicher, dass der Provider zur aktuellen Bibliothek gehört
    if (provider.id !== currentLibrary.id) {
      StorageContextLogger.warn('Provider-ID stimmt nicht mit aktueller Bibliothek überein', {
        providerId: provider.id,
        currentLibraryId: currentLibrary.id,
        activeLibraryId
      });
      
      // Versuche den korrekten Provider zu laden
      try {
        const factory = StorageFactory.getInstance();
        const correctProvider = await factory.getProvider(currentLibrary.id);
        StorageContextLogger.info('Korrekter Provider geladen', { providerName: correctProvider.name });
        
        // Verwende den korrekten Provider für diesen Aufruf
        return await correctProvider.listItemsById(folderId);
      } catch (error) {
        StorageContextLogger.error('Fehler beim Laden des korrekten Providers', error);
        throw error;
      }
    }
    
    setLastRequestedLibraryId(currentLibrary?.id || null);
    StorageContextLogger.info('refreshItems Aufruf', {
      requestedLibraryId: currentLibrary?.id,
      activeLibraryId,
      currentLibrary,
      providerId: provider.id,
      providerName: provider.name
    });
    
    // Prüfe zuerst, ob der Provider authentifiziert ist
    if ('isAuthenticated' in provider && typeof provider.isAuthenticated === 'function' && !provider.isAuthenticated()) {
      StorageContextLogger.info('Provider ist nicht authentifiziert, überspringe Aufruf');
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
        StorageContextLogger.error('Fehler beim Aktualisieren der Items', error);
      }
      throw error;
    }
  };

  // Neue Methode zum manuellen Aktualisieren des Auth-Status
  const refreshAuthStatus = React.useCallback(async () => {
    if (!currentLibrary) return;
    
    StorageContextLogger.info('Aktualisiere Authentifizierungsstatus manuell');
    
    try {
      // Versuche den Provider zu laden oder zu erstellen
      const factory = StorageFactory.getInstance();
      const provider = await factory.getProvider(currentLibrary.id);
      
      // Prüfe den Authentifizierungsstatus direkt beim Provider
      const isAuth = provider.isAuthenticated();
      
      StorageContextLogger.info('Provider Authentifizierungsstatus', {
        libraryId: currentLibrary.id,
        providerName: provider.name,
        isAuthenticated: isAuth
      });
      
      if (isAuth) {
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
        setIsAuthRequired(false);
        setAuthProvider(null);
        StorageContextLogger.info('Provider ist authentifiziert - Status auf "ready" gesetzt');
      } else {
        setLibraryStatus('waitingForAuth');
        setLibraryStatusAtom('waitingForAuth');
        setIsAuthRequired(true);
        setAuthProvider(currentLibrary.type);
        StorageContextLogger.info('Provider ist NICHT authentifiziert - Status auf "waitingForAuth" gesetzt');
      }
    } catch (error) {
      StorageContextLogger.error('Fehler beim Prüfen des Authentifizierungsstatus', error);
      // Bei Fehler annehmen, dass Authentifizierung erforderlich ist
      setLibraryStatus('waitingForAuth');
      setLibraryStatusAtom('waitingForAuth');
      setIsAuthRequired(true);
      setAuthProvider(currentLibrary.type);
    }
  }, [currentLibrary]);

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
    // TEMP: Logging für Bibliotheks-Reload nach Redirect
    StorageContextLogger.info('useEffect: currentLibrary', { currentLibrary });
    if (currentLibrary) {
      // TEMP: Logging für Token in Konfiguration
      StorageContextLogger.info('Bibliothek geladen. Token vorhanden', { 
        hasToken: !!currentLibrary.config?.accessToken, 
        config: currentLibrary.config 
      });
      // TEMP: Logging für Provider-Status
      if (provider) {
        StorageContextLogger.info('Provider geladen', { 
          providerName: provider.name, 
          authInfo: provider.getAuthInfo?.() 
        });
      }
      
      // Status-Logik: Nur OAuth-basierte Provider benötigen Authentifizierung
      // Lokale Dateisystem-Bibliotheken sind immer "ready"
      if (currentLibrary.type === 'local') {
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
        StorageContextLogger.info('Lokale Bibliothek - Status auf "ready" gesetzt');
      } else if (currentLibrary.type === 'onedrive' || currentLibrary.type === 'gdrive') {
        // OAuth-basierte Provider: Token-Status aus localStorage prüfen
        let hasToken = false;
        
        if (typeof window !== 'undefined') {
          try {
            const localStorageKey = `onedrive_tokens_${currentLibrary.id}`;
            const tokensJson = localStorage.getItem(localStorageKey);
            hasToken = !!tokensJson;
          } catch (error) {
            StorageContextLogger.error('Fehler beim Prüfen der Tokens im localStorage', error);
          }
        }
        
        if (hasToken) {
          setLibraryStatus('ready');
          setLibraryStatusAtom('ready');
          StorageContextLogger.info('OAuth-Provider: Status auf "ready" gesetzt, Token im localStorage gefunden');
        } else {
          setLibraryStatus('waitingForAuth');
          setLibraryStatusAtom('waitingForAuth');
          StorageContextLogger.info('OAuth-Provider: Status auf "waitingForAuth" gesetzt, kein Token im localStorage');
        }
      } else {
        // Unbekannter Provider-Typ - sicherheitshalber auf ready setzen
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
        StorageContextLogger.info('Unbekannter Provider-Typ, Status auf "ready" gesetzt');
      }
    }
  }, [currentLibrary, provider]);

  // TEMP: Logging für API-Calls
  React.useEffect(() => {
    StorageContextLogger.info('API-Call ausgelöst. Aktueller Status', { libraryStatus });
  }, [libraryStatus]);

  useEffect(() => {
    // Logging der Library-IDs im StorageContext
    StorageContextLogger.info('StorageContextProvider Render', {
      activeLibraryId,
      currentLibraryId: currentLibrary?.id,
      providerId: provider?.id
    });
  }, [activeLibraryId, currentLibrary, provider]);

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}; 