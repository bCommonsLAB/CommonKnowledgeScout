/**
 * @fileoverview Shadow-Twin Direct Upload - Direkter Upload von Bildern aus ZIP nach Azure
 *
 * @description
 * Lädt Bilder direkt aus ZIP-Archiven nach Azure Blob Storage hoch,
 * ohne Filesystem-Zwischenschritt. Setzt die URLs im Markdown.
 */

import { AzureStorageService } from '@/lib/services/azure-storage-service'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'
import { calculateImageHash } from '@/lib/services/azure-storage-service'
// ImageProcessor wird für zukünftige Erweiterungen importiert
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ImageProcessor } from '@/lib/ingestion/image-processor'
import { FileLogger } from '@/lib/debug/logger'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

interface UploadImagesFromZipDirectlyArgs {
  zipArchives: Array<{ base64Data: string; fileName: string }>
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

  const azureConfig = getAzureStorageConfig()
  if (!azureConfig) {
    throw new Error('Azure Storage nicht konfiguriert')
  }

  const azureStorage = new AzureStorageService()
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

      // Verarbeite alle Bilder im ZIP
      for (const [filePath, file] of Object.entries(zipContent.files)) {
        if (file.dir) continue

        const fileExtension = filePath.split('.').pop()?.toLowerCase()
        const isImage = fileExtension === 'png' || fileExtension === 'jpg' || fileExtension === 'jpeg'

        if (!isImage) continue

        try {
          // Dateiname aus ZIP-Pfad extrahieren
          const fileName = filePath.split('/').pop() || filePath
          
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

          // URL im Markdown setzen
          // Suche nach relativen Pfaden zu diesem Bild (ähnlich wie ImageProcessor)
          let replacedCount = 0
          
          // Pattern 1: Markdown image syntax: ![alt](path)
          const markdownPattern = new RegExp(`(!\\[[^\\]]*?\\]\\()(?!http)([^)]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(\\))`, 'gi')
          updatedMarkdown = updatedMarkdown.replace(markdownPattern, (fullMatch, prefix, path, suffix) => {
            if (path.startsWith('http')) {
              return fullMatch // Bereits eine absolute URL
            }
            replacedCount++
            return `${prefix}${azureUrl}${suffix}`
          })
          
          // Pattern 2: HTML img tags: <img src="path">
          const htmlImgPattern = new RegExp(`(<img\\s+src=["'])(?!http)([^"']*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(["'][^>]*>)`, 'gi')
          updatedMarkdown = updatedMarkdown.replace(htmlImgPattern, (match, prefix, path, suffix) => {
            if (path.startsWith('http')) {
              return match // Bereits eine absolute URL
            }
            replacedCount++
            return `${prefix}${azureUrl}${suffix}`
          })
          
          // Pattern 3: Obsidian-style: <img-0.jpeg>
          const obsidianPattern = new RegExp(`(<img-)(${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(>)`, 'gi')
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
          } else {
            FileLogger.warn('shadow-twin-direct-upload', 'Keine Bild-Referenzen im Markdown gefunden', {
              fileName,
              azureUrl,
            })
          }

          // Speichere Metadaten für späteren MongoDB-Upsert
          imageMetadata.push({
            fileName,
            url: azureUrl,
            hash,
            size,
            mimeType,
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
