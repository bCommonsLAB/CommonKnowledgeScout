'use client'

/**
 * @fileoverview Client-Hook fuer die Stand-Route (F8, Welle W7).
 *
 * @description
 * Kapselt `POST /api/library/{id}/agent-view/stand` nach dem Muster
 * `use-twin-curation.ts`: Nach Erfolg wird der Report NICHT neu gerechnet —
 * ein Override je folderId ueberlagert den erklaerten Stand lokal, bis der
 * naechste Scan laeuft (die UI sagt das dazu).
 *
 * 409-Antworten sind BEFUNDE, keine technischen Fehler: `nicht_bereit`
 * kommt MIT der Befundliste des frischen Teilbaum-Scans zurueck und wird
 * im Klartext angezeigt; `kein_index`, `stand_geaendert` (inkl. aktuellem
 * Stand) und `report_veraltet` benennen jeweils den naechsten Schritt.
 * Nichts wurde in diesen Faellen geschrieben.
 *
 * @module hooks/agent-view
 */

import { useCallback, useState } from 'react'
import type { BlockierenderBefund } from '@/lib/agent-view/stand-plan'
import type { Bearbeitungsstand } from '@/lib/agent-view/types'

/** Frischer erklaerter Stand — ueberlagert die Karte bis zum naechsten Scan. */
export interface StandOverride {
  bearbeitungsstand: Bearbeitungsstand
  bearbeitungsstandSeit: string | null
}

/** Klartext-Befund einer abgelehnten Stand-Aenderung (409-Katalog der Route). */
export interface StandFehler {
  text: string
  code: string | null
  /** Nur bei `nicht_bereit`: blockierende Befunde des frischen Scans. */
  befunde: readonly BlockierenderBefund[]
  gesamt: number
}

export interface SetzeStandArgs {
  folderId: string
  stand: Bearbeitungsstand
  erwarteterStand: Bearbeitungsstand | null
  reportGeneratedAt: string
  bestaetigen?: boolean
}

export interface UseStandResult {
  overrides: ReadonlyMap<string, StandOverride>
  /** folderId der gerade laufenden Aktion (eine zur Zeit). */
  pendingFolderId: string | null
  fehlerByFolder: ReadonlyMap<string, StandFehler>
  setzeStand(args: SetzeStandArgs): Promise<void>
}

interface StandRouteAntwort {
  stand?: StandOverride
  error?: string
  code?: string
  befunde?: BlockierenderBefund[]
  gesamt?: number
}

async function leseAntwort(response: Response): Promise<StandRouteAntwort> {
  try {
    return (await response.json()) as StandRouteAntwort
  } catch {
    // Antwort ohne JSON-Body: Status-Code ist die beste verfuegbare Aussage.
    return { error: `HTTP ${response.status}` }
  }
}

export function useStand(libraryId: string): UseStandResult {
  const [overrides, setOverrides] = useState<Map<string, StandOverride>>(new Map())
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null)
  const [fehlerByFolder, setFehlerByFolder] = useState<Map<string, StandFehler>>(new Map())

  const setzeStand = useCallback(
    async (args: SetzeStandArgs) => {
      setPendingFolderId(args.folderId)
      setFehlerByFolder((prev) => {
        const next = new Map(prev)
        next.delete(args.folderId)
        return next
      })
      try {
        const response = await fetch(`/api/library/${encodeURIComponent(libraryId)}/agent-view/stand`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderId: args.folderId,
            stand: args.stand,
            erwarteterStand: args.erwarteterStand,
            reportGeneratedAt: args.reportGeneratedAt,
            bestaetigen: args.bestaetigen === true,
          }),
        })
        const antwort = await leseAntwort(response)
        if (!response.ok || !antwort.stand) {
          setFehlerByFolder((prev) =>
            new Map(prev).set(args.folderId, {
              text: antwort.error ?? `HTTP ${response.status}`,
              code: antwort.code ?? null,
              befunde: antwort.befunde ?? [],
              gesamt: antwort.gesamt ?? antwort.befunde?.length ?? 0,
            }),
          )
          return
        }
        const stand = antwort.stand
        setOverrides((prev) => new Map(prev).set(args.folderId, stand))
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        setFehlerByFolder((prev) =>
          new Map(prev).set(args.folderId, { text, code: null, befunde: [], gesamt: 0 }),
        )
      } finally {
        setPendingFolderId(null)
      }
    },
    [libraryId],
  )

  return { overrides, pendingFolderId, fehlerByFolder, setzeStand }
}
