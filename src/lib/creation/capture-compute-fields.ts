/**
 * U6a — Ableitung der Inbox-Capture-Felder aus dem Wizard-Kontext.
 *
 * Reine Funktion: macht aus Library/Wizard-Identität, dem aufgelösten
 * `detailViewType` und den Schema-Feldern die `FileMediaCaptureFields`, die
 * `computeFileMediaDraft` an die Off-target-Erfassung (`POST /api/submissions`)
 * reicht. Kein Storage-, kein UI-Bezug — testbare Naht für den Datei-Compute.
 *
 * `docType` kommt aus dem hart gesetzten Schema-Feld `docType` (z.B.
 * `file-transcript-de` → `transcript`). Fehlt es, gilt der `detailViewType` als
 * `docType` — derselbe explizite Default wie im bestehenden Publish-Pfad
 * (`creation-wizard.tsx`), kein stiller Fehler (beide sind valide Typ-IDs).
 *
 * @see src/lib/creation/wizard-file-compute.ts (FileMediaCaptureFields)
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import type { TemplateMetadataField } from '@/lib/templates/template-types'
import type { FileMediaCaptureFields } from '@/lib/creation/wizard-file-compute'

export interface BuildCaptureComputeFieldsArgs {
  libraryId: string
  /** Gewählter Wizard/Flow (heute die Creation-Template-ID). */
  wizardId: string
  /** Aufgelöster Renderer-Typ (VIEW_TYPE_REGISTRY). */
  detailViewType: string
  /** Schema-Felder des Templates (nur `key`/`rawValue` werden gelesen). */
  fields: readonly Pick<TemplateMetadataField, 'key' | 'rawValue'>[]
  /** Dateiname als Anzeigetitel-Default, bis die Analyse Felder liefert. */
  fileName: string
}

/** Baut die `FileMediaCaptureFields` für `computeFileMediaDraft`. */
export function buildCaptureComputeFields(args: BuildCaptureComputeFieldsArgs): FileMediaCaptureFields {
  const docTypeField = args.fields.find((f) => f.key === 'docType')
  const rawDocType = docTypeField?.rawValue
  const docType =
    typeof rawDocType === 'string' && rawDocType.trim().length > 0 ? rawDocType.trim() : args.detailViewType
  return {
    libraryId: args.libraryId,
    wizardId: args.wizardId,
    docType,
    detailViewType: args.detailViewType,
    title: args.fileName,
  }
}
