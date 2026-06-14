'use client'

/**
 * Startet einen Pruef-/Reparatur-Lauf und konsumiert den SSE-Fortschritt (A2).
 *
 * Spiegelt das Client-Muster der Thumbnail-Reparatur (fetch → getReader →
 * TextDecoder → split('\n') → `data:`-Zeilen parsen). Die Zeilen-Logik liegt in
 * `parseVerificationSseLine` (geteilt + getestet).
 */

import { useCallback, useState } from 'react'
import { parseVerificationSseLine } from '@/lib/library-verification/sse-events'
import type {
  LibraryVerificationStatus,
  VerificationMode,
  VerificationSummary,
} from '@/lib/library-verification/types'

export interface VerificationRunState {
  isRunning: boolean
  mode: VerificationMode | null
  current: number
  total: number
  resultStatus: LibraryVerificationStatus | null
  resultSummary: VerificationSummary | null
  error: string | null
}

const INITIAL: VerificationRunState = {
  isRunning: false,
  mode: null,
  current: 0,
  total: 0,
  resultStatus: null,
  resultSummary: null,
  error: null,
}

export interface UseLibraryVerificationRunResult {
  state: VerificationRunState
  run: (mode: VerificationMode) => Promise<void>
}

export function useLibraryVerificationRun(
  libraryId: string | undefined
): UseLibraryVerificationRunResult {
  const [state, setState] = useState<VerificationRunState>(INITIAL)

  const run = useCallback(
    async (mode: VerificationMode) => {
      if (!libraryId) return
      setState({ ...INITIAL, isRunning: true, mode })
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/verify?mode=${mode}`,
          { method: 'POST' }
        )
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const event = parseVerificationSseLine(line)
            if (!event) continue
            if (event.type === 'progress') {
              setState((s) => ({ ...s, current: event.current, total: event.total }))
            } else if (event.type === 'end') {
              setState((s) => ({
                ...s,
                resultStatus: event.status ?? s.resultStatus,
                resultSummary: event.summary ?? s.resultSummary,
              }))
            } else {
              setState((s) => ({ ...s, error: event.error }))
            }
          }
        }
      } catch (e) {
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Lauf fehlgeschlagen' }))
      } finally {
        setState((s) => ({ ...s, isRunning: false }))
      }
    },
    [libraryId]
  )

  return { state, run }
}
