/**
 * @fileoverview Shadow-Twin Migration Writer
 *
 * @description
 * Migriert alle Dateien aus dem Shadow-Twin-Ordner nach MongoDB.
 * Lädt Bilder nach Azure Storage hoch und speichert URLs in binaryFragments.
 * Scant die Dateistruktur ohne Markdown-Analyse für bessere Performance.
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { upsertShadowTwinArtifact } from '@/lib/repositories/shadow-twin-repo'
import { AzureStorageService, calculateImageHash } from '@/lib/services/azure-storage-service'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { FileLogger } from '@/lib/debug/logger'
import path from 'path'

/**
 * Bestimmt den Dateityp basierend auf Dateiname und MIME-Type
 */
function getFileKind(fileName: string, mimeType?: string): 'markdown' | 'image' | 'audio' | 'video' | 'binary' {
  const name = fileName.toLowerCase()
  const mime = (mimeType || '').toLowerCase()

  if (mime.includes('markdown') || /\.(md|mdx|txt)$/.test(name)) return 'markdown'
  if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|jpeg)$/.test(name)) return 'image'
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return 'audio'
  if (mime.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return 'video'
  return 'binary'
}

/**
 * Bestimmt MIME-Type basierend auf Dateiendung
 */
function getMimeType(fileName: string): string | undefined {
  const ext = path.extname(fileName).toLowerCase().slice(1)
  const mimeMap: Record<string, string> = {
    // Bilder
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    // Audio
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    flac: 'audio/flac',
    // Video
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    // Markdown
    md: 'text/markdown',
    mdx: 'text/markdown',
    txt: 'text/plain',
  }
  return mimeMap[ext]
}

/**
 * Sammelt alle Dateien im Shadow-Twin-Ordner rekursiv
 */
async function collectAllFilesInFolder(
  provider: StorageProvider,
  folderId: string
): Promise<StorageItem[]> {
  const files: StorageItem[] = []
  const queue: string[] = [folderId]

  while (queue.length > 0) {
    const current = queue.shift() as string
    const items = await provider.listItemsById(current)

    for (const item of items) {
      if (item.type === 'folder') {
        queue.push(item.id)
      } else if (item.type === 'file') {
        files.push(item)
      }
    }
  }

  return files
}

/**
 * Bestimmt den Scope für Azure Storage Upload basierend auf Frontmatter oder Template
 */
function determineScope(
  markdownContent: string,
  artifactKey: ArtifactKey
): 'books' | 'sessions' {
  // Prüfe Frontmatter für detailViewType
  try {
    const parsed = parseFrontmatter(markdownContent)
    if (parsed.meta?.detailViewType === 'session') {
      return 'sessions'
    }
  } catch {
    // Ignoriere Parse-Fehler
  }

  // Fallback: sessions für bestimmte Templates (z.B. event-basierte)
  // Standard: books
  return 'books'
}

/**
 * Lädt ein Bild nach Azure Storage hoch mit Deduplizierung
 */
async function uploadImageToAzure(
  azureStorage: AzureStorageService,
  containerName: string,
  libraryId: string,
  scope: 'books' | 'sessions',
  fileId: string,
  provider: StorageProvider,
  imageFile: StorageItem
): Promise<{ url: string; hash: string } | null> {
  try {
    // Lade Bild-Daten
    const { blob } = await provider.getBinary(imageFile.id)
    const buffer = Buffer.from(await blob.arrayBuffer())

    // Berechne Hash
    const hash = calculateImageHash(buffer)

    // Bestimme Extension
    const fileName = imageFile.metadata.name
    const extension = path.extname(fileName).toLowerCase().slice(1) || 'jpg'

    // Prüfe ob Bild bereits existiert
    const existingUrl = await azureStorage.getImageUrlByHashWithScope(
      containerName,
      libraryId,
      scope,
      fileId,
      hash,
      extension
    )

    if (existingUrl) {
      FileLogger.info('shadow-twin-migration', 'Bild bereits vorhanden, verwende vorhandene URL', {
        fileId,
        hash,
        azureUrl: existingUrl,
        scope,
        fileName,
      })
      return { url: existingUrl, hash }
    }

    // Upload nach Azure
    const azureUrl = await azureStorage.uploadImageToScope(
      containerName,
      libraryId,
      scope,
      fileId,
      hash,
      extension,
      buffer
    )

    FileLogger.info('shadow-twin-migration', 'Bild auf Azure hochgeladen', {
      fileId,
      fileName,
      hash,
      extension,
      azureUrl,
      scope,
    })

    return { url: azureUrl, hash }
  } catch (error) {
    FileLogger.error('shadow-twin-migration', 'Fehler beim Upload des Bildes', {
      error: error instanceof Error ? error.message : String(error),
      fileName: imageFile.metadata.name,
      fileId: imageFile.id,
    })
    return null
  }
}

/**
 * Ersetzt relative Bild-Referenzen im Markdown durch Azure-URLs
 */
function rewriteMarkdownImageUrls(
  markdown: string,
  imageUrlMap: Map<string, string>
): string {
  let updatedMarkdown = markdown

  // Pattern 1: Markdown-Bilder ![alt](path)
  updatedMarkdown = updatedMarkdown.replace(
    /!\[([^\]]*?)\]\((?!http)([^)]+)\)/g,
    (match, alt, imagePath) => {
      const azureUrl = imageUrlMap.get(imagePath)
      if (azureUrl) {
        return `![${alt}](${azureUrl})`
      }
      return match
    }
  )

  // Pattern 2: HTML img-Tags <img src="path">
  updatedMarkdown = updatedMarkdown.replace(
    /<img\s+src=["'](?!http)([^"']+)["'][^>]*>/gi,
    (match, imagePath) => {
      const azureUrl = imageUrlMap.get(imagePath)
      if (azureUrl) {
        return match.replace(imagePath, azureUrl)
      }
      return match
    }
  )

  // Pattern 3: Obsidian-Syntax <img-123.jpg>
  updatedMarkdown = updatedMarkdown.replace(
    /<img-(\d+\.(?:jpeg|jpg|png|gif|webp))>/gi,
    (match, imagePath) => {
      const azureUrl = imageUrlMap.get(imagePath)
      if (azureUrl) {
        return `<img src="${azureUrl}" alt="${imagePath}">`
      }
      return match
    }
  )

  return updatedMarkdown
}

/**
 * Migriert alle Dateien aus dem Shadow-Twin-Ordner nach MongoDB.
 * Lädt Bilder nach Azure Storage hoch und speichert URLs in binaryFragments.
 * Scant die Dateistruktur ohne Markdown-Analyse für bessere Performance.
 */
export async function persistShadowTwinFilesToMongo(args: {
  libraryId: string
  userEmail: string
  sourceItem: StorageItem
  provider: StorageProvider
  artifactKey: ArtifactKey
  shadowTwinFolderId?: string
}): Promise<{
  markdown: string
  binaryFragmentsCount: number
  markdownFiles: number
  imageFiles: number
  audioFiles: number
  videoFiles: number
  otherFiles: number
}> {
  const { libraryId, userEmail, sourceItem, provider, artifactKey, shadowTwinFolderId } = args

  // Sammle alle Dateien im Shadow-Twin-Ordner
  const allFiles: StorageItem[] = []
  if (shadowTwinFolderId) {
    const folderFiles = await collectAllFilesInFolder(provider, shadowTwinFolderId)
    allFiles.push(...folderFiles)
  }

  // Kategorisiere Dateien
  const markdownFiles: StorageItem[] = []
  const imageFiles: StorageItem[] = []
  const binaryFragments: Array<{
    name: string
    kind: 'markdown' | 'image' | 'audio' | 'video' | 'binary'
    url?: string
    hash?: string
    mimeType?: string
    size?: number
    createdAt: string
  }> = []

  let markdownContent = ''
  let markdownCount = 0
  let imageCount = 0
  let audioCount = 0
  let videoCount = 0
  let otherCount = 0

  for (const file of allFiles) {
    const fileName = file.metadata.name
    const fileKind = getFileKind(fileName, file.metadata.mimeType)
    const mimeType = file.metadata.mimeType || getMimeType(fileName)

    // Zähle Dateitypen
    switch (fileKind) {
      case 'markdown':
        markdownCount++
        markdownFiles.push(file)
        // Markdown-Dateien werden NICHT zu binaryFragments hinzugefügt,
        // da sie bereits als Artefakte in MongoDB gespeichert werden
        break
      case 'image':
        imageCount++
        imageFiles.push(file)
        // Bilder werden zu binaryFragments hinzugefügt
        binaryFragments.push({
          name: fileName,
          kind: fileKind,
          mimeType,
          size: file.metadata.size,
          createdAt: file.metadata.createdAt || new Date().toISOString(),
        })
        break
      case 'audio':
        audioCount++
        // Audio-Dateien werden zu binaryFragments hinzugefügt
        binaryFragments.push({
          name: fileName,
          kind: fileKind,
          mimeType,
          size: file.metadata.size,
          createdAt: file.metadata.createdAt || new Date().toISOString(),
        })
        break
      case 'video':
        videoCount++
        // Video-Dateien werden zu binaryFragments hinzugefügt
        binaryFragments.push({
          name: fileName,
          kind: fileKind,
          mimeType,
          size: file.metadata.size,
          createdAt: file.metadata.createdAt || new Date().toISOString(),
        })
        break
      default:
        otherCount++
        // Andere Binärdateien werden zu binaryFragments hinzugefügt
        binaryFragments.push({
          name: fileName,
          kind: fileKind,
          mimeType,
          size: file.metadata.size,
          createdAt: file.metadata.createdAt || new Date().toISOString(),
        })
        break
    }
  }

  // Lade Markdown-Inhalt (nur die erste/primäre Markdown-Datei, falls vorhanden)
  const primaryMarkdownFile = markdownFiles.find((f) => {
    const name = f.metadata.name.toLowerCase()
    const lang = artifactKey.targetLanguage.toLowerCase()
    return name.includes(`.${lang}.md`) || name.endsWith(`.${lang}.md`)
  }) || markdownFiles[0]

  if (primaryMarkdownFile) {
    try {
      const { blob } = await provider.getBinary(primaryMarkdownFile.id)
      markdownContent = await blob.text()
    } catch (error) {
      // Fehler beim Laden ignorieren, Markdown bleibt leer
      FileLogger.warn('shadow-twin-migration', 'Fehler beim Laden der Markdown-Datei', {
        error: error instanceof Error ? error.message : String(error),
        fileName: primaryMarkdownFile.metadata.name,
      })
    }
  }

  // Bestimme Scope für Azure Upload
  const scope = determineScope(markdownContent, artifactKey)

  // Initialisiere Azure Storage Service
  const azureConfig = getAzureStorageConfig()
  let azureStorage: AzureStorageService | null = null
  let containerName: string | null = null

  if (azureConfig) {
    azureStorage = new AzureStorageService()
    containerName = azureConfig.containerName
  }

  // Upload Bilder nach Azure und aktualisiere binaryFragments
  const imageUrlMap = new Map<string, string>() // Mapping: fileName -> Azure URL

  if (azureStorage && containerName && imageFiles.length > 0) {
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i]
      const fileName = imageFile.metadata.name

      // Finde entsprechendes binaryFragment
      const fragmentIndex = binaryFragments.findIndex((f) => f.name === fileName && f.kind === 'image')
      if (fragmentIndex === -1) continue

      // Upload nach Azure
      const uploadResult = await uploadImageToAzure(
        azureStorage,
        containerName,
        libraryId,
        scope,
        sourceItem.id,
        provider,
        imageFile
      )

      if (uploadResult) {
        // Aktualisiere binaryFragment mit URL und Hash
        binaryFragments[fragmentIndex] = {
          ...binaryFragments[fragmentIndex],
          url: uploadResult.url,
          hash: uploadResult.hash,
        }

        // Speichere Mapping für Markdown-URL-Rewrite
        imageUrlMap.set(fileName, uploadResult.url)
      }
    }
  }

  // Rewrite Markdown-URLs (relative Pfade → Azure-URLs)
  if (markdownContent && imageUrlMap.size > 0) {
    markdownContent = rewriteMarkdownImageUrls(markdownContent, imageUrlMap)
  }

  // Speichere in MongoDB
  await upsertShadowTwinArtifact({
    libraryId,
    userEmail,
    sourceId: sourceItem.id,
    sourceName: sourceItem.metadata.name,
    parentId: sourceItem.parentId,
    artifactKey,
    markdown: markdownContent,
    binaryFragments,
  })

  return {
    markdown: markdownContent,
    binaryFragmentsCount: binaryFragments.length,
    markdownFiles: markdownCount,
    imageFiles: imageCount,
    audioFiles: audioCount,
    videoFiles: videoCount,
    otherFiles: otherCount,
  }
}
