'use client'

/**
 * @fileoverview Werkbank-Detail (F9, W4 + A3): rechts genau EIN Dokument.
 *
 * @description
 * Dispatcher der rechten Seite (Mockup-Leitidee): bei gewaehltem VORHABEN
 * der Kopf + das Dokument Bericht/Ordner-Beschreibung, bei gewaehltem
 * ARTEFAKT der Kopf + das Dokument Original/Transkript/Zusammenfassung.
 * Die frueheren gestapelten Bloecke (Befunde · Twin-Familien) sind mit A3
 * aufgeloest: Befunde sind Kennzeichnung am Baum und Inhalt des Kopfes
 * (A4), die Familien SIND die Artefakt-Ebene des Baums. Leerzustaende sind
 * benannt: nichts gewaehlt → {@link WerkbankLeerzustand}; unbekannte
 * folderId/sourceId → „Nicht im letzten Scan".
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useStand } from '@/hooks/agent-view/use-stand'
import { istBereitZurAbnahme } from '@/lib/agent-view/abnahme'
import { actorSummary, gapCountLabel, standLabel } from '@/lib/agent-view/labels'
import { istBerichtVeraltet, teilbaumBefunde } from '@/lib/agent-view/teilbaum'
import type { CoverageReport, TwinFamilySummary, VorhabenCard } from '@/lib/agent-view/types'
import { CoverageAmpel } from '../coverage-ampel'
import { StandAktionen } from './stand-aktionen'
import { TeilbaumScanKnopf, type TeilbaumScanProps } from './teilbaum-scan-knopf'
import { standardTab, WerkbankArtefaktDokument, type ArtefaktTab } from './werkbank-artefakt-dokument'
import { WerkbankLeerzustand } from './werkbank-leerzustand'
import { WerkbankVorhabenDokument } from './werkbank-vorhaben-dokument'
import { ZuListeKnopf } from './zu-liste-knopf'

export interface WerkbankDetailProps {
  /** Karte zur gewaehlten folderId; null = nichts gewaehlt oder nicht im Report. */
  karte: VorhabenCard | null
  vorhabenId: string | null
  /** A2/A3: gewaehltes Artefakt (sourceId) + effektive Familie dazu. */
  artefaktId: string | null
  familie: TwinFamilySummary | null
  report: CoverageReport
  generatedAt: string
  libraryLabel: string
  localRootPath: string | null
  teilbaumScan?: TeilbaumScanProps
}

function archivHref(libraryId: string, folderId: string): string {
  return `/library?activeLibraryId=${encodeURIComponent(libraryId)}&folderId=${encodeURIComponent(folderId)}`
}

/** Artefakt-Zweig: Kopf (A4 vereinheitlicht ihn) + Dokument mit drei Tabs. */
function ArtefaktDetail({ familie, report }: { familie: TwinFamilySummary; report: CoverageReport }) {
  const [tab, setTab] = useState<ArtefaktTab>(() => standardTab(familie))
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="space-y-1 border-b p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words text-base font-semibold">{familie.sourceName}</h2>
          <a
            href={archivHref(report.libraryId, familie.folderId)}
            className="ml-auto inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
          >
            Im Archiv oeffnen <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
        <p className="break-words text-xs text-muted-foreground">{familie.path.split('/').join(' / ')}</p>
      </header>
      <WerkbankArtefaktDokument
        libraryId={report.libraryId}
        familie={familie}
        archivHref={archivHref(report.libraryId, familie.folderId)}
        tab={tab}
        onTab={setTab}
      />
    </div>
  )
}

export function WerkbankDetail({ karte, vorhabenId, artefaktId, familie, report, generatedAt, teilbaumScan }: WerkbankDetailProps) {
  const stand = useStand(report.libraryId)

  // Artefakt-Zweig zuerst: die tiefere Auswahl gewinnt.
  if (artefaktId !== null) {
    if (familie === null) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Artefakt nicht im letzten Scan</p>
          <p className="mt-1">
            Die gewaehlte Quelle (<code className="text-xs">{artefaktId}</code>) kommt im gespeicherten Report
            nicht vor — geloescht, verschoben oder der Report ist aelter. &bdquo;Neu scannen&ldquo; oben
            rechnet den Report neu.
          </p>
        </div>
      )
    }
    return <ArtefaktDetail key={familie.sourceId} familie={familie} report={report} />
  }

  if (karte === null && vorhabenId !== null) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Nicht im letzten Scan</p>
        <p className="mt-1">
          Das gewaehlte Vorhaben (<code className="text-xs">{vorhabenId}</code>) kommt im gespeicherten Report
          nicht vor — Ordner geloescht, verschoben oder der Report ist ein Teilbaum-Report. &bdquo;Neu
          scannen&ldquo; oben rechnet den Report neu.
        </p>
      </div>
    )
  }
  if (karte === null) {
    return <WerkbankLeerzustand report={report} />
  }

  const standOverride = stand.overrides.get(karte.folderId)
  const angezeigterStand = standOverride ? standOverride.bearbeitungsstand : karte.bearbeitungsstand
  const angezeigtSeit = standOverride ? standOverride.bearbeitungsstandSeit : karte.bearbeitungsstandSeit
  const befunde = teilbaumBefunde(report.gaps, karte.path)
  const bereit = istBereitZurAbnahme(karte.gapsByActor)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="space-y-1 border-b p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {karte.ampel !== undefined && <CoverageAmpel ampel={karte.ampel} />}
            <span className="break-words">{karte.name}</span>
            {karte.widerspruch && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />}
          </h2>
          <span className="ml-auto flex items-center gap-2">
            {teilbaumScan && (
              <TeilbaumScanKnopf folderId={karte.folderId} onTeilbaumScan={teilbaumScan.onScan} isScanning={teilbaumScan.isScanning} />
            )}
            <ZuListeKnopf libraryId={report.libraryId} karte={karte} />
            <a href={archivHref(report.libraryId, karte.folderId)} className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline">
              Im Archiv oeffnen <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </span>
        </div>
        <p className="break-words text-xs text-muted-foreground">{karte.path.split('/').join(' / ')}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{standLabel(angezeigterStand)}</Badge>
          {angezeigtSeit && (
            <span className="text-xs text-muted-foreground">seit {angezeigtSeit.slice(0, 10)}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {gapCountLabel(karte.totalGaps)} · {actorSummary(karte.gapsByActor)}
          </span>
        </div>
        {karte.widerspruch && (
          <p className="text-sm font-medium text-red-500">
            {standLabel(karte.bearbeitungsstand)}, aber nicht mehr aktuell
          </p>
        )}
        <StandAktionen karte={karte} generatedAt={generatedAt} stand={stand} />
        {teilbaumScan?.hinweis && (
          <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
            Nicht gemergt: {teilbaumScan.hinweis}
          </p>
        )}
        {bereit && (
          <p className="rounded-md bg-emerald-600/10 px-2 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Bereit zur Abnahme — keine maschinellen Befunde offen, {karte.gapsByActor.mensch} Punkt(e) warten
            auf dich.
          </p>
        )}
      </header>

      <WerkbankVorhabenDokument
        libraryId={report.libraryId}
        folderId={karte.folderId}
        veraltet={istBerichtVeraltet(befunde, karte.folderId)}
      />
    </div>
  )
}
