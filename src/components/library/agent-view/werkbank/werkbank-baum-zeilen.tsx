'use client'

/**
 * @fileoverview Ordner- und Artefakt-Zeilen des Werkbank-Baums (Welle A2).
 *
 * @description
 * Mockup `agentensicht-abnahme.html`, linke Spalte: kompakte Baumzeilen mit
 * Aufklapp-Pfeil und Zaehler `n/m` je Ordner (Entscheidung 2) und
 * Pruef-Kennung je Artefakt — `✓` geprueft, `○` offen (Entscheidung 4:
 * geprueft sind Transkript UND Zusammenfassung, das Original traegt kein
 * Haekchen). Ein unbekannter Pruefstand (Scan vor A2) ist als `?` sichtbar
 * und im Titel erklaert, nie geraten (`no-silent-fallbacks.mdc`).
 *
 * @module components/library/agent-view
 */

import { ChevronDown, ChevronRight } from 'lucide-react'
import type { BaumHinweisZeile, BaumOrdnerZeile, PruefZaehler } from '@/lib/agent-view/werkbank-baum'
import { familienPruefstand, type FamilienPruefstand } from '@/lib/agent-view/werkbank-baum'
import type { TwinFamilySummary } from '@/lib/agent-view/types'

/** Einrueckung je Baumtiefe (Vorhaben = 0). */
export function baumEinrueckung(tiefe: number): { paddingLeft: string } {
  return { paddingLeft: `${8 + tiefe * 16}px` }
}

/** Zaehler `n/m`; unbekannte Familien stehen im Titel statt still in `n`. */
export function ZaehlerText({ zaehler }: { zaehler: PruefZaehler }) {
  const titel =
    zaehler.unbekannt > 0
      ? `${zaehler.geprueft} von ${zaehler.gesamt} geprueft — ${zaehler.unbekannt} mit unbekanntem Stand (Scan vor A2)`
      : `${zaehler.geprueft} von ${zaehler.gesamt} geprueft`
  return (
    <span className="ml-auto pl-2 text-[11px] tabular-nums text-muted-foreground" title={titel}>
      {zaehler.geprueft}/{zaehler.gesamt}
    </span>
  )
}

const MARK: Record<FamilienPruefstand, { zeichen: string; className: string; titel: string }> = {
  geprueft: { zeichen: '✓', className: 'text-emerald-600', titel: 'Geprueft — alle vorhandenen Artefakte menschlich verifiziert' },
  offen: { zeichen: '○', className: 'text-amber-600', titel: 'Offen — Transkript oder Zusammenfassung noch nicht verifiziert' },
  unbekannt: { zeichen: '?', className: 'text-muted-foreground', titel: 'Pruefstand unbekannt — Report aus einem Scan vor A2, „Neu scannen" ergaenzt ihn' },
}

/** Pruef-Kennung einer Familie (auch die Tabs des Details nutzen sie, A3). */
export function PruefMark({ stand }: { stand: FamilienPruefstand }) {
  const mark = MARK[stand]
  return (
    <span className={`w-4 shrink-0 text-center text-[11px] ${mark.className}`} title={mark.titel} aria-label={mark.titel}>
      {mark.zeichen}
    </span>
  )
}

export function OrdnerZeile({ zeile, onToggle }: { zeile: BaumOrdnerZeile; onToggle: (folderId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(zeile.node.folderId)}
      aria-expanded={zeile.aufgeklappt}
      className="flex h-full w-full items-center gap-1.5 rounded-md pr-2 text-left text-xs hover:bg-accent"
      style={baumEinrueckung(zeile.tiefe)}
    >
      {zeile.aufgeklappt ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      <span className="truncate" title={zeile.node.path}>{zeile.node.name}</span>
      <ZaehlerText zaehler={zeile.zaehler} />
    </button>
  )
}

export function ArtefaktZeile({
  zeile,
  ausgewaehlt,
  onSelect,
}: {
  zeile: { familie: TwinFamilySummary; vorhabenId: string; tiefe: number }
  ausgewaehlt: boolean
  onSelect: (vorhabenId: string, familie: TwinFamilySummary) => void
}) {
  const { familie } = zeile
  return (
    <button
      type="button"
      onClick={() => onSelect(zeile.vorhabenId, familie)}
      aria-current={ausgewaehlt ? 'true' : undefined}
      className={`flex h-full w-full items-center gap-1.5 rounded-md pr-2 text-left text-xs hover:bg-accent ${ausgewaehlt ? 'bg-accent' : ''}`}
      style={baumEinrueckung(zeile.tiefe)}
    >
      <PruefMark stand={familienPruefstand(familie)} />
      <span className="truncate" title={familie.path}>{familie.sourceName}</span>
      <span
        className="ml-auto shrink-0 rounded border px-1 text-[10px] text-muted-foreground"
        title={`${familie.artifactCount} Artefakt(e) in der Twin-Familie`}
      >
        {familie.artifactCount}
      </span>
    </button>
  )
}

/** Benannter Leerzustand unter einem Vorhaben — nie eine stumme Luecke. */
export function BaumHinweis({ zeile }: { zeile: BaumHinweisZeile }) {
  return (
    <p className="flex h-full items-center pr-2 text-[11px] text-muted-foreground" style={baumEinrueckung(1)}>
      {zeile.text}
    </p>
  )
}
