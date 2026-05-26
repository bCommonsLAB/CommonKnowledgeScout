'use client'

/**
 * @fileoverview Hook: laedt Liefersystem-Stammdaten zu einer Textur (Stufe 1).
 *
 * @description
 * Ruft GET /api/diva-texture/supplier-data?libraryId&fileId auf. Nur aktiv,
 * wenn das Library-Feature-Flag gesetzt ist (`enabled`). Steuert die
 * Sichtbarkeit des "DIVA-Info"-Tabs (Tab erscheint nur bei `matched`).
 */

import * as React from 'react'
import { FileLogger } from '@/lib/debug/logger'
import type { SupplierDataApiResponse } from '@/lib/diva-texture/types'

export interface DivaSupplierDataState {
  loading: boolean
  matched: boolean
  data: SupplierDataApiResponse | null
  error: string | null
}

const INITIAL: DivaSupplierDataState = {
  loading: false,
  matched: false,
  data: null,
  error: null,
}

export function useDivaSupplierData(args: {
  enabled: boolean
  libraryId: string
  fileId: string | null
}): DivaSupplierDataState {
  const { enabled, libraryId, fileId } = args
  const [state, setState] = React.useState<DivaSupplierDataState>(INITIAL)

  React.useEffect(() => {
    if (!enabled || !libraryId || !fileId) {
      setState(INITIAL)
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    const url = `/api/diva-texture/supplier-data?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(fileId)}`
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as SupplierDataApiResponse
      })
      .then((data) => {
        if (cancelled) return
        setState({ loading: false, matched: data.matched === true, data, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        // Kein stiller Fallback: Fehler wird geloggt UND im State gehalten.
        FileLogger.warn('useDivaSupplierData', 'Laden der Liefersystem-Daten fehlgeschlagen', {
          fileId,
          error: message,
        })
        setState({ loading: false, matched: false, data: null, error: message })
      })

    return () => {
      cancelled = true
    }
  }, [enabled, libraryId, fileId])

  return state
}
