'use client'

/**
 * @fileoverview Virtualisierte Baum-Liste der Werkbank (F6/§6, W3+W5+A2).
 *
 * @description
 * Vier Ebenen: Bereich (Gruppenkopf) → Vorhaben → Ordner → Artefakt (Welle
 * A2, Entscheidung 1). Virtualisiert bleibt Pflicht — mit Artefakten traegt
 * die Liste ein Vielfaches der 148 Vorhaben. Vorhaben starten zugeklappt
 * (Mockup Zustand C); Auswaehlen klappt auf, der Pfeil klappt unabhaengig.
 * Ordner starten aufgeklappt. Auch die BEREICHE starten bei langen Listen
 * zugeklappt (`berechneEingeklappt`) — kurze Listen wie Suchtreffer bleiben
 * offen, damit der Baum sein eigenes Ergebnis nicht versteckt. Die Teilbaum-Zeilen kommen aus dem puren
 * `werkbank-baum.ts`; ein leerer Zustand rendert IMMER die uebergebene
 * Begruendung (Akzeptanzkriterium 4) — nie eine stumme Flaeche.
 *
 * A5 („der Baum zieht mit", Entscheidung 5): Springt die Auswahl auf ein
 * Artefakt, dessen Ordner zugeklappt ist, klappt die Liste die Ordner des
 * Vorhabens auf und scrollt die Ziel-Zeile in Sicht.
 *
 * @module components/library/agent-view
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { TwinFamilySummary, VorhabenCard } from '@/lib/agent-view/types'
import type { BaumZeile, PruefZaehler } from '@/lib/agent-view/werkbank-baum'
import {
  baueWerkbankZeilen,
  berechneEingeklappt,
  type WerkbankGruppierung,
  type WerkbankZeile,
} from '@/lib/agent-view/werkbank-gruppen'
import { ArtefaktZeile, BaumHinweis, OrdnerZeile } from './werkbank-baum-zeilen'
import { BereichKopfZeile, VorhabenZeile } from './vorhaben-zeile'

const HOEHEN: Record<string, number> = { kopf: 32, karte: 56, ordner: 26, 'baum-artefakt': 26, 'baum-hinweis': 40 }

/** A2: Datenzugriff des Baums — das Panel rechnet, die Liste rendert. */
export interface VorhabenListeBaum {
  zeilenFuer: (vorhabenId: string, ordnerZu: ReadonlySet<string>) => BaumZeile[]
  zaehlerFuer: (vorhabenId: string) => PruefZaehler | null
  artefaktAuswahlId: string | null
  onSelectArtefakt: (vorhabenId: string, familie: TwinFamilySummary) => void
}

export function VorhabenListe({
  karten,
  gruppierung,
  leerText,
  auswahlId,
  onSelect,
  gepinnteIds,
  onPin,
  baum,
}: {
  /** Bereits gefiltert und sortiert (werkbank-filter.ts). */
  karten: readonly VorhabenCard[]
  gruppierung: WerkbankGruppierung
  /** Begruendung, wenn die Liste leer ist — Pflicht statt stummer Flaeche. */
  leerText: string | null
  auswahlId: string | null
  onSelect: (folderId: string) => void
  gepinnteIds?: ReadonlySet<string> | null
  onPin?: (card: VorhabenCard) => void
  baum?: VorhabenListeBaum
}) {
  // Nicht die eingeklappten Gruppen selbst, sondern nur die HANDGRIFFE des
  // Menschen: welche Gruppe er bewusst auf- oder zugeklappt hat. Alles andere
  // entscheidet `berechneEingeklappt` aus der Laenge der aktuellen Liste — so
  // klappt eine Suche ihre Treffer auf, ohne den Handgriff zu vergessen.
  const [gruppenHandgriff, setGruppenHandgriff] = useState<ReadonlyMap<string, boolean>>(new Map())
  // Aufgeklappte Vorhaben: Deep-Links mit Artefakt oeffnen ihr Vorhaben sofort.
  const [vorhabenAuf, setVorhabenAuf] = useState<ReadonlySet<string>>(
    () => new Set(auswahlId !== null ? [auswahlId] : []),
  )
  const [ordnerZu, setOrdnerZu] = useState<ReadonlySet<string>>(new Set())

  const eingeklappt = useMemo(
    () => berechneEingeklappt(karten, gruppierung, { manuell: gruppenHandgriff, auswahlId }),
    [karten, gruppierung, gruppenHandgriff, auswahlId],
  )

  const zeilen = useMemo<(WerkbankZeile | BaumZeile)[]>(() => {
    const basis = baueWerkbankZeilen(karten, gruppierung, eingeklappt)
    if (!baum) return basis
    const result: (WerkbankZeile | BaumZeile)[] = []
    for (const zeile of basis) {
      result.push(zeile)
      if (zeile.art === 'karte' && vorhabenAuf.has(zeile.card.folderId)) {
        result.push(...baum.zeilenFuer(zeile.card.folderId, ordnerZu))
      }
    }
    return result
  }, [karten, gruppierung, eingeklappt, baum, vorhabenAuf, ordnerZu])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: zeilen.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => HOEHEN[zeilen[index].art],
    overscan: 10,
  })

  // A5: Der Baum zieht mit. Nur bei GEAENDERTER Artefakt-Auswahl (Ref),
  // damit manuelles Scrollen und Auf-/Zuklappen nicht zurueckspringen.
  const artefaktAuswahlId = baum?.artefaktAuswahlId ?? null
  const gescrolltZu = useRef<string | null>(null)
  useEffect(() => {
    if (artefaktAuswahlId === null || gescrolltZu.current === artefaktAuswahlId) return
    const index = zeilen.findIndex(
      (zeile) => zeile.art === 'baum-artefakt' && zeile.familie.sourceId === artefaktAuswahlId,
    )
    if (index < 0) {
      // Ziel-Zeile nicht im Zeilenmodell: ihr Ordner ist zugeklappt —
      // aufklappen; der naechste Lauf dieses Effekts scrollt dann hin.
      setOrdnerZu((prev) => (prev.size === 0 ? prev : new Set()))
      return
    }
    // jsdom kennt kein element.scrollTo — im Browser immer vorhanden.
    if (typeof scrollRef.current?.scrollTo === 'function') {
      virtualizer.scrollToIndex(index, { align: 'auto' })
    }
    gescrolltZu.current = artefaktAuswahlId
  }, [artefaktAuswahlId, zeilen, virtualizer])

  if (leerText !== null) {
    return <p className="p-3 text-sm text-muted-foreground">{leerText}</p>
  }

  const toggleIn = (setter: typeof setVorhabenAuf) => (schluessel: string) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(schluessel)) next.delete(schluessel)
      else next.add(schluessel)
      return next
    })
  }
  const toggleBereich = (gruppe: string) => {
    const zuJetzt = eingeklappt.has(gruppe)
    setGruppenHandgriff((prev) => new Map(prev).set(gruppe, !zuJetzt))
  }
  const toggleVorhaben = toggleIn(setVorhabenAuf)
  const toggleOrdner = toggleIn(setOrdnerZu)

  const waehleVorhaben = (folderId: string) => {
    onSelect(folderId)
    setVorhabenAuf((prev) => (prev.has(folderId) ? prev : new Set(prev).add(folderId)))
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto" data-testid="vorhaben-liste">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtuell) => {
          const zeile = zeilen[virtuell.index]
          return (
            <div
              key={virtuell.key}
              className="absolute left-0 top-0 w-full"
              style={{ height: virtuell.size, transform: `translateY(${virtuell.start}px)` }}
            >
              {zeile.art === 'kopf' ? (
                <BereichKopfZeile
                  bereich={zeile.gruppe}
                  anzahl={zeile.anzahl}
                  eingeklappt={eingeklappt.has(zeile.gruppe)}
                  onToggle={toggleBereich}
                />
              ) : zeile.art === 'karte' ? (
                <VorhabenZeile
                  card={zeile.card}
                  ausgewaehlt={zeile.card.folderId === auswahlId}
                  onSelect={waehleVorhaben}
                  gepinnt={gepinnteIds?.has(zeile.card.folderId) ?? false}
                  onPin={gepinnteIds == null ? undefined : onPin}
                  zaehler={baum ? baum.zaehlerFuer(zeile.card.folderId) : undefined}
                  aufgeklappt={vorhabenAuf.has(zeile.card.folderId)}
                  onToggle={baum ? toggleVorhaben : undefined}
                />
              ) : zeile.art === 'ordner' ? (
                <OrdnerZeile zeile={zeile} onToggle={toggleOrdner} />
              ) : zeile.art === 'baum-artefakt' ? (
                <ArtefaktZeile
                  zeile={zeile}
                  ausgewaehlt={zeile.familie.sourceId === (baum?.artefaktAuswahlId ?? null)}
                  onSelect={(vorhabenId, familie) => baum?.onSelectArtefakt(vorhabenId, familie)}
                />
              ) : (
                <BaumHinweis zeile={zeile} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
