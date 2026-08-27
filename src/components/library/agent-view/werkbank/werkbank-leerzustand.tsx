'use client'

/**
 * @fileoverview Leerzustand der Werkbank (Welle A1, Mockup Zustand C).
 *
 * @description
 * Rechts ist nichts gewaehlt — statt einer leeren Flaeche arbeitet der
 * Zustand: vier Karten, die betonte zuerst mit der Zahl, wegen der man die
 * Sicht ueberhaupt oeffnet („wie viele Vorhaben warten JETZT auf mich?").
 * Die Bestandszahlen des Archivs folgen als Nebenzeile — sie beschreiben das
 * Archiv, nicht die Arbeit, und standen bis A1 faelschlich im Seitenkopf.
 *
 * Ist die betonte Zahl 0, nennt der Zustand den Grund statt stumm eine Null
 * zu zeigen (`no-silent-fallbacks.mdc`).
 *
 * @module components/library/agent-view
 */

import { zaehleEinstieg } from '@/lib/agent-view/werkbank-einstieg'
import type { CoverageReport } from '@/lib/agent-view/types'

function Karte({
  wert,
  label,
  title,
  betont = false,
}: {
  wert: number
  label: string
  title: string
  betont?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${betont ? 'border-amber-500 bg-amber-500/10' : 'bg-muted/40'}`}
      title={title}
    >
      <span className={`block text-xl font-semibold tabular-nums ${betont ? 'text-amber-700 dark:text-amber-400' : ''}`}>
        {wert}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

/** Grund fuer „0 wartet auf dich" — nie eine unerklaerte Null. */
function grundOhneWartendes(vorhaben: number): string {
  if (vorhaben === 0) {
    return 'Der letzte Scan hat kein Vorhaben erkannt — darum wartet hier nichts auf dich.'
  }
  return 'Kein Vorhaben ist bereit zur Abnahme: ueberall sind noch maschinelle Befunde offen, oder es liegt nichts an.'
}

export function WerkbankLeerzustand({ report }: { report: CoverageReport }) {
  const zahlen = zaehleEinstieg(report)

  return (
    <div className="flex flex-col items-start gap-4 p-6">
      <div>
        <p className="text-sm font-semibold text-foreground">Vorhaben links waehlen</p>
        <p className="text-sm text-muted-foreground">
          Der Bericht, die Artefakte und die Abnahme erscheinen hier.
        </p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Karte
          betont
          wert={zahlen.wartetAufDich}
          label="wartet auf dich"
          title="Vorhaben ohne offene maschinelle Befunde, die noch nicht abgenommen sind — nur der Mensch kann sie gruen machen."
        />
        <Karte wert={zahlen.mensch} label="deine Punkte" title="Offene Befunde mit Akteur Mensch (Verifikation, Abnahme)" />
        <Karte wert={zahlen.cowork} label="Cowork" title="Offene Befunde, die Cowork erledigt" />
        <Karte wert={zahlen.knowledgescout} label="KnowledgeScout" title="Offene Befunde, die KnowledgeScout erledigt" />
      </div>

      {zahlen.wartetAufDich === 0 && (
        <p className="text-xs text-muted-foreground">{grundOhneWartendes(report.vorhaben.length)}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Archiv: {zahlen.bestand.ordner} Ordner · {zahlen.bestand.dateien} Dateien ·{' '}
        {zahlen.bestand.quellen} Quellen · {zahlen.bestand.artefakte} Artefakte
      </p>
    </div>
  )
}
