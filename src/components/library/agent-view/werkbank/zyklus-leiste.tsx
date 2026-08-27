'use client'

/**
 * @fileoverview Vier Schritte nebeneinander — wo steht dieses Vorhaben?
 *
 * @description
 * Rueckfrage aus dem Live-Test (27.08.2026): „Was mache ich in Cowork, was
 * hier? Es sind mehrere Schritte — ich will sehen, wo ich stehe." Die Leiste
 * zeigt den Erschliessungszyklus als vier Punkte nebeneinander, je mit
 * Zustaendigem, offenen Punkten und der Marke, wo die Arbeit gerade liegt.
 *
 * Zwei Aussagen bleiben getrennt sichtbar, weil sie verschiedene Dinge sind:
 * die MESSUNG (offene Befunde je Schritt) und die SELBSTAUSKUNFT (der
 * erklaerte Bearbeitungsstand). Fallen sie auseinander, ist das kein Fehler
 * der Anzeige, sondern der Befund „Stand passt nicht zum Inhalt".
 *
 * Ein Schritt mit offenen Punkten ist ein KNOPF: Er legt den fertigen
 * Auftrag fuer GENAU diesen Schritt in die Zwischenablage (Rueckfrage
 * 27.08.2026 — die Befundliste im Menue war „viel zu unuebersichtlich").
 * Der Text kommt aus dem bestehenden `buildAuftrag`, nur auf die Befunde
 * dieses Schritts eingegrenzt.
 *
 * @module components/library/agent-view
 */

import { useToast } from '@/components/ui/use-toast'
import { buildAuftrag, type AuftragContext } from '@/lib/agent-view/auftrag-generator'
import { zyklusSchrittLabel } from '@/lib/agent-view/labels'
import { istAltBefund } from '@/lib/agent-view/zyklus-fortschritt'
import type { Bearbeitungsstand, CoverageGap, GapCountByType, ZyklusSchritt } from '@/lib/agent-view/types'
import {
  SCHRITT_WERKZEUG,
  SCHRITT_ZUSTAENDIG,
  berechneZyklusFortschritt,
  type SchrittLage,
} from '@/lib/agent-view/zyklus-fortschritt'

/** Kurzname ohne „Schritt n — " Praefix, fuer die enge Zeile. */
function kurzName(lage: SchrittLage): string {
  return zyklusSchrittLabel(lage.schritt).split('—')[1]?.trim() ?? String(lage.schritt)
}

function SchrittPunkt({ lage, onAuftrag }: { lage: SchrittLage; onAuftrag: (schritt: ZyklusSchritt) => void }) {
  const frei = lage.offen === 0
  const ton = lage.istDran
    ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    : frei
      ? 'border-emerald-300/60 text-emerald-700 dark:text-emerald-400'
      : 'border-border text-muted-foreground'
  const zeichen = frei ? '✓' : lage.istDran ? '▶' : '·'
  const titel =
    `${zyklusSchrittLabel(lage.schritt)} · ${SCHRITT_ZUSTAENDIG[lage.schritt]} · ${SCHRITT_WERKZEUG[lage.schritt]}\n` +
    (frei ? 'Keine offenen Punkte.' : `${lage.offen} offene(r) Punkt(e).`) +
    (lage.behauptetErledigt ? '\nDein erklaerter Stand sagt: erledigt.' : '')
  const inhalt = (
    <>
      <span aria-hidden>{zeichen}</span>
      <span className="truncate font-medium">{kurzName(lage)}</span>
      <span className="opacity-70">({SCHRITT_ZUSTAENDIG[lage.schritt]})</span>
      {lage.offen > 0 && <span className="tabular-nums">{lage.offen}</span>}
    </>
  )
  const klasse = `flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 ${ton}`

  // Ohne offene Punkte gibt es nichts zu beauftragen — dann auch kein Knopf,
  // der ins Leere fuehrt.
  if (frei) {
    return (
      <li className={klasse} title={titel}>
        {inhalt}
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        className={`${klasse} hover:brightness-110`}
        title={`${titel}
Anklicken legt den fertigen Auftrag fuer diesen Schritt in die Zwischenablage.`}
        onClick={() => onAuftrag(lage.schritt)}
      >
        {inhalt}
      </button>
    </li>
  )
}

export function ZyklusLeiste({ gapsByType, bearbeitungsstand, markierungen, befunde, auftragContext }: {
  gapsByType: GapCountByType
  bearbeitungsstand: Bearbeitungsstand | null
  /** Frische Fehler-Markierungen aus den effektiven Familien. */
  markierungen: number
  /** Befunde des Teilbaums — Grundlage des Schritt-Auftrags. */
  befunde: readonly CoverageGap[]
  auftragContext: AuftragContext
}) {
  const { toast } = useToast()
  const fortschritt = berechneZyklusFortschritt({ gapsByType, bearbeitungsstand, markierungen })
  const dran = fortschritt.schritte.find((lage) => lage.istDran)

  const auftragKopieren = async (schritt: ZyklusSchritt) => {
    const desSchritts = befunde.filter((gap) => gap.zyklusSchritt === schritt && !istAltBefund(gap.type))
    if (desSchritts.length === 0) {
      toast({
        title: `Kein Auftragstext fuer ${zyklusSchrittLabel(schritt)}`,
        description:
          'Die offenen Punkte dieses Schritts stehen nicht im gespeicherten Report — „Teilbaum neu scannen" holt sie, dann gibt es einen Auftrag.',
      })
      return
    }
    try {
      await navigator.clipboard.writeText(buildAuftrag(desSchritts, auftragContext))
      toast({
        title: `Auftrag kopiert: ${zyklusSchrittLabel(schritt)}`,
        description: `${desSchritts.length} Befund(e) fuer ${SCHRITT_ZUSTAENDIG[schritt]} — in die ${SCHRITT_WERKZEUG[schritt]} einfuegen.`,
      })
    } catch (error) {
      toast({
        title: 'Kopieren fehlgeschlagen',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-1">
      <ul className="flex flex-wrap items-center gap-1 text-[11px]">
        {fortschritt.schritte.map((lage) => (
          <SchrittPunkt key={lage.schritt} lage={lage} onAuftrag={(schritt) => void auftragKopieren(schritt)} />
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        {dran === undefined ? (
          <>Alle vier Schritte sind frei — es fehlt nur noch deine Abnahme.</>
        ) : (
          <>
            Dran ist <span className="font-medium text-foreground">{zyklusSchrittLabel(dran.schritt)}</span> —
            {' '}{SCHRITT_ZUSTAENDIG[dran.schritt] === 'du' ? 'das machst du ' : `zustaendig ist ${SCHRITT_ZUSTAENDIG[dran.schritt]}, `}
            {SCHRITT_WERKZEUG[dran.schritt]}. Ein Klick auf den Schritt legt den fertigen Auftragstext
            in die Zwischenablage.
          </>
        )}
      </p>
    </div>
  )
}
