/**
 * U4.0 — Wizard-Erfassung → Inbox-`CaptureBody` (ADR-0004).
 *
 * Reine, seiteneffektfreie Mapping-Funktion: macht aus dem aufgelösten
 * Wizard-Ergebnis den Body, den der Client an `POST /api/submissions` schickt.
 * Die Identität (createdBy/Rolle) leitet der Server aus dem Auth-Kontext ab —
 * NICHT aus diesem Body (siehe `submission-capture.ts`).
 *
 * Dies ist die testbare Naht für U4.1 (handleSave/Publish auf „Submission
 * anlegen" umstellen statt Direkt-Schreiben). Validiert Pflichtfelder hart
 * (kein Silent-Fallback) — passend zu `parseCaptureBody` serverseitig.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @see src/lib/submissions/submission-capture.ts (Server-Gegenstück)
 */

import type { SubmissionBinaryRef, SubmissionTarget } from '@/types/wizard-submission'
import type { CaptureBody } from '@/lib/submissions/submission-capture'

/** Aufgelöste Wizard-Ergebnisdaten (vom Aufrufer zusammengestellt). */
export interface WizardCaptureInput {
  libraryId: string
  /** Gewählter Wizard/Flow (heute die Creation-Template-ID). */
  wizardId: string
  /** Schema-/Ergebnis-Typ (finaler docType nach Defaults). */
  docType: string
  /** Renderer-Typ (VIEW_TYPE_REGISTRY). */
  detailViewType: string
  /** Finaler Markdown-Körper. */
  markdownBody: string
  /** Finale Frontmatter-/Schema-Felder (flach). */
  metadata: Record<string, unknown>
  /** Ziel der späteren Publikation (Ordner/Slug). */
  target?: { folderId?: string; slug?: string }
  /** Inbox-Blob-Referenzen (Datei-Medien); leer bei reinem Text/URL. */
  binaryRefs?: SubmissionBinaryRef[]
  /** Analyse-Confidence je Feld (0..1). */
  confidence?: Record<string, number>
}

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`wizard-capture: ${field} fehlt`)
  }
  return value
}

/** Leere Ordner-/Slug-Angaben verwerfen; `undefined`, wenn nichts übrig bleibt. */
function normalizeTarget(target?: { folderId?: string; slug?: string }): SubmissionTarget | undefined {
  if (!target) return undefined
  const out: SubmissionTarget = {}
  if (typeof target.folderId === 'string' && target.folderId.trim().length > 0) out.folderId = target.folderId
  if (typeof target.slug === 'string' && target.slug.trim().length > 0) out.slug = target.slug
  return out.folderId || out.slug ? out : undefined
}

/**
 * Baut den `CaptureBody` für `POST /api/submissions`. Status/Identität setzt der
 * Server (Capture-Invariante: immer `pending`).
 */
export function buildWizardCaptureBody(input: WizardCaptureInput): CaptureBody {
  const body: CaptureBody = {
    libraryId: requireNonEmpty(input.libraryId, 'libraryId'),
    wizardId: requireNonEmpty(input.wizardId, 'wizardId'),
    docType: requireNonEmpty(input.docType, 'docType'),
    detailViewType: requireNonEmpty(input.detailViewType, 'detailViewType'),
    markdownBody: typeof input.markdownBody === 'string' ? input.markdownBody : '',
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  }
  const target = normalizeTarget(input.target)
  if (target) body.target = target
  if (input.binaryRefs && input.binaryRefs.length > 0) body.binaryRefs = input.binaryRefs
  if (input.confidence && Object.keys(input.confidence).length > 0) body.confidence = input.confidence
  return body
}
