'use client'

/**
 * Teppich der Dokumente als Ebene der Fragen-Sektion (Plan `teppich-der-dokumente`, T2).
 *
 * Laedt die Punkte (`GET /api/chat/<id>/teppich`) und reicht sie an die Zeichenflaeche.
 * Ein Klick auf einen Punkt laedt die Karte des Dokuments (`docs/by-fileids`) und oeffnet
 * sie wie einen Beleg; ein Klick auf eine freie Stelle blendet den Vordergrund aus und
 * wieder ein, Escape holt ihn zurueck.
 *
 * Kein stiller Rueckfall: Ist der Teppich noch nicht berechnet, bleibt die Ebene leer
 * und die Konsole sagt es einmal; ein Ladefehler steht als Fehler in der Konsole.
 */

import * as React from 'react'
import type { InstanceApi } from '@ks/api-client'
import type { DocCardMeta } from '@ks/contracts'
import type { TeppichAntwort, TeppichPhase, TeppichPunkt } from '..'
import { WebsiteTeppich } from './website-teppich'
import type { TeppichSzene } from './teppich-szene'

/** Laedt die Punkte einmal je Library; leer, bis sie da sind oder wenn sie fehlen. */
export function useTeppichPunkte(instanz: InstanceApi, libraryId: string): TeppichPunkt[] {
  const [punkte, setPunkte] = React.useState<TeppichPunkt[]>([])
  React.useEffect(() => {
    let abgebrochen = false
    instanz.fetch(`/api/chat/${encodeURIComponent(libraryId)}/teppich`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const antwort = (await res.json()) as TeppichAntwort
        if (abgebrochen) return
        if (antwort.zustand === 'nicht_berechnet') {
          console.warn(`[WebsiteTeppich] Teppich fuer ${libraryId} noch nicht berechnet (${antwort.gesamt} Dokumente) — teppich_berechnen ausfuehren`)
        } else if (antwort.zustand === 'veraltet') {
          console.info(`[WebsiteTeppich] ${antwort.ohneLage} von ${antwort.gesamt} Dokumenten noch ohne Platz`)
        }
        setPunkte(antwort.items)
      })
      .catch((e: unknown) => console.error('[WebsiteTeppich] Punkte nicht ladbar', e))
    return () => { abgebrochen = true }
  }, [instanz, libraryId])
  return punkte
}

export interface WebsiteTeppichEbeneProps {
  instanz: InstanceApi
  libraryId: string
  abgetaucht: boolean
  onAbgetaucht: (abgetaucht: boolean) => void
  onDokument: (doc: DocCardMeta) => void
  /** T3: Phase der Frage, Belege der Antwort (fileIds nach Nummer), Ende des Flugs. */
  phase?: TeppichPhase
  belege?: readonly string[]
  /** T4: Kandidaten der Suche (fileIds). */
  kandidaten?: readonly string[]
  onGelandet?: () => void
  /** Gemeinsame Szene mit der vorderen Leinwand (`WebsiteTeppichVorn`). */
  szene?: TeppichSzene
  /** Waehrend einer Frage: die Frage ueber dem Kasten und die Botschaft darunter. */
  frage?: string
  botschaft?: string
}

export function WebsiteTeppichEbene({ instanz, libraryId, abgetaucht, onAbgetaucht, onDokument, phase, belege, kandidaten, onGelandet, szene, frage, botschaft }: WebsiteTeppichEbeneProps): React.ReactElement {
  const punkte = useTeppichPunkte(instanz, libraryId)

  React.useEffect(() => {
    if (!abgetaucht) return
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') onAbgetaucht(false) }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [abgetaucht, onAbgetaucht])

  const oeffnen = React.useCallback((punkt: TeppichPunkt) => {
    const params = new URLSearchParams({ fileId: punkt.fileId })
    instanz.fetch(`/api/chat/${encodeURIComponent(libraryId)}/docs/by-fileids?${params.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { items?: unknown }
        const doc = Array.isArray(json.items) ? (json.items[0] as DocCardMeta | undefined) : undefined
        if (!doc) throw new Error(`Dokument ${punkt.fileId} nicht gefunden`)
        onDokument(doc)
      })
      .catch((e: unknown) => console.error('[WebsiteTeppich] Dokument nicht ladbar', e))
  }, [instanz, libraryId, onDokument])

  return (
    <WebsiteTeppich
      punkte={punkte}
      abgetaucht={abgetaucht}
      onPunkt={oeffnen}
      onFreieStelle={() => onAbgetaucht(!abgetaucht)}
      phase={phase}
      belege={belege}
      kandidaten={kandidaten}
      onGelandet={onGelandet}
      szene={szene}
      frage={frage}
      botschaft={botschaft}
    />
  )
}
