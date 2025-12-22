import { randomUUID } from 'crypto'
import { FileLogger } from '@/lib/debug/logger'
import { splitByPages } from '@/lib/ingestion/page-split'
import { embedDocumentWithSecretary } from '@/lib/chat/rag-embeddings'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getTopLevelValue, validateAndSanitizeFrontmatter } from '@/lib/chat/dynamic-facets'
import { upsertVectors, upsertVectorMeta, deleteVectorsByFileId, ensureFacetIndexes } from '@/lib/repositories/vector-repo'
import { getRetrieverContext } from '@/lib/chat/retriever-context'
import type { DocMeta, ChapterMetaEntry } from '@/types/doc-meta'
import type { StorageProvider } from '@/lib/storage/types'
import { ImageProcessor } from '@/lib/ingestion/image-processor'
import { buildMetadataPrefix } from '@/lib/ingestion/metadata-formatter'
import { extractFacetValues, buildVectorDocuments } from '@/lib/ingestion/vector-builder'
import { buildMetaDocument } from '@/lib/ingestion/meta-document-builder'
import { hashId } from '@/lib/utils/string-utils'
import { AzureStorageService } from '@/lib/services/azure-storage-service'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'
import * as fs from 'fs/promises'

/**
 * Stub-Service zum Enqueue einer Ingestion.
 * Hier später: Markdown scannen → Summaries erzeugen → Embeddings upserten.
 */
export class IngestionService {
  static async enqueueLibraryIngestion(userEmail: string, libraryId: string): Promise<{ jobId: string }> {
    const jobId = randomUUID()
    // eslint-disable-next-line no-console
    console.log('[Ingestion] Enqueued library ingestion', { userEmail, libraryId, jobId })
    // TODO: Job in DB persistieren / Worker triggern
    return { jobId }
  }

  /**
   * Minimaler Ingestion-Lauf: erzeugt für einen Testtext ein Embedding und upsertet ihn in MongoDB.
   * Dient als End-to-End-Validierung der Pipeline.
   * Verwendet jetzt Secretary Service RAG API für Embeddings.
   */
  static async runMinimalTest(userEmail: string, libraryId: string): Promise<{ index: string; id: string }> {
    const retrieverCtx = await getRetrieverContext(userEmail, libraryId)
    const { ctx, libraryKey, dimension } = retrieverCtx

    const text = `Testchunk for ${ctx.library.label} at ${new Date().toISOString()}`
    const { embedQuestionWithSecretary } = await import('@/lib/chat/rag-embeddings')
    const embedding = await embedQuestionWithSecretary(text, ctx)
    const id = `test-${randomUUID()}`
    
      await upsertVectors(libraryKey, [{
      _id: id,
      kind: 'chunk',
      libraryId,
      user: userEmail,
      fileId: 'test',
      fileName: 'test.txt',
      chunkIndex: 0,
      text,
      embedding,
      upsertedAt: new Date().toISOString(),
    }], dimension, retrieverCtx.ctx.library)
    
    return { index: libraryKey, id }
  }

  // Bild-Verarbeitungs-Funktionen wurden nach ImageProcessor ausgelagert
  // Siehe: src/lib/ingestion/image-processor.ts

  static async upsertMarkdown(
    userEmail: string,
    libraryId: string,
    fileId: string,
    fileName: string,
    markdown: string,
    meta?: Record<string, unknown>,
    jobId?: string,
    provider?: StorageProvider,
    shadowTwinFolderId?: string,
  ): Promise<{ chunksUpserted: number; docUpserted: boolean; index: string; imageErrors?: Array<{ slideIndex: number; imageUrl: string; error: string }> }> {
    const repo = new ExternalJobsRepository()
    const retrieverCtx = await getRetrieverContext(userEmail, libraryId)
    const { ctx, libraryKey, facetDefs } = retrieverCtx

    // Frontmatter strikt parsen: Meta als Single Source, Body zum Chunken
    const { meta: metaFromMarkdown, body } = await (async () => {
      try {
        const fm = await import('@/lib/markdown/frontmatter')
        const parsed = typeof fm.parseFrontmatter === 'function' ? fm.parseFrontmatter(markdown) : { meta: meta || {}, body: markdown }
        return parsed
      } catch {
        return { meta: meta || {}, body: markdown }
      }
    })()
    const metaEffective: Record<string, unknown> = { ...(metaFromMarkdown || {}), ...(meta || {}) }
    // Facetten-validierung und Parsing: fehlende Felder warnen, Typen parse/prüfen
    try {
      validateAndSanitizeFrontmatter(metaEffective, facetDefs, jobId)
    } catch {}
    let spans = splitByPages(body)
    if (!Array.isArray(spans) || spans.length === 0) {
      // Fallback: Gesamten Body als eine Seite behandeln
      spans = [{ page: 1, startIdx: 0, endIdx: body.length }]
    }
    // Bevorzugt deklarierte Seitenzahl aus Meta (Frontmatter)
    const declaredPagesRaw = metaEffective && typeof metaEffective === 'object' ? (metaEffective as { pages?: unknown }).pages : undefined
    const declaredPages = typeof declaredPagesRaw === 'number' && declaredPagesRaw > 0 ? declaredPagesRaw : undefined
    const totalPages = declaredPages || spans.length
    FileLogger.info('ingestion', 'Start kapitelgeführte Ingestion', { libraryId, fileId, pages: totalPages })
    if (jobId) bufferLog(jobId, { phase: 'ingest_start', message: `Ingestion start (pages=${totalPages})` })
    // Kapitel aus Meta lesen
    const chaptersRaw = metaEffective && typeof metaEffective === 'object' ? (metaEffective as { chapters?: unknown }).chapters : undefined
    const chaptersInput = Array.isArray(chaptersRaw) ? chaptersRaw as Array<Record<string, unknown>> : []

    // Idempotenz: Alte Vektoren dieses Dokuments löschen
    await deleteVectorsByFileId(libraryKey, fileId)
    FileLogger.info('ingestion', 'Vorherige Vektoren gelöscht', { fileId })
    if (jobId) bufferLog(jobId, { phase: 'indextidy', message: 'Alte Vektoren entfernt' })

    // Slide-Bilder auf Azure Storage hochladen (vor docMetaJsonObj Erstellung)
    // imageErrors muss außerhalb des try-Blocks initialisiert werden, damit es immer im Scope ist
    let imageErrors: Array<{ slideIndex: number; imageUrl: string; error: string }> | undefined = undefined

    // Hilfsfunktionen sind jetzt in src/lib/utils/string-utils.ts

    // Vorab-Checks aus Frontmatter (Warnungen, aber kein Abbruch)
    try {
      const summaryRaw = meta && typeof meta === 'object' ? (meta as { summary?: unknown }).summary : undefined
      if (!(typeof summaryRaw === 'string' && summaryRaw.trim().length > 0)) {
        FileLogger.warn('ingestion', 'Frontmatter summary fehlt oder leer', { fileId })
        if (jobId) bufferLog(jobId, { phase: 'frontmatter_missing', message: 'summary fehlt' })
      }
      // Prüfe ob Session-Modus (Slides vorhanden) → dann keine Warnung für fehlende Chapters
      const slidesRaw = metaEffective && typeof metaEffective === 'object' ? (metaEffective as { slides?: unknown }).slides : undefined
      const isSessionMode = Array.isArray(slidesRaw) && (slidesRaw as Array<unknown>).length > 0
      if (!Array.isArray(chaptersInput) || chaptersInput.length === 0) {
        if (!isSessionMode) {
          // Nur warnen wenn KEIN Session-Modus (keine Slides vorhanden)
          FileLogger.warn('ingestion', 'Frontmatter chapters fehlen oder leer', { fileId })
          if (jobId) bufferLog(jobId, { phase: 'frontmatter_missing', message: 'chapters fehlen' })
        } else {
          // Session-Modus: Chapters sind normalerweise leer → kein Warnung
          FileLogger.info('ingestion', 'Session-Modus erkannt (keine Chapters erwartet)', { fileId })
        }
      }
    } catch {}

    // Kapitel-Infos für MongoDB sammeln (ohne Chunking)
    const chaptersForMongo: ChapterMetaEntry[] = []
    for (const ch of chaptersInput) {
      const title = typeof (ch as { title?: unknown }).title === 'string' ? (ch as { title: string }).title : 'Kapitel'
      const order = typeof (ch as { order?: unknown }).order === 'number' ? (ch as { order: number }).order : undefined
      const summary = typeof (ch as { summary?: unknown }).summary === 'string' ? (ch as { summary: string }).summary : ''
      const chapterId = hashId(`${fileId}|${order ?? 0}|${title}`)
      
      chaptersForMongo.push({
        index: typeof order === 'number' ? order : chaptersForMongo.length,
        id: chapterId,
        title,
        summary: summary || undefined,
        chunkCount: 0, // Wird später aus RAG-Response aktualisiert
      })
    }
    // Doc‑Meta finalisieren: counts + ingest_status + upsertedAt (ein finales Upsert)
    try {
      const chaptersCount = chaptersInput.length
      
      // Slide-Bilder auf Azure Storage hochladen (vor docMetaJsonObj Erstellung)
      // imageErrors wurde bereits außerhalb des try-Blocks initialisiert
      if (provider) {
        const slidesRaw = metaEffective && typeof metaEffective === 'object' ? (metaEffective as { slides?: unknown }).slides : undefined
        const slidesInput = Array.isArray(slidesRaw) ? slidesRaw as Array<Record<string, unknown>> : []
        
        if (slidesInput.length > 0) {
          FileLogger.info('ingestion', 'Verarbeite Slide-Bilder für Azure Upload', { fileId, slidesCount: slidesInput.length })
          if (jobId) {
            bufferLog(jobId, { phase: 'slide_images_processing', message: `Verarbeite ${slidesInput.length} Slide-Bilder für Azure Upload` })
          }
          
          try {
            const result = await ImageProcessor.processSlideImages(
              slidesInput,
              provider,
              libraryId,
              fileId,
              jobId
            )
            
            // Aktualisiere Slides in metaEffective
            metaEffective.slides = result.slides
            
            // WICHTIG: Aktualisiere auch __jsonClean und __sanitized, damit die Azure-URLs in docMetaJsonObj übernommen werden
            if ((metaEffective as Record<string, unknown>)['__jsonClean']) {
              ((metaEffective as Record<string, unknown>)['__jsonClean'] as Record<string, unknown>).slides = result.slides
            }
            if ((metaEffective as Record<string, unknown>)['__sanitized']) {
              ((metaEffective as Record<string, unknown>)['__sanitized'] as Record<string, unknown>).slides = result.slides
            }
            
            // Wenn Fehler aufgetreten sind, diese sammeln
            imageErrors = result.errors.length > 0 ? result.errors : undefined
            
            FileLogger.info('ingestion', 'Slide-Bilder verarbeitet', {
              fileId,
              processed: result.slides.length,
              errors: result.errors.length,
            })
            if (jobId) {
              bufferLog(jobId, {
                phase: 'slide_images_processed',
                message: `${result.slides.length} Slide-Bilder verarbeitet${result.errors.length > 0 ? `, ${result.errors.length} Fehler` : ''}`,
              })
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            FileLogger.error('ingestion', 'Fehler beim Verarbeiten der Slide-Bilder', {
              fileId,
              error: errorMessage,
            })
            
            // Wenn Container-Fehler: Fehler weiterwerfen, damit er im Frontend angezeigt wird
            if (errorMessage.includes('Container') && errorMessage.includes('existiert nicht')) {
              if (jobId) {
                bufferLog(jobId, {
                  phase: 'slide_images_container_error',
                  message: errorMessage,
                })
              }
              throw error // Fehler weiterwerfen für Frontend-Anzeige
            }
            
            // Andere Fehler: Original-Slides beibehalten, weitermachen
            FileLogger.warn('ingestion', 'Bild-Upload fehlgeschlagen, verwende Original-Pfade', { fileId })
          }
        }
      }
      
      // Mongo-Dokument vorbereiten (vollständige Metadaten)
      // WICHTIG: Verwende metaEffective als Basis (enthält ALLE Frontmatter-Felder),
      // nicht nur __jsonClean (enthält nur Facetten-Felder).
      // Merge __jsonClean für Facetten-Validierung, aber behalte alle anderen Felder aus metaEffective.
      const jsonClean = ((metaEffective as Record<string, unknown>)['__jsonClean'] as Record<string, unknown>) || {}
      // Basis: metaEffective mit allen Frontmatter-Feldern
      // Merge: Facetten-validierte Werte aus __jsonClean haben Priorität
      const docMetaJsonObj = { ...metaEffective, ...jsonClean } as Record<string, unknown>
      // Entferne interne Felder
      delete (docMetaJsonObj as Record<string, unknown>)['__jsonClean']
      delete (docMetaJsonObj as Record<string, unknown>)['__sanitized']
      
      // Verarbeite Markdown-Bilder und Cover-Bild für Bücher (nur wenn kein Session-Modus)
      // WICHTIG: Verwende shadowTwinFolderId aus Parameter (kommt von job.shadowTwinState)
      // Dies ist die zentrale Logik, die auch Template-Phase verwendet
      let coverImageUrl: string | null = null
      const isSessionMode = chaptersInput.length === 0 && Array.isArray((metaEffective as { slides?: unknown }).slides) && ((metaEffective as { slides?: unknown }).slides as Array<unknown>).length > 0
      
      if (provider && !isSessionMode && body && typeof body === 'string' && body.trim().length > 0) {
        try {
          // shadowTwinFolderId kommt bereits aus job.shadowTwinState (zentrale Logik)
          if (shadowTwinFolderId) {
            FileLogger.info('ingestion', 'Verwende Shadow-Twin-Verzeichnis aus Job-State für Bild-Verarbeitung', {
              fileId,
              shadowTwinFolderId,
            })
          } else {
            FileLogger.warn('ingestion', 'Kein Shadow-Twin-Verzeichnis im Job-State verfügbar', {
              fileId,
            })
          }
          
          // Verarbeite Cover-Bild
          coverImageUrl = await ImageProcessor.processCoverImage(
            provider,
            shadowTwinFolderId,
            libraryId,
            fileId,
            jobId,
            isSessionMode
          )
          if (coverImageUrl) {
            docMetaJsonObj.coverImageUrl = coverImageUrl
            FileLogger.info('ingestion', 'Cover-Bild verarbeitet', { fileId, coverImageUrl, isSessionMode })
            if (jobId) {
              bufferLog(jobId, {
                phase: 'cover_image_processed',
                message: `Cover-Bild erfolgreich verarbeitet: ${coverImageUrl}`,
              })
            }
          }
          
          // Verarbeite Markdown-Bilder
          const markdownResult = await ImageProcessor.processMarkdownImages(
            body,
            provider,
            libraryId,
            fileId,
            shadowTwinFolderId,
            jobId,
            isSessionMode
          )
          
          // Verwende aktualisiertes Markdown (mit Azure-URLs)
          docMetaJsonObj.markdown = markdownResult.markdown.trim()
          
          if (markdownResult.imageErrors.length > 0) {
            FileLogger.warn('ingestion', 'Fehler beim Verarbeiten einiger Markdown-Bilder', {
              fileId,
              errorCount: markdownResult.imageErrors.length,
            })
            if (jobId) {
              bufferLog(jobId, {
                phase: 'markdown_images_errors',
                message: `${markdownResult.imageErrors.length} Fehler beim Verarbeiten der Markdown-Bilder`,
              })
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          FileLogger.warn('ingestion', 'Fehler beim Verarbeiten der Markdown-Bilder/Cover', {
            fileId,
            error: errorMessage,
          })
          // Bei Fehlern: Original-Markdown verwenden
          if (body && typeof body === 'string' && body.trim().length > 0) {
            docMetaJsonObj.markdown = body.trim()
          }
        }
      } else {
        // Kein Provider oder Session-Modus: Markdown unverändert verwenden
        if (body && typeof body === 'string' && body.trim().length > 0) {
          docMetaJsonObj.markdown = body.trim()
        }
      }
      // WICHTIG: Stelle sicher, dass die aktualisierten Slides (mit Azure-URLs) in docMetaJsonObj sind
      if (metaEffective.slides && Array.isArray(metaEffective.slides)) {
        docMetaJsonObj.slides = metaEffective.slides
      }
      
      // PDF-Upload: Wenn docMetaJson.url fehlt, lade Original-PDF hoch
      if (provider && !docMetaJsonObj.url) {
        try {
          // Bestimme Scope basierend auf Dokumenttyp
          const scope: 'books' | 'sessions' = isSessionMode ? 'sessions' : 'books'
          
          // Lade Original-PDF vom Storage Provider
          // fileId sollte das Original-PDF sein (aus job.correlation.source.itemId)
          const pdfItem = await provider.getItemById(fileId)
          if (pdfItem && pdfItem.type === 'file') {
            const pdfMimeType = pdfItem.metadata?.mimeType || ''
            // Nur PDFs hochladen
            if (pdfMimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
              FileLogger.info('ingestion', 'Lade Original-PDF für Azure-Upload', {
                fileId,
                fileName: pdfItem.metadata?.name || fileName,
              })
              if (jobId) {
                bufferLog(jobId, {
                  phase: 'pdf_upload_start',
                  message: `Lade Original-PDF hoch: ${pdfItem.metadata?.name || fileName}`,
                })
              }
              
              // Bestimme Original-Dateiname (aus PDF-Item oder fileName)
              const originalPdfFileName = pdfItem.metadata?.name || fileName
              
              // Stelle sicher, dass Dateiname .pdf Endung hat
              const sanitizedPdfFileName = originalPdfFileName.toLowerCase().endsWith('.pdf')
                ? originalPdfFileName
                : `${originalPdfFileName.replace(/\.[^/.]+$/, '')}.pdf`
              
              // Azure Storage Service für PDF-Upload
              const azureConfig = getAzureStorageConfig()
              if (azureConfig) {
                const azureStorageInstance = new AzureStorageService()
                
                if (azureStorageInstance.isConfigured()) {
                  // Prüfe ob Container existiert
                  const containerExists = await azureStorageInstance.containerExists(azureConfig.containerName)
                  if (containerExists) {
                    // Prüfe ob PDF bereits existiert (Deduplizierung)
                    const pdfExists = await azureStorageInstance.pdfExistsWithScope(
                      azureConfig.containerName,
                      libraryId,
                      scope,
                      fileId,
                      sanitizedPdfFileName
                    )
                    
                    let pdfUrl: string
                    if (pdfExists) {
                      // PDF bereits vorhanden - verwende vorhandene URL
                      pdfUrl = azureStorageInstance.getPdfUrlWithScope(
                        azureConfig.containerName,
                        libraryId,
                        scope,
                        fileId,
                        sanitizedPdfFileName
                      )
                      FileLogger.info('ingestion', 'PDF bereits vorhanden, verwende vorhandene URL', {
                        fileId,
                        pdfUrl,
                      })
                      if (jobId) {
                        bufferLog(jobId, {
                          phase: 'pdf_upload_deduplicated',
                          message: `PDF bereits vorhanden: ${sanitizedPdfFileName}`,
                        })
                      }
                    } else {
                      // Versuche Streaming-Upload, wenn möglich (direkt vom Dateisystem)
                      // Prüfe, ob Provider einen direkten Dateipfad liefern kann
                      let useStreaming = false
                      let filePath: string | undefined = undefined
                      
                      try {
                        // Prüfe, ob Provider getPathById unterstützt
                        // getPathById gibt einen relativen Pfad zurück - wir müssen den Library-Path kennen
                        if ('getPathById' in provider && typeof provider.getPathById === 'function') {
                          const relativePath = await provider.getPathById(fileId)
                          
                          if (typeof relativePath === 'string' && relativePath !== '/') {
                            // Hole Library-Path aus Library-Service
                            try {
                              const { LibraryService } = await import('@/lib/services/library-service')
                              const libService = LibraryService.getInstance()
                              const library = await libService.getLibrary(userEmail, libraryId)
                              
                              if (library && library.path) {
                                // Konstruiere absoluten Pfad: library.path + relativePath
                                const pathLib = await import('path')
                                // Entferne führenden Slash vom relativen Pfad, falls vorhanden
                                const cleanRelativePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
                                const absolutePath = pathLib.join(library.path, cleanRelativePath)
                                
                                // Prüfe, ob Datei existiert
                                try {
                                  const stats = await fs.stat(absolutePath)
                                  if (stats.isFile()) {
                                    filePath = absolutePath
                                    useStreaming = true
                                    FileLogger.info('ingestion', 'Streaming-Upload möglich - verwende direkten Dateipfad', {
                                      fileId,
                                      filePath,
                                      relativePath,
                                      libraryPath: library.path,
                                      fileSize: stats.size,
                                    })
                                  }
                                } catch {
                                  // Datei nicht gefunden oder kein Zugriff - Fallback auf Buffer
                                  FileLogger.debug('ingestion', 'Datei nicht gefunden oder kein Zugriff, verwende Buffer-Fallback', {
                                    fileId,
                                    absolutePath,
                                  })
                                }
                              }
                            } catch (libError) {
                              // Library-Service Fehler - Fallback auf Buffer
                              FileLogger.debug('ingestion', 'Library-Path konnte nicht ermittelt werden, verwende Buffer-Fallback', {
                                fileId,
                                error: libError instanceof Error ? libError.message : String(libError),
                              })
                            }
                          }
                        }
                      } catch {
                        // getPathById nicht verfügbar oder Fehler - Fallback auf Buffer
                      }
                      
                      if (useStreaming && filePath) {
                        // Streaming-Upload direkt vom Dateisystem
                        pdfUrl = await azureStorageInstance.uploadPdfToScopeFromFile(
                          azureConfig.containerName,
                          libraryId,
                          scope,
                          fileId,
                          sanitizedPdfFileName,
                          filePath
                        )
                        FileLogger.info('ingestion', 'PDF erfolgreich auf Azure hochgeladen (via Stream)', {
                          fileId,
                          pdfUrl,
                          fileName: sanitizedPdfFileName,
                          filePath,
                        })
                      } else {
                        // Fallback: Buffer-basierter Upload (für OneDrive oder wenn Streaming nicht möglich)
                        FileLogger.info('ingestion', 'Verwende Buffer-basierten Upload (Streaming nicht möglich)', {
                          fileId,
                          fileName: sanitizedPdfFileName,
                        })
                        const pdfBinary = await provider.getBinary(fileId)
                        const pdfBuffer = Buffer.from(await pdfBinary.blob.arrayBuffer())
                        
                        pdfUrl = await azureStorageInstance.uploadPdfToScope(
                          azureConfig.containerName,
                          libraryId,
                          scope,
                          fileId,
                          sanitizedPdfFileName,
                          pdfBuffer
                        )
                        FileLogger.info('ingestion', 'PDF erfolgreich auf Azure hochgeladen', {
                          fileId,
                          pdfUrl,
                          fileName: sanitizedPdfFileName,
                        })
                        if (jobId) {
                          bufferLog(jobId, {
                            phase: 'pdf_upload_completed',
                            message: `PDF hochgeladen: ${sanitizedPdfFileName}`,
                          })
                          try {
                            await repo.traceAddEvent(jobId, {
                              spanId: 'ingest',
                              name: 'pdf_uploaded',
                              attributes: {
                                fileId,
                                fileName: sanitizedPdfFileName,
                                pdfUrl,
                                scope,
                              },
                            })
                          } catch {}
                        }
                      }
                    }
                    
                    // Setze URL in docMetaJsonObj
                    docMetaJsonObj.url = pdfUrl
                    FileLogger.info('ingestion', 'PDF-URL in docMetaJson gesetzt', {
                      fileId,
                      url: pdfUrl,
                    })
                  } else {
                    FileLogger.warn('ingestion', 'Azure Container existiert nicht, überspringe PDF-Upload', {
                      fileId,
                      containerName: azureConfig.containerName,
                    })
                    if (jobId) {
                      bufferLog(jobId, {
                        phase: 'pdf_upload_skipped',
                        message: `Azure Container existiert nicht: ${azureConfig.containerName}`,
                      })
                    }
                  }
                } else {
                  FileLogger.warn('ingestion', 'Azure Storage nicht konfiguriert, überspringe PDF-Upload', {
                    fileId,
                  })
                }
              } else {
                FileLogger.warn('ingestion', 'Azure Storage Config nicht verfügbar, überspringe PDF-Upload', {
                  fileId,
                })
              }
            } else {
              FileLogger.debug('ingestion', 'Item ist kein PDF, überspringe PDF-Upload', {
                fileId,
                mimeType: pdfMimeType,
                fileName: pdfItem.metadata?.name || fileName,
              })
            }
          } else {
            FileLogger.warn('ingestion', 'PDF-Item nicht gefunden oder kein File', {
              fileId,
              itemType: pdfItem?.type,
            })
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          FileLogger.warn('ingestion', 'Fehler beim PDF-Upload (nicht kritisch)', {
            fileId,
            error: errorMessage,
          })
          if (jobId) {
            bufferLog(jobId, {
              phase: 'pdf_upload_error',
              message: `PDF-Upload fehlgeschlagen: ${errorMessage}`,
            })
            try {
              await repo.traceAddEvent(jobId, {
                spanId: 'ingest',
                name: 'pdf_upload_failed',
                attributes: {
                  fileId,
                  error: errorMessage,
                },
              })
            } catch {}
          }
          // Fehler nicht werfen - PDF-Upload ist optional
        }
      } else if (docMetaJsonObj.url) {
        FileLogger.info('ingestion', 'docMetaJson.url bereits vorhanden, überspringe PDF-Upload', {
          fileId,
          existingUrl: docMetaJsonObj.url,
        })
      }
      
      // chunksUpserted wird später nach dem Embedding gesetzt, initialisiere mit 0
      let chunksUpserted = 0
      
      const mongoDoc: DocMeta = {
        user: userEmail,
        libraryId,
        fileId,
        fileName,
        authors: Array.isArray((docMetaJsonObj as { authors?: unknown }).authors) ? ((docMetaJsonObj as { authors?: unknown[] }).authors as string[]) : undefined,
        year: ((): number | undefined => {
          const y = (docMetaJsonObj as { year?: unknown }).year;
          if (typeof y === 'number' && Number.isFinite(y)) return y;
          if (typeof y === 'string' && y.trim().length > 0) {
            const parsed = Number(y.trim());
            if (Number.isFinite(parsed)) return parsed;
          }
          return undefined;
        })(),
        region: typeof (docMetaJsonObj as { region?: unknown }).region === 'string' ? (docMetaJsonObj as { region: string }).region : undefined,
        docType: typeof (docMetaJsonObj as { docType?: unknown }).docType === 'string' ? (docMetaJsonObj as { docType: string }).docType : undefined,
        source: typeof (docMetaJsonObj as { source?: unknown }).source === 'string' ? (docMetaJsonObj as { source: string }).source : undefined,
        tags: Array.isArray((docMetaJsonObj as { tags?: unknown }).tags) ? ((docMetaJsonObj as { tags?: unknown[] }).tags as string[]) : undefined,
        // Zusätzliche Metadaten-Felder aus Frontmatter extrahieren
        title: typeof (docMetaJsonObj as { title?: unknown }).title === 'string' ? (docMetaJsonObj as { title: string }).title : undefined,
        shortTitle: typeof (docMetaJsonObj as { shortTitle?: unknown }).shortTitle === 'string' ? (docMetaJsonObj as { shortTitle: string }).shortTitle : undefined,
        slug: typeof (docMetaJsonObj as { slug?: unknown }).slug === 'string' ? (docMetaJsonObj as { slug: string }).slug : undefined,
        summary: typeof (docMetaJsonObj as { summary?: unknown }).summary === 'string' ? (docMetaJsonObj as { summary: string }).summary : undefined,
        teaser: typeof (docMetaJsonObj as { teaser?: unknown }).teaser === 'string' ? (docMetaJsonObj as { teaser: string }).teaser : undefined,
        topics: Array.isArray((docMetaJsonObj as { topics?: unknown }).topics) ? ((docMetaJsonObj as { topics?: unknown[] }).topics as string[]) : undefined,
        chunkCount: chunksUpserted, // Wird später aktualisiert
        chaptersCount,
        upsertedAt: new Date().toISOString(),
        docMetaJson: docMetaJsonObj,
        chapters: chaptersForMongo,
      }
      // Collection-Name aus Config holen (bereits oben definiert)
      try { await ensureFacetIndexes(libraryKey, facetDefs) } catch {}
      // Facettenwerte dynamisch zusätzlich in mongoDoc spiegeln
      try {
        const sanitized = ((metaEffective as Record<string, unknown>)['__sanitized'] as Record<string, unknown>) || (metaEffective || {}) as Record<string, unknown>
        for (const d of facetDefs) {
          const v = getTopLevelValue(sanitized, d)
          if (v !== undefined && v !== null) {
            // Spezielle Behandlung für year: Validierung um NaN zu vermeiden
            if (d.metaKey === 'year') {
              let yearValue: number | undefined = undefined;
              if (typeof v === 'number' && Number.isFinite(v)) {
                yearValue = v;
              } else if (typeof v === 'string' && v.trim().length > 0) {
                const parsed = Number(v.trim());
                if (Number.isFinite(parsed)) {
                  yearValue = parsed;
                }
              }
              // Nur setzen wenn gültig, sonst undefined (wird nicht gesetzt)
              if (yearValue !== undefined) {
                (mongoDoc as Record<string, unknown>)[d.metaKey] = yearValue;
              }
            } else {
              (mongoDoc as Record<string, unknown>)[d.metaKey] = v
            }
          }
        }
      } catch {}
      // WICHTIG: Das finale Markdown verwenden (mit Azure-Bild-URLs)
      // Dieses Markdown wird an Secretary Service RAG API gesendet
      const baseMarkdown = typeof docMetaJsonObj.markdown === 'string' && docMetaJsonObj.markdown.trim().length > 0
        ? docMetaJsonObj.markdown.trim()
        : (body && typeof body === 'string' && body.trim().length > 0 ? body.trim() : '')
      
      if (!baseMarkdown || baseMarkdown.length === 0) {
        FileLogger.warn('ingestion', 'Kein Markdown für Embedding verfügbar', { fileId })
        if (jobId) bufferLog(jobId, { phase: 'ingest_no_markdown', message: 'Kein Markdown für Embedding verfügbar' })
        return { chunksUpserted: 0, docUpserted: true, index: libraryKey, imageErrors: imageErrors ?? undefined }
      }
      
      // Metadaten als Text-Präfix vor das Markdown setzen, um Embedding-Qualität zu verbessern
      const metadataPrefix = buildMetadataPrefix(docMetaJsonObj)
      const finalMarkdown = metadataPrefix ? `${metadataPrefix}\n\n--- Dokument-Body beginnt hier ---\n\n${baseMarkdown}` : baseMarkdown
      
      // Secretary Service RAG Embedding aufrufen
      FileLogger.info('ingestion', 'Starte RAG Embedding über Secretary Service', { fileId, markdownLength: finalMarkdown.length, metadataPrefixLength: metadataPrefix?.length || 0 })
      if (jobId) bufferLog(jobId, { phase: 'ingest_rag_start', message: `RAG Embedding gestartet: ${finalMarkdown.length} Zeichen (${metadataPrefix?.length || 0} Zeichen Metadaten-Präfix)` })
      
      let ragResult
      try {
        ragResult = await embedDocumentWithSecretary(finalMarkdown, ctx, {
          documentId: fileId,
          meta: {
            fileName,
            libraryId,
            userEmail,
          },
        })
        FileLogger.info('ingestion', 'RAG Embedding erfolgreich', { fileId, chunks: ragResult.chunks.length, dimensions: ragResult.dimensions, model: ragResult.model })
        if (jobId) bufferLog(jobId, { phase: 'ingest_rag_done', message: `RAG Embedding abgeschlossen: ${ragResult.chunks.length} Chunks, ${ragResult.dimensions} Dimensionen` })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        FileLogger.error('ingestion', 'RAG Embedding fehlgeschlagen', { fileId, error: errorMessage })
        if (jobId) bufferLog(jobId, { phase: 'ingest_rag_failed', message: `RAG Embedding fehlgeschlagen: ${errorMessage}` })
        throw error
      }
      
      // MongoDB-Vektoren aus RAG-Chunks bauen (mit Facetten-Metadaten)
      const facetValues = extractFacetValues(mongoDoc, docMetaJsonObj, facetDefs)
      const vectors = buildVectorDocuments(ragResult, fileId, fileName, libraryId, userEmail, facetValues)
      
      // Aktualisiere chunksUpserted mit der tatsächlichen Anzahl der Vektoren
      chunksUpserted = vectors.length
      
      // Aktualisiere chaptersForMongo mit korrekter chunkCount (falls Kapitel vorhanden)
      if (chaptersForMongo.length > 0 && chunksUpserted > 0) {
        // Vereinfachte Annahme: Chunks gleichmäßig auf Kapitel verteilt
        const chunksPerChapter = Math.ceil(chunksUpserted / chaptersForMongo.length)
        for (const chapter of chaptersForMongo) {
          chapter.chunkCount = chunksPerChapter
        }
      }
      
      // Dimension aus Retriever-Context verwenden
      const dimension = retrieverCtx.dimension
      
      // MongoDB-Vektoren upserten
      if (vectors.length > 0) {
        await upsertVectors(libraryKey, vectors, dimension, retrieverCtx.ctx.library)
        FileLogger.info('ingestion', 'MongoDB-Vektoren upsertet', { fileId, chunks: chunksUpserted })
        if (jobId) bufferLog(jobId, { phase: 'ingest_vectors_upserted', message: `${chunksUpserted} Chunks in MongoDB upsertet` })
      }
      
      // Dokument-Embedding für globale Dokumentensuche erstellen
      let documentEmbedding: number[] | undefined = undefined
      try {
        const { buildDocumentTextForEmbedding } = await import('@/lib/ingestion/document-text-builder')
        const { embedQuestionWithSecretary } = await import('@/lib/chat/rag-embeddings')
        
        const documentText = buildDocumentTextForEmbedding(docMetaJsonObj, mongoDoc)
        if (documentText.trim().length > 0) {
          FileLogger.info('ingestion', 'Erstelle Dokument-Embedding für globale Suche', { fileId, textLength: documentText.length })
          if (jobId) bufferLog(jobId, { phase: 'doc_embedding_start', message: 'Erstelle Dokument-Embedding für globale Suche' })
          
          documentEmbedding = await embedQuestionWithSecretary(documentText, retrieverCtx.ctx)
          FileLogger.info('ingestion', 'Dokument-Embedding erstellt', { fileId, dimensions: documentEmbedding.length })
          if (jobId) bufferLog(jobId, { phase: 'doc_embedding_done', message: `Dokument-Embedding erstellt: ${documentEmbedding.length} Dimensionen` })
        } else {
          FileLogger.warn('ingestion', 'Kein Text für Dokument-Embedding verfügbar', { fileId })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        FileLogger.warn('ingestion', 'Fehler beim Erstellen des Dokument-Embeddings', { fileId, error: errorMessage })
        if (jobId) bufferLog(jobId, { phase: 'doc_embedding_failed', message: `Dokument-Embedding fehlgeschlagen: ${errorMessage}` })
        // Nicht werfen, da Hauptfunktionalität (Chunk-Embeddings) bereits erfüllt ist
      }
      
      // Debug: Logge docMetaJsonObj-Inhalt vor buildMetaDocument
      FileLogger.info('ingestion', 'docMetaJsonObj vor buildMetaDocument', {
        fileId,
        docMetaJsonObjKeys: Object.keys(docMetaJsonObj),
        docMetaJsonObjSample: {
          title: docMetaJsonObj.title,
          shortTitle: docMetaJsonObj.shortTitle,
          slug: docMetaJsonObj.slug,
          summary: typeof docMetaJsonObj.summary === 'string' ? docMetaJsonObj.summary.substring(0, 100) : docMetaJsonObj.summary,
          authors: docMetaJsonObj.authors,
          year: docMetaJsonObj.year,
          topics: docMetaJsonObj.topics,
        },
      })
      
      // Meta-Dokument erstellen und speichern (ersetzt doc_meta Collection)
      const metaDoc = buildMetaDocument(
        mongoDoc,
        docMetaJsonObj,
        chaptersForMongo,
        chaptersCount,
        chunksUpserted,
        facetValues,
        userEmail
      )
      
      // Debug: Logge metaDoc-Inhalt nach buildMetaDocument
      FileLogger.info('ingestion', 'metaDoc nach buildMetaDocument', {
        fileId,
        metaDocKeys: Object.keys(metaDoc),
        metaDocSample: {
          title: metaDoc.title,
          shortTitle: metaDoc.shortTitle,
          slug: metaDoc.slug,
          summary: typeof metaDoc.summary === 'string' ? metaDoc.summary.substring(0, 100) : metaDoc.summary,
          authors: metaDoc.authors,
          year: metaDoc.year,
          topics: metaDoc.topics,
          docMetaJsonKeys: Object.keys(metaDoc.docMetaJson || {}),
        },
      })
      
      // Embedding zum Meta-Dokument hinzufügen (falls erstellt)
      if (documentEmbedding) {
        (metaDoc as Record<string, unknown>).embedding = documentEmbedding
      }
      
      try {
        await upsertVectorMeta(libraryKey, metaDoc, dimension, retrieverCtx.ctx.library)
        FileLogger.info('ingestion', 'Meta-Dokument gespeichert', { fileId, chunks: chunksUpserted, hasEmbedding: !!documentEmbedding })
        if (jobId) {
          bufferLog(jobId, { phase: 'meta_doc_upserted', message: `Meta-Dokument gespeichert: chunks=${chunksUpserted}, chapters=${chaptersCount}, embedding=${documentEmbedding ? 'ja' : 'nein'}` })
          try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'meta_doc_upsert_done', attributes: { fileId, chunks: chunksUpserted, chapters: chaptersCount, hasEmbedding: !!documentEmbedding } }) } catch {}
        }
      } catch (e) {
        FileLogger.warn('ingestion', 'Fehler beim Speichern des Meta-Dokuments', { fileId, error: String(e) })
        // Nicht werfen, da Hauptfunktionalität bereits erfüllt ist
      }
      
      FileLogger.info('ingestion', 'Upsert abgeschlossen', { fileId, chunks: chunksUpserted, vectors: vectors.length, imageErrors: imageErrors?.length ?? 0 })
      if (jobId) bufferLog(jobId, { phase: 'ingest_completed', message: `Upsert abgeschlossen: ${chunksUpserted} Chunks (${vectors.length} Vektoren)` })
      return { chunksUpserted, docUpserted: true, index: libraryKey, imageErrors: imageErrors ?? undefined }
    } catch (err) {
      FileLogger.warn('ingestion', 'Doc‑Meta finales Update fehlgeschlagen', { fileId, err: String(err) })
      if (jobId) {
        bufferLog(jobId, { phase: 'doc_meta_final_failed', message: 'Doc‑Meta finales Update fehlgeschlagen' })
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'doc_meta_upsert_failed', attributes: { vectorFileId: fileId, error: String(err) } }) } catch {}
      }
      // Kritisch: Fehler weiterwerfen, damit Orchestrator den Step/Job als failed markiert
      throw err instanceof Error ? err : new Error(String(err))
    }
  }
}


