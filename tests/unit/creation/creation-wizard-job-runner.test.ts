/**
 * Charakter-Tests des Job-Runners im Wizard-Kern
 * (`waitForJobCompletionWithProgress`, creation-wizard.tsx ~Z. 943-1047).
 *
 * Sicherheitsnetz (U0 / Sub-Welle 3-VI-a) VOR der Service-Extraktion
 * (Sub-Welle 3-VI-b: `services/job-runner.ts` + Cancel-Token). Pinnt die beiden
 * reinen Entscheidungs-/Parse-Kerne, die heute in der Promise-Closure stecken:
 *
 * - SSE-Event-Klassifikation (~Z. 1024-1045): Fremd-Events ignorieren, sonst
 *   Fortschritt melden und bei `completed`/`failed` auflösen/abbrechen.
 * - Poll-Fallback-Synthese (~Z. 975-1003): GET-Antwort → synthetisches
 *   `JobUpdateWire` inkl. `savedItemId` und `shadowTwinFolderId`.
 *
 * Die Funktionen unten spiegeln den Kern 1:1 (Stand 2026-06-14). Die
 * EventSource-/setInterval-/Timeout-Verdrahtung selbst ist hier bewusst NICHT
 * gespiegelt (reine Plumbing); sie wird mit der Extraktion direkt testbar. Bei
 * der Extraktion ist dieser Spiegel durch den echten Import zu ersetzen.
 *
 * @see docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md (Sub-Welle a, Commit 4)
 */

import { describe, expect, it } from 'vitest'

/** Spiegel des nicht-exportierten `JobUpdateWire` (creation-wizard.tsx ~Z. 933-941). */
interface JobUpdateWire {
  type: 'job_update'
  jobId: string
  status: string
  progress?: number
  message?: string
  result?: { savedItemId?: string }
  shadowTwinFolderId?: string | null
}

type WireOutcome = 'ignore' | 'pending' | 'resolve' | 'reject'

interface WireClassification {
  /** Wird `onProgress` aufgerufen? (im Kern für jedes valide Fremd-/Eigen-Event) */
  reportsProgress: boolean
  outcome: WireOutcome
}

function isJobUpdate(value: unknown): value is JobUpdateWire {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.type === 'job_update' && typeof v.jobId === 'string' && typeof v.status === 'string'
}

/** Spiegel der SSE-`job_update`-Logik (creation-wizard.tsx ~Z. 1024-1045). */
function classifyWireEvent(evt: unknown, jobId: string): WireClassification {
  // Kern: if (!evt || evt.type !== 'job_update' || evt.jobId !== jobId) return
  if (!isJobUpdate(evt) || evt.jobId !== jobId) {
    return { reportsProgress: false, outcome: 'ignore' }
  }
  // onProgress(evt) läuft für jedes valide Event – danach die Status-Weiche.
  if (evt.status === 'completed') return { reportsProgress: true, outcome: 'resolve' }
  if (evt.status === 'failed') return { reportsProgress: true, outcome: 'reject' }
  return { reportsProgress: true, outcome: 'pending' }
}

/** Spiegel der Poll-Fallback-Synthese (creation-wizard.tsx ~Z. 975-1003). */
function synthesizeWireFromPoll(args: { ok: boolean; json: Record<string, unknown>; jobId: string }): JobUpdateWire | null {
  const { ok, json, jobId } = args
  if (!ok) return null // Kern: if (!res.ok) return
  const status = typeof json.status === 'string' ? json.status : ''
  if (status !== 'completed' && status !== 'failed') return null // weiter pollen

  const resultUnknown = json.result
  const result =
    resultUnknown && typeof resultUnknown === 'object' && !Array.isArray(resultUnknown)
      ? (resultUnknown as { savedItemId?: unknown })
      : undefined
  const savedItemId = typeof result?.savedItemId === 'string' ? result.savedItemId : undefined

  const shadowTwinStateUnknown = json.shadowTwinState
  const shadowTwinFolderId =
    shadowTwinStateUnknown &&
    typeof shadowTwinStateUnknown === 'object' &&
    'shadowTwinFolderId' in (shadowTwinStateUnknown as Record<string, unknown>)
      ? (shadowTwinStateUnknown as Record<string, unknown>).shadowTwinFolderId
      : undefined
  const shadowTwinFolderIdStr = typeof shadowTwinFolderId === 'string' ? shadowTwinFolderId : null

  return {
    type: 'job_update',
    jobId,
    status,
    progress: status === 'completed' ? 100 : undefined,
    message: status === 'completed' ? 'completed (poll)' : 'failed (poll)',
    result: savedItemId ? { savedItemId } : undefined,
    shadowTwinFolderId: shadowTwinFolderIdStr,
  }
}

describe('classifyWireEvent — SSE-Entscheidung', () => {
  const jobId = 'job-1'

  it('ignoriert Events anderer Jobs ohne Fortschritt', () => {
    expect(classifyWireEvent({ type: 'job_update', jobId: 'other', status: 'running' }, jobId)).toEqual({
      reportsProgress: false,
      outcome: 'ignore',
    })
  })

  it('ignoriert Nicht-job_update / kaputte Events', () => {
    expect(classifyWireEvent({ type: 'noise', jobId, status: 'running' }, jobId).outcome).toBe('ignore')
    expect(classifyWireEvent(null, jobId).outcome).toBe('ignore')
    expect(classifyWireEvent({ type: 'job_update', jobId }, jobId).outcome).toBe('ignore')
  })

  it('laufendes Event meldet Fortschritt, löst aber nicht auf', () => {
    expect(classifyWireEvent({ type: 'job_update', jobId, status: 'running' }, jobId)).toEqual({
      reportsProgress: true,
      outcome: 'pending',
    })
  })

  it('completed löst auf, failed bricht ab', () => {
    expect(classifyWireEvent({ type: 'job_update', jobId, status: 'completed' }, jobId).outcome).toBe('resolve')
    expect(classifyWireEvent({ type: 'job_update', jobId, status: 'failed' }, jobId).outcome).toBe('reject')
  })
})

describe('synthesizeWireFromPoll — Poll-Fallback', () => {
  const jobId = 'job-1'

  it('nicht-ok Antwort → null (überspringen)', () => {
    expect(synthesizeWireFromPoll({ ok: false, json: { status: 'completed' }, jobId })).toBeNull()
  })

  it('nicht-terminaler Status → null (weiter pollen)', () => {
    expect(synthesizeWireFromPoll({ ok: true, json: { status: 'running' }, jobId })).toBeNull()
    expect(synthesizeWireFromPoll({ ok: true, json: {}, jobId })).toBeNull()
  })

  it('completed: progress 100, savedItemId + shadowTwinFolderId übernommen', () => {
    const wire = synthesizeWireFromPoll({
      ok: true,
      json: { status: 'completed', result: { savedItemId: 'file-9' }, shadowTwinState: { shadowTwinFolderId: 'st-7' } },
      jobId,
    })
    expect(wire).toEqual({
      type: 'job_update',
      jobId,
      status: 'completed',
      progress: 100,
      message: 'completed (poll)',
      result: { savedItemId: 'file-9' },
      shadowTwinFolderId: 'st-7',
    })
  })

  it('failed: kein progress, message failed (poll), fehlende Felder → undefined/null', () => {
    const wire = synthesizeWireFromPoll({ ok: true, json: { status: 'failed' }, jobId })
    expect(wire).toEqual({
      type: 'job_update',
      jobId,
      status: 'failed',
      progress: undefined,
      message: 'failed (poll)',
      result: undefined,
      shadowTwinFolderId: null,
    })
  })

  it('nicht-stringige savedItemId/shadowTwinFolderId werden verworfen', () => {
    const wire = synthesizeWireFromPoll({
      ok: true,
      json: { status: 'completed', result: { savedItemId: 42 }, shadowTwinState: { shadowTwinFolderId: 5 } },
      jobId,
    })
    expect(wire?.result).toBeUndefined()
    expect(wire?.shadowTwinFolderId).toBeNull()
  })

  it('result als Array wird ignoriert (kein savedItemId)', () => {
    const wire = synthesizeWireFromPoll({ ok: true, json: { status: 'completed', result: ['x'] }, jobId })
    expect(wire?.result).toBeUndefined()
  })
})
