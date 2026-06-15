/**
 * Kanonischer Wizard-Laufzeit-State (Sub-Welle 3-VI-d / U1).
 *
 * Aus `creation-wizard.tsx` herausgelöst, damit Engine-Module (Step-Renderer,
 * Kontext) den State-Typ teilen können, ohne zirkulär auf den Monolithen zu
 * importieren. Reines Typ-Modul — Verhalten unverändert.
 *
 * (Die spätere Sub-Welle 3-VI-c ersetzt diesen veränderlichen State durch
 * Jotai-Atoms + Zod; bis dahin bleibt er 1:1.)
 */

import type { CreationSource, CreationSourceType } from "@/lib/templates/template-types"
import type { WizardSource } from "@/lib/creation/corpus"

export interface WizardState {
  currentStepIndex: number
  mode?: 'interview' | 'form' // Eingabemodus (wird im Briefing-Step gewählt)
  selectedSource?: CreationSource
  // Multi-Source: Liste aller Quellen
  sources: WizardSource[]
  // Legacy: collectedInput (wird schrittweise durch sources ersetzt)
  collectedInput?: {
    type: CreationSourceType
    content: string
  }
  generatedDraft?: {
    metadata: Record<string, unknown>
    markdown: string
  }
  reviewedFields?: Record<string, unknown>
  // Form-Modus: direkte Bearbeitung
  draftMetadata?: Record<string, unknown>
  draftText?: string
  // Loading-State für Re-Extract
  isExtracting?: boolean
  /**
   * U6: Nach dem Upload gewählter Inhaltstyp (selectSchemaType-Step). Bestimmt
   * das Analyse-Standard-Template (standard-<viewType>) + den detailViewType der
   * Submission. Bleibt undefined, bis der Nutzer wählt (kein stiller Default).
   */
  selectedDetailViewType?: string
  /**
   * U6: ID der beim Off-target-Compute angelegten Inbox-Submission
   * (computeFileMediaDraft). Beim Publish wird DIESE Submission aktualisiert
   * (PATCH) statt einer zweiten angelegt — EIN Submission-Commit (ADR-0004).
   */
  submissionId?: string
  // PDF HITL: Progress-Anzeige für Jobs (Extract/Template/Ingest)
  processingProgress?: number
  processingMessage?: string
  // PDF HITL: finaler Publish-Schritt (User sieht Publizieren explizit)
  isPublishing?: boolean
  publishingProgress?: number
  publishingMessage?: string
  publishError?: string
  isPublished?: boolean
  /** Optional: Kurze Abschluss-Statistiken (für Publish-Step) */
  publishStats?: { documents: number; images: number; sources: number }
  /** Optional: Zielordner für "Im Explorer öffnen" */
  publishTargetFolderId?: string
  /** Optional: Ziel-Slug für "Im Explorer öffnen" (Gallery) */
  publishTargetSlug?: string
  // PDF HITL: Tracking
  pdfBaseFileId?: string
  pdfTranscriptFileId?: string
  /** Parent-Folder der Transcript-Datei (wichtig für MarkdownPreview: relative Images auflösen) */
  pdfTranscriptFolderId?: string
  pdfTransformFileId?: string
  hasConfirmedMarkdown?: boolean
  // Human-in-the-loop: Quellen-Bestätigung
  hasConfirmedSources?: boolean
  extractionError?: string
  // Bild-Upload: ausgewählte Dateien pro Bildfeld-Key
  imageFiles?: Record<string, File | null>
  // Bild-URLs: einzeln (string) oder Array (string[]) pro Bildfeld-Key
  imageUrls?: Record<string, string | string[]>
  // Upload-State: welche Bilder gerade hochgeladen werden
  isUploadingImages?: Record<string, boolean>
}
