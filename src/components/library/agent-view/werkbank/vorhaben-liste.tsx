'use client'

/**
 * @fileoverview Virtualisierte Vorhaben-Liste der Werkbank (F6/§6, Welle W3).
 *
 * @description
 * Die Arbeitsflaeche sind 100–300 Vorhaben-Zeilen, nicht 1200 Baumknoten —
 * virtualisiert von Anfang an (`@tanstack/react-virtual`, §6.3). Gruppiert
 * nach Bereich (erstes Pfadsegment) mit einklappbaren Gruppenkoepfen, die
 * gewoehnliche Zeilen sind. Ein leerer Zustand rendert IMMER die uebergebene
 * Begruendung (Akzeptanzkriterium 4) — nie eine stumme Flaeche.
 *
 * @module components/library/agent-view
 */

import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VorhabenCard } from '@/lib/agent-view/types'
import { bereichVon } from '@/lib/agent-view/werkbank-filter'
import { BereichKopfZeile, VorhabenZeile } from './vorhaben-zeile'

type Zeile =
  | { art: 'kopf'; bereich: string; anzahl: number }
  | { art: 'karte'; card: VorhabenCard }

const ZEILE_KOPF_PX = 32
const ZEILE_KARTE_PX = 56

/**
 * Baut das flache Zeilenmodell: je Bereich ein Kopf, darunter seine Karten
 * (Bereichs-Reihenfolge = erstes Vorkommen in der sortierten Liste,
 * deterministisch). Eingeklappte Bereiche behalten den Kopf, lassen die
 * Karten aus.
 */
function baueZeilen(karten: readonly VorhabenCard[], eingeklappt: ReadonlySet<string>): Zeile[] {
  const gruppen = new Map<string, VorhabenCard[]>()
  for (const card of karten) {
    const bereich = bereichVon(card)
    const bucket = gruppen.get(bereich)
    if (bucket) bucket.push(card)
    else gruppen.set(bereich, [card])
  }
  const zeilen: Zeile[] = []
  for (const [bereich, cards] of gruppen) {
    zeilen.push({ art: 'kopf', bereich, anzahl: cards.length })
    if (eingeklappt.has(bereich)) continue
    for (const card of cards) zeilen.push({ art: 'karte', card })
  }
  return zeilen
}

export function VorhabenListe({
  karten,
  leerText,
  auswahlId,
  onSelect,
}: {
  /** Bereits gefiltert und sortiert (werkbank-filter.ts). */
  karten: readonly VorhabenCard[]
  /** Begruendung, wenn die Liste leer ist — Pflicht statt stummer Flaeche. */
  leerText: string | null
  auswahlId: string | null
  onSelect: (folderId: string) => void
}) {
  const [eingeklappt, setEingeklappt] = useState<ReadonlySet<string>>(new Set())
  const zeilen = useMemo(() => baueZeilen(karten, eingeklappt), [karten, eingeklappt])
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
                  bereich={zeile.bereich}
                  anzahl={zeile.anzahl}
                  eingeklappt={eingeklappt.has(zeile.bereich)}
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
