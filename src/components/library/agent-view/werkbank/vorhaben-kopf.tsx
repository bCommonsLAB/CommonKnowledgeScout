'use client'

/**
 * @fileoverview Abnahme-Kopf des Vorhabens (Welle A4, Mockup Zustand A).
 *
 * @description
 * Zeile 1: Titel · Stand-Chip · EIN primaerer Knopf „Vorhaben abnehmen" ·
 * Menue `⋯`. Zeile 2: Breadcrumb · Fortschritt `n von m geprueft` ·
 * Sammelaktionen (Entscheidung 3). Der Knopf folgt Entscheidung 6: er
 * sperrt NUR bei offenen maschinellen Befunden ({@link istAbnehmbar}) —
 * offene Menschen-Punkte sperren ausdruecklich nicht, frueher abzunehmen
 * bleibt Peters Entscheidung. Stand-Fehler (409 mit Befundliste), Override-
 * und Merge-Hinweise stehen benannt unter den zwei Zeilen.
 *
 * @module components/library/agent-view
 */

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UseArtefaktKurationResult } from '@/hooks/agent-view/use-artefakt-kuration'
import type { UseStandResult } from '@/hooks/agent-view/use-stand'
import type { UseThemenResult } from '@/hooks/agent-view/use-themen'
import { istAbnehmbar } from '@/lib/agent-view/abnahme'
import type { AuftragContext } from '@/lib/agent-view/auftrag-generator'
import { standLabel } from '@/lib/agent-view/labels'
import type { CoverageGap, TwinFamilySummary, VorhabenCard } from '@/lib/agent-view/types'
import { zaehlePruefstand } from '@/lib/agent-view/werkbank-baum'
import { CoverageAmpel } from '../coverage-ampel'
import { AbnahmeKopfRahmen, KopfBreadcrumb, KopfChip } from './abnahme-kopf'
import type { TeilbaumScanProps } from './teilbaum-scan-knopf'
import { ThemenEditor } from './themen-editor'
import { VorhabenMenue } from './vorhaben-menue'
import { WerkbankSammelaktionen } from './werkbank-sammelaktionen'

/** Warum der Knopf gesperrt ist — nur maschinelle Befunde sperren (Entscheidung 6). */
function blockerText(karte: VorhabenCard): string {
  const teile: string[] = []
  const { cowork, knowledgescout } = karte.gapsByActor
  if (cowork > 0) teile.push(`${cowork} Cowork-Befund${cowork === 1 ? '' : 'e'}`)
  if (knowledgescout > 0) teile.push(`${knowledgescout} KnowledgeScout-Befund${knowledgescout === 1 ? '' : 'e'}`)
  return `${teile.join(' und ')} offen`
}

export function VorhabenKopf({ karte, stand, generatedAt, libraryId, familien, kuration, themenVokabular, themenHook, teilbaumScan, befunde, auftragContext }: {
  karte: VorhabenCard
  stand: UseStandResult
  generatedAt: string
  libraryId: string
  /** Effektive Familien des Teilbaums; undefined = Report vor Welle 4. */
  familien: readonly TwinFamilySummary[] | undefined
  kuration: UseArtefaktKurationResult
  /** A6: Themen-Editor (Vokabular aus Einstellungen ∪ vergebenen Themen). */
  themenVokabular: readonly string[]
  themenHook: UseThemenResult
  teilbaumScan?: TeilbaumScanProps
  befunde: readonly CoverageGap[]
  auftragContext: AuftragContext
}) {
  const override = stand.overrides.get(karte.folderId)
  const aktuellerStand = override ? override.bearbeitungsstand : karte.bearbeitungsstand
  const aktuellSeit = override ? override.bearbeitungsstandSeit : karte.bearbeitungsstandSeit
  const fehler = stand.fehlerByFolder.get(karte.folderId)
  const pending = stand.pendingFolderId === karte.folderId
  const bereit = istAbnehmbar(karte.gapsByActor)
  const abgenommen = aktuellerStand === 'abgenommen'
  const zaehler = familien === undefined ? null : zaehlePruefstand(familien)
  const archivHref = `/library?activeLibraryId=${encodeURIComponent(libraryId)}&folderId=${encodeURIComponent(karte.folderId)}`

  const abnehmenTitle = abgenommen
    ? 'Bereits abgenommen — „Stand bestaetigen" im Menue erneuert das Datum.'
    : !bereit
      ? `Blockiert: ${blockerText(karte)}`
      : karte.gapsByActor.mensch > 0
        ? `Abnahme beurkunden — ${karte.gapsByActor.mensch} Punkt(e) warten noch auf deine Pruefung. Die Route prueft zuerst mit einem frischen Teilbaum-Scan.`
        : 'Abnahme beurkunden — nichts mehr offen. Die Route prueft zuerst mit einem frischen Teilbaum-Scan.'

  return (
    <AbnahmeKopfRahmen
      zeile1={
        <>
          {karte.ampel !== undefined && <CoverageAmpel ampel={karte.ampel} />}
          <h2 className="min-w-0 truncate text-base font-semibold" title={karte.name}>{karte.name}</h2>
          <KopfChip ton="stand" title={aktuellSeit ? `seit ${aktuellSeit.slice(0, 10)}` : undefined}>
            {standLabel(aktuellerStand)}
          </KopfChip>
          {karte.widerspruch && (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-label="Widerspruch: Stand nicht mehr aktuell" />
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <span title={abnehmenTitle} className="inline-flex">
              <Button
                size="sm"
                className="h-7"
                disabled={!bereit || abgenommen || pending}
                onClick={() =>
                  void stand.setzeStand({
                    folderId: karte.folderId, stand: 'abgenommen',
                    erwarteterStand: aktuellerStand, reportGeneratedAt: generatedAt, bestaetigen: false,
                  })
                }
              >
                Vorhaben abnehmen
              </Button>
            </span>
            <VorhabenMenue
              karte={karte} aktuellerStand={aktuellerStand} stand={stand} generatedAt={generatedAt}
              libraryId={libraryId} archivHref={archivHref} teilbaumScan={teilbaumScan}
              befunde={befunde} auftragContext={auftragContext}
            />
          </span>
        </>
      }
      zeile2={
        <>
          <KopfBreadcrumb path={karte.path} />
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <ThemenEditor
              folderId={karte.folderId}
              aktuelle={karte.gepflegteThemen}
              vokabular={themenVokabular}
              themen={themenHook}
            />
            {zaehler === null ? (
              <KopfChip ton="stand" title={'Report aus einem Scan vor Welle 4 — "Neu scannen" ergaenzt die Artefakte.'}>
                Pruefstand: neu scannen
              </KopfChip>
            ) : (
              <KopfChip
                ton={zaehler.geprueft === zaehler.gesamt && zaehler.gesamt > 0 ? 'ok' : 'open'}
                title={zaehler.unbekannt > 0 ? `${zaehler.unbekannt} Familie(n) mit unbekanntem Stand (Scan vor A2)` : undefined}
              >
                {zaehler.geprueft} von {zaehler.gesamt} geprueft
              </KopfChip>
            )}
            {familien !== undefined && <WerkbankSammelaktionen familien={familien} kuration={kuration} />}
          </span>
        </>
      }
      kinder={
        <>
          {pending && <p className="text-xs text-muted-foreground">wird geprueft …</p>}
          {karte.widerspruch && (
            <p className="text-sm font-medium text-red-500">{standLabel(karte.bearbeitungsstand)}, aber nicht mehr aktuell</p>
          )}
          {override && !fehler && (
            <p className="text-xs text-muted-foreground">Erklaerter Stand geaendert — der Report zeigt noch den alten Scan.</p>
          )}
          {teilbaumScan?.hinweis && (
            <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
              Nicht gemergt: {teilbaumScan.hinweis}
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
                  {fehler.gesamt > fehler.befunde.length && <li>… und {fehler.gesamt - fehler.befunde.length} weitere</li>}
                </ul>
              )}
            </div>
          )}
        </>
      }
    />
  )
}
