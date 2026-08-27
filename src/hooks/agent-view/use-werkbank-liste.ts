'use client'

/**
 * @fileoverview Ableitungen der aktiven Arbeitsliste fuer die Werkbank (F7, W6).
 *
 * @description
 * Kapselt die Kreuzung von Buch 3 (Listen via `use-worklists`) mit Buch 2
 * (Report-Karten): Mitglieder-Menge fuer den Listen-Filter, Fortschritt,
 * tote Eintraege, Seeding-Kandidaten (`berichtStatus: aktiv`) sowie
 * Pin-/Entfernen-Aktionen mit Klartext-Fehlern (Toast) — damit das Panel
 * unter der 200-Zeilen-Grenze bleibt. Alles clientseitig, keine
 * Server-Aggregation (F7).
 *
 * @module hooks/agent-view
 */

import { useMemo } from 'react'
import { useToast } from '@ks/ui'
import {
  kreuzeListeMitReport,
  zaehleWorklistFortschritt,
  type WorklistFortschritt,
  type WorklistKreuzung,
} from '@/lib/agent-view/worklist-fortschritt'
import type { VorhabenCard } from '@/lib/agent-view/types'
import type { WorklistFolderEntry } from '@/lib/repositories/agent-view-worklists-repo'
import { useWorklists, type Worklist } from './use-worklists'

export interface WerkbankListeArgs {
  libraryId: string
  vorhaben: readonly VorhabenCard[]
  /** Aktiv nur im Filter-Modus `liste` — sonst bleiben alle Ableitungen null. */
  aktiv: boolean
  /** `?liste=` aus der URL; null = keine gewaehlt. */
  listeId: string | null
}

export function useWerkbankListe(args: WerkbankListeArgs) {
  const { toast } = useToast()
  const worklists = useWorklists(args.libraryId)
  const lists: Worklist[] = worklists.query.data ?? []

  const aktiveListe = args.aktiv && args.listeId !== null
    ? lists.find((liste) => liste.listId === args.listeId) ?? null
    : null

  const kreuzung: WorklistKreuzung | null = useMemo(
    () => (aktiveListe ? kreuzeListeMitReport(aktiveListe.folders, args.vorhaben) : null),
    [aktiveListe, args.vorhaben],
  )
  const mitglieder: ReadonlySet<string> | null = useMemo(
    () => (aktiveListe ? new Set(aktiveListe.folders.map((eintrag) => eintrag.folderId)) : null),
    [aktiveListe],
  )
  const fortschritt: WorklistFortschritt | null = kreuzung
    ? zaehleWorklistFortschritt(kreuzung.karten)
    : null

  /** Seeding-Kopie beim Anlegen (F7): Karten mit erklaertem `status: aktiv`. */
  const seedKandidaten = (): Omit<WorklistFolderEntry, 'addedAt'>[] =>
    args.vorhaben
      .filter((karte) => karte.berichtStatus === 'aktiv')
      .map((karte) => ({ folderId: karte.folderId, pathSnapshot: karte.path, name: karte.name }))

  const meldeFehler = (titel: string, error: unknown) =>
    toast({ title: titel, description: error instanceof Error ? error.message : String(error), variant: 'destructive' })

  /** Pin an der Zeile: togglet die Mitgliedschaft in der AKTIVEN Liste. */
  const pinToggle = async (card: VorhabenCard): Promise<void> => {
    if (aktiveListe === null || mitglieder === null) return
    try {
      await worklists.patch.mutateAsync({
        listId: aktiveListe.listId,
        body: mitglieder.has(card.folderId)
          ? { remove: card.folderId }
          : { add: { folderId: card.folderId, pathSnapshot: card.path, name: card.name } },
      })
    } catch (error) {
      meldeFehler('Listen-Aenderung fehlgeschlagen', error)
    }
  }

  /** Entfernt einen toten Eintrag (Zeile „nicht im letzten Scan"). */
  const entferneTot = async (folderId: string): Promise<void> => {
    if (aktiveListe === null) return
    try {
      await worklists.patch.mutateAsync({ listId: aktiveListe.listId, body: { remove: folderId } })
    } catch (error) {
      meldeFehler('Entfernen fehlgeschlagen', error)
    }
  }

  return { worklists, lists, aktiveListe, kreuzung, mitglieder, fortschritt, seedKandidaten, pinToggle, entferneTot }
}
