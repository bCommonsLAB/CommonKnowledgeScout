'use client'

/**
 * Satz-Korrektur sofort speichern (Owner-Wunsch 10.10.2026: „Uebernehmen" IST
 * die Bestaetigung, wie in einem Editor — keine Vormerkung, keine Begruendung
 * von Hand). Geht ueber denselben Schreibweg wie die Ersetzungen
 * (`POST transcript-correction`): ganzer Satz alt → neu, Begruendung
 * automatisch mit Zeitmarke, Riegel `ifUpdatedAt`. Speichern laeuft
 * nacheinander (Warteschlange), damit schnell hintereinander korrigierte
 * Saetze nicht am Riegel scheitern. Ein Fehler kommt an den Satz zurueck,
 * der Text bleibt im Editor — keine Arbeit geht still verloren.
 */

import * as React from 'react'
import { formatZeit } from '@/lib/transkript-verlaesslichkeit/befunde'
import type { ApplyAntwort } from './audio-correction-types'
import type { KorrekturZustand } from './use-audio-correction'

export interface SatzSpeichernArgs {
  libraryId: string
  sourceId: string
  zustand: KorrekturZustand | null
  setZustand: React.Dispatch<React.SetStateAction<KorrekturZustand | null>>
  /** Nach erfolgreichem Speichern (z. B. Revisionsstand im Reiter Transformation auffrischen). */
  onGespeichert?: () => void
}

/** Liefert `null` bei Erfolg, sonst die Fehlermeldung fuer den Satz. */
export type SpeichereSatz = (index: number, neu: string) => Promise<string | null>

export function useSatzSpeichern(args: SatzSpeichernArgs): SpeichereSatz {
  const { libraryId, sourceId, zustand, setZustand, onGespeichert } = args
  const stand = React.useRef(zustand)
  stand.current = zustand
  const schlange = React.useRef<Promise<unknown>>(Promise.resolve())

  return React.useCallback((index: number, neu: string) => {
    const lauf = schlange.current.then(async (): Promise<string | null> => {
      const z = stand.current
      const segment = z?.segmente?.segments[index]
      if (!z || !segment) return 'Satz nicht gefunden — Seite neu laden'
      const alt = segment.text
      const text = neu.trim()
      if (text === '' || text === alt) return null
      const res = await fetch(`/api/library/${libraryId}/transcript-correction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId, ersetzungen: [{ alt, neu: text }], sprecher: [],
          begruendung: `Satz bei ${formatZeit(segment.start)} beim Nachhoeren korrigiert`,
          ifUpdatedAt: z.updatedAt, nurVorschau: false,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as Partial<ApplyAntwort> & { error?: string }
      if (!res.ok) return json.error || `Speichern fehlgeschlagen (HTTP ${res.status})`
      // Lokal nachziehen statt neu laden: neuer Riegel und der Satz mit dem gespeicherten Text.
      // `stand` sofort setzen, damit der naechste Satz in der Schlange nicht auf den Render wartet.
      const aktuell = stand.current ?? z
      const segmente = aktuell.segmente
      const naechster: KorrekturZustand = {
        ...aktuell,
        updatedAt: json.updatedAt ?? aktuell.updatedAt,
        revisedAt: json.revision?.revised_at ?? aktuell.revisedAt,
        segmente: segmente
          ? { ...segmente, segments: segmente.segments.map((s, i) => (i === index ? { ...s, text } : s)), updatedAt: new Date().toISOString() }
          : segmente,
      }
      stand.current = naechster
      setZustand(naechster)
      onGespeichert?.()
      return null
    })
    schlange.current = lauf.catch(() => undefined)
    return lauf.catch((e: unknown) => (e instanceof Error ? e.message : String(e)))
  }, [libraryId, sourceId, setZustand, onGespeichert])
}
