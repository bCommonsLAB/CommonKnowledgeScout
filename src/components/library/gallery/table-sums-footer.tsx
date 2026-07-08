'use client'

/**
 * TableSumsFooter — Summen-Fusszeile der Tabellenansicht (Plan
 * summen-und-synergie-aggregation, Todo table-footer).
 *
 * Zeigt die SERVERSEITIG ueber den gesamten gefilterten Bestand aggregierten
 * Summen der additiven Zahlenfelder (Positivliste der Registry). Fehlende
 * Werte werden pro Feld explizit als "X ohne Angabe" ausgewiesen — sie sind
 * NICHT als 0 in die Summe eingeflossen (no-silent-fallbacks).
 */

import { useTranslation } from '@/lib/i18n/hooks'
import type { GallerySumsState } from '@/hooks/gallery/use-gallery-sums'

export interface TableSumsFooterProps {
  sumsState: GallerySumsState
  /** Anzeigenamen je Feld (aus den Facetten-Definitionen); Fallback: Key. */
  fieldLabels?: Record<string, string>
}

/** Zahlformat wie die Tabellenzellen: tabular-nums, de-DE, max. 1 Nachkommastelle. */
function formatSum(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

export function TableSumsFooter({ sumsState, fieldLabels }: TableSumsFooterProps) {
  const { t } = useTranslation()
  const { sums, total, loading, error } = sumsState

  if (loading) {
    return (
      <div className="mb-6 rounded-md border bg-muted/20 px-4 py-3 text-sm text-muted-foreground" role="status">
        {t('gallery.sums.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {t('gallery.sums.loadError')}: {error}
      </div>
    )
  }
  if (!sums || Object.keys(sums).length === 0) return null

  return (
    <div className="mb-6 rounded-md border bg-muted/20 px-4 py-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        {t('gallery.sums.title', { total })}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {Object.entries(sums).map(([field, agg]) => (
          <div key={field} className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {fieldLabels?.[field] || field}
            </span>
            <span className="text-sm font-medium tabular-nums">{formatSum(agg.sum)}</span>
            {agg.missing > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('gallery.sums.missing', { count: agg.missing })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
