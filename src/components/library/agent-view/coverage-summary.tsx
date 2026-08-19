'use client'

/**
 * @fileoverview Kopfzeilen-Kennzahlen eines Coverage-Reports.
 *
 * @description
 * Macht das Gap-Budget sichtbar: ausgeschlossene Teilbaeume und
 * zusammengefasste Sammel-Befunde stehen als Zahl da, statt still zu fehlen
 * (`no-silent-fallbacks.mdc`). Ebenso die Konventionen, unter denen der Scan
 * lief — Archiv-Konventionen sind Library-Konfiguration, kein Plattform-Wissen.
 *
 * @module components/library/agent-view
 */

import { Badge } from '@/components/ui/badge'
import { actorSummary } from '@/lib/agent-view/labels'
import type { CoverageReport } from '@/lib/agent-view/types'

function Kennzahl({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <div className="flex flex-col" title={title}>
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function CoverageSummary({ report, generatedAt }: { report: CoverageReport; generatedAt: string }) {
  const { totals, conventions } = report
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Kennzahl label="Ordner" value={totals.folders} />
        <Kennzahl label="Dateien" value={totals.files} />
        <Kennzahl label="Quellen" value={totals.sources} title="Quellen mit Twin-Familie" />
        <Kennzahl label="Twin-Artefakte" value={totals.twins} />
        {/* Statisches Label — gapCountLabel wuerde die Zahl doppeln („438 / 438 Befunde"). */}
        <Kennzahl label="Befunde" value={totals.gaps} title={actorSummary(totals.gapsByActor)} />
        <Kennzahl
          label="ausgeschlossen"
          value={totals.skippedExcluded.archive + totals.skippedExcluded.engine}
          title={`Archiv-Scan ${totals.skippedExcluded.archive}, Sync-Engine ${totals.skippedExcluded.engine} (scanExcludeGlobs)`}
        />
        <Kennzahl label="zusammengefasst" value={totals.collapsedGaps} title="Einzelbefunde in Sammel-Gaps ungesichteter Teilbaeume" />
        <Kennzahl label="Scan-Fehler" value={totals.scanErrors} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Scan {new Date(generatedAt).toLocaleString('de-DE')}</span>
        <Badge variant="outline" title="Der Report ist abgeleitet und wegwerfbar — Loeschen ist folgenlos.">
          berechnet, nicht Wahrheit
        </Badge>
        <span title="Fuehrendes Artefakt der Twin-Familie (Contract §2b)">
          Standard-Template: {conventions.standardTemplate ?? 'nicht konfiguriert'}
        </span>
        <span>
          Vorhaben-Muster: {conventions.vorhabenFolderPattern ?? 'nur Selbstdeklaration'}
        </span>
        <span>
          _INDEX-Pflicht: {conventions.indexRequiredMaxDepth === null ? 'inaktiv' : `bis Tiefe ${conventions.indexRequiredMaxDepth}`}
        </span>
        <span>Bericht-Frische: {conventions.berichtFreshness ? 'aktiv' : 'aus'}</span>
      </div>
    </div>
  )
}
