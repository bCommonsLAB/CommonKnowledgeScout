'use client'

/**
 * @fileoverview Hook: laedt das LLM-Basecolor-Crop-Bild (Stufe 3 Update 2 — UI).
 *
 * @description
 * Ruft GET /api/diva-texture/basecolor-crop?libraryId&fileId auf und gibt
 * eine Object-URL plus die Crop-Metadaten (cropPx, cropCm, dpiUsed,
 * dpiFallback, fullImage) zurueck. Wird vom DIVA-Info-Tab gebraucht, um
 * den LLM-Crop inline 1:1 anzuzeigen — gleiche Logik wie der Pipeline-Lauf.
 *
 * Die Object-URL wird beim Unmount + beim Neuladen sauber via
 * `URL.revokeObjectURL` freigegeben.
 */

import * as React from 'react'
import { FileLogger } from '@/lib/debug/logger'

export interface DivaBasecolorCropData {
  /** Object-URL fuer ein <img>-src; muss vom Hook selbst revoked werden. */
  url: string
  /** Pixel-Maesse des Crops, z.B. "472x472". */
  cropPx: string
  /** Realgroesse des Crops in cm, z.B. "4.0x4.0". */
  cropCm: string
  /** Verwendete DPI (Original-DPI oder Fallback). */
  dpiUsed: string
  /** True, wenn DPI-Fallback auf 300 greifen musste. */
  dpiFallback: boolean
  /** True, wenn Source kleiner als 4 cm war und das Voll-Bild gesendet wird. */
  fullImage: boolean
}

export type DivaBasecolorCropState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: DivaBasecolorCropData }

export function useDivaBasecolorCrop(args: {
  libraryId: string
  fileId: string | null
  /** Wenn false, wird kein Fetch ausgeloest (z.B. solange Crop-Tab nicht offen). */
  enabled?: boolean
}): DivaBasecolorCropState {
  const { libraryId, fileId, enabled = true } = args
  const [state, setState] = React.useState<DivaBasecolorCropState>({ kind: 'idle' })

  React.useEffect(() => {
    if (!enabled || !libraryId || !fileId) {
      setState({ kind: 'idle' })
      return
    }
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
        FileLogger.error('useDivaBasecolorCrop', 'Crop konnte nicht geladen werden', {
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
  }, [enabled, libraryId, fileId])

  return state
}
