'use client'

/**
 * @fileoverview Artefakt als Dokument: Original · Transkript · Zusammenfassung (A3).
 *
 * @description
 * Mockup Zustand B: rechts steht genau EIN Dokument mit drei Tabs. Das
 * Original ist der erste Tab und traegt kein Haekchen (Entscheidung 4);
 * Transkript und Zusammenfassung tragen je ihre eigene Pruef-Kennung im
 * Tab. Der Tab-Zustand ist kontrolliert — der Abnahme-Kopf (A4) verifiziert
 * das Artefakt des AKTIVEN Tabs. Inhalte kommen aus der bestehenden
 * Shadow-Twin-Content-Route; jeder Leerzustand ist benannt (fehlendes
 * Artefakt, nicht in MongoDB, Scan vor A2).
 *
 * @module components/library/agent-view
 */

import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { MarkdownPreview } from '@/components/library/markdown-preview'
import { useArtefaktInhalt } from '@/hooks/agent-view/use-artefakt-inhalt'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'
import { artefaktMarkiert } from '@/lib/agent-view/werkbank-baum'
import { WerkbankOriginal } from './werkbank-original'
import { SpeicherFehler } from './speicher-fehler'

export type ArtefaktTab = 'original' | 'transkript' | 'zusammenfassung'

export const ARTEFAKT_TAB_LABEL: Record<ArtefaktTab, string> = {
  original: 'Original',
  transkript: 'Transkript',
  zusammenfassung: 'Zusammenfassung',
}

/**
 * Startwert: Wo etwas zu tun ist, zuerst — ein markierter Fehler schlaegt
 * alles (ADR 0006), sonst Zusammenfassung vor Transkript, sonst Original.
 *
 * Befund aus dem Testlauf 26.08.2026: Der starre Vorrang der Zusammenfassung
 * liess die Auswahl auf einem bereits erledigten Reiter landen.
 */
export function standardTab(familie: TwinFamilySummary): ArtefaktTab {
  if (familie.zusammenfassung != null && artefaktMarkiert(familie.zusammenfassung)) return 'zusammenfassung'
  if (familie.transkript != null && artefaktMarkiert(familie.transkript)) return 'transkript'
  if (familie.zusammenfassung != null) return 'zusammenfassung'
  if (familie.transkript != null) return 'transkript'
  return 'original'
}

/**
 * Kennung im Tab (ADR 0006, gleiche Sprache wie der Baum): `⊘` markiert,
 * `✓` angenommen oder geprueft (die Farbe unterscheidet, nicht das Zeichen),
 * `—` kein Artefakt, `?` Report aus einem Scan vor A2.
 */
function tabMark(artefakt: LeadingArtifactSummary | null | undefined): string {
  if (artefakt === undefined) return '?'
  if (artefakt === null) return '—'
  return artefaktMarkiert(artefakt) ? '⊘' : '✓'
}

/**
 * Frontmatter als ZWEISPALTIGE Liste: Schluessel links, Werte alle auf
 * derselben Kante. Vorher lief jede Zeile als eigener Flex-Container, so
 * dass der Wert hinter dem jeweiligen Schluessel begann und die Wertespalte
 * ausfranste (Befund Testsession 25.08.2026). `max-content` gibt der
 * Schluesselspalte die Breite des laengsten Schluessels; `contents` laesst
 * dt/dd direkt im Grid des `dl` liegen, statt in einer Zwischen-Box.
 */
function FrontmatterBlock({ meta }: { meta: Record<string, unknown> }) {
  const eintraege = Object.entries(meta)
  if (eintraege.length === 0) return null
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-md bg-muted/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
      {eintraege.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-semibold text-foreground">{key}:</dt>
          <dd className="min-w-0 break-words">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function ArtefaktInhalt({ libraryId, familie, artefakt, label }: {
  libraryId: string
  familie: TwinFamilySummary
  artefakt: LeadingArtifactSummary | null | undefined
  label: string
}) {
  const { data, isLoading, error } = useArtefaktInhalt(libraryId, familie.sourceId, artefakt ?? null)

  if (artefakt === undefined) {
    return (
      <Alert>
        <AlertTitle>Pruefstand unbekannt</AlertTitle>
        <AlertDescription>Der Report stammt aus einem Scan vor A2 — &bdquo;Neu scannen&ldquo; ergaenzt die Artefakt-Daten.</AlertDescription>
      </Alert>
    )
  }
  if (artefakt === null) {
    return (
      <Alert>
        <AlertTitle>Kein {label} vorhanden</AlertTitle>
        <AlertDescription>
          Diese Twin-Familie traegt kein solches Artefakt — hier fehlt die Transformation, nicht die Pruefung.
        </AlertDescription>
      </Alert>
    )
  }
  if (isLoading) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lade {label}...</p>
  }
  if (error) return <SpeicherFehler titel={`${label} nicht ladbar`} error={error} />
  if (!data || data.grund === 'nicht_in_mongo' || data.markdown === null) {
    return (
      <Alert>
        <AlertTitle>{label} nicht in MongoDB</AlertTitle>
        <AlertDescription>Das Artefakt existiert im Storage, wurde aber nicht importiert — erst importieren, dann pruefen.</AlertDescription>
      </Alert>
    )
  }

  const { meta } = parseFrontmatter(data.markdown)
  return (
    <div className="space-y-2">
      {/* Frontmatter sichtbar UEBER dem Text (Mockup B): genau dort faellt der
          Hoerfehler in authors/participants auf, im Fliesstext nicht. */}
      <FrontmatterBlock meta={meta} />
      <div className="rounded-md border">
        <MarkdownPreview content={data.markdown} compact schriftstufe="sehr-klein" className="max-h-[60vh]" />
      </div>
    </div>
  )
}

export function WerkbankArtefaktDokument({ libraryId, familie, archivHref, tab, onTab }: {
  libraryId: string
  /** Effektive Familie (Report + Kurations-Overrides). */
  familie: TwinFamilySummary
  archivHref: string
  tab: ArtefaktTab
  onTab: (tab: ArtefaktTab) => void
}) {
  const tabs: { wert: ArtefaktTab; mark: string | null }[] = [
    { wert: 'original', mark: null },
    { wert: 'transkript', mark: tabMark(familie.transkript) },
    { wert: 'zusammenfassung', mark: tabMark(familie.zusammenfassung) },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex gap-1 border-b px-3 pt-1">
        {tabs.map(({ wert, mark }) => (
          <button
            key={wert}
            role="tab"
            type="button"
            aria-selected={tab === wert}
            onClick={() => onTab(wert)}
            className={`rounded-t-md border border-b-0 px-3 py-1 text-xs ${tab === wert ? 'bg-background font-medium' : 'border-transparent text-muted-foreground hover:bg-accent'}`}
          >
            {mark !== null && <span className="mr-1" aria-hidden>{mark}</span>}
            {ARTEFAKT_TAB_LABEL[wert]}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'original' ? (
          <WerkbankOriginal libraryId={libraryId} familie={familie} archivHref={archivHref} />
        ) : tab === 'transkript' ? (
          <ArtefaktInhalt libraryId={libraryId} familie={familie} artefakt={familie.transkript} label="Transkript" />
        ) : (
          <ArtefaktInhalt libraryId={libraryId} familie={familie} artefakt={familie.zusammenfassung} label="Zusammenfassung" />
        )}
      </div>
    </div>
  )
}
