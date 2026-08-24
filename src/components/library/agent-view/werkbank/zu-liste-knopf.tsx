'use client'

/**
 * @fileoverview „Zu Liste hinzufuegen" im Detail-Kopf (F7, Welle W6).
 *
 * @description
 * Nimmt das gewaehlte Vorhaben in eine der eigenen Arbeitslisten auf
 * (Mitgliedschafts-Schluessel folderId, `pathSnapshot` nur fuers Anzeigen
 * toter Eintraege). Doppeltes Hinzufuegen meldet die Route idempotent als
 * `unchanged` — der Toast sagt das, statt still nichts zu tun. Ohne Listen
 * verweist der Knopf auf die Listen-Leiste (Anlegen wohnt dort, F6).
 *
 * @module components/library/agent-view
 */

import { useToast } from '@/components/ui/use-toast'
import { useWorklists } from '@/hooks/agent-view/use-worklists'
import type { VorhabenCard } from '@/lib/agent-view/types'

export function ZuListeKnopf({ libraryId, karte }: { libraryId: string; karte: VorhabenCard }) {
  const { toast } = useToast()
  const worklists = useWorklists(libraryId)
  const lists = worklists.query.data ?? []

  const hinzufuegen = async (listId: string) => {
    const liste = lists.find((eintrag) => eintrag.listId === listId)
    try {
      const ergebnis = await worklists.patch.mutateAsync({
        listId,
        body: { add: { folderId: karte.folderId, pathSnapshot: karte.path, name: karte.name } },
      })
      toast({
        title: ergebnis.unchanged ? 'Bereits in der Liste' : 'Zur Liste hinzugefuegt',
        description: `${karte.name} → „${liste?.name ?? listId}"`,
      })
    } catch (error) {
      toast({
        title: 'Hinzufuegen fehlgeschlagen',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    }
  }

  return (
    <select
      aria-label="Zu Liste hinzufuegen"
      value=""
      onChange={(event) => {
        const listId = event.target.value
        if (listId !== '') void hinzufuegen(listId)
      }}
      className="h-6 rounded-md border bg-background px-1.5 text-xs text-muted-foreground"
    >
      <option value="">Zu Liste hinzufuegen …</option>
      {lists.length === 0 && (
        <option value="" disabled>
          Keine Liste vorhanden — im Filter &bdquo;Liste ▾&ldquo; anlegen
        </option>
      )}
      {lists.map((liste) => (
        <option key={liste.listId} value={liste.listId}>
          {liste.name}
        </option>
      ))}
    </select>
  )
}
