'use client'

/**
 * @fileoverview Zeilen der Werkbank-Liste (F6, Welle W3).
 *
 * @description
 * Zweizeilige Vorhaben-Zeile: Ampel · Name (Bericht-Titel als Zweitzeile) ·
 * Widerspruch-Symbol; darunter gedaempft Stand-Badge, Befundzaehler je Akteur,
 * Bericht-Indikator und „bereit"-Badge. Karten aus Scans vor W1 zeigen einen
 * neutralen Ampel-Platzhalter mit Erklaerung (kein geratenes Gruen).
 * Gruppenkoepfe (Bereich = erstes Pfadsegment) sind gewoehnliche Zeilen (§6).
 *
 * @module components/library/agent-view
 */

import { AlertTriangle, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { istBereitZurAbnahme } from '@/lib/agent-view/abnahme'
import { actorSummary, standLabel } from '@/lib/agent-view/labels'
import type { VorhabenCard } from '@/lib/agent-view/types'
import { CoverageAmpel } from '../coverage-ampel'

function AmpelOderHinweis({ card }: { card: VorhabenCard }) {
  if (card.ampel === undefined) {
    return (
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-muted-foreground/50"
        title="Ampel unbekannt — Report stammt aus einem Scan vor Werkbank-Welle W1"
        aria-label="Ampel unbekannt"
      />
    )
  }
  return <CoverageAmpel ampel={card.ampel} />
}

export function VorhabenZeile({
  card,
  ausgewaehlt,
  onSelect,
}: {
  card: VorhabenCard
  ausgewaehlt: boolean
  onSelect: (folderId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card.folderId)}
      aria-current={ausgewaehlt ? 'true' : undefined}
      className={`flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent ${
        ausgewaehlt ? 'bg-accent' : ''
      }`}
    >
      <span className="flex items-center gap-1.5">
        <AmpelOderHinweis card={card} />
        <span className="truncate text-sm font-medium" title={card.path}>
          {card.name}
        </span>
        {card.widerspruch && (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-label="Widerspruch: Stand nicht mehr aktuell" />
        )}
        {typeof card.berichtTitel === 'string' && card.berichtTitel !== '' && (
          <span className="truncate text-xs text-muted-foreground" title={card.berichtTitel}>
            {card.berichtTitel}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{card.bearbeitungsstand === null ? '—' : standLabel(card.bearbeitungsstand)}</span>
        <span title={actorSummary(card.gapsByActor)}>
          M {card.gapsByActor.mensch} · C {card.gapsByActor.cowork} · K {card.gapsByActor.knowledgescout}
        </span>
        {card.hasBericht && <FileText className="h-3 w-3" aria-label="BERICHT.md vorhanden" />}
        {istBereitZurAbnahme(card.gapsByActor) && (
          <Badge className="h-4 bg-emerald-600 px-1.5 text-[10px] text-white hover:bg-emerald-600">bereit</Badge>
        )}
      </span>
    </button>
  )
}

/** Gruppenkopf eines Bereichs — eine gewoehnliche (virtualisierte) Zeile. */
export function BereichKopfZeile({
  bereich,
  anzahl,
  eingeklappt,
  onToggle,
}: {
  bereich: string
  anzahl: number
  eingeklappt: boolean
  onToggle: (bereich: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(bereich)}
      aria-expanded={!eingeklappt}
      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent"
    >
      {eingeklappt ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
      <span className="truncate">{bereich}</span>
      <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">{anzahl}</Badge>
    </button>
  )
}
