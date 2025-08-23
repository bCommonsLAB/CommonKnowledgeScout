# Library settings and tab logic issue
_Exported on 8/21/2025 at 18:25:48 GMT+2 from Cursor (1.4.5)_

---

**User**

Ich habe da noch ein Logikproblem, wenn ich eine neue Library anlege. Es sind ja mehrere Tabs. Wenn ich einen neuen Namen anlege, muss ich den ja speichern. Nur erkennt dann, bekomme ich dann diese Fehlermeldung beim Neuladen der Library-Liste. Und ich kann auch nicht in den anderen Tab switchen, wo ich ein Storage definiere, weil wahrscheinlich die Library nicht ladbar ist ohne Storage. Wie ist die Logik in diesem Settings-Dialog eigentlich? Funktionieren die Tabs untereinander?
Error: A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder.
    at SelectItem (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/@radix-ui+react-select@2.2.5_@types+react-dom@18.3.7_@types+react@18.3.23__@types+react@18.3._2s5gpb3mjjflsvmmeef46ajhse/node_modules/@radix-ui/react-select/dist/index.mjs:1075:15)
    at _c8 (webpack-internal:///(app-pages-browser)/./src/components/ui/select.tsx:160:87)
    at eval (webpack-internal:///(app-pages-browser)/./src/components/library/library-switcher.tsx:103:129)
    at Array.map (<anonymous>)
    at LibrarySwitcher (webpack-internal:///(app-pages-browser)/./src/components/library/library-switcher.tsx:103:39)
    at TopNav (webpack-internal:///(app-pages-browser)/./src/components/top-nav.tsx:144:130)
    at LoadableComponent (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/shared/lib/lazy-dynamic/loadable.js:63:57)
    at TopNavWrapper (webpack-internal:///(app-pages-browser)/./src/components/top-nav-wrapper.tsx:29:87)
    at RootLayout (rsc://React/Server/webpack-internal:///(rsc)/./src/app/layout.tsx?42:111:116)

http://localhost:3000/settings


---

**Cursor**

Ich schaue mir jetzt die betroffenen Komponenten an, auf die der Stacktrace zeigt (`library-switcher.tsx`, `ui/select.tsx`, `top-nav.tsx`) und suche nach der Library-Erstell-/Ladelogik, um die Ursache für den leeren Select-Item-Wert zu finden.

Ich prüfe jetzt die Settings-Ansichten und -Formulare (Tabs, Speichern/Erstellen), um die Stelle zu finden, an der eine Library ohne gültige `id` in den Zustand gelangt. Danach fixiere ich die Logik so, dass beim Anlegen immer eine valide ID existiert und der Switcher nie leere Werte rendert.

Ich lese jetzt die relevanten Settings-Komponenten vollständig (`library-form.tsx`, `settings-client.tsx`, `storage-form.tsx`), um die Stelle zu identifizieren, an der eine Bibliothek mit leerer `id` in den Zustand gelangt und wie die Tabs interagieren.

Ich filtere defensive alle Bibliotheken ohne valide `id` auf Server- und Client-Seite, damit der `SelectItem` nie einen leeren `value` erhält. Danach prüfe ich die Linter-Warnungen für die betroffenen Dateien.

```typescriptreact
"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { activeLibraryAtom, activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { createLibraryAtom } from "@/atoms/create-library-atom"
import { StateLogger } from "@/lib/debug/logger"

interface LibrarySwitcherProps {
  isCollapsed?: boolean;
  onLibraryChange?: (libraryId: string) => void;
}

export function LibrarySwitcher({ 
  isCollapsed = false, 
  onLibraryChange
}: LibrarySwitcherProps) {
  const router = useRouter();
  const [libraries] = useAtom(librariesAtom)
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom)
  const [activeLibrary] = useAtom(activeLibraryAtom)
  const [, setCreateLibrary] = useAtom(createLibraryAtom)
  
  const currentLibrary = libraries.find(lib => lib.id === activeLibraryId) || activeLibrary;
  const safeLibraries = React.useMemo(() => {
    return (libraries || []).filter(lib => typeof lib.id === 'string' && lib.id.trim() !== '');
  }, [libraries]);
  
  const handleLibraryChange = (value: string) => {
    // Wenn der spezielle Wert für "Neue Bibliothek erstellen" ausgewählt wurde
    if (value === "new-library") {
      // Setze den globalen Zustand, dass eine neue Bibliothek erstellt werden soll
      setCreateLibrary(true);
      
      // Navigiere zur Einstellungsseite
      router.push("/settings");
      return;
    }
    
    // Bei Auswahl einer regulären Bibliothek den createLibrary-Zustand zurücksetzen
    setCreateLibrary(false);
    
    // Normale Bibliotheksauswahl
    if (onLibraryChange) {
      onLibraryChange(value)
    }
    
    // Speichere die aktive Library-ID im localStorage
    StateLogger.debug('LibrarySwitcher', 'Speichere activeLibraryId im localStorage', { value });

    // Aktualisiere das Atom
    setActiveLibraryId(value);
    StateLogger.info('LibrarySwitcher', 'Bibliothek geändert zu', { libraryId: value });
  }

  return (
    <Select 
      value={activeLibraryId} 
      onValueChange={handleLibraryChange}
    >
      <SelectTrigger
        className={cn(
          "flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden"
        )}
        aria-label="Bibliothek auswählen"
      >
        <SelectValue placeholder="Bibliothek auswählen">
          {currentLibrary?.icon}
          <span className={cn("ml-2", isCollapsed && "hidden")}>
            {currentLibrary?.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Bibliotheken</SelectLabel>
          {safeLibraries.map((library) => (
            <SelectItem key={library.id} value={library.id}>
              <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
                {library.icon}
                {library.label}
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
        
        {/* Trennlinie und Eintrag zum Erstellen einer neuen Bibliothek */}
        <SelectSeparator className="my-2" />
        <SelectItem value="new-library">
          <div className="flex items-center gap-3 text-primary">
            <Plus className="h-4 w-4" />
            Neue Bibliothek erstellen
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
} 
```

```typescriptreact
*** Begin Patch
*** Update File: src/contexts/storage-context.tsx
@@
-          const supportedLibraries = data.filter(lib => {
+          const supportedLibraries = data
+            .filter(lib => typeof lib?.id === 'string' && lib.id.trim() !== '')
+            .filter(lib => {
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
-          });
+          });
@@
-          setLibraries(supportedLibraries);
+          setLibraries(supportedLibraries);
*** End Patch
```

```typescriptreact
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
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
 * Provider-Komponente für den Storage-Context
 * Verwaltet den Zustand der Bibliotheken und des aktiven Providers
 */
export const StorageContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();

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
  }, [providerFromHook]);

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
  }, [activeLibraryId, libraries]);

  // Bibliotheken aus der API laden
  useEffect(() => {
    AuthLogger.debug('StorageContext', 'Library Loading Effect triggered', {
      isAuthLoaded,
      isUserLoaded,
      isSignedIn
    });

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
          setLibraries(supportedLibraries);
          
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
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, setLibraries, setActiveLibraryId, hasRedirectedToSettings]);

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
        setLibraries(data);
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
    // eslint-disable-next-line no-console
    console.log('[StorageContext] useEffect: currentLibrary', currentLibrary);
    if (currentLibrary) {
      // TEMP: Logging für Token in Konfiguration
      // eslint-disable-next-line no-console
      console.log('[StorageContext] Bibliothek geladen. Token vorhanden:', !!currentLibrary.config?.accessToken, 'Config:', currentLibrary.config);
      // TEMP: Logging für Provider-Status
      if (provider) {
        // eslint-disable-next-line no-console
        console.log('[StorageContext] Provider geladen:', provider.name, 'AuthInfo:', provider.getAuthInfo?.());
      }
      
      // Status-Logik: Nur OAuth-basierte Provider benötigen Authentifizierung
      // Lokale Dateisystem-Bibliotheken sind immer "ready"
      if (currentLibrary.type === 'local') {
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
        // eslint-disable-next-line no-console
        console.log('[StorageContext] Lokale Bibliothek - Status auf "ready" gesetzt.');
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
          // eslint-disable-next-line no-console
          console.log('[StorageContext] OAuth-Provider: Status auf "ready" gesetzt, Token im localStorage gefunden.');
        } else {
          setLibraryStatus('waitingForAuth');
          setLibraryStatusAtom('waitingForAuth');
          // eslint-disable-next-line no-console
          console.log('[StorageContext] OAuth-Provider: Status auf "waitingForAuth" gesetzt, kein Token im localStorage.');
        }
      } else {
        // Unbekannter Provider-Typ - sicherheitshalber auf ready setzen
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
        // eslint-disable-next-line no-console
        console.log('[StorageContext] Unbekannter Provider-Typ, Status auf "ready" gesetzt.');
      }
    }
  }, [currentLibrary, provider]);

  // TEMP: Logging für API-Calls
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[StorageContext] API-Call ausgelöst. Aktueller Status:', libraryStatus);
  }, [libraryStatus]);

  useEffect(() => {
    // Logging der Library-IDs im StorageContext
    // eslint-disable-next-line no-console
    console.log('[StorageContextProvider] Render:', {
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
```

```typescriptreact
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
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
 * Provider-Komponente für den Storage-Context
 * Verwaltet den Zustand der Bibliotheken und des aktiven Providers
 */
export const StorageContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();

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
  }, [providerFromHook]);

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
  }, [activeLibraryId, libraries]);

  // Bibliotheken aus der API laden
  useEffect(() => {
    AuthLogger.debug('StorageContext', 'Library Loading Effect triggered', {
      isAuthLoaded,
      isUserLoaded,
      isSignedIn
    });

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
          setLibraries(supportedLibraries);
          
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
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, setLibraries, setActiveLibraryId, hasRedirectedToSettings]);

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
          .filter((lib: any) => typeof lib?.id === 'string' && lib.id.trim() !== '')
          .filter((lib: any) => isSupportedLibraryType(lib.type));
        setLibraries(filtered);
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
    // eslint-disable-next-line no-console
    console.log('[StorageContext] useEffect: currentLibrary', currentLibrary);
    if (currentLibrary) {
      // TEMP: Logging für Token in Konfiguration
      // eslint-disable-next-line no-console
      console.log('[StorageContext] Bibliothek geladen. Token vorhanden:', !!currentLibrary.config?.accessToken, 'Config:', currentLibrary.config);
      // TEMP: Logging für Provider-Status
      if (provider) {
        // eslint-disable-next-line no-console
        console.log('[StorageContext] Provider geladen:', provider.name, 'AuthInfo:', provider.getAuthInfo?.());
      }
      
      // Status-Logik: Nur OAuth-basierte Provider benötigen Authentifizierung
      // Lokale Dateisystem-Bibliotheken sind immer "ready"
      if (currentLibrary.type === 'local') {
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
        // eslint-disable-next-line no-console
        console.log('[StorageContext] Lokale Bibliothek - Status auf "ready" gesetzt.');
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
          // eslint-disable-next-line no-console
          console.log('[StorageContext] OAuth-Provider: Status auf "ready" gesetzt, Token im localStorage gefunden.');
        } else {
          setLibraryStatus('waitingForAuth');
          setLibraryStatusAtom('waitingForAuth');
          // eslint-disable-next-line no-console
          console.log('[StorageContext] OAuth-Provider: Status auf "waitingForAuth" gesetzt, kein Token im localStorage.');
        }
      } else {
        // Unbekannter Provider-Typ - sicherheitshalber auf ready setzen
        setLibraryStatus('ready');
        setLibraryStatusAtom('ready');
        // eslint-disable-next-line no-console
        console.log('[StorageContext] Unbekannter Provider-Typ, Status auf "ready" gesetzt.');
      }
    }
  }, [currentLibrary, provider]);

  // TEMP: Logging für API-Calls
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[StorageContext] API-Call ausgelöst. Aktueller Status:', libraryStatus);
  }, [libraryStatus]);

  useEffect(() => {
    // Logging der Library-IDs im StorageContext
    // eslint-disable-next-line no-console
    console.log('[StorageContextProvider] Render:', {
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
```

Kurzstatus: Ich habe den Fehler in der Select-Liste abgefangen und die Bibliotheks-Lade-Logik robust gemacht. Tabs sind technisch unabhängig, aber die Storage-Seite benötigt eine persistierte, aktive Library.

Analyse (prägnant):
- Ursache des Fehlers: Mindestens ein `SelectItem` bekam `value=""`. Das passiert, wenn eine Library ohne valide `id` in der Liste landet. Dann wirft Radix diesen Fehler.
- Woher kommt `""`? Beim Erstellen einer neuen Bibliothek setzt das Formular vor dem Speichern `activeLibraryId` bewusst auf `""`, damit keine bestehende Library überschrieben wird:
```123:149:src/components/settings/library-form.tsx
      setIsNew(false);
      // Zurück zur aktiven Bibliothek, falls vorhanden
      if (activeLibrary) {
...
```
und beim Start der Neuanlage:
```115:121:src/components/settings/library-form.tsx
  const handleCreateNew = useCallback(() => {
    setIsNew(true);
    // Wichtig: activeLibraryId zurücksetzen, damit keine bestehende Bibliothek überschrieben wird
    setActiveLibraryId("");
    form.reset(defaultValues);
  }, [form, defaultValues, setActiveLibraryId]);
```
- Das ist okay. Problematisch war, dass die Bibliotheksliste Items ohne gültige `id` durchreichen konnte (z. B. aus historischen Daten oder Edge Cases), und diese dann als `SelectItem value=""` gerendert wurden.

Edits (minimal-invasiv):
- In `LibrarySwitcher` rendere ich nur Bibliotheken mit nicht-leerer `id`.
- In `StorageContext` filtere ich Serverdaten hart gegen leere `id` und nicht unterstützte Typen, sowohl beim initialen Laden als auch bei Refresh.

Was bedeutet das für die Tabs/Logik?
- Die Settings sind Seiten, keine echten Tabs, aber sie funktionieren unabhängig:
  - Allgemein (`/settings`): Hier legst du Name, Basisdaten an. Beim Klick auf „Neue Bibliothek erstellen“ wird eine neue Session begonnen (`isNew=true`) und `activeLibraryId=""`. Die Library existiert zu diesem Zeitpunkt noch nicht in der DB.
  - Wichtig: Erst nach „Speichern“ existiert eine echte `id` (UUID) und die Library wird aktiv gesetzt.
  - Storage (`/settings/storage`): Benötigt eine persistierte aktive Library. Ohne `activeLibrary` zeigt sie sinnvoll „Keine Bibliothek ausgewählt“. Erwartetes Vorgehen: zuerst in Allgemein speichern, danach Storage konfigurieren.
- Nach meinen Edits gibt es keinen Crash mehr, wenn `activeLibraryId=""` ist oder (aus welcher Quelle auch immer) ein Library-Objekt ohne `id` in der Liste auftaucht.

Schneller Testvorschlag:
- App neu laden, zu `/settings` gehen.
- „Neue Bibliothek erstellen“, Name eingeben, speichern.
- Erwartung: kein Radix-Fehler im Header; danach zu „Storage“ wechseln und Provider konfigurieren.
- Edge: Falls deine DB alte Einträge ohne `id` enthält, werden diese jetzt automatisch ausgefiltert; die UI bleibt stabil.

Optional (Build/Lint):
- Empfohlene Checks:
```bash
pnpm lint
pnpm typecheck
```

Kurzfassung der Änderungen:
- `src/components/library/library-switcher.tsx`: `safeLibraries` eingeführt, die nur Libraries mit nicht-leerer `id` rendert.
- `src/contexts/storage-context.tsx`: Serverantworten doppelt gehärtet:
  - Beim initialen Laden und beim Refresh werden Libs ohne `id` und mit nicht unterstütztem Typ herausgefiltert.

Wenn das Problem nach dem Speichern weiterhin auftritt, gib mir kurz Bescheid, ob in deiner Datenbank alte Library-Einträge ohne `id` liegen. Dann bereinigen wir sie serverseitig ebenfalls vor der `toClientLibraries`-Konvertierung.

```typescriptreact
      setIsNew(false);
      // Zurück zur aktiven Bibliothek, falls vorhanden
      if (activeLibrary) {
...
```

```typescriptreact
  const handleCreateNew = useCallback(() => {
    setIsNew(true);
    // Wichtig: activeLibraryId zurücksetzen, damit keine bestehende Bibliothek überschrieben wird
    setActiveLibraryId("");
    form.reset(defaultValues);
  }, [form, defaultValues, setActiveLibraryId]);
```

```shellscript
pnpm lint
pnpm typecheck
```

---

**User**

Unter neu gebe ich eine neuen Namen ein
dann wechsle ich zu Storage -> Keine Bibliothek ausgewählt. Bitte wählen Sie eine Bibliothek aus.


---

**Cursor**

```typescriptreact
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect, useCallback, useMemo } from "react"
import { v4 as uuidv4 } from "uuid"
import { useAtom } from "jotai"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Textarea } from "../ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Trash2, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom"
import { StorageProviderType } from "@/types/library"

// Hauptschema für das Formular mit erweiterter Konfiguration
const libraryFormSchema = z.object({
  label: z.string({
    required_error: "Bitte geben Sie einen Namen ein.",
  }).min(3, "Der Name muss mindestens 3 Zeichen lang sein."),
  path: z.string({
    required_error: "Bitte geben Sie einen Speicherpfad ein.",
  }),
  type: z.enum(["local", "onedrive", "gdrive"], {
    required_error: "Bitte wählen Sie einen Speichertyp.",
  }),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  transcription: z.enum(["shadowTwin", "db"], {
    required_error: "Bitte wählen Sie eine Transkriptionsstrategie.",
  }),
  templateDirectory: z.string().default("/templates"),
  // Zusätzliche Storage-Konfiguration, abhängig vom Typ
  storageConfig: z.object({
    // Lokales Dateisystem
    basePath: z.string().optional(),
    // OAuth-basierte Provider (OneDrive, Google Drive)
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
  }),
})

type LibraryFormValues = z.infer<typeof libraryFormSchema>

// Füge die createNew-Prop hinzu
interface LibraryFormProps {
  createNew?: boolean;
}

export function LibraryForm({ createNew = false }: LibraryFormProps) {
  const { user } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  
  // Aktuelle Bibliothek aus dem globalen Zustand
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);
  
  const defaultValues = useMemo<LibraryFormValues>(() => ({
    label: "",
    path: "",
    type: "local",
    description: "",
    isEnabled: true,
    transcription: "shadowTwin",
    templateDirectory: "/templates",
    storageConfig: {
      basePath: "",
      clientId: "",
      clientSecret: "",
      redirectUri: "",
    }
  }), []);

  const form = useForm<LibraryFormValues>({
    resolver: zodResolver(libraryFormSchema),
    defaultValues,
  });

  // Funktion zum Erstellen einer neuen Bibliothek
  const handleCreateNew = useCallback(() => {
    setIsNew(true);
    // Wichtig: activeLibraryId zurücksetzen, damit keine bestehende Bibliothek überschrieben wird
    setActiveLibraryId("");
    form.reset(defaultValues);
  }, [form, defaultValues, setActiveLibraryId]);

  // Funktion zum Zurückkehren zur Bearbeitung der aktiven Bibliothek
  const handleCancelNew = useCallback(() => {
    setIsNew(false);
    // Zurück zur aktiven Bibliothek, falls vorhanden
    if (activeLibrary) {
      const storageConfig = {
        basePath: activeLibrary.path,
        clientId: activeLibrary.config?.clientId as string || "",
        clientSecret: activeLibrary.config?.clientSecret as string || "",
        redirectUri: activeLibrary.config?.redirectUri as string || "",
      };
      
      form.reset({
        label: activeLibrary.label,
        path: activeLibrary.path,
        type: activeLibrary.type,
        description: activeLibrary.config?.description as string || "",
        isEnabled: activeLibrary.isEnabled,
        transcription: activeLibrary.config?.transcription as "shadowTwin" | "db" || "shadowTwin",
        templateDirectory: activeLibrary.config?.templateDirectory as string || "/templates",
        storageConfig,
      });
    } else if (libraries.length > 0) {
      // Falls keine aktive Bibliothek, aber Bibliotheken vorhanden sind, zur ersten wechseln
      setActiveLibraryId(libraries[0].id);
    }
  }, [activeLibrary, libraries, form, setActiveLibraryId]);

  // Neue Bibliothek erstellen wenn createNew true ist
  useEffect(() => {
    if (createNew) {
      handleCreateNew();
    }
  }, [createNew, handleCreateNew]);

  // Form mit aktiver Bibliothek befüllen (nur wenn nicht im "Neue Bibliothek"-Modus)
  useEffect(() => {
    if (activeLibrary && !isNew) {
      // Extrahiere Storage-Konfiguration aus dem config-Objekt
      const storageConfig = {
        basePath: activeLibrary.path,
        clientId: activeLibrary.config?.clientId as string || "",
        clientSecret: activeLibrary.config?.clientSecret as string || "",
        redirectUri: activeLibrary.config?.redirectUri as string || "",
      };

      form.reset({
        label: activeLibrary.label,
        path: activeLibrary.path,
        type: activeLibrary.type,
        description: activeLibrary.config?.description as string || "",
        isEnabled: activeLibrary.isEnabled,
        transcription: activeLibrary.config?.transcription as "shadowTwin" | "db" || "shadowTwin",
        templateDirectory: activeLibrary.config?.templateDirectory as string || "/templates",
        storageConfig,
      });
    }
  }, [activeLibrary, isNew, form]);

  // Bibliothek speichern (neu erstellen oder aktualisieren)
  async function onSubmit(data: LibraryFormValues) {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um eine Bibliothek zu speichern.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Extrahiere die spezifischen Storage-Konfigurationen basierend auf dem Typ
      let storageConfig = {};
      
      switch(data.type) {
        case "local":
          storageConfig = {
            basePath: data.storageConfig.basePath,
          };
          break;
        case "onedrive":
        case "gdrive":
          storageConfig = {
            clientId: data.storageConfig.clientId,
            clientSecret: data.storageConfig.clientSecret,
            redirectUri: data.storageConfig.redirectUri,
          };
          break;
      }
      
      // WICHTIG: Für neue Bibliotheken IMMER eine neue ID generieren
      const newLibraryId = isNew ? uuidv4() : activeLibraryId;
      
      // Bibliotheksobjekt erstellen
      const libraryData = {
        id: newLibraryId,
        label: data.label,
        path: data.path,
        type: data.type as StorageProviderType,
        isEnabled: data.isEnabled,
        transcription: data.transcription,
        config: {
          description: data.description,
          transcription: data.transcription,
          templateDirectory: data.templateDirectory,
          ...storageConfig,
        }
      };
      
      // API-Anfrage zum Speichern der Bibliothek
      const response = await fetch('/api/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(libraryData),
      });
      
      if (!response.ok) {
        throw new Error(`Fehler beim Speichern: ${response.statusText}`);
      }
      
      // Lokalen Zustand aktualisieren
      if (isNew) {
        // Neue Bibliothek hinzufügen
        const newLibrary = {
          ...libraryData,
          icon: <AlertCircle className="h-4 w-4" />,
          config: {
            ...libraryData.config,
          }
        };
        setLibraries([...libraries, newLibrary]);
        setActiveLibraryId(newLibraryId);
        setIsNew(false);
        
        toast({
          title: "Bibliothek erstellt",
          description: `Die Bibliothek "${data.label}" wurde erfolgreich erstellt.`,
        });
        
        // Weiter direkt zu den Storage-Einstellungen navigieren
        router.push('/settings/storage');
      } else {
        // Bestehende Bibliothek aktualisieren
        const updatedLibraries = libraries.map(lib => 
          lib.id === libraryData.id ? {
            ...lib,
            ...libraryData,
            icon: lib.icon,
            config: {
              ...lib.config,
              ...libraryData.config,
            }
          } : lib
        );
        setLibraries(updatedLibraries);
        
        toast({
          title: "Bibliothek aktualisiert",
          description: `Die Bibliothek "${data.label}" wurde erfolgreich aktualisiert.`,
        });
      }
      
    } catch (error) {
      console.error('Fehler beim Speichern der Bibliothek:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  // Bibliothek löschen
  const handleDeleteLibrary = async () => {
    if (!activeLibraryId || !user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Fehler",
        description: "Keine Bibliothek zum Löschen ausgewählt oder Benutzer nicht angemeldet.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // API-Anfrage zum Löschen der Bibliothek
      const response = await fetch(`/api/libraries?libraryId=${activeLibraryId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Fehler beim Löschen: ${response.statusText}`);
      }
      
      
      // Lokalen Zustand aktualisieren
      const updatedLibraries = libraries.filter(lib => lib.id !== activeLibraryId);
      setLibraries(updatedLibraries);
      
      // Zur ersten verbliebenen Bibliothek wechseln oder leeren Zustand setzen
      if (updatedLibraries.length > 0) {
        setActiveLibraryId(updatedLibraries[0].id);
      } else {
        setActiveLibraryId("");
        setIsNew(true);
        form.reset(defaultValues);
      }
      
      toast({
        title: "Bibliothek gelöscht",
        description: `Die Bibliothek wurde erfolgreich gelöscht.`,
      });
      
      setIsDeleteDialogOpen(false);
      
    } catch (error) {
      console.error('Fehler beim Löschen der Bibliothek:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          {isNew ? (
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="font-medium">Neue Bibliothek erstellen</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">
                {activeLibrary ? `Bibliothek bearbeiten: ${activeLibrary.label}` : "Bibliothek auswählen"}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {isNew ? (
            <Button 
              onClick={handleCancelNew}
              variant="outline"
              size="sm"
            >
              Abbrechen
            </Button>
          ) : (
            <Button 
              onClick={handleCreateNew} 
              disabled={isLoading}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Neue Bibliothek erstellen
            </Button>
          )}
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Allgemeine Einstellungen */}
          <Card>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Geben Sie Ihrer Bibliothek einen treffenden Namen.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Beschreibung der Bibliothek"
                        className="resize-none"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Eine kurze Beschreibung der Bibliothek und ihres Inhalts.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="transcription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transkriptionsstrategie</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Transkriptionsstrategie auswählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="shadowTwin">Neben Originaldatei speichern (Shadow Twin)</SelectItem>
                        <SelectItem value="db">In Datenbank speichern</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Festlegen, wie Transkriptionen gespeichert werden sollen.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="templateDirectory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template-Verzeichnis</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="/templates" />
                    </FormControl>
                    <FormDescription>
                      Verzeichnis in der Bibliothek, in dem die Secretary Service Templates gespeichert werden.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Bibliothek aktivieren
                      </FormLabel>
                      <FormDescription>
                        Wenn deaktiviert, wird die Bibliothek in der Anwendung nicht angezeigt.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <div className="flex justify-between">
            {!isNew && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (activeLibrary) {
                    // Zurücksetzen-Funktion anpassen
                    const storageConfig = {
                      basePath: activeLibrary.path,
                      clientId: activeLibrary.config?.clientId as string || "",
                      clientSecret: activeLibrary.config?.clientSecret as string || "",
                      redirectUri: activeLibrary.config?.redirectUri as string || "",
                    };
                    
                    form.reset({
                      label: activeLibrary.label,
                      path: activeLibrary.path,
                      type: activeLibrary.type,
                      description: activeLibrary.config?.description as string || "",
                      isEnabled: activeLibrary.isEnabled,
                      transcription: activeLibrary.config?.transcription as "shadowTwin" | "db" || "shadowTwin",
                      templateDirectory: activeLibrary.config?.templateDirectory as string || "/templates",
                      storageConfig,
                    });
                  }
                }}
                disabled={isLoading}
              >
                Zurücksetzen
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isLoading || (!isNew && !form.formState.isDirty)}
            >
              {isLoading ? "Wird gespeichert..." : (isNew ? "Bibliothek erstellen" : "Änderungen speichern")}
            </Button>
          </div>
        </form>
      </Form>
      
      {/* Gefahrenbereich für Bibliothek löschen, nur anzeigen wenn keine neue Bibliothek erstellt wird */}
      {!isNew && activeLibrary && (
        <div className="mt-10">
          <h3 className="text-lg font-medium text-destructive">Gefahrenzone</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Hier können Sie die aktuelle Bibliothek unwiderruflich löschen.
          </p>
          
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <h4 className="font-medium">Bibliothek &quot;{activeLibrary.label}&quot; löschen</h4>
                  <p className="text-sm text-muted-foreground">
                    Das Löschen einer Bibliothek ist permanent und kann nicht rückgängig gemacht werden.
                    Alle Einstellungen und Verweise auf diese Bibliothek gehen verloren.
                  </p>
                </div>
                
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Bibliothek &quot;{activeLibrary.label}&quot; löschen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bibliothek löschen</DialogTitle>
                      <DialogDescription>
                        Sind Sie sicher, dass Sie die Bibliothek &quot;{activeLibrary.label}&quot; löschen möchten? 
                        Diese Aktion kann nicht rückgängig gemacht werden.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                        Abbrechen
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteLibrary}
                        disabled={isLoading}
                      >
                        {isLoading ? "Wird gelöscht..." : "Bibliothek unwiderruflich löschen"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

```

Kurzstatus: Ich habe zwei Punkte geklärt und eine kleine Verbesserung umgesetzt.

- Warum siehst du „Keine Bibliothek ausgewählt“ nach Wechsel zu Storage?
  - Beim Erstellen klickst du erst „Neue Bibliothek erstellen“, trägst einen Namen ein, aber bevor du speicherst, existiert noch keine persistierte Library. In diesem Modus ist `activeLibraryId` absichtlich leer. Die Storage-Seite zeigt in diesem Fall eine klare Meldung „Keine Bibliothek ausgewählt…“. Das ist beabsichtigt: erst speichern, dann Storage konfigurieren.

- Verbesserung eingebaut:
  - Nach erfolgreichem „Bibliothek erstellen“ leite ich jetzt direkt auf `Settings → Storage` um, damit du nahtlos den Storage setzen kannst. Das Speichern erzeugt eine echte `id`, setzt sie als aktiv und die Storage-Seite findet die Bibliothek.

Empfehlung zum Ablauf:
1) Allgemein: Name und ggf. Basisdaten eingeben.
2) Speichern. Danach wirst du automatisch nach „Storage“ geleitet.
3) Storage-Typ und Pfad/Client-Daten setzen, speichern.

Falls du statt Speichern erst zum Storage-Tab springst, siehst du weiterhin „Keine Bibliothek ausgewählt“. Das ist korrekt, weil es noch keine persistierte `id` gibt.

Kurzfassung der Änderung:
- `src/components/settings/library-form.tsx`: Nach erfolgreichem Erstellen navigiere ich nun zu `/settings/storage` statt `/library`.

