"use client"

/**
 * Kleine Bausteine, die alle Teil-Formulare unter „Erweitert" teilen:
 * Hinweis ohne gewaehlte Bibliothek und die Speichern-Zeile.
 * Owner-Regel: Knopfzeilen brechen nie um (kein flex-wrap, Text nowrap).
 */

import { Button } from '@ks/ui'

export function NoLibrarySelected() {
  return <div className="text-center text-muted-foreground">Bitte wählen Sie eine Bibliothek aus.</div>
}

interface SaveRowProps {
  isLoading: boolean
  isDirty: boolean
}

/** Ein Speichern-Knopf je Seite (Plan Teil B: eine Seite, ein Config-Objekt, ein Knopf). */
export function SaveRow({ isLoading, isDirty }: SaveRowProps) {
  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={isLoading || !isDirty} className="whitespace-nowrap">
        {isLoading ? "Wird gespeichert..." : "Änderungen speichern"}
      </Button>
    </div>
  )
}
