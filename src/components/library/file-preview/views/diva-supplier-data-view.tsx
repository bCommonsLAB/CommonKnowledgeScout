'use client'

/**
 * @fileoverview DIVA-Info-View: Liefersystem-Stammdaten + Bildwahl (Stufe 1).
 *
 * @description
 * Orchestriert Bildvergleich (DivaImageComparison), Metadaten-Tabelle
 * (DivaSupplierMetadataTable) und die Quellbild-Wahl. Die Wahl wird ueber
 * den generischen Archiv-Property-Store persistiert (Key = stabile
 * Material-ID = VCodex, Plan Edge-Case #18). Rein deterministisch, kein LLM.
 */

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import type { AnalysisSourceImage, OptionvalueEntry } from '@/lib/diva-texture/types'
import { DivaImageComparison } from './diva-image-comparison'
import { DivaSupplierMetadataTable } from './diva-supplier-metadata-table'

const SOURCE_IMAGE_PROPERTY = 'analysisSourceImage'

interface DivaSupplierDataViewProps {
  provider: StorageProvider
  activeLibraryId: string
  item: StorageItem
  entry: OptionvalueEntry
  /** Stabile Material-ID (= VCodex), an die die Bildwahl gebunden wird. */
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
  const [sourceImage, setSourceImage] = React.useState<AnalysisSourceImage>('basecolor')
  const [isSaving, setIsSaving] = React.useState(false)

  // Basecolor-URL vom Provider holen (Filesystem-Bild der aktuellen Textur).
  React.useEffect(() => {
    let cancelled = false
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

  // Persistierte Bildwahl laden (Key = stabile Material-ID).
  React.useEffect(() => {
    let cancelled = false
    setSupplierImageError(false)
    const url = `/api/library/${encodeURIComponent(activeLibraryId)}/archive-item-properties?itemKey=${encodeURIComponent(materialId)}`
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as { properties?: Record<string, unknown> }
      })
      .then((json) => {
        if (cancelled) return
        const stored = json.properties?.[SOURCE_IMAGE_PROPERTY]
        setSourceImage(stored === 'supplier-preview' ? 'supplier-preview' : 'basecolor')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        FileLogger.warn('DivaSupplierDataView', 'Bildwahl konnte nicht geladen werden', {
          materialId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [activeLibraryId, materialId])

  const handleSourceChange = React.useCallback(
    async (value: string) => {
      if (value !== 'basecolor' && value !== 'supplier-preview') {
        FileLogger.warn('DivaSupplierDataView', 'Unerwarteter Bildwahl-Wert ignoriert', { value })
        return
      }
      const next: AnalysisSourceImage = value
      const previous = sourceImage
      setSourceImage(next)
      setIsSaving(true)
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(activeLibraryId)}/archive-item-properties`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemKey: materialId, properties: { [SOURCE_IMAGE_PROPERTY]: next } }),
          },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch (err) {
        setSourceImage(previous)
        const message = err instanceof Error ? err.message : String(err)
        FileLogger.error('DivaSupplierDataView', 'Bildwahl speichern fehlgeschlagen', { materialId, error: message })
        toast.error('Bildwahl nicht gespeichert', { description: message })
      } finally {
        setIsSaving(false)
      }
    },
    [activeLibraryId, materialId, sourceImage],
  )

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
      />

      <div className="space-y-2 rounded-md border p-4">
        <Label className="text-sm font-medium">Quellbild fuer Analyse</Label>
        <RadioGroup
          value={sourceImage}
          onValueChange={(v) => void handleSourceChange(v)}
          disabled={isSaving}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="basecolor" id="diva-src-basecolor" />
            <Label htmlFor="diva-src-basecolor" className="font-normal">Basecolor</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="supplier-preview" id="diva-src-supplier" />
            <Label htmlFor="diva-src-supplier" className="font-normal">Liefersystem-Preview</Label>
          </div>
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          Die Wahl wird an die stabile Material-ID gebunden und in Stufe 3 (LLM-Pass) verwendet.
        </p>
      </div>

      {supplierImageError ? (
        <Alert>
          <AlertDescription className="text-xs">
            Das Liefersystem-Preview ist aktuell nicht erreichbar — die Analyse kann weiterhin das
            Basecolor-Bild nutzen.
          </AlertDescription>
        </Alert>
      ) : null}

      <DivaSupplierMetadataTable entry={entry} />
    </div>
  )
}
