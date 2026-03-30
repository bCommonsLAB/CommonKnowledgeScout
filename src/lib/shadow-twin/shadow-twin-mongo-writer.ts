/**
 * @fileoverview Shadow-Twin Mongo Writer
 *
 * @description
 * Lädt Bilder nach Azure (binaryFragments.url) und persistiert Markdown so, dass im **Text**
 * relative Pfade wie `_Quelle.pdf/img-0.jpeg` stehen (Shadow-Twin-Ordner + Dateiname) — eindeutig
 * im gleichen Elternordner wie die Quelle, keine Hash-Blob-Namen. `binaryFragments.name` bleibt
 * der Basisdateiname (`img-0.jpeg`) für Mongo/Resolve; Hash-Blob ggf. als `originalName`.
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { ImageProcessor } from '@/lib/ingestion/image-processor'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { LibraryService } from '@/lib/services/library-service'
import { FileLogger } from '@/lib/debug/logger'
import { generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import path from 'path'

/** Letztes URL-Segment ohne Query (Azure-Blob-Name / Dateiname) */
function blobNameFromAbsoluteUrl(url: string): string {
  const tail = url.split('/').pop() || url
  return tail.split('?')[0] || tail
}

function inferImageMimeTypeFromFileName(fileName: string): string | undefined {
  const ext = path.extname(fileName).toLowerCase().slice(1)
  return ext ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : undefined
}

function inferHashFromHashStyleName(fileNameOrUrl: string | undefined): string | undefined {
  if (!fileNameOrUrl) return undefined
  const base = fileNameOnlyFromPathOrUrl(fileNameOrUrl).toLowerCase()
  const match = base.match(/^([a-f0-9]{12,64})\.(jpe?g|png|gif|webp)$/i)
  return match?.[1]
}

function fileNameOnlyFromPathOrUrl(raw: string): string {
  const noQuery = raw.split('?')[0] ?? raw
  const normalized = noQuery.replace(/\\/g, '/')
  const slash = normalized.lastIndexOf('/')
  return slash >= 0 ? normalized.slice(slash + 1) : normalized
}

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
        const name = blobNameFromAbsoluteUrl(url)
        results.push({ url, name })
      }
    }
  }

  return results
}

/**
 * Relativer Pfad im Vault: Shadow-Twin-Ordner der Quelle + Bilddateiname (Slashes `/`).
 * Wenn `originalPath` diesen Ordner schon enthält, wird nicht doppelt vorangestellt.
 */
export function vaultRelativeShadowTwinImagePath(sourceFileName: string, originalPath: string): string {
  const twinNorm = generateShadowTwinFolderName(sourceFileName).replace(/\\/g, '/')
  const norm = originalPath.replace(/\\/g, '/').replace(/^\.\//, '').trim()
  const base = norm.split('/').pop() || norm
  if (!base) return twinNorm

  if (norm === twinNorm || norm.startsWith(`${twinNorm}/`)) {
    return norm
  }
  return `${twinNorm}/${base}`
}

/**
 * Ersetzt Azure-Bild-URLs im Markdown durch relative Pfade (`_Quelle.pdf/img-0.jpeg`).
 * Export für Unit-Tests; ersetzt nur exakte URL-Vorkommen.
 */
export function rewriteMarkdownAzureUrlsToCanonicalFileNames(
  markdown: string,
  urlToCanonical: Array<{ absoluteUrl: string; canonicalFileName: string }>,
): string {
  if (!urlToCanonical.length) return markdown
  const ordered = [...urlToCanonical].sort((a, b) => b.absoluteUrl.length - a.absoluteUrl.length)
  let md = markdown
  for (const { absoluteUrl, canonicalFileName } of ordered) {
    if (!absoluteUrl || !canonicalFileName) continue
    if (!md.includes(absoluteUrl)) continue
    if (absoluteUrl === canonicalFileName) continue
    md = md.split(absoluteUrl).join(canonicalFileName)
  }
  return md
}

type PersistableImageBinaryFragment = {
  name: string
  originalName?: string
  kind: 'image'
  url: string
  hash?: string
  mimeType?: string
  size?: number
  createdAt: string
}

/**
 * Zentrale Normalisierung für neue Mongo-BinaryFragments.
 * Ziel: konsistente Felder statt späterer Legacy-Reparaturen.
 */
export function buildPersistableImageBinaryFragment(args: {
  canonicalName: string
  url: string
  blobStyleName?: string
  hash?: string
  mimeType?: string
  size?: number
  createdAt?: string
}): PersistableImageBinaryFragment {
  const canonicalName = fileNameOnlyFromPathOrUrl(args.canonicalName)
  const blobStyleName = args.blobStyleName
    ? fileNameOnlyFromPathOrUrl(args.blobStyleName)
    : undefined

  return {
    name: canonicalName,
    originalName: blobStyleName && blobStyleName !== canonicalName ? blobStyleName : undefined,
    kind: 'image',
    url: args.url,
    hash:
      args.hash ||
      inferHashFromHashStyleName(blobStyleName) ||
      inferHashFromHashStyleName(args.url),
    mimeType: args.mimeType || inferImageMimeTypeFromFileName(canonicalName || blobStyleName || ''),
    size: typeof args.size === 'number' ? args.size : undefined,
    createdAt: args.createdAt || new Date().toISOString(),
  }
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

  const libraryDoc = await LibraryService.getInstance().getLibraryById(libraryId)
  const libraryConfig = libraryDoc?.config

  let processedMarkdown = markdown
  let directUploadMetadata: Array<{ fileName: string; url: string; hash: string; size: number; mimeType: string }> | undefined
  let azureUnavailable = false

  // Wenn ZIP-Daten vorhanden sind, lade Bilder direkt aus dem ZIP nach Azure hoch.
  // Falls Azure nicht konfiguriert ist (z.B. Electron/Offline), wird der Upload
  // übersprungen und der Text trotzdem gespeichert.
  if (zipArchives && zipArchives.length > 0) {
    try {
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
    } catch (azureErr) {
      const msg = azureErr instanceof Error ? azureErr.message : String(azureErr)
      if (msg.includes('Azure Storage nicht konfiguriert') || msg.includes('Azure Storage Service nicht konfiguriert')) {
        azureUnavailable = true
        FileLogger.warn('shadow-twin-mongo-writer', 'Azure Storage nicht verfügbar – Bilder-Upload wird übersprungen, Text wird trotzdem gespeichert', {
          libraryId, sourceId: sourceItem.id, error: msg,
        })
      } else {
        throw azureErr
      }
    }
  } else if (!azureUnavailable) {
    // Standard-Pfad: Bilder vom Filesystem laden und nach Azure hochladen
    try {
      const processed = await ImageProcessor.processMarkdownImages(
        markdown,
        provider,
        libraryId,
        sourceItem.id,
        shadowTwinFolderId,
        jobId,
        false,
        libraryConfig
      )
      processedMarkdown = processed.markdown
    } catch (imgErr) {
      const msg = imgErr instanceof Error ? imgErr.message : String(imgErr)
      if (msg.includes('Azure Storage nicht konfiguriert') || msg.includes('Azure Storage Service nicht konfiguriert')) {
        azureUnavailable = true
        FileLogger.warn('shadow-twin-mongo-writer', 'Azure Storage nicht verfügbar – Bilder-Verarbeitung übersprungen', {
          libraryId, sourceId: sourceItem.id, error: msg,
        })
      } else {
        throw imgErr
      }
    }
  }

  // Verarbeite Markdown (URLs sollten bereits gesetzt sein, aber prüfe auf verbleibende relative Pfade).
  // Bei fehlendem Azure wird der zweite Durchlauf übersprungen.
  let processed: { markdown: string; imageErrors: Array<{ imagePath: string; error: string }>; imageMapping: Array<{ originalPath: string; azureUrl: string }> }
  if (azureUnavailable) {
    processed = { markdown: processedMarkdown, imageErrors: [], imageMapping: [] }
  } else {
    processed = await ImageProcessor.processMarkdownImages(
      processedMarkdown,
      provider,
      libraryId,
      sourceItem.id,
      shadowTwinFolderId,
      jobId,
      false,
      libraryConfig
    )
  }

  // Extrahiere Azure-URLs aus dem verarbeiteten Markdown (vor Umschreiben auf kanonische Namen)
  const imageUrls = extractImageUrls(processed.markdown)

  const sourceName = sourceItem.metadata.name

  // Azure-Blob-Name → Basisdateiname im Twin-Ordner (img-0.jpeg) für binaryFragments / Aliase
  const azureNameToOriginal = new Map<string, string>()
  const urlToCanonical: Array<{ absoluteUrl: string; canonicalFileName: string }> = []

  for (const mapping of processed.imageMapping) {
    const azureBlobName = blobNameFromAbsoluteUrl(mapping.azureUrl)
    const originalFileName = mapping.originalPath.split('/').pop() || mapping.originalPath
    if (azureBlobName && originalFileName) {
      azureNameToOriginal.set(azureBlobName.toLowerCase(), originalFileName)
      const vaultRel = vaultRelativeShadowTwinImagePath(sourceName, mapping.originalPath)
      urlToCanonical.push({ absoluteUrl: mapping.azureUrl, canonicalFileName: vaultRel })
    }
  }

  // ZIP-Direktupload: imageMapping kommt nicht aus ImageProcessor — Zuordnung URL → ZIP-Dateiname
  if (directUploadMetadata && directUploadMetadata.length > 0) {
    for (const meta of directUploadMetadata) {
      const blob = blobNameFromAbsoluteUrl(meta.url)
      const base = path.basename(meta.fileName)
      if (blob && base) {
        azureNameToOriginal.set(blob.toLowerCase(), base)
        const vaultRel = vaultRelativeShadowTwinImagePath(sourceName, meta.fileName)
        urlToCanonical.push({ absoluteUrl: meta.url, canonicalFileName: vaultRel })
      }
    }
  }

  const markdownToPersist = rewriteMarkdownAzureUrlsToCanonicalFileNames(processed.markdown, urlToCanonical)

  // Erstelle binaryFragments mit konsistenten Pflicht-/Metadatenfeldern.
  const binaryFragments: PersistableImageBinaryFragment[] = []

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
        const canonical = azureNameToOriginal.get(fileName.toLowerCase()) || fileName
        binaryFragments.push(
          buildPersistableImageBinaryFragment({
            canonicalName: canonical,
            blobStyleName: fileName,
            url: metadata.url,
            hash: metadata.hash,
            mimeType: metadata.mimeType,
            size: metadata.size,
          })
        )
      } else {
        // Fallback: verwende nur URL (sollte nicht vorkommen, wenn alle Bilder korrekt verarbeitet wurden)
        const canonical = azureNameToOriginal.get(fileName.toLowerCase()) || fileName
        binaryFragments.push(
          buildPersistableImageBinaryFragment({
            canonicalName: canonical,
            blobStyleName: fileName,
            url: imageInfo.url,
          })
        )
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
    // Hash und Size sind hier oft nicht verfügbar; wir inferieren wenigstens hash aus Hash-Blob-Namen.
    for (const imageInfo of imageUrls) {
      const blobKey = imageInfo.name.toLowerCase()
      const canonical = azureNameToOriginal.get(blobKey) || imageInfo.name

      binaryFragments.push(
        buildPersistableImageBinaryFragment({
          canonicalName: canonical,
          blobStyleName: imageInfo.name,
          url: imageInfo.url,
        })
      )
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

    // Konvertiere binaryFragments zu Service-Format, ohne Metadaten wieder zu verlieren.
    const serviceBinaryFragments = binaryFragments.map((f) => ({
      name: f.name,
      originalName: f.originalName,
      url: f.url,
      hash: f.hash,
      mimeType: f.mimeType,
      size: f.size,
      kind: f.kind,
      createdAt: f.createdAt,
    }))

    await service.upsertMarkdown({
      kind: artifactKey.kind,
      targetLanguage: artifactKey.targetLanguage,
      templateName: artifactKey.templateName,
      markdown: markdownToPersist,
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
    markdown: markdownToPersist,
    imageCount: imageUrls.length,
    imageErrorsCount: processed.imageErrors.length,
  }
}
