import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { SettingsLogger } from '@/lib/debug/logger';

export interface UserSettings {
  activeLibraryId?: string;
}

// Globaler Cache für API-Calls um doppelte Requests zu vermeiden
let globalLibrariesCache: any = null;
let globalLibrariesPromise: Promise<any> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5000; // 5 Sekunden Cache

export function useUserSettings() {
  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [settings, setSettings] = useState<UserSettings>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Einstellungen laden mit globalem Cache
  const loadSettings = useCallback(async () => {
    // Warte, bis Auth und User vollständig geladen sind
    if (!isAuthLoaded || !isUserLoaded) {
      return;
    }
    
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    if (!isSignedIn || !userEmail) {
      return;
    }

    // Prüfe Cache-Gültigkeit
    const now = Date.now();
    if (globalLibrariesCache && (now - cacheTimestamp) < CACHE_DURATION) {
      SettingsLogger.info('useUserSettings', 'Verwende gecachte Daten');
      setSettings({ activeLibraryId: globalLibrariesCache.activeLibraryId });
      return;
    }

    // Wenn bereits ein Request läuft, warte auf den
    if (globalLibrariesPromise) {
      SettingsLogger.info('useUserSettings', 'Request bereits in Bearbeitung - warte auf bestehenden Request');
      const cachedData = await globalLibrariesPromise;
      setSettings({ activeLibraryId: cachedData.activeLibraryId });
      return;
    }

    setIsLoading(true);
    setError(null);

    // Erstelle globalen Promise für Deduplizierung
    globalLibrariesPromise = (async () => {
      try {
        SettingsLogger.info('useUserSettings', 'Starte einzigen API-Request für Libraries');
        const response = await fetch('/api/libraries');
        if (!response.ok) {
          throw new Error(`Fehler beim Laden der Einstellungen: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache aktualisieren
        globalLibrariesCache = data;
        cacheTimestamp = Date.now();
        
        SettingsLogger.info('useUserSettings', 'Libraries aus API geladen und gecacht', { 
          activeLibraryId: data.activeLibraryId,
          hasLibraries: !!data.libraries,
          librariesCount: data.libraries?.length 
        });
        
        return data;
      } catch (err) {
        console.error('Fehler beim Laden der Libraries:', err);
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
        throw err;
      } finally {
        setIsLoading(false);
        // Promise zurücksetzen nach Abschluss
        globalLibrariesPromise = null;
      }
    })();

    try {
      const data = await globalLibrariesPromise;
      setSettings({ activeLibraryId: data.activeLibraryId });
    } catch (err) {
      // Fehler bereits geloggt
    }
  }, [isSignedIn, user?.primaryEmailAddress?.emailAddress, isAuthLoaded, isUserLoaded]);

  // Einstellungen speichern
  const saveSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    // Warte, bis Auth und User vollständig geladen sind (wie in StorageContext)
    if (!isAuthLoaded || !isUserLoaded) {
      return false;
    }
    
    // Verwende die gleiche Logik wie in StorageContext
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    if (!isSignedIn || !userEmail) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/libraries', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fehler beim Speichern der Einstellungen: ${response.statusText}`);
      }

      const responseData = await response.json();

      // Lokalen State aktualisieren
      setSettings(prev => ({ ...prev, ...newSettings }));
      return true;
    } catch (err) {
      console.error('Fehler beim Speichern der User-Einstellungen:', err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, user?.primaryEmailAddress?.emailAddress, isAuthLoaded, isUserLoaded]);

  // Aktive Library-ID setzen
  const setActiveLibraryId = useCallback(async (libraryId: string | null) => {
    // Direkt versuchen zu speichern, ohne Warteschleife
    const result = await saveSettings({ activeLibraryId: libraryId || undefined });
    if (result) {
      // Cache invalidieren bei erfolgreichem Speichern
      globalLibrariesCache = null;
      cacheTimestamp = 0;
      SettingsLogger.info('useUserSettings', 'Aktive Library-ID gespeichert und Cache invalidiert', { libraryId });
    } else {
      SettingsLogger.error('useUserSettings', 'Fehler beim Speichern der aktiven Library-ID', { libraryId });
    }
    return result;
  }, [saveSettings, isSignedIn, user?.primaryEmailAddress?.emailAddress, isAuthLoaded, isUserLoaded]);

  // Einstellungen beim ersten Laden abrufen - nur einmal pro Email
  useEffect(() => {
    // Warte, bis Auth und User vollständig geladen sind (wie in StorageContext)
    if (!isAuthLoaded || !isUserLoaded) return;
    
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    if (isSignedIn && userEmail && !isLoading && !settings.activeLibraryId) {
      SettingsLogger.info('useUserSettings', 'Triggere ersten Load der User-Einstellungen');
      loadSettings();
    }
  }, [isSignedIn, user?.primaryEmailAddress?.emailAddress, isAuthLoaded, isUserLoaded]);

  return {
    settings,
    isLoading,
    error,
    loadSettings,
    saveSettings,
    setActiveLibraryId,
    activeLibraryId: settings.activeLibraryId,
  };
} 