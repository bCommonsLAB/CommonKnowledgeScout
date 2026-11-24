'use client'

/**
 * Teppich der Dokumente als Ebene der Fragen-Sektion (Plan `teppich-der-dokumente`, T2).
 *
 * Laedt die Punkte (`GET /api/chat/<id>/teppich`) und reicht sie an die Zeichenflaeche.
 * Ein Klick auf einen Punkt laedt die Karte des Dokuments (`docs/by-fileids`) und oeffnet
 * sie wie einen Beleg; ein Klick mit der Maus auf eine freie Stelle oeffnet die Graph-Ansicht,
 * ihr Schliessen-Knopf oder Escape holt die Seite zurueck.
 *
 * Kein stiller Rueckfall: Ist der Teppich noch nicht berechnet, bleibt die Ebene leer
 * und die Konsole sagt es einmal; ein Ladefehler steht als Fehler in der Konsole.
 */

import * as React from 'react'
import type { InstanceApi } from '@ks/api-client'
import type { DocCardMeta } from '@ks/contracts'
import { hatWolke, type TeppichAnimation, type TeppichAntwort, type TeppichPhase, type TeppichPunkt } from '..'
import { WebsiteTeppich } from './website-teppich'
import type { TeppichBotschaft } from './use-teppich-botschaft'
import type { TeppichSzene } from './teppich-szene'
import { useSchmal } from './use-schmal'

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
        // T5b: Der Teppich zeigt die Wolke. Hat der letzte Lauf sie noch nicht gerechnet (vor T5a),
        // bleibt die Ebene leer — kein Rueckfall auf das alte Raster.
        if (antwort.items.length > 0 && !hatWolke(antwort.items)) {
          console.warn(`[WebsiteTeppich] Teppich fuer ${libraryId} ohne Wolke — teppich_berechnen erneut ausfuehren`)
          setPunkte([])
          return
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
  /** Animation des Teppichs (`animation=` der Sektion). */
  animation?: TeppichAnimation
  /** Waehrend einer Frage: die Frage ueber dem Kasten und die Botschaft darunter. */
  botschaft?: TeppichBotschaft
  /** Duerfen Graph-Ansicht und Statusblatt am Bildschirm haengen? Ohne Angabe ja. */
  fest?: boolean
}

export function WebsiteTeppichEbene({ instanz, libraryId, abgetaucht, onAbgetaucht, onDokument, phase, belege, kandidaten, onGelandet, szene, botschaft, animation, fest = true }: WebsiteTeppichEbeneProps): React.ReactElement {
  const punkte = useTeppichPunkte(instanz, libraryId)

  // Graph-Ansicht (Owner 24.11.2026): eine eigene Seite ueber dem Bildschirm. Zu geht sie ueber ihren
  // Schliessen-Knopf oder Escape — nicht mehr ueber einen Klick auf den Hintergrund (zu ungenau, und
  // mit dem Finger liess sich so kein Punkt ansehen). Die Seite darunter scrollt solange nicht.
  React.useEffect(() => {
    if (!abgetaucht) return
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') onAbgetaucht(false) }
    window.addEventListener('keydown', taste)
    // Auf der Flaeche der Sektion (nicht am Bildschirm): die Seite scrollt weiter, der Kopf der Ansicht kommt ins Bild.
    if (!fest) {
      szene?.hinten?.closest('[data-website-story]')?.scrollIntoView({ block: 'start' })
      return () => window.removeEventListener('keydown', taste)
    }
    const wurzel = document.documentElement
    const vorher = wurzel.style.overflow
    wurzel.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', taste); wurzel.style.overflow = vorher }
  }, [abgetaucht, onAbgetaucht, fest, szene])
  const schmal = useSchmal()

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
      botschaftAlsBlatt={schmal && fest}
      punkte={punkte}
      abgetaucht={abgetaucht}
      onPunkt={oeffnen}
      // Mit der Maus oeffnet ein Klick ins Leere die Graph-Ansicht; mit dem Finger nicht (zu leicht versehentlich).
      onFreieStelle={(touch) => { if (!touch) onAbgetaucht(true) }}
      onZu={() => onAbgetaucht(false)}
      phase={phase}
      belege={belege}
      kandidaten={kandidaten}
      onGelandet={onGelandet}
      szene={szene}
      animation={animation}
      botschaft={botschaft}
    />
  )
}
