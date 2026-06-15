/**
 * U5c — Off-target Compute fuer Datei-Medien (ADR-0004, U5 Entscheidung 2Y).
 *
 * Duenner, getesteter Client-Service: laedt eine Datei-Quelle in die Inbox-
 * Quarantaene (`POST /api/submissions` multipart -> binaryRef, NIE ins Archiv),
 * startet die external-jobs-Analyse (`providerScope='inbox'`, U5b-Fabrik) und
 * wartet den Flowback in die Submission ab. Liefert die angelegte Submission-ID
 * + den berechneten Entwurf (Metadaten + Markdown) — der Wizard rendert daraus
 * Preview/Edit, ohne je den Ziel-Provider zu beruehren.
 *
 * Reine Orchestrierung ueber `fetch` + ein injiziertes `waitForJob` (der Wizard
 * reicht seinen bestehenden Job-Runner herein; Tests stubben ihn). Wirft bei
 * jedem HTTP-/Flowback-Fehler mit Server-Meldung (kein Silent-Fallback).
 *
 * @see src/lib/submissions/submission-analysis-job.ts (U5b Job-Fabrik)
 * @see src/lib/creation/wizard-submit.ts (Submit/Approve/Promote)
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import type { WizardComputeMode } from '@/lib/creation/compute-mode'

/** Schema-/Ziel-Felder, die die Submission bei der Erfassung traegt. */
export interface FileMediaCaptureFields {
  libraryId: string
  /** Gewaehlter Wizard/Flow (heute die Creation-Template-ID). */
  wizardId: string
  /** Schema-/Ergebnis-Typ. */
  docType: string
  /** Renderer-Typ (VIEW_TYPE_REGISTRY). */
  detailViewType: string
  /** Anzeigetitel-Default bis die Analyse Felder liefert (Default: Dateiname). */
  title?: string
}

/** Berechneter Entwurf einer Datei-Quelle (aus der Submission nach Flowback). */
export interface FileMediaComputeResult {
  submissionId: string
  draft: { metadata: Record<string, unknown>; markdown: string }
}

/** Wartet auf Job-Abschluss; vom Wizard injiziert (bestehender Job-Runner). */
export type WaitForJob = (jobId: string) => Promise<unknown>

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function readError(json: unknown, status: number): string {
  if (json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string') {
    return (json as { error: string }).error
  }
  return `HTTP ${status}`
}

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`wizard-file-compute: ${field} fehlt`)
  }
  return value
}

/**
 * Bestaetigt, dass dieser Service fuer den Compute-Modus zustaendig ist. Reiner
 * Text/URL (`text-sync`) gehoert NICHT hierher (synchron ueber process-text) —
 * wirft, statt eine Datei-Pipeline fuer Text zu starten (no-silent-fallbacks).
 */
export function assertInboxJobMode(mode: WizardComputeMode): void {
  if (mode !== 'inbox-job') {
    throw new Error(`wizard-file-compute: nur fuer Modus 'inbox-job' (erhalten: '${mode}')`)
  }
}

/**
 * Laedt die Datei in die Inbox-Quarantaene und legt eine `pending`-Submission an.
 * Liefert die Submission-ID. Wirft bei HTTP-Fehler mit Server-Meldung.
 */
export async function uploadFileMediaToInbox(
  file: File,
  fields: FileMediaCaptureFields,
  fetchImpl: FetchImpl,
): Promise<string> {
  const form = new FormData()
  form.set('file', file)
  form.set('libraryId', requireNonEmpty(fields.libraryId, 'libraryId'))
  form.set('wizardId', requireNonEmpty(fields.wizardId, 'wizardId'))
  form.set('docType', requireNonEmpty(fields.docType, 'docType'))
  form.set('detailViewType', requireNonEmpty(fields.detailViewType, 'detailViewType'))
  form.set('markdownBody', '')
  form.set('metadata', JSON.stringify({ title: fields.title ?? file.name }))

  const res = await fetchImpl('/api/submissions', { method: 'POST', body: form })
  const json: unknown = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(readError(json, res.status))

  const submission = json && typeof json === 'object' ? (json as { submission?: { id?: unknown } }).submission : undefined
  const id = submission && typeof submission.id === 'string' ? submission.id : ''
  if (!id) throw new Error('Submission angelegt, aber id fehlt in der Antwort')
  return id
}

/** Startet die Inbox-Analyse (U5b) und liefert die Job-ID. */
export async function startSubmissionAnalysis(
  submissionId: string,
  fetchImpl: FetchImpl,
): Promise<string> {
  const res = await fetchImpl(`/api/submissions/${encodeURIComponent(submissionId)}/analyze`, {
    method: 'POST',
  })
  const json: unknown = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(readError(json, res.status))

  const jobId = json && typeof json === 'object' && typeof (json as { jobId?: unknown }).jobId === 'string'
    ? (json as { jobId: string }).jobId
    : ''
  if (!jobId) throw new Error('Analyse gestartet, aber jobId fehlt in der Antwort')
  return jobId
}

/**
 * Liest die Submission nach Flowback und projiziert sie auf den Entwurf
 * (markdownBody -> markdown). Wirft, wenn die Analyse weder Felder noch Body
 * geliefert hat (leeres Ergebnis ist ein Fehler, kein stiller Default).
 */
export async function fetchSubmissionDraft(
  submissionId: string,
  fetchImpl: FetchImpl,
): Promise<FileMediaComputeResult> {
  const res = await fetchImpl(`/api/submissions/${encodeURIComponent(submissionId)}`)
  const json: unknown = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(readError(json, res.status))

  const submission = json && typeof json === 'object' ? (json as { submission?: unknown }).submission : undefined
  if (!submission || typeof submission !== 'object') {
    throw new Error('Submission-Detail fehlt in der Antwort')
  }
  const s = submission as { metadata?: unknown; markdownBody?: unknown }
  const metadata = s.metadata && typeof s.metadata === 'object' ? (s.metadata as Record<string, unknown>) : {}
  const markdown = typeof s.markdownBody === 'string' ? s.markdownBody : ''
  if (Object.keys(metadata).length === 0 && markdown.trim().length === 0) {
    throw new Error('Analyse-Ergebnis ist leer (weder Metadaten noch Markdown).')
  }
  return { submissionId, draft: { metadata, markdown } }
}

/** Eingaben fuer die Datei-Medien-Berechnung. */
export interface ComputeFileMediaDraftArgs {
  file: File
  fields: FileMediaCaptureFields
  /** Wartet auf den Analyse-Job (Wizard reicht seinen Job-Runner herein). */
  waitForJob: WaitForJob
  /** Injizierbar fuer Tests; Default: globales fetch. */
  fetchImpl?: FetchImpl
}

/**
 * Orchestriert den Off-target-Compute einer Datei-Quelle:
 * Upload -> Inbox-Submission -> Analyse-Job -> Flowback -> Entwurf.
 */
export async function computeFileMediaDraft(
  args: ComputeFileMediaDraftArgs,
): Promise<FileMediaComputeResult> {
  const doFetch: FetchImpl = args.fetchImpl ?? ((input, init) => fetch(input, init))
  const submissionId = await uploadFileMediaToInbox(args.file, args.fields, doFetch)
  const jobId = await startSubmissionAnalysis(submissionId, doFetch)
  await args.waitForJob(jobId)
  return fetchSubmissionDraft(submissionId, doFetch)
}
