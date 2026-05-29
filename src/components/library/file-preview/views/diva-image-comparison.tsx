'use client'

/**
 * @fileoverview Bildvergleich fuer den DIVA-Info-Tab (Stufe 1 + Update 2).
 *
 * @description
 * Zeigt Basecolor (Filesystem) und Liefersystem-Preview nebeneinander.
 * Reine Praesentations-Komponente; Fallback bei toter Preview-URL
 * (Plan Edge-Case #1).
 *
 * Update 2 (2026-05-28): Overlay unten links im Basecolor mit Pixel-
 * Massen + DPI + cm-Massen des Originals (sofern bekannt). Klick aufs
 * Basecolor-Bild oeffnet ein Modal mit dem tatsaechlichen Crop, der
 * ans LLM gesendet wird — gleicher Helper wie der Pipeline-Lauf.
 */

import { ImageOff } from 'lucide-react'
import type { ImageTechnicalMetadata } from '@/lib/image/exif-metadata'

interface DivaImageComparisonProps {
  basecolorUrl: string | null
  supplierImageUrl?: string
  supplierImageError: boolean
  onSupplierError: () => void
  /** Source-Metadaten der Original-Basecolor-Bitmap (siehe basecolor-info-Route). */
  basecolorMeta?: ImageTechnicalMetadata | null
  /** Wird beim Klick aufs Basecolor-Bild aufgerufen; oeffnet das Crop-Modal. */
  onBasecolorClick?: () => void
}

/** Formatiert die Overlay-Caption fuer die Original-Basecolor-Bitmap. */
function formatBasecolorCaption(meta: ImageTechnicalMetadata): string {
  const px = `${meta.breite_px}x${meta.hoehe_px} px`
  const dpi = meta.dpi_horizontal !== null ? ` · ${meta.dpi_horizontal} DPI` : ' · DPI ?'
  const cm =
    meta.breite_cm !== null && meta.hoehe_cm !== null
      ? ` · ${meta.breite_cm.toFixed(1)}x${meta.hoehe_cm.toFixed(1)} cm`
      : ''
  return `${px}${dpi}${cm}`
}

export function DivaImageComparison({
  basecolorUrl,
  supplierImageUrl,
  supplierImageError,
  onSupplierError,
  basecolorMeta,
  onBasecolorClick,
}: DivaImageComparisonProps) {
  const isClickable = onBasecolorClick !== undefined && basecolorUrl !== null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <figure className="space-y-1">
        <figcaption className="text-xs text-muted-foreground">
          Basecolor (Filesystem){isClickable ? ' — Klick zeigt LLM-Ausschnitt' : ''}
        </figcaption>
        <div className="relative flex h-48 items-center justify-center overflow-hidden rounded border bg-muted/30">
          {basecolorUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={basecolorUrl}
              alt="Basecolor"
              className={`max-h-full max-w-full object-contain ${isClickable ? 'cursor-zoom-in' : ''}`}
              onClick={onBasecolorClick}
            />
          ) : (
            <span className="text-xs text-muted-foreground">Bild wird geladen …</span>
          )}
          {basecolorMeta ? (
            <div className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[10px] leading-tight text-white">
              {formatBasecolorCaption(basecolorMeta)}
            </div>
          ) : null}
        </div>
      </figure>

      <figure className="space-y-1">
        <figcaption className="text-xs text-muted-foreground">Liefersystem-Preview</figcaption>
        <div className="flex h-48 items-center justify-center overflow-hidden rounded border bg-muted/30">
          {supplierImageUrl && !supplierImageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={supplierImageUrl}
              alt="Liefersystem-Preview"
              className="max-h-full max-w-full object-contain"
              onError={onSupplierError}
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageOff className="h-6 w-6" />
              <span className="text-xs">Preview nicht verfuegbar</span>
            </div>
          )}
        </div>
      </figure>
    </div>
  )
}
