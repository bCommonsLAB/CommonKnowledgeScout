'use client'

/**
 * @fileoverview Bildvergleich fuer den DIVA-Info-Tab (Stufe 1 + Update 2).
 *
 * @description
 * Linker Bereich: Basecolor mit Switch zwischen Original und LLM-Crop —
 * beide werden physisch 1:1 angezeigt (4 cm Material = 4 cm am Bildschirm,
 * Annahme 96 CSS-DPI). Klick aufs Bild oeffnet die pannbare Vollbild-
 * Ansicht des Originals.
 *
 * Rechter Bereich: Liefersystem-Preview wie gehabt (Best-Effort-<img>,
 * Edge-Case #1 wird via onSupplierError gemeldet).
 *
 * Reine Praesentations-Komponente: bekommt Source-Meta, Crop-Daten, URLs
 * von oben — laedt nichts selbst.
 */

import * as React from 'react'
import { ImageOff } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { DivaBasecolor1to1 } from './diva-basecolor-1to1'
import type { ImageTechnicalMetadata } from '@/lib/image/exif-metadata'
import type { DivaBasecolorCropState } from '../use-diva-basecolor-crop'

export type BasecolorViewMode = 'original' | 'llm-crop'

interface DivaImageComparisonProps {
  basecolorUrl: string | null
  supplierImageUrl?: string
  supplierImageError: boolean
  onSupplierError: () => void
  /** Source-Metadaten der Original-Basecolor-Bitmap (siehe basecolor-info-Route). */
  basecolorMeta: ImageTechnicalMetadata | null
  /** Crop-Zustand (Object-URL + Maesse) aus useDivaBasecolorCrop. */
  cropState: DivaBasecolorCropState
  /** Aktueller Anzeige-Modus (Original oder LLM-Crop). */
  viewMode: BasecolorViewMode
  onViewModeChange: (mode: BasecolorViewMode) => void
  /** Klick aufs Basecolor-Bild oeffnet das Fullscreen-Modal. */
  onBasecolorClick: () => void
}

export function DivaImageComparison({
  basecolorUrl,
  supplierImageUrl,
  supplierImageError,
  onSupplierError,
  basecolorMeta,
  cropState,
  viewMode,
  onViewModeChange,
  onBasecolorClick,
}: DivaImageComparisonProps) {
  // Physische cm-Masse je nach Modus bestimmen — Inline-Render rechnet daraus
  // die CSS-Breite (Annahme 96 CSS-DPI).
  const inline = pickInlineImage(viewMode, basecolorUrl, basecolorMeta, cropState)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <figure className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <figcaption className="text-xs text-muted-foreground">
            Basecolor — physisch 1:1 (Klick zeigt Vollbild)
          </figcaption>
          <div className="flex items-center gap-2">
            <Label htmlFor="diva-basecolor-mode" className="text-xs">
              {viewMode === 'llm-crop' ? 'LLM-Crop' : 'Original'}
            </Label>
            <Switch
              id="diva-basecolor-mode"
              checked={viewMode === 'llm-crop'}
              onCheckedChange={(checked) => onViewModeChange(checked ? 'llm-crop' : 'original')}
              aria-label="Umschalten zwischen Original und LLM-Crop"
            />
          </div>
        </div>

        {inline.kind === 'loading' && (
          <div className="flex h-48 items-center justify-center rounded border bg-muted/30 text-xs text-muted-foreground">
            Bild wird geladen …
          </div>
        )}
        {inline.kind === 'error' && (
          <div className="flex h-48 items-center justify-center rounded border bg-muted/30 text-xs text-destructive">
            {inline.message}
          </div>
        )}
        {inline.kind === 'ready' && (
          <DivaBasecolor1to1
            src={inline.src}
            contentWidthCm={inline.widthCm}
            contentHeightCm={inline.heightCm}
            alt={viewMode === 'llm-crop' ? 'LLM-Crop des Basecolors' : 'Basecolor-Original'}
            onClick={onBasecolorClick}
          />
        )}

        {inline.kind === 'ready' && (
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <Badge variant="secondary" className="font-mono">{inline.pxLabel}</Badge>
            <Badge variant="secondary" className="font-mono">
              {inline.widthCm.toFixed(1)}x{inline.heightCm.toFixed(1)} cm
            </Badge>
            {inline.dpiLabel ? (
              <Badge variant="outline" className="font-mono">{inline.dpiLabel}</Badge>
            ) : null}
            {inline.warningLabel ? (
              <Badge variant="destructive" className="font-mono">{inline.warningLabel}</Badge>
            ) : null}
          </div>
        )}
      </figure>

      <figure className="space-y-1">
        <figcaption className="text-xs text-muted-foreground">Liefersystem-Preview</figcaption>
        <div
          className="flex items-center justify-center overflow-hidden rounded border bg-muted/30"
          style={{ height: '320px' }}
        >
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

/**
 * Entscheidet je nach Modus, welche Quelle + welche cm-Masse die Inline-
 * 1:1-Anzeige bekommt. Trennt Loading-/Error-/Ready-Zustaende sauber,
 * damit das JSX oben nur ein flaches Switch braucht.
 */
type InlineImageDecision =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready'
      src: string
      widthCm: number
      heightCm: number
      pxLabel: string
      dpiLabel: string | null
      warningLabel: string | null
    }

function pickInlineImage(
  mode: BasecolorViewMode,
  basecolorUrl: string | null,
  meta: ImageTechnicalMetadata | null,
  cropState: DivaBasecolorCropState,
): InlineImageDecision {
  if (mode === 'llm-crop') {
    if (cropState.kind === 'loading' || cropState.kind === 'idle') return { kind: 'loading' }
    if (cropState.kind === 'error') return { kind: 'error', message: `Crop-Fehler: ${cropState.message}` }
    const cm = parseCm(cropState.data.cropCm)
    if (cm === null) return { kind: 'error', message: 'Crop-cm-Wert nicht parsebar' }
    // Der Source-DPI-Wert spielt im Crop-Modus keine Anzeige-Rolle mehr —
    // das Bild wird hier 1:1 (= 96 CSS-DPI) gerendert. Der Source-DPI ist
    // ueber den Original-Modus weiter einsehbar; eine DPI-Fallback-Warnung
    // bleibt aber sichtbar, weil sie die Vertrauenswuerdigkeit der 4-cm-
    // Annahme betrifft.
    return {
      kind: 'ready',
      src: cropState.data.url,
      widthCm: cm.width,
      heightCm: cm.height,
      pxLabel: `${cropState.data.cropPx} px`,
      dpiLabel: null,
      warningLabel: cropState.data.dpiFallback
        ? 'DPI-Fallback (300 angenommen)'
        : cropState.data.fullImage
          ? 'Voll-Bild (< 4 cm)'
          : null,
    }
  }
  // mode === 'original'
  if (basecolorUrl === null) return { kind: 'loading' }
  if (meta === null) return { kind: 'loading' }
  if (meta.breite_cm === null || meta.hoehe_cm === null) {
    return {
      kind: 'error',
      message: 'Original ohne cm-Masse (DPI fehlt im Header) — 1:1-Anzeige nicht moeglich',
    }
  }
  return {
    kind: 'ready',
    src: basecolorUrl,
    widthCm: meta.breite_cm,
    heightCm: meta.hoehe_cm,
    pxLabel: `${meta.breite_px}x${meta.hoehe_px} px`,
    dpiLabel: meta.dpi_horizontal !== null ? `${meta.dpi_horizontal} DPI` : null,
    warningLabel: null,
  }
}

/** Parst Crop-cm-String "4.0x4.0" → { width: 4.0, height: 4.0 } | null. */
function parseCm(label: string): { width: number; height: number } | null {
  const match = label.match(/^([0-9.]+)x([0-9.]+)$/)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  return { width, height }
}
