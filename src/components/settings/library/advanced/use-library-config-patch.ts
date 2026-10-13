"use client"

/**
 * useLibraryConfigPatch — gemeinsamer Speicherweg der Teil-Seiten unter
 * „Erweitert" und des Schritts „Erfassen" auf der Archive-Seite
 * (Plan speicher-verbindungen-und-library-anlage, Teil B).
 *
 * Jede Seite schickt NUR die Config-Schluessel, die ihr gehoeren, per
 * PATCH /api/libraries/[id]. Die Route fuehrt die Config auf oberster Ebene
 * zusammen: nicht mitgeschickte Schluessel bleiben unberuehrt, ein
 * mitgeschickter Schluessel ersetzt das gespeicherte Objekt als Ganzes —
 * deshalb schickt jede Seite ihre Objekte vollstaendig.
 */

import { useCallback, useState } from "react"
import { toast } from '@ks/ui'
import { useActiveLibraryId, useLibraries, useSetLibraries } from '@ks/shell/react'
import type { ClientLibrary } from "@/types/library"

/** Teilmenge der Client-Config, die eine Seite besitzt und schreibt. */
export type LibraryConfigPatch = Partial<ClientLibrary["config"]>

/** Liest die Fehlermeldung der Route, wenn sie eine liefert (z. B. 400 bei Chat-Config). */
async function fehlertextAusAntwort(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === "string" && body.error.trim() !== "") return body.error
  } catch (err) {
    console.debug("[LibraryConfigPatch] Antwort ohne JSON-Fehlertext:", err)
  }
  return `Fehler beim Speichern: ${response.statusText}`
}

export function useLibraryConfigPatch() {
  const libraries = useLibraries()
  const setLibraries = useSetLibraries()
  const activeLibraryId = useActiveLibraryId()
  const [isLoading, setIsLoading] = useState(false)
  const activeLibrary = libraries.find((lib) => lib.id === activeLibraryId)

  /** Speichert `config` (nur eigene Schluessel) und spiegelt sie in den Library-Zustand. */
  const patchConfig = useCallback(
    async (config: LibraryConfigPatch, erfolgTitel: string): Promise<boolean> => {
      if (!activeLibrary) {
        toast({ title: "Fehler", description: "Keine Bibliothek ausgewählt.", variant: "destructive" })
        return false
      }
      setIsLoading(true)
      try {
        const response = await fetch(`/api/libraries/${activeLibrary.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        })
        if (!response.ok) {
          throw new Error(await fehlertextAusAntwort(response))
        }
        setLibraries(
          libraries.map((lib) =>
            lib.id === activeLibrary.id ? { ...lib, config: { ...lib.config, ...config } } : lib,
          ),
        )
        toast({
          title: erfolgTitel,
          description: `Die Bibliothek "${activeLibrary.label}" wurde erfolgreich aktualisiert.`,
        })
        return true
      } catch (error) {
        console.error("[LibraryConfigPatch] Fehler beim Speichern der Bibliothek:", error)
        toast({
          title: "Fehler",
          description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
          variant: "destructive",
        })
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [activeLibrary, libraries, setLibraries],
  )

  return { activeLibrary, activeLibraryId, isLoading, patchConfig }
}
