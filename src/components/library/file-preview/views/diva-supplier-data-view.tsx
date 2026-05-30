'use client'

/**
 * @fileoverview DIVA-Info-View: Liefersystem-Stammdaten + Bildvergleich (Stufe 1).
 *
 * @description
 * Orchestriert Bildvergleich (DivaImageComparison) mit Switch zwischen
 * Original und LLM-Crop, Vollbild-Modal (DivaBasecolorFullscreenDialog)
 * und die Metadaten-Tabelle (DivaSupplierMetadataTable). Rein
 * deterministisch, kein LLM.
 *
 * Hinweis: die fruehere Quellbild-Auswahl (Basecolor vs. Liefersystem-
 * Preview) wurde entfernt. Lea-Regel #11 (Update 2) hat den Pipeline-
 * Lauf so festgezurrt, dass IMMER der Basecolor-Crop als Bild 1 und die
 * Supplier-Preview (sofern verfuegbar) als Bild 2 ans LLM gehen — die
 * UI-Auswahl wurde ohnehin ignoriert und ist jetzt aus dem View raus.
 */

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import type { OptionvalueEntry } from '@/lib/diva-texture/types'
import { useDivaBasecolorInfo } from '../use-diva-basecolor-info'
import { useDivaBasecolorCrop } from '../use-diva-basecolor-crop'
import { DivaImageComparison, type BasecolorViewMode } from './diva-image-comparison'
import { DivaBasecolorFullscreenDialog } from './diva-basecolor-fullscreen-dialog'
import { DivaSupplierMetadataTable } from './diva-supplier-metadata-table'

interface DivaSupplierDataViewProps {
  provider: StorageProvider
  activeLibraryId: string
  item: StorageItem
  entry: OptionvalueEntry
  /** Stabile Material-ID (= VCodex), wird im Header als Referenz angezeigt. */
  materialId: string
  strategy?: string
}

export function DivaSupplierDataView({
  provider,
  activeLibraryId,
  item,
  entry,
  materialId,
  strategy,
}: DivaSupplierDataViewProps) {
  const [basecolorUrl, setBasecolorUrl] = React.useState<string | null>(null)
  const [supplierImageError, setSupplierImageError] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<BasecolorViewMode>('original')
  const [fullscreenOpen, setFullscreenOpen] = React.useState(false)

  const { data: basecolorInfo } = useDivaBasecolorInfo({
    libraryId: activeLibraryId,
    fileId: item.id,
  })
  const cropState = useDivaBasecolorCrop({
    libraryId: activeLibraryId,
    fileId: item.id,
    enabled: true,
  })

  // Basecolor-URL vom Provider holen (Filesystem-Bild der aktuellen Textur).
  React.useEffect(() => {
    let cancelled = false
    setSupplierImageError(false)
    provider
      .getStreamingUrl(item.id)
      .then((url) => {
        if (!cancelled) setBasecolorUrl(url)
      })
      .catch((err: unknown) => {
        FileLogger.warn('DivaSupplierDataView', 'Basecolor-URL konnte nicht geladen werden', {
          itemId: item.id,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [provider, item.id])

  const sourceMeta = basecolorInfo?.source ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Liefersystem-Treffer</Badge>
        {strategy ? <Badge variant="outline">Strategie: {strategy}</Badge> : null}
        <span className="text-xs text-muted-foreground font-mono">{materialId}</span>
      </div>

      <DivaImageComparison
        basecolorUrl={basecolorUrl}
        supplierImageUrl={entry.Image}
        supplierImageError={supplierImageError}
        onSupplierError={() => setSupplierImageError(true)}
        basecolorMeta={sourceMeta}
        cropState={cropState}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onBasecolorClick={() => setFullscreenOpen(true)}
      />

      <DivaBasecolorFullscreenDialog
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        src={basecolorUrl}
        contentWidthCm={sourceMeta?.breite_cm ?? null}
        contentHeightCm={sourceMeta?.hoehe_cm ?? null}
        pixelLabel={
          sourceMeta ? `${sourceMeta.breite_px}x${sourceMeta.hoehe_px} px` : undefined
        }
        dpiLabel={
          sourceMeta?.dpi_horizontal !== null && sourceMeta?.dpi_horizontal !== undefined
            ? `${sourceMeta.dpi_horizontal} DPI`
            : undefined
        }
      />

      {supplierImageError ? (
        <Alert>
          <AlertDescription className="text-xs">
            Das Liefersystem-Preview ist aktuell nicht erreichbar — der Pass-1-Lauf laeuft dann
            nur mit dem Basecolor-Crop weiter.
          </AlertDescription>
        </Alert>
      ) : null}

      <DivaSupplierMetadataTable entry={entry} />
    </div>
  )
}
