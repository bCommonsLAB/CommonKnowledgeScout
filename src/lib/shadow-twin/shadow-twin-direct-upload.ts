/**
 * @fileoverview Shadow-Twin Direct Upload - Direkter Upload von Bildern aus ZIP nach Azure
 *
 * @description
 * Lädt Bilder direkt aus ZIP-Archiven nach Azure Blob Storage hoch,
 * ohne Filesystem-Zwischenschritt. Setzt die URLs im Markdown.
 */

import { AzureStorageService } from '@/lib/services/azure-storage-service'
import { resolveAzureStorageConfig } from '@/lib/config/azure-storage'
import { LibraryService } from '@/lib/services/library-service'
import { calculateImageHash } from '@/lib/services/azure-storage-service'
// ImageProcessor wird für zukünftige Erweiterungen importiert
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ImageProcessor } from '@/lib/ingestion/image-processor'
import { FileLogger } from '@/lib/debug/logger'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

interface UploadImagesFromZipDirectlyArgs {
  // ZIP-Archive, die ins Azure hochgeladen werden sollen.
  // `variantHint='page-render'` markiert ZIPs, deren Inhalte komplette Seitenrenderings sind
  // (Mistral `pages_archive`). In diesem Fall wird der Dateiname auf `page_NNN.<ext>`
  // normalisiert und im Result als variant='page-render' mit pageNumber gemeldet.
  zipArchives: Array<{ base64Data: string; fileName: string; variantHint?: 'page-render' }>
  markdown: string
  libraryId: string
  sourceItemId: string
  jobId?: string
}

interface ImageMetadata {
  fileName: string
  url: string
  hash: string
  size: number
  mimeType: string
  /**
   * Optional: Variant-Klassifikation des Bildes.
   *  - 'page-render': HighRes-Seitenrendering (200 DPI) aus pages.zip - Quelle fuer Split-Pages.
   *  - 'thumbnail':   Vorschau-Seitenrendering (~360 px) aus pages.zip - fuer UI-Thumbnails.
   * Wird vom Mongo-Writer in binaryFragments uebernommen.
   */
  variant?: 'page-render' | 'thumbnail'
  /** Optional: 1-basierte Seitennummer (bei variant='page-render' oder 'thumbnail'). */
  pageNumber?: number
}

interface UploadResult {
  markdown: string
  imageCount: number
  imageErrorsCount: number
  /** Metadaten der hochgeladenen Bilder (Hash, Size, etc.) */
  imageMetadata: ImageMetadata[]
}

/**
 * Lädt Bilder direkt aus ZIP-Archiven nach Azure hoch und setzt URLs im Markdown
 */
export async function uploadImagesFromZipDirectly(
  args: UploadImagesFromZipDirectlyArgs
): Promise<UploadResult> {
  const { zipArchives, markdown, libraryId, sourceItemId, jobId } = args

  FileLogger.info('shadow-twin-direct-upload', 'Starte direkten Upload von Bildern aus ZIP nach Azure', {
    zipCount: zipArchives.length,
    sourceItemId,
  })

  if (jobId) {
    bufferLog(jobId, {
      phase: 'direct_azure_upload_start',
      message: `Starte direkten Upload von ${zipArchives.length} ZIP-Archiven nach Azure`,
    })
  }

  const libraryDoc = await LibraryService.getInstance().getLibraryById(libraryId)
  const libraryConfig = libraryDoc?.config

  const azureConfig = resolveAzureStorageConfig(libraryConfig)
  if (!azureConfig) {
    throw new Error('Azure Storage nicht konfiguriert')
  }

  const azureStorage = new AzureStorageService(libraryConfig)
  if (!azureStorage.isConfigured()) {
    throw new Error('Azure Storage Service nicht konfiguriert')
  }

  // Erstelle Container-Check (vereinfachte Version ohne ImageProcessor)
  const containerName = azureConfig.containerName
  if (!containerName) {
    throw new Error('Container-Name nicht konfiguriert')
  }
  const containerExists = await azureStorage.containerExists(containerName)
  if (!containerExists) {
    throw new Error(`Azure Container '${containerName}' existiert nicht`)
  }
  const containerCheck = { success: true as const, containerName }
  if (!containerCheck.success || !containerCheck.containerName) {
    throw new Error('Azure Container konnte nicht erstellt/geprüft werden')
  }

  const scope: 'books' | 'sessions' = 'books' // Standard-Scope für Shadow-Twins
  let updatedMarkdown = markdown
  let imageCount = 0
  let imageErrorsCount = 0
  const imageMetadata: ImageMetadata[] = []

  // Verarbeite alle ZIP-Archive
  for (const zipArchive of zipArchives) {
    try {
      // ZIP entpacken
      const JSZip = await import('jszip')
      const zip = new JSZip.default()
      const buffer = Buffer.from(zipArchive.base64Data, 'base64')
      const zipContent = await zip.loadAsync(buffer)

      FileLogger.info('shadow-twin-direct-upload', 'ZIP-Archiv geladen', {
        fileName: zipArchive.fileName,
        fileCount: Object.keys(zipContent.files).length,
      })

      // ZIP-Eintraege deterministisch sortieren - kritisch fuer den Sequential-Fallback bei
      // Page-Render-ZIPs, damit Seitennummern stabil und reproduzierbar sind.
      const zipEntries = Object.entries(zipContent.files).sort(([a], [b]) => a.localeCompare(b))

      // Sequentieller Counter fuer Page-Renderings, falls der Dateiname keine Seitennummer
      // enthaelt. Wird ausschliesslich bei `variantHint === 'page-render'` verwendet.
      let pageRenderSequence = 0

      // Verarbeite alle Bilder im ZIP
      for (const [filePath, file] of zipEntries) {
        if (file.dir) continue

        const fileExtension = filePath.split('.').pop()?.toLowerCase()
        const isImage = fileExtension === 'png' || fileExtension === 'jpg' || fileExtension === 'jpeg'

        if (!isImage) continue

        try {
          // Dateiname aus ZIP-Pfad extrahieren (Original, vor Normalisierung).
          const originalFileName = filePath.split('/').pop() || filePath

          // Page-Render- und Thumbnail-Erkennung (Hard-Rename auf neue Secretary-API).
          // Mistral liefert in pages.zip jetzt zwei orthogonale Varianten parallel:
          //  - preview_NNN.jpg  (Low-Res ~360 px, JPEG q80)  -> variant='thumbnail'
          //  - page_NNN.jpeg    (HighRes 200 DPI, JPEG q85)  -> variant='page-render'
          //
          // Strategie (zwei Stufen):
          //  1) Pattern-basiert: praefix-spezifisches Mapping auf variant + Seitennummer.
          //  2) Fallback bei `variantHint === 'page-render'`: kein Pattern, also vergeben wir
          //     Seitennummern sequenziell nach sortierter Dateiposition und behandeln den
          //     Treffer konservativ als 'page-render' (HighRes ist die Quelle der Wahrheit
          //     fuer den Split-Pages-Locator; im Notfall lieber HighRes als Thumbnail labeln).
          let fileName = originalFileName
          let pageRenderInfo: { variant: 'page-render' | 'thumbnail'; pageNumber: number } | undefined

          if (zipArchive.variantHint === 'page-render') {
            const pageMatch = originalFileName.match(
              /^(page|image|preview)[_-](\d+)\.(png|jpe?g)$/i
            )
            const ext = (pageMatch?.[3] || fileExtension || 'jpg').toLowerCase()
            const normExt = ext === 'jpg' ? 'jpeg' : ext

            let pageNumber: number
            // Praefix bestimmt die Variant: 'preview_' -> Thumbnail, sonst HighRes.
            let detectedVariant: 'page-render' | 'thumbnail' = 'page-render'

            if (pageMatch) {
              const prefix = pageMatch[1].toLowerCase()
              pageNumber = parseInt(pageMatch[2], 10)
              if (prefix === 'preview') {
                detectedVariant = 'thumbnail'
              }
            } else {
              pageRenderSequence += 1
              pageNumber = pageRenderSequence
              FileLogger.info(
                'shadow-twin-direct-upload',
                'Page-Render ohne Pattern erkannt - vergebe sequentielle Seitennummer (Default: HighRes)',
                { originalFileName, assignedPageNumber: pageNumber }
              )
            }

            // Speichername normalisieren je nach Variant, damit der Locator
            // einheitliche Namen sieht: page_NNN.<ext> fuer HighRes, preview_NNN.<ext> fuer Thumbnails.
            const namePrefix = detectedVariant === 'thumbnail' ? 'preview' : 'page'
            fileName = `${namePrefix}_${String(pageNumber).padStart(3, '0')}.${normExt}`
            pageRenderInfo = { variant: detectedVariant, pageNumber }
          }

          // Bild-Blob extrahieren
          const imageBlob = await file.async('blob')
          const imageBuffer = Buffer.from(await imageBlob.arrayBuffer())

          // Hash und Size berechnen
          const hash = calculateImageHash(imageBuffer)
          const size = imageBuffer.length
          const extension = fileExtension || 'jpg'
          const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`

          // Upload nach Azure mit Deduplication
          // Prüfe Azure Storage (library-weit, nicht nur für diesen fileId)
          const existingUrl = await azureStorage.getImageUrlByHashWithScope(
            containerCheck.containerName,
            libraryId,
            scope,
            sourceItemId,
            hash,
            extension
          )

          let azureUrl: string
          if (existingUrl) {
            azureUrl = existingUrl
            FileLogger.info('shadow-twin-direct-upload', 'Bild bereits vorhanden, verwende vorhandene URL', {
              fileName,
              hash,
              azureUrl,
            })
          } else {
            // Bild existiert nicht - hochladen
            azureUrl = await azureStorage.uploadImageToScope(
              containerCheck.containerName,
              libraryId,
              scope,
              sourceItemId,
              hash,
              extension,
              imageBuffer
            )
            FileLogger.info('shadow-twin-direct-upload', 'Bild auf Azure hochgeladen', {
              fileName,
              hash,
              azureUrl,
            })
          }

          // URL im Markdown setzen.
          // WICHTIG: Bei Page-Render-Bildern wurde der Dateiname (`fileName`) auf `page_NNN.<ext>`
          // normalisiert. Im Markdown selbst steht aber typischerweise der Original-Name aus dem ZIP
          // (z.B. `image_1.png`). Wir suchen daher gezielt nach dem Original-Namen, damit Replace
          // weiterhin funktioniert. Für nicht-page-render-Bilder ist `originalFileName === fileName`.
          const matchName = originalFileName
          const escapedMatchName = matchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          let replacedCount = 0

          // Pattern 1: Markdown image syntax: ![alt](path)
          const markdownPattern = new RegExp(`(!\\[[^\\]]*?\\]\\()(?!http)([^)]*${escapedMatchName})(\\))`, 'gi')
          updatedMarkdown = updatedMarkdown.replace(markdownPattern, (fullMatch, prefix, path, suffix) => {
            if (path.startsWith('http')) {
              return fullMatch // Bereits eine absolute URL
            }
            replacedCount++
            return `${prefix}${azureUrl}${suffix}`
          })

          // Pattern 2: HTML img tags: <img src="path">
          const htmlImgPattern = new RegExp(`(<img\\s+src=["'])(?!http)([^"']*${escapedMatchName})(["'][^>]*>)`, 'gi')
          updatedMarkdown = updatedMarkdown.replace(htmlImgPattern, (match, prefix, path, suffix) => {
            if (path.startsWith('http')) {
              return match // Bereits eine absolute URL
            }
            replacedCount++
            return `${prefix}${azureUrl}${suffix}`
          })

          // Pattern 3: Obsidian-style: <img-0.jpeg>
          const obsidianPattern = new RegExp(`(<img-)(${escapedMatchName})(>)`, 'gi')
          updatedMarkdown = updatedMarkdown.replace(obsidianPattern, (_match, _prefix, path) => {
            replacedCount++
            return `<img src="${azureUrl}" alt="${path}">`
          })
          
          if (replacedCount > 0) {
            FileLogger.info('shadow-twin-direct-upload', 'Bild-URLs im Markdown ersetzt', {
              fileName,
              replacedCount,
              azureUrl,
            })
          } else if (!pageRenderInfo) {
            // Bei Page-Render-Bildern ist es erwartet, dass sie nicht im Markdown stehen.
            // Daher loggen wir hier nur, wenn es ein normales OCR-Bild ist.
            FileLogger.warn('shadow-twin-direct-upload', 'Keine Bild-Referenzen im Markdown gefunden', {
              fileName,
              azureUrl,
            })
          }

          // Speichere Metadaten fuer spaeteren MongoDB-Upsert.
          // Bei page-render und thumbnail werden variant und pageNumber gesetzt, damit der
          // Mongo-Writer sie als binaryFragment persistiert (auch ohne Markdown-Referenz).
          imageMetadata.push({
            fileName,
            url: azureUrl,
            hash,
            size,
            mimeType,
            variant: pageRenderInfo?.variant,
            pageNumber: pageRenderInfo?.pageNumber,
          })
          
          imageCount++
          FileLogger.info('shadow-twin-direct-upload', 'Bild direkt nach Azure hochgeladen', {
            fileName,
            azureUrl,
            hash,
            size,
          })
        } catch (error) {
          imageErrorsCount++
          FileLogger.warn('shadow-twin-direct-upload', 'Fehler beim Upload eines Bildes', {
            fileName: filePath,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    } catch (error) {
      FileLogger.error('shadow-twin-direct-upload', 'Fehler beim Verarbeiten eines ZIP-Archivs', {
        fileName: zipArchive.fileName,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  FileLogger.info('shadow-twin-direct-upload', 'Direkter Upload abgeschlossen', {
    imageCount,
    imageErrorsCount,
  })

  if (jobId) {
    bufferLog(jobId, {
      phase: 'direct_azure_upload_completed',
      message: `Direkter Upload abgeschlossen: ${imageCount} Bilder hochgeladen, ${imageErrorsCount} Fehler`,
      imageCount,
      imageErrorsCount,
    })
  }

  return {
    markdown: updatedMarkdown,
    imageCount,
    imageErrorsCount,
    imageMetadata,
  }
}
