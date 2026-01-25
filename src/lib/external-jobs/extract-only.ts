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
import { buildProvider } from './provider'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { clearWatchdog } from '@/lib/external-jobs-watchdog'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { writeArtifact } from '@/lib/shadow-twin/artifact-writer'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { persistShadowTwinToMongo } from '@/lib/shadow-twin/shadow-twin-mongo-writer'
import { FileLogger } from '@/lib/debug/logger'
import { getSecretaryConfig } from '@/lib/env'
import { buildMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'

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

  // Prüfe Shadow-Twin-Konfiguration (Mongo oder Filesystem) - einmalig für den gesamten Extract-Only-Lauf
  const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
  const shadowTwinConfig = getShadowTwinConfig(library)
  // WICHTIG: persistShadowTwinToMongo verwendet bereits intern den ShadowTwinService,
  // daher ist die Store-Entscheidung dort zentralisiert.
  // Hier prüfen wir nur die Konfiguration für Logging und Entscheidungen.
  const persistToFilesystem = shadowTwinConfig.persistToFilesystem ?? true
  // useMongo wird nur für Logging verwendet - die eigentliche Persistierung entscheidet der Service
  const useMongo = shadowTwinConfig.primaryStore === 'mongo'

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
      
      // Speichere ins Filesystem, wenn aktiviert
      let writeResult: Awaited<ReturnType<typeof writeArtifact>> | null = null
      if (persistToFilesystem) {
        // Nutze zentrale writeArtifact() Logik
        writeResult = await writeArtifact(provider, {
          key: artifactKey,
          sourceName,
          parentId,
          content: cleanText,
          createFolder,
        })
        
        savedItemId = writeResult.file.id
        if (savedItemId) savedItems.push(savedItemId)
      }
      
      bufferLog(jobId, {
        phase: 'extract_only_markdown_saved',
        message: `Markdown gespeichert${shadowTwinFolderId ? ' im Shadow-Twin-Verzeichnis' : ' direkt im Parent'}`,
        parentId,
        shadowTwinFolderId: shadowTwinFolderId || null,
        savedItemId,
        fileName: writeResult?.file.metadata.name || 'unknown',
      })
      
      // WICHTIG: Shadow-Twin-State nach dem Speichern neu berechnen
      // Dies stellt sicher, dass das Shadow-Twin-State im Job-Dokument aktualisiert wird
      // Verwende bereits erstellten Provider (wurde oben erstellt)
      if (savedItemId && job.correlation?.source?.itemId) {
        try {
          const { analyzeShadowTwinWithService } = await import('@/lib/shadow-twin/analyze-shadow-twin')
          const { LibraryService } = await import('@/lib/services/library-service')
          const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
          const lang = (job.correlation?.options as { targetLanguage?: string } | undefined)?.targetLanguage || 'de'
          const updatedShadowTwinState = await analyzeShadowTwinWithService(job.correlation.source.itemId, provider, job.userEmail, library, lang)
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
  // WICHTIG: Wenn persistToFilesystem=false, überspringe Filesystem-Schreibvorgänge
  // und lade Bilder direkt aus dem ZIP nach Azure hoch (ohne Filesystem-Zwischenschritt)
  if (imagesPhaseEnabled) {
    if (persistToFilesystem) {
      // Standard-Pfad: Bilder ins Filesystem schreiben
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
          message: 'Starte Bilder-Verarbeitung im Extract-Only Fall (mit Filesystem)',
          hasPagesArchiveData: !!pagesArchiveData,
          hasPagesArchiveUrl: !!pagesArchiveUrl,
          hasImagesArchiveData: !!imagesArchiveData,
          hasImagesArchiveUrl: !!imagesArchiveUrlFromWorker,
          hasMistralOcrImages,
          hasMistralOcrImagesUrl: !!mistralOcrImagesUrl,
          mistralOcrRawType: typeof mistralOcrRaw,
          mistralOcrRawKeys: mistralOcrRaw && typeof mistralOcrRaw === 'object' ? Object.keys(mistralOcrRaw as Record<string, unknown>) : [],
        })

        const { processAllImageSources } = await import('./images')
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
      // Optimierter Pfad: Bilder direkt aus ZIP nach Azure hochladen (ohne Filesystem)
      // ZIP-Daten werden unten gesammelt und an persistShadowTwinToMongo() übergeben
      bufferLog(jobId, {
        phase: 'extract_only_images_direct_azure',
        message: 'Bilder werden direkt aus ZIP nach Azure hochgeladen (ohne Filesystem-Zwischenschritt)',
        hasPagesArchiveData: !!pagesArchiveData,
        hasPagesArchiveUrl: !!pagesArchiveUrl,
        hasImagesArchiveData: !!imagesArchiveData,
        hasImagesArchiveUrl: !!imagesArchiveUrlFromWorker,
        hasMistralOcrImages,
        hasMistralOcrImagesUrl: !!mistralOcrImagesUrl,
      })
    }
  } else {
    bufferLog(jobId, {
      phase: 'extract_only_images_disabled',
      message: 'Bilder-Verarbeitung deaktiviert (imagesPhaseEnabled = false)'
    })
  }

  // WICHTIG: Speichere Shadow-Twin in MongoDB NACH der Bilder-Verarbeitung
  // (damit alle Bilder bereits im Shadow-Twin-Ordner vorhanden sind)
  bufferLog(jobId, {
    phase: 'extract_only_mongo_check',
    message: 'Prüfe Bedingungen für MongoDB-Upsert',
    hasExtractedText: !!extractedText,
    useMongo,
    hasSourceItemId: !!job.correlation?.source?.itemId,
    primaryStore: shadowTwinConfig.primaryStore,
    persistToFilesystem,
  })
  
  // Schreibe auch in Trace für bessere Sichtbarkeit
  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'extract',
      name: 'extract_only_mongo_check',
      attributes: {
        hasExtractedText: !!extractedText,
        useMongo,
        hasSourceItemId: !!job.correlation?.source?.itemId,
        primaryStore: shadowTwinConfig.primaryStore,
        persistToFilesystem,
      },
    })
  } catch {
    // Trace-Fehler nicht kritisch
  }
  
  if (extractedText && useMongo && job.correlation?.source?.itemId) {
    try {
      bufferLog(jobId, {
        phase: 'extract_only_mongo_start',
        message: 'Starte MongoDB-Upsert für Shadow-Twin',
        sourceItemId: job.correlation.source.itemId,
      })
      
      const provider = await buildProvider({
        userEmail: job.userEmail,
        libraryId: job.libraryId,
        jobId,
        repo,
      })
      
      bufferLog(jobId, {
        phase: 'extract_only_mongo_provider_ready',
        message: 'Provider erstellt, lade sourceItem',
        sourceItemId: job.correlation.source.itemId,
      })
      
      const sourceItem = await provider.getItemById(job.correlation.source.itemId)
      
      if (!sourceItem) {
        throw new Error(`SourceItem nicht gefunden: ${job.correlation.source.itemId}`)
      }
      
      bufferLog(jobId, {
        phase: 'extract_only_mongo_source_item_loaded',
        message: 'SourceItem geladen',
        sourceItemId: sourceItem.id,
        sourceItemName: sourceItem.metadata.name,
      })
      
      // Lade aktuelles Markdown aus dem Filesystem (falls vorhanden)
      // oder verwende das ursprüngliche extractedText
      let markdownToSave = extractedText
      if (savedItemId && persistToFilesystem) {
        try {
          const { blob } = await provider.getBinary(savedItemId)
          markdownToSave = await blob.text()
        } catch {
          // Falls Laden fehlschlägt, verwende originales extractedText
        }
      }
      
      const { stripAllFrontmatter } = await import('@/lib/markdown/frontmatter')
      const cleanText = stripAllFrontmatter(markdownToSave)
      
      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const artifactKey: ArtifactKey = {
        sourceId: job.correlation.source.itemId,
        kind: 'transcript',
        targetLanguage: lang,
      }
      
      // Aktualisiere shadowTwinFolderId nach Bilder-Verarbeitung
      const currentShadowTwinFolderId = job.shadowTwinState?.shadowTwinFolderId || shadowTwinFolderId
      
      // Sammle ZIP-Daten für direkten Upload (wenn persistToFilesystem=false)
      const zipArchives: Array<{ base64Data: string; fileName: string }> = []
      if (!persistToFilesystem && imagesPhaseEnabled) {
        // Hilfsfunktion: Lade ZIP von URL herunter und konvertiere zu Base64
        const downloadZipAsBase64 = async (url: string): Promise<string | undefined> => {
          try {
            // URL-Auflösung: ähnlich wie in images.ts
            const { baseUrl: baseRaw } = getSecretaryConfig()
            const isAbsolute = /^https?:\/\//i.test(url)
            let archiveUrl = url
            if (!isAbsolute) {
              const base = baseRaw.replace(/\/$/, '')
              const rel = url.startsWith('/') ? url : `/${url}`
              archiveUrl = base.endsWith('/api') && rel.startsWith('/api/') 
                ? `${base}${rel.substring(4)}` 
                : `${base}${rel}`
            }
            
            // Headers für Authentifizierung (falls benötigt)
            const headers: Record<string, string> = {}
            const { apiKey } = getSecretaryConfig()
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`
              headers['X-Secretary-Api-Key'] = apiKey
            }
            
            bufferLog(jobId, {
              phase: 'extract_only_downloading_zip',
              message: `Lade ZIP von URL: ${archiveUrl}`,
            })
            
            const response = await fetch(archiveUrl, { method: 'GET', headers })
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            return buffer.toString('base64')
          } catch (error) {
            FileLogger.warn('extract-only', 'Fehler beim Herunterladen von ZIP-URL', {
              url,
              error: error instanceof Error ? error.message : String(error),
            })
            bufferLog(jobId, {
              phase: 'extract_only_zip_download_error',
              message: `Fehler beim Herunterladen von ZIP: ${error instanceof Error ? error.message : String(error)}`,
              url,
            })
            return undefined
          }
        }
        
        // Sammle ZIP-Daten: zuerst Base64-Daten, dann URLs herunterladen
        if (imagesArchiveData) {
          zipArchives.push({
            base64Data: imagesArchiveData,
            fileName: (body?.data as { images_archive_filename?: string })?.images_archive_filename || 'images.zip',
          })
        }
        if (pagesArchiveData) {
          zipArchives.push({
            base64Data: pagesArchiveData,
            fileName: (body?.data as { pages_archive_filename?: string })?.pages_archive_filename || 'pages.zip',
          })
        }
        
        // Lade ZIP-Daten von URLs herunter (falls nicht als Base64 vorhanden)
        if (pagesArchiveUrl && !pagesArchiveData) {
          const base64Data = await downloadZipAsBase64(pagesArchiveUrl)
          if (base64Data) {
            zipArchives.push({
              base64Data,
              fileName: (body?.data as { pages_archive_filename?: string })?.pages_archive_filename || 'pages.zip',
            })
          }
        }
        
        if (imagesArchiveUrlFromWorker && !imagesArchiveData) {
          const base64Data = await downloadZipAsBase64(imagesArchiveUrlFromWorker)
          if (base64Data) {
            zipArchives.push({
              base64Data,
              fileName: (body?.data as { images_archive_filename?: string })?.images_archive_filename || 'images.zip',
            })
          }
        }
        
        // Mistral OCR Images: Lade von URL herunter (falls vorhanden)
        if (mistralOcrImagesUrl) {
          const base64Data = await downloadZipAsBase64(mistralOcrImagesUrl)
          if (base64Data) {
            zipArchives.push({
              base64Data,
              fileName: 'mistral_ocr_images.zip',
            })
          }
        }
        
        bufferLog(jobId, {
          phase: 'extract_only_zip_archives_collected',
          message: `${zipArchives.length} ZIP-Archive für direkten Upload gesammelt`,
          zipCount: zipArchives.length,
          zipFileNames: zipArchives.map(z => z.fileName),
        })
      }
      
      const mongoResult = await persistShadowTwinToMongo({
        libraryId: job.libraryId,
        userEmail: job.userEmail,
        sourceItem,
        provider,
        artifactKey,
        markdown: cleanText,
        shadowTwinFolderId: currentShadowTwinFolderId || undefined,
        zipArchives: zipArchives.length > 0 ? zipArchives : undefined,
        jobId,
      })

      // WICHTIG (Global Contract):
      // In Mongo-only Mode (persistToFilesystem=false) gibt es keine Provider-File-ID.
      // Wir müssen daher eine virtuelle Mongo-Shadow-Twin-ID als savedItemId setzen,
      // sonst ist der Job zwar "completed", aber result.savedItemId fehlt (Race/Contract-Bruch).
      if (!persistToFilesystem && !savedItemId) {
        savedItemId = buildMongoShadowTwinId({
          libraryId: job.libraryId,
          sourceId: job.correlation.source.itemId,
          kind: 'transcript',
          targetLanguage: lang,
        })
      }
      
      bufferLog(jobId, {
        phase: 'extract_only_mongo_saved',
        message: `Shadow-Twin in MongoDB gespeichert (${mongoResult.imageCount} Bilder verarbeitet)`,
        imageCount: mongoResult.imageCount,
        imageErrorsCount: mongoResult.imageErrorsCount,
      })
      
      // Schreibe auch in Trace für bessere Sichtbarkeit
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'extract',
          name: 'extract_only_mongo_saved',
          attributes: {
            imageCount: mongoResult.imageCount,
            imageErrorsCount: mongoResult.imageErrorsCount,
          },
        })
      } catch {
        // Trace-Fehler nicht kritisch
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      
      bufferLog(jobId, {
        phase: 'extract_only_mongo_error',
        message: `Mongo-Upsert fehlgeschlagen: ${errorMessage}`,
        error: errorMessage,
        errorStack,
      })
      
      // Schreibe auch in Trace für bessere Sichtbarkeit
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'extract',
          name: 'extract_only_mongo_error',
          level: 'error',
          attributes: {
            message: `Mongo-Upsert fehlgeschlagen: ${errorMessage}`,
            error: errorMessage,
          },
        })
      } catch {
        // Trace-Fehler nicht kritisch
      }
      
      FileLogger.error('extract-only', 'MongoDB-Upsert fehlgeschlagen', {
        jobId,
        sourceItemId: job.correlation?.source?.itemId,
        error: errorMessage,
        errorStack,
      })

      // WICHTIG:
      // - Wenn persistToFilesystem=true, können wir den Job trotzdem abschließen (Fallback ist Filesystem).
      // - Wenn persistToFilesystem=false (Mongo-only), ist ein Mongo-Fehler fatal, weil es sonst keinen savedItemId gibt.
      if (!persistToFilesystem) {
        throw error instanceof Error ? error : new Error(String(error))
      }
    }
  } else {
    // MongoDB-Upsert wurde übersprungen - logge Grund
    const reasons: string[] = []
    if (!extractedText) reasons.push('kein extractedText')
    if (!useMongo) reasons.push(`useMongo=false (primaryStore=${shadowTwinConfig.primaryStore})`)
    if (!job.correlation?.source?.itemId) reasons.push('kein sourceItemId')
    
    bufferLog(jobId, {
      phase: 'extract_only_mongo_skipped',
      message: `MongoDB-Upsert übersprungen: ${reasons.join(', ')}`,
      reasons,
      primaryStore: shadowTwinConfig.primaryStore,
    })
    
    // Schreibe auch in Trace für bessere Sichtbarkeit
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'extract',
        name: 'extract_only_mongo_skipped',
        attributes: {
          message: `MongoDB-Upsert übersprungen: ${reasons.join(', ')}`,
          reasons,
          primaryStore: shadowTwinConfig.primaryStore,
        },
      })
    } catch {
      // Trace-Fehler nicht kritisch
    }
  }

  // Complete extract phase
  try {
    const extractStepName =
      job.job_type === 'audio'
        ? 'extract_audio'
        : job.job_type === 'video'
          ? 'extract_video'
          : 'extract_pdf'
    await repo.updateStep(jobId, extractStepName, { status: 'completed', endedAt: new Date() })
  } catch {}
  try {
    await repo.traceEndSpan(jobId, 'extract', 'completed', {})
  } catch {}

  // WICHTIG (Global Contract):
  // In Integration-Tests (und auch im UI) wird der Job per Polling beobachtet. Wenn wir
  // `status=completed` setzen, bevor `result.savedItemId` gespeichert wurde, entsteht ein
  // Race-Condition-Fenster: Polling sieht "completed" → liest ein leeres result → Contract verletzt.
  // Deshalb: erst Result/Payload persistieren, dann Status auf completed setzen.
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

  // Set job status to completed (nachdem result gespeichert wurde)
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

