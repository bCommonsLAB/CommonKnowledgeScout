"use client"

/**
 * Export/Import der Library-Konfiguration als JSON (Seite Erweitert · Wartung).
 * Herkunft: use-library-form.ts (vor Teil B eine Form fuer alles). Nach dem
 * Import wird die neue Library aktiv; die Seiten lesen ihre Felder aus dem
 * Library-Zustand, ein Formular-Reset ist hier nicht mehr noetig.
 */

import { useCallback, useState } from "react"
import { toast } from '@ks/ui'
import { useActiveLibraryId, useLibraries, useSetActiveLibraryId, useSetLibraries } from '@ks/shell/react'
import { useSafeUser } from "@/hooks/use-safe-user"

export function useLibraryImportExport() {
  const { user } = useSafeUser()
  const libraries = useLibraries()
  const setLibraries = useSetLibraries()
  const activeLibraryId = useActiveLibraryId()
  const setActiveLibraryId = useSetActiveLibraryId()
  const [isLoading, setIsLoading] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const activeLibrary = libraries.find((lib) => lib.id === activeLibraryId)

  /** Bibliothek exportieren */
  const handleExportLibrary = useCallback(async () => {
    if (!activeLibraryId || !user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Fehler",
        description: "Keine Bibliothek zum Exportieren ausgewählt oder Benutzer nicht angemeldet.",
        variant: "destructive",
      })
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch(`/api/libraries/${activeLibraryId}/export`)
      if (!response.ok) {
        throw new Error(`Fehler beim Exportieren: ${response.statusText}`)
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `library-${activeLibrary?.label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast({
        title: "Bibliothek exportiert",
        description: `Die Bibliothek "${activeLibrary?.label}" wurde erfolgreich exportiert.`,
      })
    } catch (error) {
      console.error("[LibraryImportExport] Fehler beim Exportieren der Bibliothek:", error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Exportieren",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [activeLibraryId, user, activeLibrary])

  /** Bibliothek importieren */
  const handleImportLibrary = useCallback(
    async (file: File) => {
      if (!user?.primaryEmailAddress?.emailAddress) {
        toast({
          title: "Fehler",
          description: "Sie müssen angemeldet sein, um eine Bibliothek zu importieren.",
          variant: "destructive",
        })
        return
      }
      setIsLoading(true)
      try {
        const text = await file.text()
        const libraryData = JSON.parse(text) as Record<string, unknown>
        const response = await fetch("/api/libraries/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ libraryData }),
        })
        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string }
          throw new Error(errorData.error ?? `Fehler beim Importieren: ${response.statusText}`)
        }
        const result = (await response.json()) as { library: Record<string, unknown> }
        const importedLibrary = result.library
        // icon-Platzhalter: wird von der Client-Atom-Logik gesetzt
        const newLibrary = { ...(importedLibrary as object) }
        setLibraries([...libraries, newLibrary as Parameters<typeof setLibraries>[0][0]])
        setActiveLibraryId(importedLibrary.id as string)
        setIsImportDialogOpen(false)
        toast({
          title: "Bibliothek importiert",
          description: `Die Bibliothek "${importedLibrary.label as string}" wurde erfolgreich importiert.`,
        })
      } catch (error) {
        console.error("[LibraryImportExport] Fehler beim Importieren der Bibliothek:", error)
        toast({
          title: "Fehler",
          description: error instanceof Error ? error.message : "Unbekannter Fehler beim Importieren",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    },
    [user, libraries, setLibraries, setActiveLibraryId],
  )

  return { activeLibrary, isLoading, isImportDialogOpen, setIsImportDialogOpen, handleExportLibrary, handleImportLibrary }
}
