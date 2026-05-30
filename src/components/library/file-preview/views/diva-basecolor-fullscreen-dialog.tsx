'use client'

/**
 * @fileoverview Fullscreen-1:1-Modal fuer das Basecolor-Original (Stufe 3 Update 2 — UI).
 *
 * @description
 * Zeigt das Original-Basecolor-Bild in physisch 1:1-Groesse in einem
 * Dialog ueber dem gesamten Viewport. Der Bild-Container ist scroll-
 * + pannbar — das LLM-Bild geht oft weit ueber den Bildschirm hinaus
 * (z.B. 4096 px @ 333 DPI → 1181 CSS-px), und der User scrollt zu der
 * Stelle, die er inspizieren will.
 *
 * Bild wird vom Storage-Provider als Streaming-URL gereicht (gleiche
 * URL wie die Inline-Anzeige) — kein doppelter Fetch.
 */

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { divaCmToCssPx } from './diva-basecolor-1to1'

interface DivaBasecolorFullscreenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Bild-Quelle (Streaming-URL des Storage-Providers). */
  src: string | null
  /** Physische Breite des Originals in cm. */
  contentWidthCm: number | null
  /** Physische Hoehe des Originals in cm. */
  contentHeightCm: number | null
  /** Pixel-Masse fuer die Caption. */
  pixelLabel?: string
  /** DPI fuer die Caption. */
  dpiLabel?: string
}

export function DivaBasecolorFullscreenDialog({
  open,
  onOpenChange,
  src,
  contentWidthCm,
  contentHeightCm,
  pixelLabel,
  dpiLabel,
}: DivaBasecolorFullscreenDialogProps) {
  const widthCssPx =
    contentWidthCm !== null && contentWidthCm > 0 ? divaCmToCssPx(contentWidthCm) : null
  const heightCssPx =
    contentHeightCm !== null && contentHeightCm > 0 ? divaCmToCssPx(contentHeightCm) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] gap-2 p-4 sm:max-w-[95vw]"
        aria-describedby={undefined}
      >
        <DialogHeader className="space-y-1">
          <DialogTitle>Basecolor — Vollbild 1:1</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {pixelLabel ? (
              <Badge variant="secondary" className="font-mono">{pixelLabel}</Badge>
            ) : null}
            {dpiLabel ? (
              <Badge variant="outline" className="font-mono">{dpiLabel}</Badge>
            ) : null}
            {contentWidthCm !== null && contentHeightCm !== null ? (
              <Badge variant="secondary" className="font-mono">
                {contentWidthCm.toFixed(1)}x{contentHeightCm.toFixed(1)} cm
              </Badge>
            ) : null}
            <span className="text-muted-foreground">Scrollen zum Verschieben</span>
          </div>
        </DialogHeader>

        <div className="overflow-auto rounded border bg-muted/30" style={{ maxHeight: '80vh' }}>
          {src && widthCssPx !== null && heightCssPx !== null ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt="Basecolor 1:1"
              style={{
                width: `${widthCssPx}px`,
                height: `${heightCssPx}px`,
                maxWidth: 'none',
                display: 'block',
              }}
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              {src === null ? 'Bild wird geladen …' : 'Physische Masse unbekannt — Anzeige nicht moeglich'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
