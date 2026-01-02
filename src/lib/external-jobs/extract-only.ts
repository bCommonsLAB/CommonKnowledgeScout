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
import { writeArtifact } from '@/lib/shadow-twin/artifact-writer'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { getShadowTwinMode } from '@/lib/shadow-twin/mode-helper'
import { LibraryService } from '@/lib/services/library-service'

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
  
  // Trace-Event für Extract-Only-Modus hinzufügen (für Validator)
  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'extract',
      name: 'extract_only_mode',
      attributes: {
        message: 'Extract-Only Modus aktiviert',
      },
    })
  } catch {
    // Trace-Fehler nicht kritisch
  }

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
      // WICHTIG: Provider MUSS vor writeArtifact erstellt werden!
      const provider = await buildProvider({
        userEmail: job.userEmail,
        libraryId: job.libraryId,
        jobId,
        repo,
      })
      
      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const sourceItemId = job.correlation.source?.itemId || 'unknown'
      const sourceName = job.correlation.source?.name || 'output'
      
      // WICHTIG: Wenn shadowTwinFolderId vorhanden ist, verwende es als parentId
      // Sonst verwende das Original-Parent-Verzeichnis
      const parentId = shadowTwinFolderId || (job.correlation?.source?.parentId || 'root')
      
      // Bestimme Library-Modus
      let mode: 'legacy' | 'v2' = 'legacy'
      try {
        const libraryService = LibraryService.getInstance()
        const library = await libraryService.getLibrary(job.userEmail, job.libraryId)
        if (library) {
          mode = getShadowTwinMode(library)
        }
      } catch {
        // Fallback zu legacy
      }
      
      // Erstelle ArtifactKey für Transcript
      const artifactKey: ArtifactKey = {
        sourceId: sourceItemId,
        kind: 'transcript',
        targetLanguage: lang,
      }
      
      // Bei Extract-Only: Speichere Markdown OHNE Frontmatter (reines Transcript)
      // Frontmatter wird erst bei Template-Phase hinzugefügt
      // Die Job-Informationen sind bereits in der Job-Datenbank gespeichert
      const { stripAllFrontmatter } = await import('@/lib/markdown/frontmatter')
      const cleanText = stripAllFrontmatter(extractedText)
      
      // WICHTIG: Wenn shadowTwinFolderId vorhanden ist, ist parentId bereits das Shadow-Twin-Verzeichnis.
      // In diesem Fall sollte createFolder false sein, da das Verzeichnis bereits existiert.
      // createFolder=true bedeutet: "Erstelle ein neues Shadow-Twin-Verzeichnis im parentId"
      // Wenn parentId bereits das Shadow-Twin-Verzeichnis ist, würde createFolder=true zu Verschachtelung führen.
      const createFolder = !shadowTwinFolderId
      
      // Nutze zentrale writeArtifact() Logik
      const writeResult = await writeArtifact(provider, {
        key: artifactKey,
        sourceName,
        parentId,
        content: cleanText,
        mode,
        createFolder,
      })
      
      savedItemId = writeResult.file.id
      if (savedItemId) savedItems.push(savedItemId)
      
      bufferLog(jobId, {
        phase: 'extract_only_markdown_saved',
        message: `Markdown gespeichert${shadowTwinFolderId ? ' im Shadow-Twin-Verzeichnis' : ' direkt im Parent'}`,
        parentId,
        shadowTwinFolderId: shadowTwinFolderId || null,
        savedItemId,
        fileName: writeResult.file.metadata.name,
      })
      
      // WICHTIG: Shadow-Twin-State nach dem Speichern neu berechnen
      // Dies stellt sicher, dass das Shadow-Twin-State im Job-Dokument aktualisiert wird
      // Verwende bereits erstellten Provider (wurde oben erstellt)
      if (savedItemId && job.correlation?.source?.itemId) {
        try {
          const { analyzeShadowTwin } = await import('@/lib/shadow-twin/analyze-shadow-twin')
          const updatedShadowTwinState = await analyzeShadowTwin(job.correlation.source.itemId, provider)
          if (updatedShadowTwinState) {
            // Im Extract-Only-Fall gilt: Sobald das Transcript erfolgreich im Shadow-Twin-Verzeichnis
            // gespeichert wurde, betrachten wir den Shadow-Twin als "ready". Template- und Ingest-Phasen
            // sind bewusst deaktiviert, daher gibt es keine weiteren serverseitigen Schritte mehr, die den
            // Shadow-Twin vervollständigen würden. Bild-Fehler sind nicht fatal und ändern den Jobstatus nicht.
            const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
            const mongoState = toMongoShadowTwinState({
              ...updatedShadowTwinState,
              processingStatus: 'ready' as const,
            })
            await repo.setShadowTwinState(jobId, mongoState)
            bufferLog(jobId, {
              phase: 'extract_only_shadow_twin_state_updated',
              message: 'Shadow-Twin-State nach Markdown-Speicherung neu berechnet (processingStatus=ready)',
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
  // Shadow-Twin-State nach Abschluss des Extract-Only-Laufs explizit auf "ready" setzen,
  // sofern bereits ein Shadow-Twin-State existiert. Damit ist für das UI klar erkennbar,
  // dass der Shadow-Twin für diese Datei vollständig vorliegt, auch ohne Template/Ingest.
  // WICHTIG: Dieser Fallback stellt sicher, dass der Status auch dann auf "ready" gesetzt wird,
  // wenn die vorherige Aktualisierung nach der Shadow-Twin-Reanalyse nicht gegriffen hat.
  try {
    const latest = await repo.get(jobId)
    const latestState = (latest as unknown as { shadowTwinState?: import('@/lib/shadow-twin/shared').ShadowTwinState | undefined }).shadowTwinState
    if (latestState) {
      // Immer auf "ready" setzen, auch wenn der Status bereits "ready" ist (idempotent)
      // Dies stellt sicher, dass auch Fälle wie TC-1.2 korrekt behandelt werden,
      // bei denen der Status möglicherweise noch "processing" ist
      const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
      const mongoState = toMongoShadowTwinState({
        ...latestState,
        processingStatus: 'ready' as const,
      })
      await repo.setShadowTwinState(jobId, mongoState)
      bufferLog(jobId, {
        phase: 'extract_only_final_status_update',
        message: 'Shadow-Twin-State final auf "ready" gesetzt (Fallback nach Job-Abschluss)',
      })
    }
  } catch {
    // Fehler bei der Status-Aktualisierung sind nicht kritisch für den Job-Abschluss
  }
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
    result: { savedItemId },
  })

  return { savedItemId, savedItems }
}

