/**
 * U4.1 — Client-Service: Wizard-Ergebnis in den Wartekorb legen (ADR-0004).
 *
 * Dünner, getesteter Wrapper um `POST /api/submissions`. Der Server prüft Rechte,
 * leitet Identität ab und legt die Submission `pending` an (Capture-Invariante).
 * Wirft bei HTTP-Fehler mit Server-Meldung (kein Silent-Fallback).
 *
 * @see src/lib/creation/wizard-capture.ts (Body-Mapping, U4.0)
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import type { CaptureBody } from '@/lib/submissions/submission-capture'
import type { UpdateSubmissionMetadataInput } from '@/types/wizard-submission'

export interface WizardSubmitResult {
  /** ID der angelegten (pending) Submission. */
  id: string
}

function readError(json: unknown, status: number): string {
  if (json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string') {
    return (json as { error: string }).error
  }
  return `HTTP ${status}`
}

/** Legt aus dem CaptureBody eine `pending`-Submission an und liefert ihre ID. */
export async function submitWizardCapture(body: CaptureBody): Promise<WizardSubmitResult> {
  const res = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json: unknown = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(readError(json, res.status))

  const submission = (json && typeof json === 'object') ? (json as { submission?: { id?: unknown } }).submission : undefined
  const id = submission && typeof submission.id === 'string' ? submission.id : ''
  if (!id) throw new Error('Submission angelegt, aber id fehlt in der Antwort')
  return { id }
}

/**
 * Aktualisiert eine bestehende (editierbare) Submission redaktionell
 * (Markdown/Metadaten/Ziel) ueber `PATCH /api/submissions/[id]`. Genutzt vom
 * Datei-Flow: die beim Compute angelegte Submission (computeFileMediaDraft) wird
 * beim Publish mit dem editierten Entwurf aktualisiert — EIN Submission-Commit
 * statt einer zweiten Submission (ADR-0004). Wirft bei HTTP-Fehler mit
 * Server-Meldung (kein Silent-Fallback).
 */
export async function updateSubmission(id: string, input: UpdateSubmissionMetadataInput): Promise<void> {
  const res = await fetch(`/api/submissions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json: unknown = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(readError(json, res.status))
}

async function postSubmissionAction(id: string, action: 'approve' | 'promote'): Promise<unknown> {
  const res = await fetch(`/api/submissions/${encodeURIComponent(id)}/${action}`, { method: 'POST' })
  const json: unknown = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(readError(json, res.status))
  return json
}

/** Freigabe: `pending → ready` (Reviewer-Recht). */
export async function approveSubmission(id: string): Promise<void> {
  await postSubmissionAction(id, 'approve')
}

/**
 * Owner-Sofort-Publikation: `ready → published` (schreibt Ziel-Provider + RAG).
 * Liefert die geschriebene Datei-ID, falls vorhanden.
 */
export async function promoteSubmission(id: string): Promise<{ savedItemId?: string }> {
  const json = await postSubmissionAction(id, 'promote')
  const savedItemId =
    json && typeof json === 'object' && typeof (json as { savedItemId?: unknown }).savedItemId === 'string'
      ? (json as { savedItemId: string }).savedItemId
      : undefined
  return { savedItemId }
}
