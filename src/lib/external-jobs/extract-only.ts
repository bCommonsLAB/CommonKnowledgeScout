/**
 * @fileoverview External Jobs Extract-Only Mode - Extract-Only Processing
 * 
 * @description
 * Handles extract-only mode when template and ingest phases are disabled.
 * Saves Markdown with frontmatter and processes images, then completes the job.
 * This is a shortcut path that skips template transformation and RAG ingestion.
 * 
 * @module external-jobs
 * 
 * @exports
 * - runExtractOnly: Main function to run extract-only processing
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Route handler uses extract-only mode
 * 
 * @dependencies
 * - @/lib/external-jobs-repository: Job repository
 * - @/lib/external-jobs/storage: Markdown storage
 * - @/lib/external-jobs/images: Image processing
 * - @/lib/external-jobs/provider: Provider building
 * - @/lib/external-jobs-log-buffer: Log buffering
 * - @/lib/external-jobs-watchdog: Watchdog management
 * - @/lib/events/job-event-bus: Job event bus
 * - @/types/external-jobs: Context types
 */

import type { RequestContext } from '@/types/external-jobs'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { saveMarkdown } from './storage'
import { processAllImageSources } from './images'
import { buildProvider } from './provider'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { clearWatchdog } from '@/lib/external-jobs-watchdog'
import { getJobEventBus } from '@/lib/events/job-event-bus'

/**
 * Runs extract-only mode processing. This mode is activated when both template
 * and ingest phases are disabled. It saves the extracted Markdown with basic
 * frontmatter and processes images, then completes the job.
 * 
 * @param ctx - Request context
 * @param repo - Job repository instance
 * @param extractedText - Extracted text content
 * @param pagesArchiveData - Base64-encoded ZIP archive of PDF pages (optional, Legacy)
 * @param pagesArchiveUrl - URL to download pages archive (optional, new format)
 * @param imagesArchiveData - Base64-encoded ZIP archive of extracted images (optional)
 * @param imagesArchiveUrlFromWorker - URL to download images archive (optional)
 * @param mistralOcrRaw - Mistral OCR raw response (optional)
 * @param hasMistralOcrImages - Whether Mistral OCR images are present (in mistral_ocr_raw as Base64)
 * @param mistralOcrImagesUrl - URL to download Mistral OCR images ZIP archive (optional, separate from mistral_ocr_raw)
 * @param imagesPhaseEnabled - Whether images phase is enabled
 * @returns Object containing savedItemId and savedItems array
 */
export async function runExtractOnly(
  ctx: RequestContext,
  repo: ExternalJobsRepository,
  extractedText: string | undefined,
  pagesArchiveData: string | undefined,
  pagesArchiveUrl: string | undefined,
  imagesArchiveData: string | undefined,
  imagesArchiveUrlFromWorker: string | undefined,
  mistralOcrRaw: unknown,
  hasMistralOcrImages: boolean,
  mistralOcrImagesUrl: string | undefined,
  imagesPhaseEnabled: boolean
): Promise<{ savedItemId: string | undefined; savedItems: string[] }> {
  const { jobId, job, body } = ctx

  bufferLog(jobId, { phase: 'extract_only_mode', message: 'Extract-Only Modus aktiviert' })

  // Mark template and ingest steps as skipped
  try {
    await repo.updateStep(jobId, 'transform_template', {
      status: 'completed',
      endedAt: new Date(),
      details: { skipped: true, reason: 'phase_disabled' },
    })
  } catch {}
  try {
    await repo.updateStep(jobId, 'ingest_rag', {
      status: 'completed',
      endedAt: new Date(),
      details: { skipped: true, reason: 'phase_disabled' },
    })
  } catch {}

  // DETERMINISTISCHE ARCHITEKTUR: Verwende Shadow-Twin-State aus Job-Dokument
  // Der Kontext wurde beim Job-Start bestimmt und im Job-State gespeichert
  // Jeder Job hat seinen eigenen isolierten Kontext - keine gegenseitige Beeinflussung
  const shadowTwinFolderId: string | undefined = job.shadowTwinState?.shadowTwinFolderId

  // Save Markdown with frontmatter if extracted text is available
  // Jetzt kann es im Shadow-Twin-Verzeichnis gespeichert werden, falls vorhanden
  let savedItemId: string | undefined
  const savedItems: string[] = []

  if (extractedText) {
    try {
      const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      // Transcript-File OHNE Language-Suffix (Originalsprache)
      const { generateShadowTwinName } = await import('@/lib/storage/shadow-twin')
      const uniqueName = generateShadowTwinName(baseName, lang, true) // isTranscript = true
      const parentId = shadowTwinFolderId || (job.correlation?.source?.parentId || 'root')

      // Bei Extract-Only: Speichere Markdown OHNE Frontmatter (reines Transcript)
      // Frontmatter wird erst bei Template-Phase hinzugefügt
      // Die Job-Informationen sind bereits in der Job-Datenbank gespeichert
      const { stripAllFrontmatter } = await import('@/lib/markdown/frontmatter')
      const cleanText = stripAllFrontmatter(extractedText)
      const saved = await saveMarkdown({ ctx, parentId, fileName: uniqueName, markdown: cleanText })
      savedItemId = saved.savedItemId
      if (savedItemId) savedItems.push(savedItemId)
      
      bufferLog(jobId, {
        phase: 'extract_only_markdown_saved',
        message: `Markdown gespeichert${shadowTwinFolderId ? ' im Shadow-Twin-Verzeichnis' : ' direkt im Parent'}`,
        parentId,
        shadowTwinFolderId: shadowTwinFolderId || null,
      })
      
      // WICHTIG: Shadow-Twin-State nach dem Speichern neu berechnen
      // Dies stellt sicher, dass das Shadow-Twin-State im Job-Dokument aktualisiert wird
      if (savedItemId && job.correlation?.source?.itemId) {
        try {
          const provider = await buildProvider({
            userEmail: job.userEmail,
            libraryId: job.libraryId,
            jobId,
            repo,
          })
          const { analyzeShadowTwin } = await import('@/lib/shadow-twin/analyze-shadow-twin')
          const updatedShadowTwinState = await analyzeShadowTwin(job.correlation.source.itemId, provider)
          if (updatedShadowTwinState) {
            const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
            const mongoState = toMongoShadowTwinState(updatedShadowTwinState)
            await repo.setShadowTwinState(jobId, mongoState)
            bufferLog(jobId, {
              phase: 'extract_only_shadow_twin_state_updated',
              message: 'Shadow-Twin-State nach Markdown-Speicherung neu berechnet',
              shadowTwinFolderId: updatedShadowTwinState.shadowTwinFolderId || null,
            })
          }
        } catch (error) {
          bufferLog(jobId, {
            phase: 'extract_only_shadow_twin_state_update_error',
            message: `Fehler beim Neuberechnen des Shadow-Twin-States: ${error instanceof Error ? error.message : String(error)}`
          })
          // Fehler nicht kritisch - Client-seitige Analyse wird trotzdem ausgeführt
        }
      }
    } catch (error) {
      bufferLog(jobId, {
        phase: 'extract_only_markdown_save_failed',
        message: `Fehler beim Speichern des Markdowns: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }

  // Process images if enabled
  if (imagesPhaseEnabled) {
    try {
      const provider = await buildProvider({
        userEmail: job.userEmail,
        libraryId: job.libraryId,
        jobId,
        repo,
      })
      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const parentId = job.correlation?.source?.parentId || 'root'

      bufferLog(jobId, {
        phase: 'extract_only_images_start',
        message: 'Starte Bilder-Verarbeitung im Extract-Only Fall',
        hasPagesArchiveData: !!pagesArchiveData,
        hasPagesArchiveUrl: !!pagesArchiveUrl,
        hasImagesArchiveData: !!imagesArchiveData,
        hasImagesArchiveUrl: !!imagesArchiveUrlFromWorker,
        hasMistralOcrImages,
        hasMistralOcrImagesUrl: !!mistralOcrImagesUrl,
        mistralOcrRawType: typeof mistralOcrRaw,
        mistralOcrRawKeys: mistralOcrRaw && typeof mistralOcrRaw === 'object' ? Object.keys(mistralOcrRaw as Record<string, unknown>) : [],
      })

      const imageResult = await processAllImageSources(ctx, provider, {
        pagesArchiveData,
        pagesArchiveUrl,
        pagesArchiveFilename: (body?.data as { pages_archive_filename?: string })?.pages_archive_filename,
        imagesArchiveData,
        imagesArchiveFilename: (body?.data as { images_archive_filename?: string })?.images_archive_filename,
        imagesArchiveUrl: imagesArchiveUrlFromWorker,
        mistralOcrRaw,
        hasMistralOcrImages,
        mistralOcrImagesUrl,
        extractedText,
        lang,
        targetParentId: parentId,
        imagesPhaseEnabled,
        shadowTwinFolderId, // Übergebe bereits erstelltes Shadow-Twin-Verzeichnis
      })

      if (imageResult) {
        savedItems.push(...imageResult.savedItemIds)
        bufferLog(jobId, {
          phase: 'extract_only_images_completed',
          message: `Bilder-Verarbeitung abgeschlossen, ${imageResult.savedItemIds.length} Items gespeichert`
        })
      } else {
        bufferLog(jobId, {
          phase: 'extract_only_images_no_result',
          message: 'Keine Bilder verarbeitet - imageResult ist undefined'
        })
      }
    } catch (error) {
      bufferLog(jobId, {
        phase: 'extract_only_images_error',
        message: `Fehler bei der Bilder-Verarbeitung: ${error instanceof Error ? error.message : String(error)}`,
        errorStack: error instanceof Error ? error.stack : undefined,
      })
    }
  } else {
    bufferLog(jobId, {
      phase: 'extract_only_images_disabled',
      message: 'Bilder-Verarbeitung deaktiviert (imagesPhaseEnabled = false)'
    })
  }

  // Complete extract phase
  try {
    await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date() })
  } catch {}
  try {
    await repo.traceEndSpan(jobId, 'extract', 'completed', {})
  } catch {}

  // Set job status to completed
  await repo.setStatus(jobId, 'completed')
  clearWatchdog(jobId)
  await repo.setResult(
    jobId,
    {
      extracted_text: extractedText,
      images_archive_url: imagesArchiveUrlFromWorker || undefined,
      metadata: (body?.data as { metadata?: unknown })?.metadata as Record<string, unknown> | undefined,
    },
    {
      savedItemId,
      savedItems: savedItems.length > 0 ? savedItems : savedItemId ? [savedItemId] : [],
    }
  )
  await repo.appendLog(jobId, {
    phase: 'completed',
    message: 'Job abgeschlossen (extract only: phases disabled)',
  } as unknown as Record<string, unknown>)
  getJobEventBus().emitUpdate(job.userEmail, {
    type: 'job_update',
    jobId,
    status: 'completed',
    progress: 100,
    updatedAt: new Date().toISOString(),
    message: 'completed',
    jobType: job.job_type,
    fileName: job.correlation?.source?.name,
    sourceItemId: job.correlation?.source?.itemId,
  })

  return { savedItemId, savedItems }
}

