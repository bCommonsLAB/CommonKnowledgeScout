/**
 * @fileoverview Dokument-Jobs (PDF/Office) programmatisch einreihen (A1).
 *
 * @description
 * Pilot-Wunschliste A1: PDF/Office ueber die MCP-Bruecke erschliessen.
 * Dieselbe Job-Form wie `/api/pipeline/process` — upload-frei: der Worker
 * laedt das Binary selbst ueber `itemId` aus dem Storage (der frueher
 * dokumentierte „andere Upload-Contract" gilt nur fuer den Browser-Upload).
 * Eigene Datei neben `enqueue-secretary-job.ts` (200-Zeilen-Regel).
 *
 * @module external-jobs
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { mediaKindToJobType } from '@/lib/media-types'
import type { ExternalJob } from '@/types/external-job'
import { transformParameter, type TransformOptionen } from './transform-optionen'
import type { SourceRef } from './enqueue-secretary-job'

/** Ueber die Bruecke erschliessbare Dokument-Arten (Rest: siehe media-types). */
export type DocumentMediaKind = 'pdf' | 'docx' | 'xlsx' | 'pptx'

const DOCUMENT_MIME: Record<DocumentMediaKind, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

/**
 * Welche Seitenbilder die PDF-Extraktion ablegt (Befund 26.11.2026: 17 Seiten reiner Text
 * kosteten knapp 12 MB Bilder ohne Nutzen):
 * - `alle` (Vorgabe, wie bisher): Vorschau (~360 px) und HighRes (200 DPI) je Seite.
 * - `vorschau`: nur die kleinen Vorschaubilder — reichen fuer Cover und Folien-Erkennung.
 * - `keine`: keine Seitenbilder — fuer reine Text-PDFs; Cover aus den Quellen gibt es dann nicht.
 * Bilder, die die Texterkennung IM Dokument findet, bleiben davon unberuehrt.
 */
export const SEITENBILDER = ['alle', 'vorschau', 'keine'] as const
export type Seitenbilder = (typeof SEITENBILDER)[number]

/** Die beiden Schalter der Secretary-Anfrage zu einer Wahl; ein unbekannter Wert wirft. */
export function seitenbildParameter(wahl: Seitenbilder): { includePreviewPages: boolean; includeHighResPages: boolean } {
  if (wahl === 'alle') return { includePreviewPages: true, includeHighResPages: true }
  if (wahl === 'vorschau') return { includePreviewPages: true, includeHighResPages: false }
  if (wahl === 'keine') return { includePreviewPages: false, includeHighResPages: false }
  throw new Error(`seitenbilder "${String(wahl)}" ist unbekannt — erlaubt: ${SEITENBILDER.join(', ')}`)
}

/** Dokument-Art aus dem Dateinamen; null = kein Bruecken-Dokument. */
export function documentMediaKindFromName(fileName: string): DocumentMediaKind | null {
  const match = fileName.toLowerCase().match(/\.(pdf|docx|xlsx|pptx)$/)
  return match ? (match[1] as DocumentMediaKind) : null
}

/**
 * Reiht einen Erschliessungs-Job fuer EIN Dokument ein (Form der
 * Pipeline-Route: Steps + parameters/policies identisch); der Worker
 * uebernimmt und laedt das Binary aus dem Storage.
 */
export async function enqueueSourceDocumentJob(args: {
  libraryId: string
  userEmail: string
  source: SourceRef
  mediaKind: DocumentMediaKind
  template?: string
  /** LLM-Modell fuer die Template-Transformation (siehe parameters unten). */
  llmModel?: string
  targetLanguage?: string
  /** Welle ST11: Extract-Gate uebergehen — siehe `buildSourceTranscribeJob`. */
  erzwingen?: boolean
  /** Welle B: Lauf-Optionen der Transformation (P6), nur mit Template sinnvoll. */
  optionen?: TransformOptionen
  /** Welle I: Ingest nur auf ausdruecklichen Wunsch — siehe `buildSourceTranscribeJob`. */
  ingest: boolean
  /** Nur PDF: welche Seitenbilder die Extraktion ablegt; weggelassen = `alle`. */
  seitenbilder?: Seitenbilder
}): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  const jobSecretHash = repo.hashSecret(jobSecret)
  const template = args.template?.trim() || undefined
  if (args.ingest && !template) {
    throw new Error(`ingest: true ohne Vorlage — "${args.source.name}" wuerde nur extrahiert, es gaebe nichts zu ingestieren`)
  }
  const llmModel = args.llmModel?.trim() || undefined
  const targetLanguage = args.targetLanguage ?? 'de'
  const jobType = mediaKindToJobType(args.mediaKind)
  const isOffice = args.mediaKind !== 'pdf'
  if (isOffice && args.seitenbilder !== undefined) {
    throw new Error(`seitenbilder gilt nur fuer PDF — "${args.source.name}" ist ${args.mediaKind}`)
  }
  const seitenbildFlags = seitenbildParameter(args.seitenbilder ?? 'alle')

  const job: Omit<ExternalJob, 'createdAt' | 'updatedAt'> & { steps: NonNullable<ExternalJob['steps']> } = {
    jobId,
    jobSecretHash,
    job_type: jobType,
    operation: 'extract',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId,
      libraryId: args.libraryId,
      source: {
        mediaType: args.mediaKind,
        mimeType: args.source.mimeType ?? DOCUMENT_MIME[args.mediaKind],
        name: args.source.name,
        itemId: args.source.itemId,
        parentId: args.source.parentId,
      },
      options: {
        targetLanguage,
        // Die Start-Route und die Secretary-Anfrage lesen die Bild-Schalter HIER, nicht aus
        // `parameters` — dort stehen sie nur zur Ansicht (job_status).
        ...(isOffice
          ? { useCache: true, includeImages: true, includePreviews: true }
          : seitenbildFlags),
      },
    },
    steps: [
      { name: isOffice ? 'extract_office' : 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ],
    parameters: {
      targetLanguage,
      ...(template ? { template } : {}),
      ...transformParameter(args.optionen),
      // Welle ST8 (Live-Befund 28.08.2026): Ohne dieses Feld faellt der
      // Secretary auf SEINEN Default zurueck — und der stand tagelang auf
      // `deepseek/deepseek-v4-flash-latest`, einer Modell-Id, die es bei
      // OpenRouter nicht gibt. Jede Transformation ueber die Bruecke starb
      // nach ~100 ms mit HTTP 400, waehrend derselbe Weg aus der Werkbank
      // lief: die gibt ein Modell mit. Ein stiller Rueckfall auf fremde
      // Konfiguration ist genau das, was `no-silent-fallbacks` verbietet.
      ...(llmModel ? { llmModel } : {}),
      phases: { extract: true, template: Boolean(template), ingest: Boolean(template) && args.ingest },
      policies: {
        extract: args.erzwingen === true ? 'force' : 'do',
        metadata: template ? 'do' : 'ignore',
        ingest: template && args.ingest ? 'do' : 'ignore',
      },
      ...(args.mediaKind === 'pdf'
        ? {
            extractionMethod: 'mistral_ocr',
            includeOcrImages: true,
            ...seitenbildFlags,
            useCache: true,
          }
        : { useCache: true }),
    },
  }

  await repo.create(job)
  return { jobId }
}
