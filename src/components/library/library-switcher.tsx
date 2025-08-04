"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { activeLibraryAtom, activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { createLibraryAtom } from "@/atoms/create-library-atom"
import { StateLogger, SettingsLogger } from "@/lib/debug/logger"
import { useUserSettings } from '@/hooks/use-user-settings';
import { useEffect } from "react";

interface LibrarySwitcherProps {
  isCollapsed?: boolean;
  onLibraryChange?: (libraryId: string) => void;
}

export function LibrarySwitcher({ 
  isCollapsed = false, 
  onLibraryChange
}: LibrarySwitcherProps) {
  const router = useRouter();
  const { activeLibraryId: userActiveLibraryId, setActiveLibraryId: saveUserActiveLibraryId, isLoading: settingsLoading } = useUserSettings();
  const [libraries] = useAtom(librariesAtom)
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom)
  const [activeLibrary] = useAtom(activeLibraryAtom)
  const [, setCreateLibrary] = useAtom(createLibraryAtom)
  
  const currentLibrary = libraries.find(lib => lib.id === activeLibraryId) || activeLibrary;
  
  // Prüfe Library-Synchronisation - StorageContext setzt activeLibraryId bereits
  useEffect(() => {
    // Warte, bis die User-Einstellungen geladen sind
    if (settingsLoading || libraries.length === 0) {
      StateLogger.debug('LibrarySwitcher', 'Warte auf User-Einstellungen oder Libraries', { 
        settingsLoading, 
        librariesCount: libraries.length 
      });
      return;
    }
    
    StateLogger.info('LibrarySwitcher', 'Prüfe Library-Synchronisation', { 
      userActiveLibraryId, 
      activeLibraryId,
      availableLibraries: libraries.map(lib => lib.id)
    });
    
    // StorageContext setzt activeLibraryId bereits aus der API-Response
    // LibrarySwitcher muss nur noch prüfen, ob alles synchron ist
    if (userActiveLibraryId && activeLibraryId !== userActiveLibraryId) {
      StateLogger.warn('LibrarySwitcher', 'Inkonsistenz erkannt - korrigiere activeLibraryId', {
        userActiveLibraryId,
        activeLibraryId
      });
      setActiveLibraryId(userActiveLibraryId);
    } else {
      StateLogger.info('LibrarySwitcher', 'Library-Auswahl ist synchron', {
        activeLibraryId
      });
    }
  }, [userActiveLibraryId, libraries, settingsLoading, activeLibraryId]);

  const handleLibraryChange = async (value: string) => {
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
    
    StateLogger.info('LibrarySwitcher', 'Bibliothek wird geändert - starte Speicher- und Neuinitialisierungs-Prozess', { 
      from: activeLibraryId, 
      to: value 
    });
    
    try {
      // 1. In Datenbank speichern
      const result = await saveUserActiveLibraryId(value);
      
      if (result) {
        SettingsLogger.info('LibrarySwitcher', 'Bibliothek erfolgreich in Datenbank gespeichert', { libraryId: value });
        
        // 2. Komplette Neuinitialisierung durch Seiten-Reload
        StateLogger.info('LibrarySwitcher', 'Starte komplette Neuinitialisierung via Seiten-Reload');
        window.location.reload();
        
      } else {
        SettingsLogger.error('LibrarySwitcher', 'Fehler beim Speichern in Datenbank - Neuinitialisierung abgebrochen', { libraryId: value });
      }
      
    } catch (error) {
      SettingsLogger.error('LibrarySwitcher', 'Fehler beim Speichern der Library-Auswahl', { libraryId: value, error });
    }
  }
  
  // Nicht rendern bis User-Einstellungen und Libraries geladen sind und gültige Library-ID gesetzt ist
  if (settingsLoading || libraries.length === 0 || !activeLibraryId) {
    StateLogger.debug('LibrarySwitcher', 'Rendering pausiert - warte auf vollständige Initialisierung', { 
      settingsLoading, 
      librariesCount: libraries.length,
      activeLibraryId: !!activeLibraryId
    });
    return (
      <div className="flex items-center justify-center h-9 w-full bg-muted rounded-md">
        <span className="text-sm text-muted-foreground">Lade Bibliotheken...</span>
      </div>
    );
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
          {libraries.map((library) => (
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