'use client'

/**
 * @fileoverview Hook: laedt Basecolor-Metadaten + Crop-Plan (Stufe 3 Update 2 — UI).
 *
 * @description
 * Ruft GET /api/diva-texture/basecolor-info?libraryId&fileId auf. Liefert
 * die technischen Bild-Metadaten der Original-Basecolor-Bitmap (Pixel,
 * DPI, cm) plus den geplanten Crop. Wird vom DIVA-Info-Tab gebraucht,
 * um Overlay-Caption + Modal-Vorschau mit den exakt selben Massen
 * anzuzeigen, die der Pass-1-Lauf verwendet.
 */

import * as React from 'react'
import { FileLogger } from '@/lib/debug/logger'
import type { BasecolorInfoResponse } from '@/app/api/diva-texture/basecolor-info/route'

export interface DivaBasecolorInfoState {
  data: BasecolorInfoResponse | null
  error: string | null
}

export function useDivaBasecolorInfo(args: {
  libraryId: string
  fileId: string | null
}): DivaBasecolorInfoState {
  const { libraryId, fileId } = args
  const [state, setState] = React.useState<DivaBasecolorInfoState>({ data: null, error: null })

  React.useEffect(() => {
    if (!libraryId || !fileId) {
      setState({ data: null, error: null })
      return
    }
    let cancelled = false
    const url = `/api/diva-texture/basecolor-info?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(fileId)}`
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as BasecolorInfoResponse
      })
      .then((data) => {
        if (!cancelled) setState({ data, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        FileLogger.warn('useDivaBasecolorInfo', 'Basecolor-Metadaten nicht ladbar', {
          fileId,
          error: message,
        })
        setState({ data: null, error: message })
      })
    return () => {
      cancelled = true
    }
  }, [libraryId, fileId])

  return state
}
