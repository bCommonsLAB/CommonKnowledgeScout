/**
 * SSE-Ereignisse der Verifikations-Route (Welle A2) — Typen + reiner Parser.
 *
 * Die `POST /api/library/[libraryId]/verify`-Route sendet `data: {json}`-Zeilen.
 * Dieser Parser uebersetzt EINE Zeile in ein typisiertes Ereignis und wird vom
 * Client-Hook UND vom Test geteilt. Unbekannte/nicht-`data:`-Zeilen liefern
 * `null` (kein stilles Raten eines Typs).
 */

import type { LibraryVerificationStatus, VerificationSummary } from './types'

export interface VerifyProgressEvent {
  type: 'progress'
  phase: 'start' | 'document' | 'done'
  current: number
  total: number
  fileId?: string
  issueCount?: number
  repaired?: boolean
}

export interface VerifyEndEvent {
  type: 'end'
  success: boolean
  status?: LibraryVerificationStatus
  summary?: VerificationSummary
}

export interface VerifyErrorEvent {
  type: 'error'
  error: string
}

export type VerificationSseEvent = VerifyProgressEvent | VerifyEndEvent | VerifyErrorEvent

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Parst eine einzelne SSE-Zeile. Liefert `null`, wenn die Zeile kein
 * `data:`-Ereignis mit bekanntem `type` ist.
 */
export function parseVerificationSseLine(line: string): VerificationSseEvent | null {
  const trimmed = line.trimStart()
  if (!trimmed.startsWith('data:')) return null

  const payload = trimmed.slice('data:'.length).trim()
  if (payload === '') return null

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null

  switch (parsed.type) {
    case 'progress':
      return {
        type: 'progress',
        phase: parsed.phase as VerifyProgressEvent['phase'],
        current: typeof parsed.current === 'number' ? parsed.current : 0,
        total: typeof parsed.total === 'number' ? parsed.total : 0,
        fileId: typeof parsed.fileId === 'string' ? parsed.fileId : undefined,
        issueCount: typeof parsed.issueCount === 'number' ? parsed.issueCount : undefined,
        repaired: typeof parsed.repaired === 'boolean' ? parsed.repaired : undefined,
      }
    case 'end':
      return {
        type: 'end',
        success: parsed.success === true,
        status: parsed.status as LibraryVerificationStatus | undefined,
        summary: parsed.summary as VerificationSummary | undefined,
      }
    case 'error':
      return {
        type: 'error',
        error: typeof parsed.error === 'string' ? parsed.error : 'Unbekannter Fehler',
      }
    default:
      // Unbekannter Ereignistyp → kein stiller Default, sondern „ignorieren".
      return null
  }
}
