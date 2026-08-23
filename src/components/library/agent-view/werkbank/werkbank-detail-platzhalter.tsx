'use client'

/**
 * @fileoverview Detail-Platzhalter der Werkbank (Welle W3).
 *
 * @description
 * W3 baut das Geruest — das volle Detail (Bericht-Render via Lese-Route,
 * Befunde je Akteur, Familien) kommt in W4. Der Platzhalter zeigt den Kopf
 * des gewaehlten Vorhabens aus der Karte und benennt jeden Leerzustand:
 * nichts gewaehlt → Auswahl-Hinweis + Library-Totalen; gewaehlte folderId
 * nicht im Report → „nicht im letzten Scan" (kein stilles Leerbleiben).
 *
 * @module components/library/agent-view
 */

import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { actorSummary, gapCountLabel, standLabel } from '@/lib/agent-view/labels'
import type { CoverageTotals, VorhabenCard } from '@/lib/agent-view/types'
import { CoverageAmpel } from '../coverage-ampel'

export function WerkbankDetailPlatzhalter({
  karte,
  vorhabenId,
  totals,
}: {
  /** Karte zur gewaehlten folderId; null = nichts gewaehlt oder nicht im Report. */
  karte: VorhabenCard | null
  /** Gewaehlte folderId aus der URL (`?vorhaben=`). */
  vorhabenId: string | null
  totals: CoverageTotals
}) {
  if (karte === null && vorhabenId !== null) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Nicht im letzten Scan</p>
        <p className="mt-1">
          Das gewaehlte Vorhaben (<code className="text-xs">{vorhabenId}</code>) kommt im gespeicherten Report nicht
          vor — Ordner geloescht, verschoben oder der Report ist ein Teilbaum-Report. &bdquo;Neu scannen&ldquo; oben
          rechnet den Report neu.
        </p>
      </div>
    )
  }

  if (karte === null) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <p>Vorhaben links waehlen.</p>
        <p className="mt-2">
          Library gesamt: {totals.folders} Ordner · {totals.files} Dateien · {totals.sources} Quellen ·{' '}
          {totals.twins} Twins · {gapCountLabel(totals.gaps)}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-4">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {karte.ampel !== undefined && <CoverageAmpel ampel={karte.ampel} />}
          <span className="break-words">{karte.name}</span>
          {karte.widerspruch && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />}
        </h2>
        <p className="break-words text-xs text-muted-foreground">{karte.path}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{standLabel(karte.bearbeitungsstand)}</Badge>
        {karte.bearbeitungsstandSeit && (
          <span className="text-xs text-muted-foreground">seit {karte.bearbeitungsstandSeit.slice(0, 10)}</span>
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

      {typeof karte.berichtTitel === 'string' && karte.berichtTitel !== '' && (
        <p className="text-sm font-medium">{karte.berichtTitel}</p>
      )}
      {typeof karte.berichtStatus === 'string' && (
        <p className="text-xs text-muted-foreground">Status: {karte.berichtStatus}</p>
      )}
      {karte.themen !== undefined && karte.themen.length > 0 && (
        <p className="flex flex-wrap gap-1">
          {karte.themen.map((thema) => (
            <Badge key={thema} variant="outline" className="text-xs">{thema}</Badge>
          ))}
        </p>
      )}

      <p className="pt-2 text-xs text-muted-foreground">
        Bericht, Befunde je Akteur und Twin-Familien erscheinen hier mit Welle W4 (Detail-Panel).
      </p>
    </div>
  )
}
