/**
 * @fileoverview Shadow-Twin Mongo Writer
 *
 * @description
 * Speichert Shadow-Twin-Markdown in MongoDB und normalisiert Bild-URLs (Azure).
 * Lädt Bilder erneut, um Hash und Size zu berechnen (für binaryFragments).
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { ImageProcessor } from '@/lib/ingestion/image-processor'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { LibraryService } from '@/lib/services/library-service'
import { FileLogger } from '@/lib/debug/logger'
import path from 'path'

function extractImageUrls(markdown: string): Array<{ url: string; name: string; originalPath?: string }> {
  const results: Array<{ url: string; name: string; originalPath?: string }> = []
  const patterns = [
    {
      regex: /!\[[^\]]*?\]\((https?:\/\/[^)]+)\)/gi,
      extractUrl: (match: RegExpMatchArray) => match[1],
    },
    {
      regex: /<img\s+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi,
      extractUrl: (match: RegExpMatchArray) => match[1],
    },
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.regex.exec(markdown)) !== null) {
      const url = pattern.extractUrl(match)
      if (url) {
        const name = url.split('/').pop() || url
        results.push({ url, name })
      }
    }
  }

  return results
}


export async function persistShadowTwinToMongo(args: {
  libraryId: string
  userEmail: string
  sourceItem: StorageItem
  provider: StorageProvider
  artifactKey: ArtifactKey
  markdown: string
  shadowTwinFolderId?: string
  /** Optional: ZIP-Daten für direkten Upload nach Azure (ohne Filesystem) */
  zipArchives?: Array<{ base64Data: string; fileName: string }>
  /** Optional: Job-ID für Logging */
  jobId?: string
}): Promise<{ markdown: string; imageCount: number; imageErrorsCount: number }> {
  const { libraryId, userEmail, sourceItem, provider, artifactKey, markdown, shadowTwinFolderId, zipArchives, jobId } = args

  let processedMarkdown = markdown
  let directUploadMetadata: Array<{ fileName: string; url: string; hash: string; size: number; mimeType: string }> | undefined

  // Wenn ZIP-Daten vorhanden sind, lade Bilder direkt aus dem ZIP nach Azure hoch
  if (zipArchives && zipArchives.length > 0) {
    const { uploadImagesFromZipDirectly } = await import('./shadow-twin-direct-upload')
    const uploadResult = await uploadImagesFromZipDirectly({
      zipArchives,
      markdown,
      libraryId,
      sourceItemId: sourceItem.id,
      jobId,
    })
    processedMarkdown = uploadResult.markdown
    directUploadMetadata = uploadResult.imageMetadata
  } else {
    // Standard-Pfad: Bilder vom Filesystem laden und nach Azure hochladen
    const processed = await ImageProcessor.processMarkdownImages(
      markdown,
      provider,
      libraryId,
      sourceItem.id,
      shadowTwinFolderId
    )
    processedMarkdown = processed.markdown
  }

  // Verarbeite Markdown (URLs sollten bereits gesetzt sein, aber prüfe auf verbleibende relative Pfade)
  const processed = await ImageProcessor.processMarkdownImages(
    processedMarkdown,
    provider,
    libraryId,
    sourceItem.id,
    shadowTwinFolderId
  )

  // Extrahiere Azure-URLs aus dem verarbeiteten Markdown
  const imageUrls = extractImageUrls(processed.markdown)
  
  // Baue Reverse-Mapping: Azure-Blob-Name → Original-Dateiname (z.B. "hash.jpeg" → "img-0.jpeg")
  // Wird verwendet, um bei der Auflösung auch über den originalen Frontmatter-Wert zu matchen
  const azureNameToOriginal = new Map<string, string>()
  for (const mapping of processed.imageMapping) {
    const azureBlobName = mapping.azureUrl.split('/').pop() || ''
    const originalFileName = mapping.originalPath.split('/').pop() || mapping.originalPath
    if (azureBlobName && originalFileName) {
      azureNameToOriginal.set(azureBlobName.toLowerCase(), originalFileName)
    }
  }

  // Erstelle binaryFragments mit Hash und Size
  const binaryFragments: Array<{
    name: string
    originalName?: string
    kind: 'image'
    url?: string
    hash?: string
    mimeType?: string
    size?: number
    createdAt: string
  }> = []

  // Wenn direkter Upload verwendet wurde, verwende die Metadaten direkt
  if (directUploadMetadata && directUploadMetadata.length > 0) {
    // Erstelle Map für schnellen Zugriff: URL -> metadata
    // WICHTIG: Mappe über URL, da extractImageUrls den Dateinamen aus der URL extrahiert
    const metadataMap = new Map<string, typeof directUploadMetadata[0]>()
    for (const meta of directUploadMetadata) {
      metadataMap.set(meta.url, meta)
    }
    
    // Verwende Metadaten aus direktem Upload
    for (const imageInfo of imageUrls) {
      const fileName = imageInfo.name
      const metadata = metadataMap.get(imageInfo.url)
      
      if (metadata) {
        binaryFragments.push({
          name: fileName,
          originalName: azureNameToOriginal.get(fileName.toLowerCase()),
          kind: 'image',
          url: metadata.url,
          hash: metadata.hash,
          mimeType: metadata.mimeType,
          size: metadata.size,
          createdAt: new Date().toISOString(),
        })
      } else {
        // Fallback: verwende nur URL (sollte nicht vorkommen, wenn alle Bilder korrekt verarbeitet wurden)
        const ext = path.extname(fileName).toLowerCase().slice(1)
        const mimeType = ext ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : undefined
        binaryFragments.push({
          name: fileName,
          originalName: azureNameToOriginal.get(fileName.toLowerCase()),
          kind: 'image',
          url: imageInfo.url,
          mimeType,
          createdAt: new Date().toISOString(),
        })
        FileLogger.warn('shadow-twin-mongo-writer', 'Bild-Metadaten nicht gefunden (direkter Upload)', {
          fileName,
          url: imageInfo.url,
          sourceId: sourceItem.id,
          availableUrls: Array.from(metadataMap.keys()),
        })
      }
    }
  } else {
    // Standard-Pfad: Bilder wurden bereits von ImageProcessor hochgeladen
    // Hash und Size sind optional - nur speichern, wenn bereits verfügbar (z.B. aus file.metadata.size)
    // Wir laden die Bilder NICHT erneut, um Zeit zu sparen
    for (const imageInfo of imageUrls) {
      const ext = path.extname(imageInfo.name).toLowerCase().slice(1)
      const mimeType = ext ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : undefined
      
      binaryFragments.push({
        name: imageInfo.name,
        originalName: azureNameToOriginal.get(imageInfo.name.toLowerCase()),
        kind: 'image',
        url: imageInfo.url,
        mimeType,
        createdAt: new Date().toISOString(),
      })
    }
  }

  // Verwende ShadowTwinService für zentrale Store-Entscheidung
  try {
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      throw new Error(`Library nicht gefunden: ${libraryId}`)
    }

    const { getShadowTwinConfig } = await import('@/lib/shadow-twin/shadow-twin-config')
    const cfg = getShadowTwinConfig(library)
    // Wenn persistToFilesystem und shadowTwinFolderId fehlt: Ordner finden oder erstellen
    let effectiveShadowTwinFolderId = shadowTwinFolderId
    if (cfg.persistToFilesystem && cfg.primaryStore === 'mongo' && !effectiveShadowTwinFolderId) {
      const { findShadowTwinFolder, generateShadowTwinFolderName } = await import('@/lib/storage/shadow-twin')
      const found = await findShadowTwinFolder(sourceItem.parentId, sourceItem.metadata.name, provider)
      if (found) {
        effectiveShadowTwinFolderId = found.id
      } else {
        const folderName = generateShadowTwinFolderName(sourceItem.metadata.name)
        const created = await provider.createFolder(sourceItem.parentId, folderName)
        effectiveShadowTwinFolderId = created.id
      }
    }

    const service = new ShadowTwinService({
      library,
      userEmail,
      sourceId: sourceItem.id,
      sourceName: sourceItem.metadata.name,
      parentId: sourceItem.parentId,
      provider,
    })

    // Konvertiere binaryFragments zu Service-Format (inkl. originalName für Frontmatter-Auflösung)
    const serviceBinaryFragments = binaryFragments.map((f) => ({
      name: f.name,
      originalName: f.originalName,
      url: f.url,
      hash: f.hash,
      mimeType: f.mimeType,
      size: f.size,
    }))

    await service.upsertMarkdown({
      kind: artifactKey.kind,
      targetLanguage: artifactKey.targetLanguage,
      templateName: artifactKey.templateName,
      markdown: processed.markdown,
      binaryFragments: serviceBinaryFragments,
      shadowTwinFolderId: effectiveShadowTwinFolderId,
    })
  } catch (error) {
    FileLogger.error('shadow-twin-mongo-writer', 'Fehler beim Speichern über ShadowTwinService', {
      libraryId,
      sourceId: sourceItem.id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  return {
    markdown: processed.markdown,
    imageCount: imageUrls.length,
    imageErrorsCount: processed.imageErrors.length,
  }
}
