'use client'

/**
 * @fileoverview Bildvergleich fuer den DIVA-Info-Tab (Stufe 1).
 *
 * @description
 * Zeigt Basecolor (Filesystem) und Liefersystem-Preview nebeneinander.
 * Reine Praesentations-Komponente; Fallback bei toter Preview-URL
 * (Plan Edge-Case #1). Ausgegliedert aus diva-supplier-data-view.tsx
 * (200-Zeilen-Regel).
 */

import { ImageOff } from 'lucide-react'

interface DivaImageComparisonProps {
  basecolorUrl: string | null
  supplierImageUrl?: string
  supplierImageError: boolean
  onSupplierError: () => void
}

export function DivaImageComparison({
  basecolorUrl,
  supplierImageUrl,
  supplierImageError,
  onSupplierError,
}: DivaImageComparisonProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <figure className="space-y-1">
        <figcaption className="text-xs text-muted-foreground">Basecolor (Filesystem)</figcaption>
        <div className="flex h-48 items-center justify-center overflow-hidden rounded border bg-muted/30">
          {basecolorUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={basecolorUrl} alt="Basecolor" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">Bild wird geladen …</span>
          )}
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
