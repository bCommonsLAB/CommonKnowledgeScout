'use client'

/**
 * Liest den aktuellen Verifikations-Status einer Library (Welle A2).
 *
 * Schlanker GET-Abruf auf `/api/library/[libraryId]/verify` (kein Lauf, nur der
 * juengste persistierte Status). Storage-agnostisch — die UI kennt nur die API.
 */

import { useCallback, useEffect, useState } from 'react'
import type {
  DocumentVerificationResult,
  LibraryVerificationStatus,
  VerificationSummary,
} from '@/lib/library-verification/types'

interface VerifyStatusResponse {
  status: LibraryVerificationStatus
  summary?: VerificationSummary
  /** Detail-Log des juengsten Laufs (beim Speichern gekappte Doc-Liste). */
  documents?: DocumentVerificationResult[]
  lastRun?: { createdAt?: string } | null
}

export interface UseLibraryVerificationStatusResult {
  status: LibraryVerificationStatus | null
  summary: VerificationSummary | null
  /** Problematische Dokumente des juengsten Laufs (fuer die Befund-Liste). */
  documents: DocumentVerificationResult[]
  lastRunAt: string | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useLibraryVerificationStatus(
  libraryId: string | undefined,
  enabled: boolean
): UseLibraryVerificationStatusResult {
  const [status, setStatus] = useState<LibraryVerificationStatus | null>(null)
  const [summary, setSummary] = useState<VerificationSummary | null>(null)
  const [documents, setDocuments] = useState<DocumentVerificationResult[]>([])
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!libraryId || !enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/verify`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as VerifyStatusResponse
      setStatus(data.status)
      setSummary(data.summary ?? null)
      setDocuments(Array.isArray(data.documents) ? data.documents : [])
      setLastRunAt(data.lastRun?.createdAt ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status-Abruf fehlgeschlagen')
    } finally {
      setIsLoading(false)
    }
  }, [libraryId, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { status, summary, documents, lastRunAt, isLoading, error, refresh }
}
