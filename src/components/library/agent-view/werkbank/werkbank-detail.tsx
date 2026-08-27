'use client'

/**
 * @fileoverview Werkbank-Detail (W4 + A3 + A4): EIN Kopf, EIN Dokument.
 *
 * @description
 * Dispatcher der rechten Seite (Mockup-Leitidee): oben IMMER der gleich
 * gebaute Abnahme-Kopf (A4) — er nimmt ab, was rechts steht —, darunter
 * genau EIN Dokument (A3). Vorhaben: {@link VorhabenKopf} + Tabs
 * Bericht/Ordner-Beschreibung. Artefakt: {@link ArtefaktKopf} + Tabs
 * Original/Transkript/Zusammenfassung. Nach einer Verifikation springt die
 * Auswahl zum naechsten offenen Artefakt (Entscheidung 5); ist derselbe
 * Twin nur halb geprueft, wechselt erst der Tab. Leerzustaende sind
 * benannt: nichts gewaehlt → {@link WerkbankLeerzustand}; unbekannte
 * folderId/sourceId → „Nicht im letzten Scan".
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { useStand } from '@/hooks/agent-view/use-stand'
import type { UseArtefaktKurationResult } from '@/hooks/agent-view/use-artefakt-kuration'
import type { UseThemenResult } from '@/hooks/agent-view/use-themen'
import { istBerichtVeraltet, teilbaumBefunde } from '@/lib/agent-view/teilbaum'
import type { CoverageReport, LeadingArtifactSummary, TwinFamilySummary, VorhabenCard } from '@/lib/agent-view/types'
import {
  patchFamilie,
  sprungHinweis,
  sprungNachVerifikation,
  type PruefbareArt,
} from '@/lib/agent-view/werkbank-abnahme'
import { familienPruefstand } from '@/lib/agent-view/werkbank-baum'
import { ArtefaktKopf } from './artefakt-kopf'
import type { TeilbaumScanProps } from './teilbaum-scan-knopf'
import { VorhabenKopf } from './vorhaben-kopf'
import { standardTab, WerkbankArtefaktDokument, type ArtefaktTab } from './werkbank-artefakt-dokument'
import { WerkbankLeerzustand } from './werkbank-leerzustand'
import { WerkbankVorhabenDokument } from './werkbank-vorhaben-dokument'

export interface WerkbankDetailProps {
  /** Karte zur gewaehlten folderId; null = nichts gewaehlt oder nicht im Report. */
  karte: VorhabenCard | null
  vorhabenId: string | null
  /** A2/A3: gewaehltes Artefakt (sourceId) + effektive Familie dazu. */
  artefaktId: string | null
  familie: TwinFamilySummary | null
  /** Effektive Familien des gewaehlten Vorhabens (Sprung-Reihenfolge, Zaehler). */
  familien: readonly TwinFamilySummary[] | undefined
  kuration: UseArtefaktKurationResult
  /** A6: Themen-Editor des Vorhaben-Kopfs (Vokabular + Schreib-Hook). */
  themenVokabular: readonly string[]
  themenHook: UseThemenResult
  /** A5-Vorgriff (Entscheidung 5): Auswahl zum naechsten offenen Artefakt bewegen. */
  onWaehleArtefakt: (sourceId: string) => void
  report: CoverageReport
  generatedAt: string
  libraryLabel: string
  localRootPath: string | null
  teilbaumScan?: TeilbaumScanProps
}

function archivHrefFuer(libraryId: string, folderId: string): string {
  return `/library?activeLibraryId=${encodeURIComponent(libraryId)}&folderId=${encodeURIComponent(folderId)}`
}

/** Artefakt-Zweig: einheitlicher Kopf + Dokument mit drei Tabs. */
function ArtefaktDetail({ familie, familien, kuration, report, onWaehleArtefakt }: {
  familie: TwinFamilySummary
  familien: readonly TwinFamilySummary[] | undefined
  kuration: UseArtefaktKurationResult
  report: CoverageReport
  onWaehleArtefakt: (sourceId: string) => void
}) {
  const { toast } = useToast()
  const [tab, setTab] = useState<ArtefaktTab>(() => standardTab(familie))

  const kuriert = (art: PruefbareArt, frisch: LeadingArtifactSummary) => {
    const gepatcht = patchFamilie(familie, art, frisch)
    // ADR 0006: Der Sprung sucht den naechsten WIDERSTAND. Wer nur verifiziert
    // hat, bleibt stehen, wenn nichts markiert ist — keine Weiterreich-Kette
    // mehr, die zum Abarbeiten draengt.
    const ergebnis = sprungNachVerifikation(familien ?? [], gepatcht)
    const hinweis = sprungHinweis(ergebnis, gepatcht)
    if (hinweis !== null) toast({ title: hinweis.titel, description: hinweis.beschreibung })
    if (ergebnis.naechste !== null) onWaehleArtefakt(ergebnis.naechste.sourceId)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ArtefaktKopf
        familie={familie}
        tab={tab}
        kuration={kuration}
        libraryId={report.libraryId}
        onKuriert={kuriert}
      />
      <WerkbankArtefaktDokument
        libraryId={report.libraryId}
        familie={familie}
        archivHref={archivHrefFuer(report.libraryId, familie.folderId)}
        tab={tab}
        onTab={setTab}
      />
    </div>
  )
}

export function WerkbankDetail({
  karte, vorhabenId, artefaktId, familie, familien, kuration, themenVokabular, themenHook,
  onWaehleArtefakt, report, generatedAt, libraryLabel, localRootPath, teilbaumScan,
}: WerkbankDetailProps) {
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
    return (
      <ArtefaktDetail
        key={familie.sourceId}
        familie={familie}
        familien={familien}
        kuration={kuration}
        report={report}
        onWaehleArtefakt={onWaehleArtefakt}
      />
    )
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

  const befunde = teilbaumBefunde(report.gaps, karte.path)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <VorhabenKopf
        karte={karte}
        stand={stand}
        generatedAt={generatedAt}
        libraryId={report.libraryId}
        familien={familien}
        kuration={kuration}
        themenVokabular={themenVokabular}
        themenHook={themenHook}
        teilbaumScan={teilbaumScan}
        befunde={befunde}
        onWaehleArtefakt={onWaehleArtefakt}
        auftragContext={{ libraryLabel, localRootPath, generatedAt }}
      />
      <WerkbankVorhabenDokument
        libraryId={report.libraryId}
        folderId={karte.folderId}
        veraltet={istBerichtVeraltet(befunde, karte.folderId)}
      />
    </div>
  )
}
