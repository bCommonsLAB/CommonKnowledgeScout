'use client'

/**
 * @fileoverview Seitenkopf der Agentensicht — EINE Zeile (Welle A1).
 *
 * @description
 * Mockup `agentensicht-abnahme.html`, Zustand C: Der Kopf traegt nur noch
 * Scan-Zeitpunkt, „berechnet, nicht Wahrheit" und den Fortschritt seit dem
 * letzten Scan. Die acht Kennzahlen, die Akteur-Chips und die Zyklus-Zeile
 * sind hier weg — die Akteur-Zahlen wohnen im Leerzustand der Werkbank
 * ({@link WerkbankLeerzustand}), Konventionen und Gap-Budget im
 * Aufklapp-Element {@link AgentViewScanDetails}.
 *
 * Fehlt ein Delta, nennt die Zeile den Grund (erster Scan, anderer Scope,
 * gekappter Vorlauf) statt still 0/0 zu zeigen (`no-silent-fallbacks.mdc`);
 * Scan-Fehler stehen laut in der Zeile, nicht nur im Aufklapp-Element.
 *
 * @module components/library/agent-view
 */

import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CoverageResponse } from '@/hooks/agent-view/use-coverage-report'
import { AgentViewScanDetails } from './agent-view-scan-details'

export interface AgentViewKopfProps {
  /** null = noch kein Report geladen; der Grund steht als Alert im Panel. */
  daten: CoverageResponse | null
  isLoading: boolean
  isScanning: boolean
  onScan: () => void
}

/** „2 erledigt · 1 neu" oder der benannte Grund, warum es kein Delta gibt. */
function deltaText(daten: CoverageResponse): string {
  if (daten.delta === null) return daten.deltaHinweis ?? 'kein Delta (kein Grund gemeldet)'
  return `seit dem letzten Scan: ${daten.delta.erledigt} erledigt · ${daten.delta.neu} neu`
}

export function AgentViewKopf({ daten, isLoading, isScanning, onScan }: AgentViewKopfProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h1 className="text-lg font-semibold">Agentensicht</h1>

      {daten && (
        <p className="text-xs text-muted-foreground">
          Scan <span className="font-medium text-foreground">{new Date(daten.generatedAt).toLocaleString('de-DE')}</span>
          {' · '}
          <span title="Der Report ist abgeleitet und wegwerfbar — Loeschen ist folgenlos.">
            berechnet, nicht Wahrheit
          </span>
          {' · '}
          <span title="Befunde wandern (Mensch → Pipeline → Verifikation) — die Gesamtzahl misst keinen Fortschritt.">
            {deltaText(daten)}
          </span>
          {daten.report.totals.scanErrors > 0 && (
            <span className="font-medium text-red-500"> · {daten.report.totals.scanErrors} Scan-Fehler</span>
          )}
        </p>
      )}

      <span className="ml-auto flex items-center gap-2">
        {daten && <AgentViewScanDetails report={daten.report} />}
        <Button onClick={onScan} disabled={isScanning || isLoading}>
          {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Neu scannen
        </Button>
      </span>
    </header>
  )
}
