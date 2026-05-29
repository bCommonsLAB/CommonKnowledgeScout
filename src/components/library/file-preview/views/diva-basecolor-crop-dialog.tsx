'use client'

/**
 * @fileoverview Modal-Dialog: LLM-Crop-Vorschau (Stufe 3 Update 2 — UI).
 *
 * @description
 * Zeigt das exakte Bild, das der Pass-1-Lauf ans LLM senden wuerde —
 * geladen von `GET /api/diva-texture/basecolor-crop`, das denselben
 * `buildBasecolorCrop`-Helper wie die Pipeline nutzt (keine doppelte
 * Logik). Caption darunter zeigt die Crop-Masse + DPI-Fallback-Flag.
 *
 * Reine Praesentations-Komponente: bekommt `libraryId` + `fileId` und
 * laedt das Bild beim Oeffnen (open=true), verworfen beim Schliessen.
 */

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FileLogger } from '@/lib/debug/logger'

interface DivaBasecolorCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  fileId: string
}

interface CropImageState {
  url: string
  cropPx: string
  cropCm: string
  dpiUsed: string
  dpiFallback: boolean
  fullImage: boolean
}

export function DivaBasecolorCropDialog({
  open,
  onOpenChange,
  libraryId,
  fileId,
}: DivaBasecolorCropDialogProps) {
  const [state, setState] = React.useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: CropImageState }
  >({ kind: 'idle' })

  // Bild bei jedem Open frisch laden + beim Close die Object-URL freigeben.
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    let createdUrl: string | null = null
    setState({ kind: 'loading' })
    const url = `/api/diva-texture/basecolor-crop?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(fileId)}`
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`)
        }
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        createdUrl = objectUrl
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setState({
          kind: 'ready',
          data: {
            url: objectUrl,
            cropPx: res.headers.get('X-Crop-Px') ?? '?',
            cropCm: res.headers.get('X-Crop-Cm') ?? '?',
            dpiUsed: res.headers.get('X-Dpi-Used') ?? '?',
            dpiFallback: res.headers.get('X-Dpi-Fallback') === 'true',
            fullImage: res.headers.get('X-Full-Image') === 'true',
          },
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        FileLogger.error('DivaBasecolorCropDialog', 'Crop konnte nicht geladen werden', {
          libraryId,
          fileId,
          error: message,
        })
        setState({ kind: 'error', message })
      })
    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [open, libraryId, fileId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* aria-describedby=undefined: wir haben bewusst KEINE DialogDescription
          (der fruehere Text war ein Entwickler-Hinweis, kein User-Text) —
          das unterdrueckt die Radix-a11y-Warnung sauber. */}
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>An das LLM gesendeter Basecolor-Ausschnitt</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="flex min-h-[360px] w-full items-center justify-center rounded border bg-muted/30 p-4">
            {state.kind === 'loading' && (
              <span className="text-sm text-muted-foreground">Crop wird berechnet …</span>
            )}
            {state.kind === 'error' && (
              <span className="text-sm text-destructive">Fehler: {state.message}</span>
            )}
            {state.kind === 'ready' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.data.url}
                alt="Basecolor-Crop fuer LLM"
                className="max-h-[420px] max-w-full object-contain"
              />
            )}
          </div>

          {state.kind === 'ready' && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <Badge variant="secondary" className="font-mono">{state.data.cropPx} px</Badge>
              <Badge variant="secondary" className="font-mono">{state.data.cropCm} cm</Badge>
              <Badge variant="outline" className="font-mono">{state.data.dpiUsed} DPI</Badge>
              {state.data.dpiFallback && (
                <Badge variant="destructive">DPI-Fallback aktiv (300)</Badge>
              )}
              {state.data.fullImage && (
                <Badge variant="outline">
                  Voll-Bild (Original kleiner als Ziel-Crop)
                </Badge>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
