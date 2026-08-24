'use client'

/**
 * @fileoverview Stand-Aktionen im Detail-Kopf (F8, Welle W7).
 *
 * @description
 * Der EINE Call-to-Action der Abnahme (Feedback 23.08.: kein doppelter CTA —
 * die gruene Leiste bleibt reiner Status): primaerer Button „Abnehmen", nur
 * aktiv, wenn das geteilte Praedikat wahr ist; deaktiviert nennt der Tooltip
 * die Blocker. Daneben das Stand-Menue mit „Stand bestaetigen" (gleicher
 * Stand, `_seit` neu — loest den Widerspruch nach menschlicher Pruefung) und
 * „Zurueckstufen/Setzen auf …" — `abgenommen` ist dort bewusst NICHT
 * waehlbar, die Abnahme geht nur ueber den Button (Stufe-4-Precheck).
 *
 * Nach Erfolg ueberlagert der Hook den Stand lokal; der Hinweis sagt dazu,
 * dass der Report noch den alten Scan zeigt. 409-Antworten erscheinen als
 * Klartext-Befunde inklusive `nicht_bereit`-Befundliste.
 *
 * @module components/library/agent-view
 */

import { Button } from '@/components/ui/button'
import type { UseStandResult } from '@/hooks/agent-view/use-stand'
import { istBereitZurAbnahme } from '@/lib/agent-view/abnahme'
import { standRank } from '@/lib/agent-view/bearbeitungsstand'
import { standLabel } from '@/lib/agent-view/labels'
import { BEARBEITUNGSSTAND_VALUES, type Bearbeitungsstand, type VorhabenCard } from '@/lib/agent-view/types'

function blockerText(karte: VorhabenCard): string {
  const teile: string[] = []
  const { cowork, knowledgescout } = karte.gapsByActor
  if (cowork > 0) teile.push(`${cowork} Cowork-Befund${cowork === 1 ? '' : 'e'}`)
  if (knowledgescout > 0) teile.push(`${knowledgescout} KnowledgeScout-Befund${knowledgescout === 1 ? '' : 'e'}`)
  if (teile.length === 0) return 'Kein Befund wartet auf den Menschen — es gibt nichts abzunehmen.'
  return `${teile.join(' und ')} offen`
}

function zielLabel(ziel: Bearbeitungsstand, aktuell: Bearbeitungsstand | null): string {
  const zurueck = aktuell !== null && standRank(ziel) < standRank(aktuell)
  return `${zurueck ? 'Zurueckstufen auf' : 'Setzen auf'}: ${standLabel(ziel)}`
}

export function StandAktionen({ karte, generatedAt, stand }: {
  karte: VorhabenCard
  /** `generatedAt` des angezeigten Reports — Stufe 3 urteilt darueber. */
  generatedAt: string
  stand: UseStandResult
}) {
  const override = stand.overrides.get(karte.folderId)
  const aktuellerStand = override ? override.bearbeitungsstand : karte.bearbeitungsstand
  const fehler = stand.fehlerByFolder.get(karte.folderId)
  const pending = stand.pendingFolderId === karte.folderId
  const bereit = istBereitZurAbnahme(karte.gapsByActor)
  const abgenommen = aktuellerStand === 'abgenommen'

  const abnehmenTitle = abgenommen
    ? 'Bereits abgenommen — „Stand bestaetigen" erneuert das Datum.'
    : bereit
      ? 'Abnahme beurkunden — die Route prueft zuerst mit einem frischen Teilbaum-Scan.'
      : `Blockiert: ${blockerText(karte)}`

  const setze = (ziel: Bearbeitungsstand, bestaetigen: boolean) =>
    void stand.setzeStand({
      folderId: karte.folderId,
      stand: ziel,
      erwarteterStand: aktuellerStand,
      reportGeneratedAt: generatedAt,
      bestaetigen,
    })

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span title={abnehmenTitle} className="inline-flex">
          <Button size="sm" className="h-7" disabled={!bereit || abgenommen || pending} onClick={() => setze('abgenommen', false)}>
            Abnehmen
          </Button>
        </span>
        <select
          aria-label="Stand-Menue"
          value=""
          disabled={pending}
          onChange={(event) => {
            const wert = event.target.value
            if (wert === '') return
            if (wert === 'bestaetigen' && aktuellerStand !== null) setze(aktuellerStand, true)
            else if (wert !== 'bestaetigen') setze(wert as Bearbeitungsstand, false)
          }}
          className="h-7 rounded-md border bg-background px-1.5 text-xs text-muted-foreground"
        >
          <option value="">Stand-Menue …</option>
          {aktuellerStand !== null && (
            <option value="bestaetigen">Stand bestaetigen ({standLabel(aktuellerStand)})</option>
          )}
          {BEARBEITUNGSSTAND_VALUES.filter((wert) => wert !== 'abgenommen' && wert !== aktuellerStand).map(
            (wert) => (
              <option key={wert} value={wert}>
                {zielLabel(wert, aktuellerStand)}
              </option>
            ),
          )}
        </select>
        {pending && <span className="text-xs text-muted-foreground">wird geprueft …</span>}
      </div>
      {override && !fehler && (
        <p className="text-xs text-muted-foreground">
          Erklaerter Stand geaendert — der Report zeigt noch den alten Scan.
        </p>
      )}
      {fehler && (
        <div className="rounded-md bg-red-600/10 px-2 py-1.5 text-sm text-red-700 dark:text-red-400">
          <p>{fehler.text}</p>
          {fehler.befunde.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-xs">
              {fehler.befunde.map((befund, idx) => (
                <li key={idx}>
                  {befund.path}: {befund.message} ({befund.actor}, {befund.severity})
                </li>
              ))}
              {fehler.gesamt > fehler.befunde.length && (
                <li>… und {fehler.gesamt - fehler.befunde.length} weitere</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
