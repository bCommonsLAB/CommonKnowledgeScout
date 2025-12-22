/**
 * @fileoverview External Jobs Images Processing - Image Archive Extraction
 * 
 * @description
 * Processes image archives from Secretary Service. Downloads ZIP archives containing
 * extracted images, saves them to storage using ImageExtractionService, and associates
 * them with the original document. Handles URL normalization and authentication.
 * Consolidates all image processing sources (pages_archive_data, images_archive_data,
 * mistral_ocr_raw, images_archive_url) into a single unified function.
 * 
 * @module external-jobs
 * 
 * @exports
 * - maybeProcessImages: Processes images if archive URL is provided (legacy)
 * - processAllImageSources: Consolidated image processing for all sources
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback processes images
 * - src/lib/external-jobs/extract-only.ts: Extract-only mode processes images
 * 
 * @dependencies
 * - @/lib/transform/image-extraction-service: Image extraction service
 * - @/lib/storage/server-provider: Storage provider creation
 * - @/lib/env: Environment helpers for Secretary config
 * - @/lib/external-jobs-log-buffer: Log buffering
 * - @/lib/external-jobs/shadow-twin-helpers: Shadow-Twin helper functions
 * - @/types/external-jobs: Images types
 */

import type { ImagesArgs, ImagesResult, RequestContext } from '@/types/external-jobs'
import type { StorageProvider } from '@/lib/storage/types'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { getServerProvider } from '@/lib/storage/server-provider'
import { ImageExtractionService } from '@/lib/transform/image-extraction-service'
import { getSecretaryConfig } from '../env'
import { findOrCreateShadowTwinFolder, prepareImageProcessingContext } from './shadow-twin-helpers'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'

/**
 * Options for processing all image sources
 */
export interface ProcessAllImageSourcesOptions {
  /** Base64-encoded ZIP archive of PDF pages (Mistral OCR, Legacy) */
  pagesArchiveData?: string
  /** URL to download pages archive from (Mistral OCR, new format) */
  pagesArchiveUrl?: string
  /** Filename for pages archive */
  pagesArchiveFilename?: string
  /** Base64-encoded ZIP archive of extracted images (Standard PDF) */
  imagesArchiveData?: string
  /** Filename for images archive */
  imagesArchiveFilename?: string
  /** URL to download images archive from (Worker fallback) */
  imagesArchiveUrl?: string
  /** Mistral OCR raw response containing inline images */
  mistralOcrRaw?: unknown
  /** Whether Mistral OCR images are present (in mistral_ocr_raw as Base64) */
  hasMistralOcrImages: boolean
  /** URL to download Mistral OCR images ZIP archive (separate from mistral_ocr_raw) */
  mistralOcrImagesUrl?: string
  /** Extracted text content */
  extractedText?: string
  /** Target language */
  lang: string
  /** Target parent directory ID */
  targetParentId: string
  /** Whether images phase is enabled */
  imagesPhaseEnabled: boolean
  /** Optional: Pre-created Shadow-Twin folder ID (if already created) */
  shadowTwinFolderId?: string
}

/**
 * Consolidated image processing function that handles all image sources:
 * - pages_archive_data (Mistral OCR page images as ZIP)
 * - images_archive_data (Standard PDF extracted images as ZIP)
 * - mistral_ocr_raw (Mistral OCR inline images as Base64)
 * - images_archive_url (Worker-provided URL fallback)
 * 
 * @param ctx - Request context
 * @param provider - Storage provider instance
 * @param options - Image processing options
 * @returns Array of saved item IDs, or undefined if no images were processed
 */
export async function processAllImageSources(
  ctx: RequestContext,
  provider: StorageProvider,
  options: ProcessAllImageSourcesOptions
): Promise<{ savedItemIds: string[] } | undefined> {
  const {
    pagesArchiveData,
    pagesArchiveUrl,
    pagesArchiveFilename,
    imagesArchiveData,
    imagesArchiveFilename,
    imagesArchiveUrl,
    mistralOcrRaw,
    hasMistralOcrImages,
    mistralOcrImagesUrl,
    extractedText,
    lang,
    targetParentId,
    imagesPhaseEnabled,
  } = options

  if (!imagesPhaseEnabled) {
    bufferLog(ctx.jobId, {
      phase: 'process_images_disabled',
      message: 'Bilder-Verarbeitung deaktiviert'
    })
    return undefined
  }

  const repo = new ExternalJobsRepository()
  
  // Starte Bild-Extraktion-Span
  try {
    await repo.traceStartSpan(ctx.jobId, {
      spanId: 'image_extraction',
      parentSpanId: 'job',
      name: 'image_extraction',
    })
  } catch {
    // Span könnte bereits existieren (nicht kritisch)
  }
  
  // Trace-Event für Start der Bild-Verarbeitung (allgemein)
  try {
    await repo.traceAddEvent(ctx.jobId, {
      spanId: 'image_extraction',
      name: 'image_extraction_start',
      attributes: {
        hasPagesArchiveData: !!pagesArchiveData,
        hasPagesArchiveUrl: !!pagesArchiveUrl,
        hasImagesArchiveData: !!imagesArchiveData,
        hasImagesArchiveUrl: !!imagesArchiveUrl,
        hasMistralOcrImages,
        hasMistralOcrImagesUrl: !!mistralOcrImagesUrl,
        mistralOcrRawType: typeof mistralOcrRaw,
      },
    })
  } catch {
    // Trace-Fehler nicht kritisch
  }
  
  bufferLog(ctx.jobId, {
    phase: 'process_images_start',
    message: 'Starte konsolidierte Bilder-Verarbeitung',
    hasPagesArchiveData: !!pagesArchiveData,
    hasPagesArchiveUrl: !!pagesArchiveUrl,
    hasImagesArchiveData: !!imagesArchiveData,
    hasImagesArchiveUrl: !!imagesArchiveUrl,
    hasMistralOcrImages,
    hasMistralOcrImagesUrl: !!mistralOcrImagesUrl,
    mistralOcrRawType: typeof mistralOcrRaw,
  })

  const savedItemIds: string[] = []
  const { originalItemForImages, textContents } = prepareImageProcessingContext(
    provider,
    ctx.job,
    targetParentId,
    ctx.body
  )

  // Verwende bereits erstelltes Shadow-Twin-Verzeichnis oder erstelle ein neues
  const originalName = ctx.job.correlation?.source?.name || 'source.pdf'
  let effectiveShadowTwinFolderId = options.shadowTwinFolderId
  if (!effectiveShadowTwinFolderId) {
    // Erstelle Shadow-Twin-Verzeichnis nur wenn noch nicht vorhanden
    effectiveShadowTwinFolderId = await findOrCreateShadowTwinFolder(
      provider,
      targetParentId,
      originalName,
      ctx.jobId
    )
  }

  // 0. Process mistral_ocr_images_url ZUERST (Mistral OCR eingebettete Bilder als ZIP von URL)
  // WICHTIG: Bilder sind NIEMALS in mistral_ocr_raw eingebettet, sondern werden separat bereitgestellt
  // PRIORITÄT: mistral_ocr_images_url wird ZUERST verarbeitet, da dies die primäre Quelle für eingebettete Bilder ist
  if (mistralOcrImagesUrl) {
    try {
      // Download ZIP archive from URL (similar to pages_archive_url)
      const { baseUrl: baseRaw } = getSecretaryConfig()
      const isAbsolute = /^https?:\/\//i.test(mistralOcrImagesUrl)
      let archiveUrl = mistralOcrImagesUrl
      if (!isAbsolute) {
        const base = baseRaw.replace(/\/$/, '')
        const rel = mistralOcrImagesUrl.startsWith('/') ? mistralOcrImagesUrl : `/${mistralOcrImagesUrl}`
        archiveUrl = base.endsWith('/api') && rel.startsWith('/api/') ? `${base}${rel.substring(4)}` : `${base}${rel}`
      }
      const headers: Record<string, string> = {}
      const { apiKey } = getSecretaryConfig()
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
        headers['X-Service-Token'] = apiKey
      }

      bufferLog(ctx.jobId, {
        phase: 'mistral_ocr_images_download_start',
        message: `Lade Mistral OCR Bilder von URL: ${archiveUrl}`
      })

      const resp = await fetch(archiveUrl, { method: 'GET', headers })
      if (!resp.ok) {
        bufferLog(ctx.jobId, {
          phase: 'mistral_ocr_images_download_failed',
          message: `Mistral OCR Bilder-Download fehlgeschlagen: ${resp.status}`
        })
      } else {
        const arrayBuf = await resp.arrayBuffer()
        const base64Zip = Buffer.from(arrayBuf).toString('base64')

        // Trace-Event für Start der spezifischen Archiv-Extraktion
        try {
          await repo.traceAddEvent(ctx.jobId, {
            spanId: 'image_extraction',
            name: 'image_extraction_archive_start',
            attributes: {
              archiveType: 'mistral_ocr_images',
              archiveName: 'mistral_ocr_images.zip',
              source: 'url',
            },
          })
        } catch {}

        const result = await ImageExtractionService.saveZipArchive(
          base64Zip,
          'mistral_ocr_images.zip',
          originalItemForImages,
          provider,
          async (folderId: string) => provider.listItemsById(folderId),
          extractedText,
          lang,
          textContents,
          effectiveShadowTwinFolderId
        )

        savedItemIds.push(...result.savedItems.map(it => it.id))
        
        // Trace-Event für Abschluss der Archiv-Extraktion mit Progress-Information
        try {
          await repo.traceAddEvent(ctx.jobId, {
            spanId: 'image_extraction',
            name: 'image_extraction_completed',
            attributes: {
              archiveType: 'mistral_ocr_images',
              archiveName: 'mistral_ocr_images.zip',
              imagesCount: result.savedItems.length,
              totalImagesSoFar: savedItemIds.length,
            },
          })
          // Progress-Event für einzelne Bild-Uploads (nachträglich, da wir die Anzahl kennen)
          if (result.savedItems.length > 0) {
            await repo.traceAddEvent(ctx.jobId, {
              spanId: 'image_extraction',
              name: 'image_upload_progress',
              attributes: {
                archiveType: 'mistral_ocr_images',
                uploadedImages: result.savedItems.length,
                totalImagesSoFar: savedItemIds.length,
              },
            })
          }
        } catch {}
        
        bufferLog(ctx.jobId, {
          phase: 'mistral_ocr_images_extracted_from_url',
          message: `Mistral OCR Bilder von URL gespeichert (${result.savedItems.length})`
        })
      }
    } catch (error) {
      bufferLog(ctx.jobId, {
        phase: 'mistral_ocr_images_url_error',
        message: `Fehler beim Download/Speichern der Mistral OCR Bilder: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }

  // 1. Process pages_archive_url (Mistral OCR page images as ZIP from URL)
  if (pagesArchiveUrl) {
    try {
      // Download ZIP archive from URL (similar to images_archive_url)
      const { baseUrl: baseRaw } = getSecretaryConfig()
      const isAbsolute = /^https?:\/\//i.test(pagesArchiveUrl)
      let archiveUrl = pagesArchiveUrl
      if (!isAbsolute) {
        const base = baseRaw.replace(/\/$/, '')
        const rel = pagesArchiveUrl.startsWith('/') ? pagesArchiveUrl : `/${pagesArchiveUrl}`
        archiveUrl = base.endsWith('/api') && rel.startsWith('/api/') ? `${base}${rel.substring(4)}` : `${base}${rel}`
      }
      const headers: Record<string, string> = {}
      const { apiKey } = getSecretaryConfig()
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
        headers['X-Service-Token'] = apiKey
      }

      bufferLog(ctx.jobId, {
        phase: 'pages_archive_download_start',
        message: `Lade Seiten-Archiv von URL: ${archiveUrl}`
      })

      const resp = await fetch(archiveUrl, { method: 'GET', headers })
      if (!resp.ok) {
        bufferLog(ctx.jobId, {
          phase: 'pages_archive_download_failed',
          message: `Archiv-Download fehlgeschlagen: ${resp.status}`
        })
      } else {
        const arrayBuf = await resp.arrayBuffer()
        const base64Zip = Buffer.from(arrayBuf).toString('base64')

        // Trace-Event für Start der spezifischen Archiv-Extraktion
        try {
          await repo.traceAddEvent(ctx.jobId, {
            spanId: 'image_extraction',
            name: 'image_extraction_archive_start',
            attributes: {
              archiveType: 'pages',
              archiveName: pagesArchiveFilename || 'pages.zip',
              source: 'url',
            },
          })
        } catch {}

        const result = await ImageExtractionService.saveZipArchive(
          base64Zip,
          pagesArchiveFilename || 'pages.zip',
          originalItemForImages,
          provider,
          async (folderId: string) => provider.listItemsById(folderId),
          extractedText,
          lang,
          textContents,
          effectiveShadowTwinFolderId
        )

      savedItemIds.push(...result.savedItems.map(it => it.id))
      
      // Trace-Event für Abschluss der Archiv-Extraktion mit Progress-Information
      try {
        await repo.traceAddEvent(ctx.jobId, {
          spanId: 'image_extraction',
          name: 'image_extraction_completed',
          attributes: {
            archiveType: 'pages',
            archiveName: pagesArchiveFilename || 'pages.zip',
            imagesCount: result.savedItems.length,
            totalImagesSoFar: savedItemIds.length,
          },
        })
        // Progress-Event für einzelne Bild-Uploads (nachträglich, da wir die Anzahl kennen)
        if (result.savedItems.length > 0) {
          await repo.traceAddEvent(ctx.jobId, {
            spanId: 'image_extraction',
            name: 'image_upload_progress',
            attributes: {
              archiveType: 'pages',
              uploadedImages: result.savedItems.length,
              totalImagesSoFar: savedItemIds.length,
            },
          })
        }
      } catch {}
      
      bufferLog(ctx.jobId, {
        phase: 'pages_images_extracted_from_url',
          message: `Seiten-Bilder von URL gespeichert (${result.savedItems.length})`
        })
      }
    } catch (error) {
      bufferLog(ctx.jobId, {
        phase: 'pages_archive_url_error',
        message: `Fehler beim Download/Speichern der Seiten-Bilder: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }

  // 2. Process pages_archive_data (Mistral OCR page images as ZIP, Legacy Base64)
  if (pagesArchiveData) {
    try {
      // Trace-Event für Start der spezifischen Archiv-Extraktion
      try {
        await repo.traceAddEvent(ctx.jobId, {
          spanId: 'image_extraction',
          name: 'image_extraction_archive_start',
          attributes: {
            archiveType: 'pages',
            archiveName: pagesArchiveFilename || 'pages.zip',
            source: 'base64',
          },
        })
      } catch {}
      
      const result = await ImageExtractionService.saveZipArchive(
        pagesArchiveData,
        pagesArchiveFilename || 'pages.zip',
        originalItemForImages,
        provider,
        async (folderId: string) => provider.listItemsById(folderId),
        extractedText,
        lang,
        textContents,
        effectiveShadowTwinFolderId
      )

      savedItemIds.push(...result.savedItems.map(it => it.id))
      
      // Trace-Event für Abschluss der Archiv-Extraktion mit Progress-Information
      try {
        await repo.traceAddEvent(ctx.jobId, {
          spanId: 'image_extraction',
          name: 'image_extraction_completed',
          attributes: {
            archiveType: 'pages',
            archiveName: pagesArchiveFilename || 'pages.zip',
            imagesCount: result.savedItems.length,
            totalImagesSoFar: savedItemIds.length,
          },
        })
        // Progress-Event für einzelne Bild-Uploads (nachträglich, da wir die Anzahl kennen)
        if (result.savedItems.length > 0) {
          await repo.traceAddEvent(ctx.jobId, {
            spanId: 'image_extraction',
            name: 'image_upload_progress',
            attributes: {
              archiveType: 'pages',
              uploadedImages: result.savedItems.length,
              totalImagesSoFar: savedItemIds.length,
            },
          })
        }
      } catch {}
      
      bufferLog(ctx.jobId, {
        phase: 'pages_images_extracted_from_base64',
        message: `Seiten-Bilder von Base64 gespeichert (${result.savedItems.length})`
      })
    } catch (error) {
      bufferLog(ctx.jobId, {
        phase: 'pages_images_extract_failed',
        message: `Fehler beim Speichern der Seiten-Bilder: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }

  // 3. Process images_archive_data (Standard PDF extracted images as ZIP)
  if (imagesArchiveData) {
    try {
      // Trace-Event für Start der spezifischen Archiv-Extraktion
      try {
        await repo.traceAddEvent(ctx.jobId, {
          spanId: 'image_extraction',
          name: 'image_extraction_archive_start',
          attributes: {
            archiveType: 'images',
            archiveName: imagesArchiveFilename || 'images.zip',
            source: 'base64',
          },
        })
      } catch {}
      
      const result = await ImageExtractionService.saveZipArchive(
        imagesArchiveData,
        imagesArchiveFilename || 'images.zip',
        originalItemForImages,
        provider,
        async (folderId: string) => provider.listItemsById(folderId),
        extractedText,
        lang,
        textContents,
        effectiveShadowTwinFolderId
      )

      savedItemIds.push(...result.savedItems.map(it => it.id))
      
      // Trace-Event für Abschluss der Archiv-Extraktion mit Progress-Information
      try {
        await repo.traceAddEvent(ctx.jobId, {
          spanId: 'image_extraction',
          name: 'image_extraction_completed',
          attributes: {
            archiveType: 'images',
            archiveName: imagesArchiveFilename || 'images.zip',
            imagesCount: result.savedItems.length,
            totalImagesSoFar: savedItemIds.length,
          },
        })
        // Progress-Event für einzelne Bild-Uploads (nachträglich, da wir die Anzahl kennen)
        if (result.savedItems.length > 0) {
          await repo.traceAddEvent(ctx.jobId, {
            spanId: 'image_extraction',
            name: 'image_upload_progress',
            attributes: {
              archiveType: 'images',
              uploadedImages: result.savedItems.length,
              totalImagesSoFar: savedItemIds.length,
            },
          })
        }
      } catch {}
      
      bufferLog(ctx.jobId, {
        phase: 'images_extracted',
        message: `Bilder gespeichert (${result.savedItems.length})`
      })
    } catch (error) {
      bufferLog(ctx.jobId, {
        phase: 'images_extract_failed',
        message: `Fehler beim Speichern der Bilder: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }

  // 4. Process mistral_ocr_raw (Mistral OCR inline images as Base64, Legacy - nur wenn keine URL vorhanden)
  // HINWEIS: Laut Dokumentation sind Bilder NIEMALS in mistral_ocr_raw eingebettet, aber für Rückwärtskompatibilität behalten
  if (hasMistralOcrImages && mistralOcrRaw && typeof mistralOcrRaw === 'object' && 'pages' in mistralOcrRaw && !mistralOcrImagesUrl) {
    try {
      if (effectiveShadowTwinFolderId) {
        // Sammle alle Bilder aus allen Seiten
        const allImages: Array<{ id: string; image_base64: string }> = []
        const pages = (mistralOcrRaw as {
          pages?: Array<{
            images?: Array<{ id?: string; image_base64?: string | null }>
          }>
        }).pages

        if (pages && Array.isArray(pages)) {
          for (const page of pages) {
            if (page.images && Array.isArray(page.images)) {
              for (const image of page.images) {
                if (image.id && image.image_base64 && image.image_base64 !== null) {
                  allImages.push({
                    id: image.id,
                    image_base64: image.image_base64,
                  })
                }
              }
            }
          }
        }

        if (allImages.length > 0) {
          bufferLog(ctx.jobId, {
            phase: 'mistral_ocr_images_found',
            message: `${allImages.length} Mistral OCR Bilder gefunden`
          })

          const savedMistralImages = await ImageExtractionService.saveMistralOcrImages(
            allImages,
            effectiveShadowTwinFolderId,
            provider
          )

          savedItemIds.push(...savedMistralImages.map(it => it.id))
          bufferLog(ctx.jobId, {
            phase: 'mistral_ocr_images_saved',
            message: `${savedMistralImages.length} Mistral OCR Bilder gespeichert`
          })
        }
      } else {
        bufferLog(ctx.jobId, {
          phase: 'mistral_ocr_images_no_folder',
          message: 'Kein Shadow-Twin-Verzeichnis verfügbar für Mistral OCR Bilder'
        })
      }
    } catch (error) {
      bufferLog(ctx.jobId, {
        phase: 'mistral_ocr_images_save_failed',
        message: `Fehler beim Speichern der Mistral OCR Bilder: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }

  // 6. Fallback: images_archive_url vom Worker (wie bisher)
  if (savedItemIds.length === 0 && imagesArchiveUrl) {
    const urlResult = await maybeProcessImages({
      ctx,
      parentId: targetParentId,
      imagesZipUrl: imagesArchiveUrl,
      extractedText,
      lang,
    })
    if (urlResult) {
      savedItemIds.push(...urlResult.savedItemIds)
    }
  }

  // Beende Bild-Extraktion-Span
  try {
    await repo.traceEndSpan(ctx.jobId, 'image_extraction', savedItemIds.length > 0 ? 'completed' : 'skipped', {
      totalImages: savedItemIds.length,
    })
  } catch {
    // Span-Fehler nicht kritisch
  }

  return savedItemIds.length > 0 ? { savedItemIds } : undefined
}

/**
 * Legacy function: Processes images if archive URL is provided.
 * Kept for backward compatibility.
 * 
 * @deprecated Use processAllImageSources instead for consolidated processing
 */
export async function maybeProcessImages(args: ImagesArgs): Promise<ImagesResult | void> {
  const { ctx, parentId, imagesZipUrl, extractedText, lang } = args
  if (!imagesZipUrl) return

  // Baue absolute URL, falls nötig
  const { baseUrl: baseRaw } = getSecretaryConfig()
  const isAbsolute = /^https?:\/\//i.test(imagesZipUrl)
  let archiveUrl = imagesZipUrl
  if (!isAbsolute) {
    const base = baseRaw.replace(/\/$/, '')
    const rel = imagesZipUrl.startsWith('/') ? imagesZipUrl : `/${imagesZipUrl}`
    archiveUrl = base.endsWith('/api') && rel.startsWith('/api/') ? `${base}${rel.substring(4)}` : `${base}${rel}`
  }
  const headers: Record<string, string> = {}
  const { apiKey } = getSecretaryConfig()
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
    headers['X-Service-Token'] = apiKey
  }

  const resp = await fetch(archiveUrl, { method: 'GET', headers })
  if (!resp.ok) {
    bufferLog(ctx.jobId, {
      phase: 'images_download_failed',
      message: `Archiv-Download fehlgeschlagen: ${resp.status}`
    })
    return
  }
  const arrayBuf = await resp.arrayBuffer()
  const base64Zip = Buffer.from(arrayBuf).toString('base64')
  const provider = await getServerProvider(ctx.job.userEmail, ctx.job.libraryId)
  const { originalItemForImages, textContents } = prepareImageProcessingContext(
    provider,
    ctx.job,
    parentId,
    ctx.body
  )

  // Verwende bereits erstelltes Shadow-Twin-Verzeichnis oder erstelle ein neues
  const originalName = ctx.job.correlation?.source?.name || 'source.pdf'
  const effectiveShadowTwinFolderId = await findOrCreateShadowTwinFolder(
    provider,
    parentId,
    originalName,
    ctx.jobId
  )

  const result = await ImageExtractionService.saveZipArchive(
    base64Zip,
    'images.zip',
    originalItemForImages,
    provider,
    async (folderId: string) => provider.listItemsById(folderId),
    extractedText,
    lang,
    textContents,
    effectiveShadowTwinFolderId
  )
  const savedItemIds = result.savedItems.map(it => it.id)
  bufferLog(ctx.jobId, {
    phase: 'images_extracted',
    message: `Bilder gespeichert (${savedItemIds.length})`
  })
  return { savedItemIds }
}


