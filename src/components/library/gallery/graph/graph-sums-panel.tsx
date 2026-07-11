'use client'

/**
 * GraphSumsPanel — Summen-Panel des Graph-Modus (Plan summen-und-synergie-
 * aggregation, Todo graph-panel).
 *
 * Zeigt pro Summenfeld (Registry-Positivliste) die naive Summe UND die
 * synergiebereinigte Summe nebeneinander. Datenbasis sind die bereits
 * geladenen Graph-Dokumente + die rohen Aehnlichkeits-Kanten aus
 * use-similarity-edges — KEIN eigener Endpoint. Die bereinigte Summe ist
 * eine SCHAETZUNG (Embeddings messen thematische Naehe, keine kausale
 * Ueberlappung) und wird entsprechend gekennzeichnet: naive Summe =
 * Obergrenze, bereinigt = konservative Schaetzung.
 */

import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { SimilarityNeighborEdge } from '@/hooks/gallery/use-similarity-edges'
import { computeSynergyAdjustedSum } from '@/lib/graph/synergy-sum'
import { getSummableFields, isValidDetailViewType } from '@/lib/detail-view-types/registry'
import { useTranslation } from '@/lib/i18n/hooks'
import { OverlapReportDialog } from '../overlap-report-dialog'

export interface GraphSumsPanelProps {
  docs: DocCardMeta[]
  /** Rohe (ungedeckelte) Aehnlichkeits-Kanten der aktiven Similarity-Quelle. */
  edges: SimilarityNeighborEdge[]
  /** Anzeigenamen je meta-Feld (aus den Facetten-Definitionen). */
  fieldLabels?: Record<string, string>
  /** Fuer den Wirkungsbericht (Stufe 3, Owner-only sichtbar). */
  libraryId?: string
  canManageReport?: boolean
}

/** Alpha-Stufen laut Plan: Keine Synergie / Moderat / Stark. */
const ALPHA_CHOICES = [
  { value: 0, labelKey: 'gallery.sums.alphaNone' },
  { value: 0.5, labelKey: 'gallery.sums.alphaModerate' },
  { value: 0.9, labelKey: 'gallery.sums.alphaStrong' },
] as const

function formatSum(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

export function GraphSumsPanel({ docs, edges, fieldLabels, libraryId, canManageReport }: GraphSumsPanelProps) {
  const { t } = useTranslation()
  const [alpha, setAlpha] = useState<number>(0.5)

  // Summenfelder aus dem ViewType der geladenen Dokumente (Positivliste).
  const fields = useMemo(() => {
    const viewType = docs
      .map((d) => (d as { detailViewType?: string }).detailViewType)
      .find((vt) => isValidDetailViewType(vt))
    return getSummableFields(viewType)
  }, [docs])

  const rows = useMemo(
    () =>
      fields.map((field) => {
        const items = docs.map((d) => {
          const raw = (d as unknown as Record<string, unknown>)[field]
          return {
            id: d.fileId || d.id,
            value: typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined,
          }
        })
        return { field, ...computeSynergyAdjustedSum(items, edges, alpha) }
      }),
    [fields, docs, edges, alpha],
  )

  if (fields.length === 0 || docs.length === 0) return null

  return (
    <div className="absolute right-2 top-2 z-20 w-64 rounded-md border bg-background/90 p-3 text-xs shadow-sm backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-muted-foreground">{t('gallery.sums.graphTitle')}</span>
        <span title={t('gallery.sums.methodNote')} className="cursor-help">
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </span>
      </div>
      <label className="mb-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{t('gallery.sums.alphaLabel')}</span>
        <select
          className="rounded border bg-background px-1.5 py-0.5 text-xs"
          value={String(alpha)}
          onChange={(e) => setAlpha(Number(e.target.value))}
        >
          {ALPHA_CHOICES.map((choice) => (
            <option key={choice.value} value={String(choice.value)}>
              {t(choice.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.field}>
            <div className="font-medium">{fieldLabels?.[row.field] || row.field}</div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{t('gallery.sums.naive')}</span>
              <span className="tabular-nums">{formatSum(row.naiveSum)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{t('gallery.sums.adjusted')}</span>
              <span className="tabular-nums font-medium">{formatSum(row.adjustedSum)}</span>
            </div>
            {row.missing > 0 && (
              <div className="text-muted-foreground">
                {t('gallery.sums.missing', { count: row.missing })}
              </div>
            )}
          </div>
        ))}
      </div>
      {libraryId && canManageReport && (
        <div className="mt-2 border-t pt-2">
          <OverlapReportDialog libraryId={libraryId} canManage />
        </div>
      )}
    </div>
  )
}
