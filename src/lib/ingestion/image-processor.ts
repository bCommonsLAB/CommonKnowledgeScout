import type { StorageProvider } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { AzureStorageService, calculateImageHash } from '@/lib/services/azure-storage-service'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'

export interface ImageProcessingError {
  imagePath?: string
  slideIndex?: number
  imageUrl?: string
  error: string
}

export interface MarkdownImageProcessingResult {
  markdown: string
  imageErrors: Array<{ imagePath: string; error: string }>
}

export interface SlideImageProcessingResult {
  slides: Array<Record<string, unknown>>
  errors: Array<{ slideIndex: number; imageUrl: string; error: string }>
}

/**
 * Konsolidierter Image Processor für alle Bild-Verarbeitungs-Typen während der Ingestion.
 * Eliminiert Redundanz zwischen Markdown-Bilder, Cover-Bilder und Slide-Bilder.
 */
export class ImageProcessor {
  // Performance: Cache für bereits geprüfte Bilder (Hash -> Azure URL)
  // Verhindert wiederholte Azure API-Calls für dieselben Bilder
  private static imageCache: Map<string, string> = new Map()
  
  /**
   * Berechnet Cache-Key für Bild-Deduplizierung
   */
  private static getImageCacheKey(
    libraryId: string,
    scope: 'books' | 'sessions',
    hash: string,
    extension: string
  ): string {
    return `${libraryId}:${scope}:${hash}:${extension}`
  }
  
  /**
   * Löscht den Bild-Cache (für Tests oder nach größeren Änderungen)
   */
  static clearImageCache(): void {
    this.imageCache.clear()
  }
  /**
   * Verarbeitet Markdown-Bilder und lädt sie auf Azure Storage hoch.
   * Extrahiert Bildreferenzen aus Markdown-Body und ersetzt sie durch Azure-URLs.
   */
  static async processMarkdownImages(
    markdownBody: string,
    provider: StorageProvider,
    libraryId: string,
    fileId: string,
    shadowTwinFolderId: string | undefined,
    jobId?: string,
    isSessionMode: boolean = false
  ): Promise<MarkdownImageProcessingResult> {
    const azureStorage = await this.ensureAzureStorage(fileId, jobId)
    if (!azureStorage) {
      return { markdown: markdownBody, imageErrors: [] }
    }

    const containerCheck = await this.ensureContainer(azureStorage, fileId, jobId, 'markdown_images_container_error')
    if (!containerCheck.success || !containerCheck.containerName) {
      return { markdown: markdownBody, imageErrors: [{ imagePath: '', error: containerCheck.errorMessage || 'Unbekannter Fehler' }] }
    }

    const errors: Array<{ imagePath: string; error: string }> = []
    let updatedMarkdown = markdownBody

    // Regex-Patterns für Bildreferenzen
    const imagePatterns = [
      {
        regex: /!\[(.*?)\]\((?!http)(.*?)\)/g,
        extractPath: (match: RegExpMatchArray) => match[2],
        replace: (alt: string, newUrl: string) => `![${alt}](${newUrl})`,
      },
      {
        regex: /<img\s+src=["'](?!http)([^"']+)["'][^>]*>/gi,
        extractPath: (match: RegExpMatchArray) => match[1],
        replace: (_alt: string, newUrl: string) => `<img src="${newUrl}">`,
      },
      {
        regex: /<img-(\d+\.(?:jpeg|jpg|png|gif|webp))>/gi,
        extractPath: (match: RegExpMatchArray) => match[1],
        replace: (alt: string, newUrl: string) => `<img src="${newUrl}" alt="${alt}">`,
      },
    ]

    // Sammle alle Bildreferenzen
    const imageReferences: Array<{ match: RegExpMatchArray; pattern: typeof imagePatterns[0] }> = []
    for (const pattern of imagePatterns) {
      const matches = Array.from(markdownBody.matchAll(pattern.regex))
      for (const match of matches) {
        const imagePath = pattern.extractPath(match)
        if (imagePath && !imagePath.startsWith('http://') && !imagePath.startsWith('https://') && !imagePath.startsWith('/api/storage/')) {
          imageReferences.push({ match, pattern })
        }
      }
    }

    if (imageReferences.length === 0) {
      FileLogger.info('ingestion', 'Keine relativen Bildreferenzen im Markdown gefunden', { fileId })
      return { markdown: markdownBody, imageErrors: [] }
    }

    FileLogger.info('ingestion', 'Verarbeite Markdown-Bilder für Azure Upload', {
      fileId,
      imageCount: imageReferences.length,
    })
    if (jobId) {
      bufferLog(jobId, {
        phase: 'markdown_images_processing',
        message: `Verarbeite ${imageReferences.length} Markdown-Bilder für Azure Upload`,
      })
    }

    // Parallele Verarbeitung: Bilder in Batches von 10 aufteilen
    const BATCH_SIZE = 10
    const PARALLEL_BATCHES = 2 // Anzahl der Batches, die gleichzeitig verarbeitet werden
    const batches: Array<Array<{ match: RegExpMatchArray; pattern: typeof imagePatterns[0] }>> = []
    for (let i = 0; i < imageReferences.length; i += BATCH_SIZE) {
      batches.push(imageReferences.slice(i, i + BATCH_SIZE))
    }

    FileLogger.info('ingestion', 'Markdown-Bilder in Batches aufgeteilt', {
      fileId,
      totalImages: imageReferences.length,
      batchCount: batches.length,
      batchSize: BATCH_SIZE,
      parallelBatches: PARALLEL_BATCHES,
    })

    // Verarbeite Batches parallel (mehrere Batches gleichzeitig)
    for (let batchStartIndex = 0; batchStartIndex < batches.length; batchStartIndex += PARALLEL_BATCHES) {
      const parallelBatches = batches.slice(batchStartIndex, batchStartIndex + PARALLEL_BATCHES)
      
      FileLogger.info('ingestion', `Verarbeite ${parallelBatches.length} Batches parallel (${batchStartIndex + 1}-${Math.min(batchStartIndex + PARALLEL_BATCHES, batches.length)}/${batches.length})`, {
        fileId,
        batchStartIndex: batchStartIndex + 1,
        batchEndIndex: Math.min(batchStartIndex + PARALLEL_BATCHES, batches.length),
        totalBatches: batches.length,
      })

      // Verarbeite mehrere Batches parallel
      const parallelBatchResults = await Promise.allSettled(
        parallelBatches.map(async (batch, relativeIndex) => {
          const batchIndex = batchStartIndex + relativeIndex

      // Verarbeite alle Bilder im Batch parallel
      const batchResults = await Promise.allSettled(
        batch.map(async ({ match, pattern }) => {
          const imagePath = pattern.extractPath(match)
          if (!imagePath) {
            return { success: false, match, pattern, imagePath, error: 'Kein Bildpfad gefunden' }
          }

          try {
            const normalizedPath = this.normalizeImagePath(imagePath)
            if (!normalizedPath.success || !normalizedPath.path) {
              return { success: false, match, pattern, imagePath, error: normalizedPath.error || 'Unbekannter Fehler' }
            }

            const { findShadowTwinImage } = await import('@/lib/storage/shadow-twin')
            const baseItem = await provider.getItemById(fileId)
            if (!baseItem) {
              const errorMsg = `Base-Item nicht gefunden: ${fileId}`
              FileLogger.error('ingestion', errorMsg, { fileId, imagePath: normalizedPath.path })
              return { success: false, match, pattern, imagePath, error: errorMsg }
            }

            const scope: 'books' | 'sessions' = isSessionMode ? 'sessions' : 'books'
            const extension = normalizedPath.path.split('.').pop()?.toLowerCase() || 'jpg'
            
            if (!containerCheck.containerName) {
              return { success: false, match, pattern, imagePath, error: 'Container-Name nicht verfügbar' }
            }

            // Performance-Optimierung: Prüfe zuerst, ob wir das Bild bereits kennen
            // (z.B. durch vorherige Verarbeitung oder Cache)
            // Wenn nicht, lade es vom Storage Provider
            let buffer: Buffer | null = null
            let hash: string | null = null
            
            // Versuche zuerst, das Bild vom Storage Provider zu laden
            // (nur wenn wir es noch nicht haben)
            try {
            const imageFile = await findShadowTwinImage(baseItem, normalizedPath.path, provider, shadowTwinFolderId)
            if (!imageFile) {
              const errorMsg = `Bild nicht gefunden: ${normalizedPath.path}`
              FileLogger.warn('ingestion', errorMsg, {
                fileId,
                imagePath: normalizedPath.path,
                shadowTwinFolderId: shadowTwinFolderId || 'none',
              })
              return { success: false, match, pattern, imagePath, error: errorMsg }
            }

            const bin = await provider.getBinary(imageFile.id)
              buffer = Buffer.from(await bin.blob.arrayBuffer())
              hash = calculateImageHash(buffer)
              
              // Prüfe Cache bevor wir Azure prüfen
              const cacheKey = this.getImageCacheKey(libraryId, scope, hash, extension)
              const cachedUrl = this.imageCache.get(cacheKey)
              if (cachedUrl) {
                FileLogger.info('ingestion', 'Bild aus Cache gefunden (vor Azure-Prüfung)', {
                  fileId,
                  hash,
                  azureUrl: cachedUrl,
                  imagePath: normalizedPath.path,
                })
                return { success: true, match, pattern, imagePath, azureUrl: cachedUrl }
              }
            } catch (loadError) {
              const errorMessage = loadError instanceof Error ? loadError.message : 'Unbekannter Fehler beim Laden'
              FileLogger.warn('ingestion', 'Fehler beim Laden des Bildes vom Storage Provider', {
                fileId,
                imagePath: normalizedPath.path,
                error: errorMessage,
              })
              return { success: false, match, pattern, imagePath, error: `Fehler beim Laden: ${errorMessage}` }
            }
            
            if (!buffer || !hash) {
              return { success: false, match, pattern, imagePath, error: 'Bild konnte nicht geladen werden' }
            }

            const azureUrl = await this.uploadImageWithDeduplication(
              azureStorage,
              containerCheck.containerName,
              libraryId,
              scope,
              fileId,
              buffer,
              extension,
              imagePath,
              jobId,
              'markdown_image'
            )

            return { success: true, match, pattern, imagePath, azureUrl }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
            FileLogger.warn('ingestion', 'Fehler beim Verarbeiten des Markdown-Bildes', {
              fileId,
              imagePath,
              error: errorMessage,
            })
            return { success: false, match, pattern, imagePath, error: errorMessage }
          }
        })
      )
        
        return { batchIndex, batchResults }
        })
      )

      // Verarbeite Ergebnisse aller parallel verarbeiteten Batches
      for (const parallelResult of parallelBatchResults) {
        if (parallelResult.status === 'fulfilled') {
          const { batchIndex, batchResults } = parallelResult.value

      // Verarbeite Batch-Ergebnisse
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const { success, match, pattern, imagePath, azureUrl, error } = result.value
          if (success && azureUrl) {
            const altText = match[1] || imagePath
            updatedMarkdown = updatedMarkdown.replace(match[0], pattern.replace(altText, azureUrl))
          } else {
            const userFriendlyError = this.formatImageError(error || 'Unbekannter Fehler', imagePath || '')
            errors.push({ imagePath: imagePath || '', error: userFriendlyError })
            if (jobId) {
              bufferLog(jobId, {
                phase: 'markdown_image_error',
                message: `Bild ${imagePath}: ${userFriendlyError}`,
              })
            }
          }
        } else {
          // Promise.allSettled garantiert, dass wir hier nie landen sollten, aber zur Sicherheit
          const errorMessage = result.reason instanceof Error ? result.reason.message : 'Unbekannter Fehler'
          FileLogger.error('ingestion', 'Unerwarteter Fehler beim Batch-Upload', {
            fileId,
            error: errorMessage,
          })
          errors.push({ imagePath: '', error: `Batch-Fehler: ${errorMessage}` })
        }
      }

      // Logge Batch-Fortschritt
      if (jobId && batchIndex < batches.length - 1) {
        const processed = (batchIndex + 1) * BATCH_SIZE
        const remaining = imageReferences.length - processed
        bufferLog(jobId, {
          phase: 'markdown_images_batch_progress',
          message: `Batch ${batchIndex + 1}/${batches.length} abgeschlossen (${processed}/${imageReferences.length} Bilder verarbeitet, ${remaining} verbleibend)`,
        })
          }
        } else {
          // Fehler beim Verarbeiten eines parallelen Batches
          const errorMessage = parallelResult.reason instanceof Error ? parallelResult.reason.message : 'Unbekannter Fehler'
          FileLogger.error('ingestion', 'Unerwarteter Fehler beim parallelen Batch-Upload', {
            fileId,
            error: errorMessage,
          })
          errors.push({ imagePath: '', error: `Paralleler Batch-Fehler: ${errorMessage}` })
        }
      }
    }

    FileLogger.info('ingestion', 'Markdown-Bilder verarbeitet', {
      fileId,
      processed: imageReferences.length - errors.length,
      errors: errors.length,
    })
    if (jobId) {
      bufferLog(jobId, {
        phase: 'markdown_images_processed',
        message: `${imageReferences.length - errors.length} Markdown-Bilder verarbeitet${errors.length > 0 ? `, ${errors.length} Fehler` : ''}`,
      })
    }

    return { markdown: updatedMarkdown, imageErrors: errors }
  }

  /**
   * Findet und lädt Cover-Bild aus Shadow-Twin-Verzeichnis.
   */
  static async processCoverImage(
    provider: StorageProvider,
    shadowTwinFolderId: string | undefined,
    libraryId: string,
    fileId: string,
    jobId?: string,
    isSessionMode: boolean = false
  ): Promise<string | null> {
    const azureStorage = await this.ensureAzureStorage(fileId, jobId)
    if (!azureStorage) {
      return null
    }

    const coverCandidates = ['preview_001.jpg']
    const baseItem = await provider.getItemById(fileId)
    if (!baseItem) {
      FileLogger.warn('ingestion', 'Base-Item nicht gefunden für Cover-Bild', { fileId })
      return null
    }

    const { findShadowTwinImage } = await import('@/lib/storage/shadow-twin')

    for (const candidate of coverCandidates) {
      try {
        const imageItem = await findShadowTwinImage(baseItem, candidate, provider, shadowTwinFolderId)
        if (!imageItem) {
          continue
        }

        const bin = await provider.getBinary(imageItem.id)
        const buffer = Buffer.from(await bin.blob.arrayBuffer())
        const scope: 'books' | 'sessions' = isSessionMode ? 'sessions' : 'books'
        const extension = candidate.split('.').pop()?.toLowerCase() || 'jpg'

        const containerCheck = await this.ensureContainer(azureStorage, fileId, jobId, 'cover_image_container_error')
        if (!containerCheck.success || !containerCheck.containerName) {
          return null
        }

        const azureUrl = await this.uploadImageWithDeduplication(
          azureStorage,
          containerCheck.containerName,
          libraryId,
          scope,
          fileId,
          buffer,
          extension,
          candidate,
          jobId,
          'cover_image'
        )

        return azureUrl
      } catch (error) {
        FileLogger.debug('ingestion', 'Fehler beim Laden des Cover-Bild-Kandidaten (Fallback)', {
          candidate,
          error: error instanceof Error ? error.message : String(error),
        })
        continue
      }
    }

    FileLogger.info('ingestion', 'Kein Cover-Bild gefunden', { fileId, shadowTwinFolderId })
    return null
  }

  /**
   * Verarbeitet Slide-Bilder und lädt sie auf Azure Storage hoch.
   */
  static async processSlideImages(
    slides: Array<Record<string, unknown>>,
    provider: StorageProvider,
    libraryId: string,
    fileId: string,
    jobId?: string
  ): Promise<SlideImageProcessingResult> {
    const azureStorage = await this.ensureAzureStorage(fileId, jobId)
    if (!azureStorage) {
      return { slides, errors: [] }
    }

    const containerCheck = await this.ensureContainer(azureStorage, fileId, jobId, 'slide_images_container_error', true)
    if (!containerCheck.success) {
      throw new Error(containerCheck.errorMessage)
    }

    const updatedSlides: Array<Record<string, unknown>> = []
    const errors: Array<{ slideIndex: number; imageUrl: string; error: string }> = []

    // Bereite Slides für Verarbeitung vor
    const slidesToProcess: Array<{ index: number; slide: Record<string, unknown>; imageUrl: string }> = []
    for (let i = 0; i < slides.length; i++) {
      const slide = { ...slides[i] }
      const imageUrl = typeof slide.image_url === 'string' ? slide.image_url : ''

      if (!imageUrl || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        updatedSlides[i] = slide
        continue
      }

      slidesToProcess.push({ index: i, slide, imageUrl })
    }

    if (slidesToProcess.length === 0) {
      return { slides: updatedSlides.length > 0 ? updatedSlides : slides, errors }
    }

    FileLogger.info('ingestion', 'Verarbeite Slide-Bilder für Azure Upload', {
      fileId,
      totalSlides: slides.length,
      slidesToProcess: slidesToProcess.length,
    })

    // Parallele Verarbeitung: Slides in Batches von 10 aufteilen
    const BATCH_SIZE = 10
    const PARALLEL_BATCHES = 2 // Anzahl der Batches, die gleichzeitig verarbeitet werden
    const batches: Array<Array<{ index: number; slide: Record<string, unknown>; imageUrl: string }>> = []
    for (let i = 0; i < slidesToProcess.length; i += BATCH_SIZE) {
      batches.push(slidesToProcess.slice(i, i + BATCH_SIZE))
    }

    FileLogger.info('ingestion', 'Slide-Bilder in Batches aufgeteilt', {
      fileId,
      totalSlides: slidesToProcess.length,
      batchCount: batches.length,
      batchSize: BATCH_SIZE,
      parallelBatches: PARALLEL_BATCHES,
    })

    // Verarbeite Batches parallel (mehrere Batches gleichzeitig)
    for (let batchStartIndex = 0; batchStartIndex < batches.length; batchStartIndex += PARALLEL_BATCHES) {
      const parallelBatches = batches.slice(batchStartIndex, batchStartIndex + PARALLEL_BATCHES)
      
      FileLogger.info('ingestion', `Verarbeite ${parallelBatches.length} Slide-Batches parallel (${batchStartIndex + 1}-${Math.min(batchStartIndex + PARALLEL_BATCHES, batches.length)}/${batches.length})`, {
        fileId,
        batchStartIndex: batchStartIndex + 1,
        batchEndIndex: Math.min(batchStartIndex + PARALLEL_BATCHES, batches.length),
        totalBatches: batches.length,
      })

      // Verarbeite mehrere Batches parallel
      const parallelBatchResults = await Promise.allSettled(
        parallelBatches.map(async (batch, relativeIndex) => {
          const batchIndex = batchStartIndex + relativeIndex

      // Verarbeite alle Slides im Batch parallel
      const batchResults = await Promise.allSettled(
        batch.map(async ({ index, slide, imageUrl }) => {
          try {
            const normalizedPath = this.normalizeImagePath(imageUrl)
                if (!normalizedPath.success || !normalizedPath.path) {
                  return { success: false, index, slide, imageUrl, error: normalizedPath.error || 'Kein Bildpfad gefunden' }
            }

            const utf8Bytes = Buffer.from(normalizedPath.path, 'utf-8')
            const fileIdForImage = utf8Bytes.toString('base64')

            const bin = await provider.getBinary(fileIdForImage)
            const buffer = Buffer.from(await bin.blob.arrayBuffer())
            const extension = normalizedPath.path.split('.').pop()?.toLowerCase() || 'jpg'

                if (!containerCheck.containerName) {
                  return { success: false, index, slide, imageUrl, error: 'Container-Name nicht verfügbar' }
                }

            const azureUrl = await this.uploadImageWithDeduplication(
              azureStorage,
              containerCheck.containerName,
              libraryId,
              'sessions',
              fileId,
              buffer,
              extension,
              imageUrl,
              jobId,
              'slide_image',
              index + 1
            )

            slide.image_url = azureUrl
            return { success: true, index, slide, imageUrl, azureUrl }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
            FileLogger.warn('ingestion', 'Fehler beim Verarbeiten des Slide-Bildes', {
              fileId,
              slideIndex: index,
              imageUrl,
              error: errorMessage,
            })
            return { success: false, index, slide, imageUrl, error: errorMessage }
          }
        })
      )
          
          return { batchIndex, batchResults }
        })
      )

      // Verarbeite Ergebnisse aller parallel verarbeiteten Batches
      for (const parallelResult of parallelBatchResults) {
        if (parallelResult.status === 'fulfilled') {
          const { batchIndex, batchResults } = parallelResult.value

      // Verarbeite Batch-Ergebnisse
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const { success, index, slide, imageUrl, error } = result.value
          if (success) {
            updatedSlides[index] = slide
          } else {
            const userFriendlyError = this.formatImageError(error || 'Unbekannter Fehler', imageUrl)
            errors.push({ slideIndex: index, imageUrl, error: userFriendlyError })
            updatedSlides[index] = slide

            if (jobId) {
              bufferLog(jobId, {
                phase: 'slide_image_error',
                message: `Bild ${index + 1}: ${userFriendlyError}`,
              })
            }
          }
        } else {
          // Promise.allSettled garantiert, dass wir hier nie landen sollten, aber zur Sicherheit
          const errorMessage = result.reason instanceof Error ? result.reason.message : 'Unbekannter Fehler'
          FileLogger.error('ingestion', 'Unerwarteter Fehler beim Slide-Batch-Upload', {
            fileId,
            error: errorMessage,
          })
          // Index nicht verfügbar, daher können wir den Slide nicht zuordnen
          errors.push({ slideIndex: -1, imageUrl: '', error: `Batch-Fehler: ${errorMessage}` })
        }
      }

      // Logge Batch-Fortschritt
      if (jobId && batchIndex < batches.length - 1) {
        const processed = (batchIndex + 1) * BATCH_SIZE
        const remaining = slidesToProcess.length - processed
        bufferLog(jobId, {
          phase: 'slide_images_batch_progress',
          message: `Slide-Batch ${batchIndex + 1}/${batches.length} abgeschlossen (${processed}/${slidesToProcess.length} Slides verarbeitet, ${remaining} verbleibend)`,
        })
          }
        } else {
          // Fehler beim Verarbeiten eines parallelen Batches
          const errorMessage = parallelResult.reason instanceof Error ? parallelResult.reason.message : 'Unbekannter Fehler'
          FileLogger.error('ingestion', 'Unerwarteter Fehler beim parallelen Slide-Batch-Upload', {
            fileId,
            error: errorMessage,
          })
          errors.push({ slideIndex: -1, imageUrl: '', error: `Paralleler Batch-Fehler: ${errorMessage}` })
        }
      }
    }

    // Stelle sicher, dass alle Slides in updatedSlides vorhanden sind (auch die, die bereits URLs hatten)
    for (let i = 0; i < slides.length; i++) {
      if (!updatedSlides[i]) {
        updatedSlides[i] = slides[i]
      }
    }

    return { slides: updatedSlides, errors }
  }

  // Private Hilfsfunktionen

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static async ensureAzureStorage(_fileId: string, _jobId?: string): Promise<AzureStorageService | null> {
    const azureConfig = getAzureStorageConfig()
    if (!azureConfig) {
      FileLogger.info('ingestion', 'Azure Storage nicht konfiguriert, überspringe Bild-Upload')
      return null
    }

    const azureStorage = new AzureStorageService()
    if (!azureStorage.isConfigured()) {
      FileLogger.warn('ingestion', 'Azure Storage Service nicht konfiguriert')
      return null
    }

    return azureStorage
  }

  private static async ensureContainer(
    azureStorage: AzureStorageService,
    fileId: string,
    jobId: string | undefined,
    phase: string,
    throwOnError: boolean = false
  ): Promise<{ success: boolean; containerName?: string; errorMessage?: string }> {
    const azureConfig = getAzureStorageConfig()
    if (!azureConfig) {
      return { success: false, errorMessage: 'Azure Storage nicht konfiguriert' }
    }

    const containerExists = await azureStorage.containerExists(azureConfig.containerName)
    if (!containerExists) {
      const errorMessage = `[Schritt: Azure Container Prüfung] Azure Storage Container '${azureConfig.containerName}' existiert nicht.${throwOnError ? ' Bitte erstellen Sie den Container im Azure Portal mit öffentlichem Blob-Zugriff.' : ''}`
      FileLogger.error('ingestion', 'Azure Container existiert nicht', {
        containerName: azureConfig.containerName,
        fileId,
      })
      if (jobId) {
        bufferLog(jobId, {
          phase,
          message: errorMessage,
        })
      }
      return { success: false, errorMessage }
    }

    return { success: true, containerName: azureConfig.containerName }
  }

  private static normalizeImagePath(imagePath: string): { success: boolean; path?: string; error?: string } {
    const normalizedPath = imagePath.replace(/^\/+|\/+$/g, '')
    if (normalizedPath.includes('..')) {
      return { success: false, error: '[Schritt: Bild-Pfad Validierung] Path traversal erkannt' }
    }
    return { success: true, path: normalizedPath }
  }

  private static async uploadImageWithDeduplication(
    azureStorage: AzureStorageService,
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    fileId: string,
    buffer: Buffer,
    extension: string,
    imagePath: string,
    jobId: string | undefined,
    phasePrefix: string,
    imageIndex?: number
  ): Promise<string> {
    const hash = calculateImageHash(buffer)
    const cacheKey = this.getImageCacheKey(libraryId, scope, hash, extension)
    
    // Performance: Prüfe zuerst den Cache
    const cachedUrl = this.imageCache.get(cacheKey)
    if (cachedUrl) {
      FileLogger.info('ingestion', 'Bild aus Cache gefunden, verwende vorhandene URL', {
        fileId,
        hash,
        azureUrl: cachedUrl,
        scope,
      })
      if (jobId) {
        bufferLog(jobId, {
          phase: `${phasePrefix}_cached`,
          message: imageIndex ? `Bild ${imageIndex}: Hash ${hash} aus Cache` : `Bild ${imagePath}: Hash ${hash} aus Cache`,
        })
      }
      return cachedUrl
    }
    
    // Prüfe Azure Storage (library-weit, nicht nur für diesen fileId)
    // Optimierung: Suche nach dem Bild in der gesamten Library, nicht nur für diesen fileId
    const existingUrl = await azureStorage.getImageUrlByHashWithScope(
      containerName,
      libraryId,
      scope,
      fileId,
      hash,
      extension
    )

    if (existingUrl) {
      // Cache die gefundene URL für zukünftige Verwendungen
      this.imageCache.set(cacheKey, existingUrl)
      FileLogger.info('ingestion', 'Bild bereits vorhanden, verwende vorhandene URL', {
        fileId,
        hash,
        azureUrl: existingUrl,
        scope,
      })
      if (jobId) {
        bufferLog(jobId, {
          phase: `${phasePrefix}_deduplicated`,
          message: imageIndex ? `Bild ${imageIndex}: Hash ${hash} bereits vorhanden` : `Bild ${imagePath}: Hash ${hash} bereits vorhanden`,
        })
      }
      return existingUrl
    }

    // Bild existiert nicht - hochladen
    const azureUrl = await azureStorage.uploadImageToScope(
      containerName,
      libraryId,
      scope,
      fileId,
      hash,
      extension,
      buffer
    )
    
    // Cache die neue URL
    this.imageCache.set(cacheKey, azureUrl)

    FileLogger.info('ingestion', 'Bild auf Azure hochgeladen', {
      fileId,
      imagePath,
      hash,
      extension,
      azureUrl,
    })
    if (jobId) {
      bufferLog(jobId, {
        phase: `${phasePrefix}_uploaded`,
        message: imageIndex ? `Bild ${imageIndex}: ${hash}.${extension} hochgeladen` : `Bild ${imagePath}: ${hash}.${extension} hochgeladen`,
      })
    }

    return azureUrl
  }

  private static formatImageError(errorMessage: string, imagePath: string): string {
    if (errorMessage.includes('not found') || errorMessage.includes('nicht gefunden')) {
      return `[Schritt: Bild-Upload] Bild nicht gefunden: ${imagePath}`
    }
    if (errorMessage.includes('does not exist')) {
      return `[Schritt: Bild-Upload] Bild-Datei existiert nicht: ${imagePath}`
    }
    if (errorMessage.includes('Upload fehlgeschlagen')) {
      return `[Schritt: Bild-Upload] Upload fehlgeschlagen für ${imagePath}: ${errorMessage.replace('Upload fehlgeschlagen: ', '')}`
    }
    return `[Schritt: Bild-Upload] ${errorMessage}`
  }
}

