"use client"

import * as React from "react"
import { useState } from "react"
import { useAtom } from "jotai"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { activeLibraryAtom, activeLibraryIdAtom, currentFolderIdAtom, folderItemsAtom, lastLoadedFolderAtom, librariesAtom, libraryAtom } from "@/atoms/library-atom"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { StateLogger } from "@/lib/debug/logger"
import { CreateLibraryDialog } from "./create-library-dialog"

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
  const [, setCurrentFolderId] = useAtom(currentFolderIdAtom)
  const [, setFolderItems] = useAtom(folderItemsAtom)
  const [, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom)
  const [, setLibraryState] = useAtom(libraryAtom)
  
  // Dialog-State für Neue Bibliothek erstellen
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  
  const currentLibrary = libraries.find(lib => lib.id === activeLibraryId) || activeLibrary;
  const safeLibraries = React.useMemo(() => {
    return (libraries || []).filter(lib => typeof lib.id === 'string' && lib.id.trim() !== '');
  }, [libraries]);
  
  /**
   * Handler für Library-Wechsel nach erfolgreicher Erstellung im Dialog.
   * Navigiert zur Settings-Seite, um die neue Library zu konfigurieren.
   */
  const handleLibraryCreated = (libraryId: string) => {
    StateLogger.info('LibrarySwitcher', 'Neue Bibliothek erstellt, navigiere zu Settings', { libraryId })
    // Navigiere zu den Settings für weitere Konfiguration
    router.push('/settings')
  }

  const handleLibraryChange = (value: string) => {
    // Wenn der spezielle Wert für "Neue Bibliothek erstellen" ausgewählt wurde
    if (value === "new-library") {
      // Öffne den Dialog anstatt direkt zur Settings-Seite zu navigieren
      setIsCreateDialogOpen(true)
      return;
    }
    
    // Normale Bibliotheksauswahl
    if (onLibraryChange) {
      onLibraryChange(value)
    }
    
    // Speichere die aktive Library-ID im localStorage
    StateLogger.debug('LibrarySwitcher', 'Speichere activeLibraryId im localStorage', { value });
    try {
      localStorage.setItem('activeLibraryId', value)
    } catch {
      // Ignoriere Storage-Fehler still, UI-State bleibt konsistent
    }

    // Sofortiger UI-Reset, um alte Liste zu vermeiden
    // WICHTIG: folderCache muss SYNCHRON vor dem Library-Wechsel geleert werden,
    // um Race Conditions zu vermeiden. Sonst kann loadItems() in library.tsx
    // noch den alten Cache der vorherigen Library verwenden.
    setLibraryState(state => ({ ...state, folderCache: {} }))
    setFolderItems([])
    setLastLoadedFolder(null)
    setCurrentFolderId('root')

    // Aktualisiere das Atom
    setActiveLibraryId(value);
    StateLogger.info('LibrarySwitcher', 'Bibliothek geändert zu', { libraryId: value });

    // URL bereinigen: vorhandene folderId aus der vorherigen Library entfernen
    try {
      router.replace('/library');
    } catch {}
  }

  return (
    <>
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

      {/* Dialog zum Erstellen einer neuen Bibliothek */}
      <CreateLibraryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={handleLibraryCreated}
      />
    </>
  )
} 