"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ClientLibrary } from "@/types/library"
import { activeLibraryAtom, activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"

interface LibrarySwitcherProps {
  isCollapsed?: boolean;
  // Optional, um direkte Übergabe weiterhin zu unterstützen
  libraries?: ClientLibrary[];
  activeLibraryId?: string;
  onLibraryChange?: (libraryId: string) => void;
}

export function LibrarySwitcher({ 
  isCollapsed = false, 
  libraries: propLibraries,
  activeLibraryId: propActiveLibraryId,
  onLibraryChange
}: LibrarySwitcherProps) {
  // Verwende entweder die Props oder den Jotai-Zustand
  const [globalLibraries] = useAtom(librariesAtom)
  const [globalActiveLibraryId, setGlobalActiveLibraryId] = useAtom(activeLibraryIdAtom)
  const [activeLibrary] = useAtom(activeLibraryAtom)
  
  // Priorisiere Props über globalen Zustand
  const effectiveLibraries = propLibraries || globalLibraries
  const effectiveActiveLibraryId = propActiveLibraryId || globalActiveLibraryId
  
  // Bestimme das aktuelle Library-Objekt
  const currentLibrary = effectiveLibraries.find(lib => lib.id === effectiveActiveLibraryId) || activeLibrary;
  
  // Verarbeite Änderungen der Bibliothek
  const handleLibraryChange = (libraryId: string) => {
    // Wenn ein externer Handler übergeben wurde, rufe ihn auf
    if (onLibraryChange) {
      onLibraryChange(libraryId)
    }
    
    // Aktualisiere auch den globalen Zustand
    setGlobalActiveLibraryId(libraryId)
    
    // Log für Debugging
    console.log('LibrarySwitcher: Bibliothek geändert zu', libraryId)
  }

  return (
    <Select 
      value={effectiveActiveLibraryId} 
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
        {effectiveLibraries.map((library) => (
          <SelectItem key={library.id} value={library.id}>
            <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
              {library.icon}
              {library.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
} 