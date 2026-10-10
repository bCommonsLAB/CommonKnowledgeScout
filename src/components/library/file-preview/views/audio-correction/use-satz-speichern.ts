'use client'

/**
 * Korrekturen sofort speichern (Owner 10.10.2026: „Uebernehmen" IST die
 * Bestaetigung, wie in einem Editor). Zwei Arten, beide ueber
 * `POST transcript-correction` (Riegel `ifUpdatedAt`, Begruendung automatisch
 * mit Zeitmarke):
 * - `speichereSatz(index, neu)`: ganzer Satz alt → neu,
 * - `speichereSprecher(index, name)`: ab diesem Satz spricht `name`.
 * Alles laeuft nacheinander (Warteschlange), damit schnell hintereinander
 * gespeicherte Aenderungen nicht am Riegel scheitern. Ergebnis `null` =
 * gespeichert, sonst die Fehlermeldung fuer die Oberflaeche.
 */

import * as React from 'react'
import { formatZeit } from '@/lib/transkript-verlaesslichkeit/befunde'
import type { KorrekturZustand } from './use-audio-correction'

export interface SatzSpeichernArgs {
  libraryId: string
  sourceId: string
  zustand: KorrekturZustand | null
  setZustand: React.Dispatch<React.SetStateAction<KorrekturZustand | null>>
  /** Nach erfolgreichem Speichern (z. B. Revisionsstand im Reiter Transformation auffrischen). */
  onGespeichert?: () => void
}

export type Speichern = (index: number, wert: string) => Promise<string | null>
/** name null = Sprecher an diesem Satz entfernen. */
export type SprecherSpeichern = (index: number, name: string | null) => Promise<string | null>

interface Antwort {
  updatedAt?: string | null
  revision?: { revised_at?: string }
  error?: string
}

export function useSatzSpeichern(args: SatzSpeichernArgs): { speichereSatz: Speichern; speichereSprecher: SprecherSpeichern } {
  const { libraryId, sourceId, zustand, setZustand, onGespeichert } = args
  const stand = React.useRef(zustand)
  stand.current = zustand
  const schlange = React.useRef<Promise<unknown>>(Promise.resolve())

  // `wert` null (nur Sprecher) = Sprecher an diesem Satz entfernen.
  const lauf = React.useCallback((art: 'satz' | 'sprecher', index: number, wert: string | null): Promise<string | null> => {
    const schritt = schlange.current.then(async (): Promise<string | null> => {
      const z = stand.current
      const segment = z?.segmente?.segments[index]
      if (!z || !segment) return 'Satz nicht gefunden — Seite neu laden'
      const text = wert === null ? null : wert.trim()
      if (art === 'satz' && (text === null || text === '' || text === segment.text)) return null
      if (art === 'sprecher' && (text === '' || text === (segment.speaker ?? null))) return null
      const zeit = formatZeit(segment.start)
      const begruendung = art === 'satz'
        ? `Satz bei ${zeit} beim Nachhoeren korrigiert`
        : text === null ? `Sprecher bei ${zeit} entfernt` : `Sprecher ab ${zeit}: ${text}`
      const res = await fetch(`/api/library/${libraryId}/transcript-correction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId, sprecher: [], ifUpdatedAt: z.updatedAt, nurVorschau: false, begruendung,
          ...(art === 'satz'
            ? { ersetzungen: [{ alt: segment.text, neu: text }] }
            : { ersetzungen: [], sprecherWechsel: [{ satzIndex: index, name: text }] }),
        }),
      })
      const json = (await res.json().catch(() => ({}))) as Antwort
      if (!res.ok) return json.error || `Speichern fehlgeschlagen (HTTP ${res.status})`
      // Lokal nachziehen statt neu laden; `stand` sofort setzen, damit der naechste Schritt nicht auf den Render wartet.
      const aktuell = stand.current ?? z
      const segmente = aktuell.segmente
      const naechster: KorrekturZustand = {
        ...aktuell,
        updatedAt: json.updatedAt ?? aktuell.updatedAt,
        revisedAt: json.revision?.revised_at ?? aktuell.revisedAt,
        segmente: segmente
          ? {
              ...segmente,
              segments: segmente.segments.map((s, i) => (i !== index ? s : art === 'satz' ? { ...s, text: text ?? s.text } : { ...s, speaker: text })),
              updatedAt: new Date().toISOString(),
            }
          : segmente,
      }
      stand.current = naechster
      setZustand(naechster)
      onGespeichert?.()
      return null
    })
    schlange.current = schritt.catch(() => undefined)
    return schritt.catch((e: unknown) => (e instanceof Error ? e.message : String(e)))
  }, [libraryId, sourceId, setZustand, onGespeichert])

  return React.useMemo(() => ({
    speichereSatz: (index: number, neu: string) => lauf('satz', index, neu),
    /** name null = Sprecher an diesem Satz entfernen. */
    speichereSprecher: (index: number, name: string | null) => lauf('sprecher', index, name),
  }), [lauf])
}
