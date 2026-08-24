'use client'

/**
 * @fileoverview Virtualisierte Vorhaben-Liste der Werkbank (F6/§6, W3 + W5).
 *
 * @description
 * Die Arbeitsflaeche sind 100–300 Vorhaben-Zeilen, nicht 1200 Baumknoten —
 * virtualisiert von Anfang an (`@tanstack/react-virtual`, §6.3). Gruppiert
 * nach Bereich ODER Thema (F12, Welle W5 — Zeilenmodell aus
 * `werkbank-gruppen.ts`); Gruppenkoepfe sind einklappbare gewoehnliche
 * Zeilen. Ein leerer Zustand rendert IMMER die uebergebene Begruendung
 * (Akzeptanzkriterium 4) — nie eine stumme Flaeche.
 *
 * @module components/library/agent-view
 */

import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VorhabenCard } from '@/lib/agent-view/types'
import { baueWerkbankZeilen, type WerkbankGruppierung } from '@/lib/agent-view/werkbank-gruppen'
import { BereichKopfZeile, VorhabenZeile } from './vorhaben-zeile'

const ZEILE_KOPF_PX = 32
const ZEILE_KARTE_PX = 56

export function VorhabenListe({
  karten,
  gruppierung,
  leerText,
  auswahlId,
  onSelect,
}: {
  /** Bereits gefiltert und sortiert (werkbank-filter.ts). */
  karten: readonly VorhabenCard[]
  /** Gruppieren nach Bereich oder Thema (F12, `?gruppierung=`). */
  gruppierung: WerkbankGruppierung
  /** Begruendung, wenn die Liste leer ist — Pflicht statt stummer Flaeche. */
  leerText: string | null
  auswahlId: string | null
  onSelect: (folderId: string) => void
}) {
  const [eingeklappt, setEingeklappt] = useState<ReadonlySet<string>>(new Set())
  const zeilen = useMemo(
    () => baueWerkbankZeilen(karten, gruppierung, eingeklappt),
    [karten, gruppierung, eingeklappt],
  )
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: zeilen.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (zeilen[index].art === 'kopf' ? ZEILE_KOPF_PX : ZEILE_KARTE_PX),
    overscan: 10,
  })

  if (leerText !== null) {
    return <p className="p-3 text-sm text-muted-foreground">{leerText}</p>
  }

  const toggleBereich = (bereich: string) => {
    setEingeklappt((prev) => {
      const next = new Set(prev)
      if (next.has(bereich)) next.delete(bereich)
      else next.add(bereich)
      return next
    })
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
              ) : (
                <VorhabenZeile
                  card={zeile.card}
                  ausgewaehlt={zeile.card.folderId === auswahlId}
                  onSelect={onSelect}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
