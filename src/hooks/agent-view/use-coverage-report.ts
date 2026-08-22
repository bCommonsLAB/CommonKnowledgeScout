'use client'

/**
 * @fileoverview Client-Hook fuer die Coverage-API der Agentensicht (Welle 2).
 *
 * @description
 * Laedt den juengsten Report (GET) und stoesst den expliziten Scan an (POST).
 * Die UI kennt AUSSCHLIESSLICH diese API — nie einen Provider, nie
 * `primaryStore`, nie ein Storage-Backend (`storage-abstraction.mdc`,
 * Akzeptanzkriterium 5).
 *
 * „Noch nie gescannt" (HTTP 404) ist ein eigener Zustand, kein Fehler und
 * kein leerer Ersatz-Report (`no-silent-fallbacks.mdc`).
 *
 * @module hooks/agent-view
 */

import { useCallback, useEffect, useState } from 'react'
import type { CoverageReport } from '@/lib/agent-view/types'
import type { CoverageDelta } from '@/lib/agent-view/coverage-delta'

export interface CoverageResponse {
  report: CoverageReport
  generatedAt: string
  gapsTruncated: boolean
  totalGaps: number
  /** D1: erledigt/neu seit dem letzten Scan; null = deltaHinweis sagt warum. */
  delta: CoverageDelta | null
  deltaHinweis: string | null
}

export interface UseCoverageReportResult {
  data: CoverageResponse | null
  /** true, solange der juengste Report geladen wird. */
  isLoading: boolean
  /** true, waehrend ein expliziter Scan laeuft. */
  isScanning: boolean
  /** true, wenn die Library noch nie gescannt wurde. */
  neverScanned: boolean
  error: string | null
  reload: () => Promise<void>
  scan: (folderId?: string) => Promise<void>
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (typeof body.error === 'string' && body.error.trim() !== '') return body.error
  } catch {
    // Antwort ohne JSON-Body: Status-Code ist die beste verfuegbare Aussage.
  }
  return `HTTP ${response.status}`
}

export function useCoverageReport(libraryId: string | undefined): UseCoverageReportResult {
  const [data, setData] = useState<CoverageResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [neverScanned, setNeverScanned] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!libraryId) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/library/${encodeURIComponent(libraryId)}/agent-view/coverage`)
      if (response.status === 404) {
        setData(null)
        setNeverScanned(true)
        return
      }
      if (!response.ok) throw new Error(await readError(response))
      setData((await response.json()) as CoverageResponse)
      setNeverScanned(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [libraryId])

  const scan = useCallback(
    async (folderId?: string) => {
      if (!libraryId) return
      setIsScanning(true)
      setError(null)
      try {
        const response = await fetch(`/api/library/${encodeURIComponent(libraryId)}/agent-view/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(folderId ? { scope: { folderId } } : {}),
        })
        if (!response.ok) throw new Error(await readError(response))
        setData((await response.json()) as CoverageResponse)
        setNeverScanned(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsScanning(false)
      }
    },
    [libraryId],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, isLoading, isScanning, neverScanned, error, reload, scan }
}
