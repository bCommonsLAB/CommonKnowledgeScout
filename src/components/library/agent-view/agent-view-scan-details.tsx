'use client'

/**
 * @fileoverview Aufklapp-Element „Scan-Details" (Welle A1).
 *
 * @description
 * Nachschlagewerk, kein Dauerinhalt (Projektauftrag Werkbank-Abnahme, A1):
 * Die Konventionen, unter denen der Scan lief, und das Gap-Budget wandern
 * aus dem Seitenkopf in dieses Aufklapp-Element. Verschwinden duerfen sie
 * nicht — ausgeschlossene Teilbaeume, zusammengefasste Sammel-Befunde und
 * Scan-Fehler stehen weiter als Zahl da, statt still zu fehlen
 * (`no-silent-fallbacks.mdc`).
 *
 * @module components/library/agent-view
 */

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { zyklusSchrittLabel } from '@/lib/agent-view/labels'
import type { CoverageReport, ZyklusSchritt } from '@/lib/agent-view/types'

const SCHRITTE: ZyklusSchritt[] = [1, 2, 3, 4]

function Zeile({ label, wert, title }: { label: string; wert: string | number; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3" title={title}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{wert}</span>
    </div>
  )
}

function zaehleNachSchritt(report: CoverageReport): Map<ZyklusSchritt, number> {
  const counts = new Map<ZyklusSchritt, number>()
  for (const gap of report.gaps) counts.set(gap.zyklusSchritt, (counts.get(gap.zyklusSchritt) ?? 0) + 1)
  return counts
}

export function AgentViewScanDetails({ report }: { report: CoverageReport }) {
  const { totals, conventions } = report
  const nachSchritt = zaehleNachSchritt(report)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
          Scan-Details <ChevronDown className="ml-1 h-3 w-3" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 text-xs">
        <section className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Befunde</h2>
          <Zeile label="gesamt" wert={totals.gaps} />
          {SCHRITTE.map((schritt) => (
            <Zeile
              key={schritt}
              label={zyklusSchrittLabel(schritt)}
              wert={nachSchritt.get(schritt) ?? 0}
              title="Gezaehlt aus den gespeicherten Befunden — bei gekappter Liste entsprechend weniger."
            />
          ))}
        </section>

        <section className="space-y-1 border-t pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget</h2>
          <Zeile
            label="ausgeschlossen"
            wert={totals.skippedExcluded.archive + totals.skippedExcluded.engine}
            title={`Archiv-Scan ${totals.skippedExcluded.archive}, Sync-Engine ${totals.skippedExcluded.engine} (scanExcludeGlobs)`}
          />
          <Zeile
            label="zusammengefasst"
            wert={totals.collapsedGaps}
            title="Einzelbefunde in Sammel-Gaps ungesichteter Teilbaeume"
          />
          <Zeile label="Scan-Fehler" wert={totals.scanErrors} />
        </section>

        <section className="space-y-1 border-t pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Konventionen</h2>
          <Zeile
            label="Standard-Template"
            wert={conventions.standardTemplate ?? 'nicht konfiguriert'}
            title="Fuehrendes Artefakt der Twin-Familie (Contract §2b)"
          />
          <Zeile label="Vorhaben-Muster" wert={conventions.vorhabenFolderPattern ?? 'nur Selbstdeklaration'} />
          <Zeile
            label="_INDEX-Pflicht"
            wert={conventions.indexRequiredMaxDepth === null ? 'inaktiv' : `bis Tiefe ${conventions.indexRequiredMaxDepth}`}
          />
          <Zeile label="Bericht-Frische" wert={conventions.berichtFreshness ? 'aktiv' : 'aus'} />
        </section>
      </PopoverContent>
    </Popover>
  )
}
