'use client'

/**
 * @fileoverview Werkbank-Detail (F9, Welle W4): das Vorhaben im Ganzen.
 *
 * @description
 * Kopf (Name, Breadcrumb, Ampel, Stand, Widerspruch, „Im Archiv oeffnen"),
 * „Bereit zur Abnahme"-Leiste (reiner Status, Abnehmen kommt mit W7),
 * gerenderter BERICHT.md (W2-Route + bestehende `MarkdownPreview`), Befunde
 * je Akteur mit Vorhaben-Auftrag, Twin-Familien (bestehende Kuration) und
 * die Fusszeile mit Teilbaum-Zaehlern + kopierbarer folderId. Leerzustaende
 * sind benannt: nichts gewaehlt → Auswahl-Hinweis + Library-Totalen;
 * unbekannte folderId → „Nicht im letzten Scan".
 *
 * @module components/library/agent-view
 */

import { AlertTriangle, ClipboardCopy, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useStand } from '@/hooks/agent-view/use-stand'
import { useTwinCuration } from '@/hooks/agent-view/use-twin-curation'
import { istBereitZurAbnahme } from '@/lib/agent-view/abnahme'
import { actorSummary, gapCountLabel, standLabel } from '@/lib/agent-view/labels'
import {
  familienImTeilbaum,
  findeKnoten,
  istBerichtVeraltet,
  teilbaumBefunde,
  teilbaumZaehler,
} from '@/lib/agent-view/teilbaum'
import type { CoverageReport, VorhabenCard } from '@/lib/agent-view/types'
import { CoverageAmpel } from '../coverage-ampel'
import { StandAktionen } from './stand-aktionen'
import { WerkbankBefunde } from './werkbank-befunde'
import { WerkbankBericht } from './werkbank-bericht'
import { WerkbankFamilien } from './werkbank-familien'
import { ZuListeKnopf } from './zu-liste-knopf'

export interface WerkbankDetailProps {
  /** Karte zur gewaehlten folderId; null = nichts gewaehlt oder nicht im Report. */
  karte: VorhabenCard | null
  vorhabenId: string | null
  report: CoverageReport
  generatedAt: string
  libraryLabel: string
  localRootPath: string | null
}

export function WerkbankDetail({ karte, vorhabenId, report, generatedAt, libraryLabel, localRootPath }: WerkbankDetailProps) {
  const { toast } = useToast()
  const curation = useTwinCuration(report.libraryId)
  const stand = useStand(report.libraryId)

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
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <p>Vorhaben links waehlen.</p>
        <p className="mt-2">
          Library gesamt: {report.totals.folders} Ordner · {report.totals.files} Dateien ·{' '}
          {report.totals.sources} Quellen · {report.totals.twins} Twins · {gapCountLabel(report.totals.gaps)}
        </p>
      </div>
    )
  }

  const standOverride = stand.overrides.get(karte.folderId)
  const angezeigterStand = standOverride ? standOverride.bearbeitungsstand : karte.bearbeitungsstand
  const angezeigtSeit = standOverride ? standOverride.bearbeitungsstandSeit : karte.bearbeitungsstandSeit
  const befunde = teilbaumBefunde(report.gaps, karte.path)
  const familien = familienImTeilbaum(report.families, karte.path)
  const knoten = findeKnoten(report.tree, karte.folderId)
  const zaehler = knoten === null ? null : teilbaumZaehler(knoten)
  const bereit = istBereitZurAbnahme(karte.gapsByActor)
  const archivHref = `/library?activeLibraryId=${encodeURIComponent(report.libraryId)}&folderId=${encodeURIComponent(karte.folderId)}`

  const copyFolderId = async () => {
    try {
      await navigator.clipboard.writeText(karte.folderId)
      toast({ title: 'folderId kopiert', description: 'Fuer MCP-/Teilbaum-Werkzeuge.' })
    } catch (error) {
      toast({ title: 'Kopieren fehlgeschlagen', description: error instanceof Error ? error.message : String(error), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {karte.ampel !== undefined && <CoverageAmpel ampel={karte.ampel} />}
            <span className="break-words">{karte.name}</span>
            {karte.widerspruch && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />}
          </h2>
          <span className="ml-auto flex items-center gap-2">
            <ZuListeKnopf libraryId={report.libraryId} karte={karte} />
            <a href={archivHref} className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline">
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
          {typeof karte.berichtStatus === 'string' && (
            <span className="text-xs text-muted-foreground">Status: {karte.berichtStatus}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {gapCountLabel(karte.totalGaps)} · {actorSummary(karte.gapsByActor)}
          </span>
        </div>
        {karte.themen !== undefined && karte.themen.length > 0 && (
          // div statt p: die Badge-Komponente rendert ein div, und ein div in
          // einem p ist invalides HTML (React validateDOMNesting, Test-Befund 24.08.).
          <div className="flex flex-wrap gap-1">
            {karte.themen.map((thema) => (
              <Badge key={thema} variant="outline" className="text-xs">{thema}</Badge>
            ))}
          </div>
        )}
        {karte.widerspruch && (
          <p className="text-sm font-medium text-red-500">
            {standLabel(karte.bearbeitungsstand)}, aber nicht mehr aktuell
          </p>
        )}
        <StandAktionen karte={karte} generatedAt={generatedAt} stand={stand} />
        {bereit && (
          <p className="rounded-md bg-emerald-600/10 px-2 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Bereit zur Abnahme — keine maschinellen Befunde offen, {karte.gapsByActor.mensch} Punkt(e) warten
            auf dich.
          </p>
        )}
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Bericht</h3>
        <WerkbankBericht
          libraryId={report.libraryId}
          folderId={karte.folderId}
          veraltet={istBerichtVeraltet(befunde, karte.folderId)}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Befunde des Teilbaums</h3>
        <WerkbankBefunde
          befunde={befunde}
          totalGaps={karte.totalGaps}
          auftragContext={{ libraryLabel, localRootPath, generatedAt }}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Twin-Familien</h3>
        <WerkbankFamilien familien={familien} truncated={report.familiesTruncated === true} curation={curation} />
      </section>

      <footer className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
        <span>
          {zaehler === null
            ? 'Teilbaum-Zaehler nicht verfuegbar (Knoten fehlt im Baum des Reports)'
            : `${zaehler.quellen} Quellen · ${zaehler.dateien} Dateien im Teilbaum`}
        </span>
        <span>· Scan {generatedAt.slice(0, 16).replace('T', ' ')}</span>
        <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => void copyFolderId()}>
          <ClipboardCopy className="mr-1 h-3 w-3" aria-hidden /> folderId kopieren
        </Button>
      </footer>
    </div>
  )
}
