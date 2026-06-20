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
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { upsertShadowTwinArtifact, getShadowTwinBinaryFragments } from '@/lib/repositories/shadow-twin-repo'
import { AzureStorageService, calculateImageHash } from '@/lib/services/azure-storage-service'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { FileLogger } from '@/lib/debug/logger'
import { getFileKind, getMimeTypeFromFileName } from '@/lib/shadow-twin/file-kind'
import path from 'path'

// Welle 2, Schritt 4: pure Helper `getFileKind` und `getMimeTypeFromFileName`
// wurden nach `src/lib/shadow-twin/file-kind.ts` extrahiert. Lokaler Alias
// fuer Aufrufer im File belassen, damit die Diff-Groesse klein bleibt.
const getMimeType = getMimeTypeFromFileName

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
 * Bestimmt den Scope für Azure Storage Upload basierend auf Frontmatter.
 * Hinweis: Der Scope haengt am Inhalt (detailViewType), nicht am ArtifactKey.
 */
function determineScope(
  markdownContent: string
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
 * Erkennt anhand des Dateinamens, ob eine Datei eine PDF-Seitenrenderung ist
 * (Standard-Naming aus ImageExtractionService.saveZipArchive: page_001.png).
 * Liefert die 1-basierte Seitennummer oder null.
 */
function detectPageRenderNumber(fileName: string): number | null {
  const m = fileName.match(/^page[_-](\d+)\.(png|jpe?g)$/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Fuehrt asynchrone Tasks mit begrenzter Nebenlaeufigkeit aus (Variante 3).
 * Vermeidet, dass alle WebDAV-/Azure-Calls gleichzeitig starten, haelt aber
 * mehrere Verbindungen parallel offen -> deutlich schneller als rein sequenziell.
 */
async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number
): Promise<void> {
  const size = Math.max(1, Math.min(limit, tasks.length))
  let cursor = 0
  const workers: Array<Promise<void>> = []
  for (let i = 0; i < size; i++) {
    workers.push(
      (async () => {
        while (cursor < tasks.length) {
          const index = cursor++
          await tasks[index]()
        }
      })()
    )
  }
  await Promise.all(workers)
}

/** Ein binaryFragment, wie es die Migration aufbaut (vor dem Schreiben nach Mongo). */
interface MigrationBinaryFragment {
  name: string
  kind: 'markdown' | 'image' | 'audio' | 'video' | 'binary'
  url?: string
  hash?: string
  mimeType?: string
  size?: number
  createdAt: string
  // Markierungen, die der Locator (page-images-locator.ts) fuer "PDF-Seiten als Bilder"
  // benoetigt. Bei Filesystem-Migration heuristisch aus dem Dateinamen abgeleitet.
  variant?: 'original' | 'thumbnail' | 'preview' | 'page-render'
  pageNumber?: number
}

/**
 * Ergebnis von `prepareSourceArtifacts`: alle pro Quelle EINMALIG ermittelten Daten,
 * die anschliessend von ALLEN Artefakten dieser Quelle gemeinsam genutzt werden.
 */
export interface PreparedSource {
  /** Gemeinsame binaryFragments (Bilder bereits mit Azure-URL/Hash). */
  binaryFragments: MigrationBinaryFragment[]
  /** Mapping Dateiname -> Azure-URL fuer den Markdown-Rewrite. */
  imageUrlMap: Map<string, string>
  /** Alle Markdown-Inhalte des Twin-Ordners (Dateiname -> Inhalt), einmal geladen. */
  markdownByName: Map<string, string>
  counts: {
    markdownFiles: number
    imageFiles: number
    audioFiles: number
    videoFiles: number
    otherFiles: number
  }
}

/**
 * Variante 1+2+3: Verarbeitet einen Quell-Twin-Ordner GENAU EINMAL.
 *
 * - kategorisiert alle Dateien und baut die binaryFragments auf,
 * - laedt alle Markdown-Inhalte einmal (statt pro Artefakt),
 * - laedt Bilder nach Azure (mit Dedup),
 * - V2: ueberspringt Bilder, die in Mongo bereits eine Azure-URL haben
 *   (kein WebDAV-Download, keine Azure-Pruefung -> idempotente, guenstige Re-Runs),
 * - V3: verarbeitet Bilder mit begrenzter Nebenlaeufigkeit.
 *
 * Das Ergebnis wird von `upsertArtifactFromPrepared` pro Artefakt wiederverwendet.
 */
export async function prepareSourceArtifacts(args: {
  libraryId: string
  userEmail: string
  sourceItem: StorageItem
  provider: StorageProvider
  shadowTwinFolderId?: string
  /** Max. parallele Bild-Operationen (WebDAV/Azure). Default 6. */
  concurrency?: number
}): Promise<PreparedSource> {
  const { libraryId, sourceItem, provider, shadowTwinFolderId, concurrency = 6 } = args

  const counts = { markdownFiles: 0, imageFiles: 0, audioFiles: 0, videoFiles: 0, otherFiles: 0 }
  const binaryFragments: MigrationBinaryFragment[] = []
  const markdownFiles: StorageItem[] = []
  const imageFiles: StorageItem[] = []

  // Sammle alle Dateien im Shadow-Twin-Ordner (einmal pro Quelle)
  const allFiles = shadowTwinFolderId
    ? await collectAllFilesInFolder(provider, shadowTwinFolderId)
    : []

  for (const file of allFiles) {
    const fileName = file.metadata.name
    const fileKind = getFileKind(fileName, file.metadata.mimeType)
    const mimeType = file.metadata.mimeType || getMimeType(fileName)
    const createdAt = file.metadata.modifiedAt?.toISOString() || new Date().toISOString()

    switch (fileKind) {
      case 'markdown':
        // Markdown wird als eigenes Artefakt gespeichert, nicht als binaryFragment.
        counts.markdownFiles++
        markdownFiles.push(file)
        break
      case 'image': {
        counts.imageFiles++
        imageFiles.push(file)
        const pageNumber = detectPageRenderNumber(fileName)
        binaryFragments.push({
          name: fileName,
          kind: fileKind,
          mimeType,
          size: file.metadata.size,
          createdAt,
          variant: pageNumber != null ? 'page-render' : undefined,
          pageNumber: pageNumber ?? undefined,
        })
        break
      }
      case 'audio':
        counts.audioFiles++
        binaryFragments.push({ name: fileName, kind: fileKind, mimeType, size: file.metadata.size, createdAt })
        break
      case 'video':
        counts.videoFiles++
        binaryFragments.push({ name: fileName, kind: fileKind, mimeType, size: file.metadata.size, createdAt })
        break
      default:
        counts.otherFiles++
        binaryFragments.push({ name: fileName, kind: fileKind, mimeType, size: file.metadata.size, createdAt })
        break
    }
  }

  // Markdown-Inhalte EINMAL pro Quelle laden (Dateiname -> Inhalt)
  const markdownByName = new Map<string, string>()
  for (const md of markdownFiles) {
    try {
      const { blob } = await provider.getBinary(md.id)
      markdownByName.set(md.metadata.name, await blob.text())
    } catch (error) {
      FileLogger.warn('shadow-twin-migration', 'Fehler beim Laden der Markdown-Datei', {
        error: error instanceof Error ? error.message : String(error),
        fileName: md.metadata.name,
      })
    }
  }

  // Scope EINMAL pro Quelle bestimmen: 'sessions', sobald ein Markdown detailViewType=session hat.
  // (Bilder einer Quelle teilen sich Scope + Azure-Ordner; ein Scope pro Quelle ist konsistent.)
  let scope: 'books' | 'sessions' = 'books'
  for (const content of markdownByName.values()) {
    if (determineScope(content) === 'sessions') {
      scope = 'sessions'
      break
    }
  }

  // Azure-Service initialisieren
  const azureConfig = getAzureStorageConfig()
  const azureStorage = azureConfig ? new AzureStorageService() : null
  const containerName = azureConfig?.containerName ?? null

  const imageUrlMap = new Map<string, string>()

  if (azureStorage && containerName && imageFiles.length > 0) {
    // V2: Bereits in Mongo registrierte Bilder (mit Azure-URL) vorab laden.
    const existingFragments = await getShadowTwinBinaryFragments(libraryId, sourceItem.id)
    const existingByName = new Map<string, { url: string; hash?: string }>()
    if (existingFragments) {
      for (const fragment of existingFragments) {
        if (fragment.kind === 'image' && fragment.url) {
          existingByName.set(fragment.name, { url: fragment.url, hash: fragment.hash })
        }
      }
    }

    // V3: Bild-Tasks mit begrenzter Nebenlaeufigkeit ausfuehren.
    const tasks = imageFiles.map((imageFile) => async () => {
      const fileName = imageFile.metadata.name
      const fragmentIndex = binaryFragments.findIndex((f) => f.name === fileName && f.kind === 'image')
      if (fragmentIndex === -1) return

      // V2-Skip: schon migriert -> kein erneuter WebDAV-Download/Azure-Check.
      const known = existingByName.get(fileName)
      if (known) {
        binaryFragments[fragmentIndex] = { ...binaryFragments[fragmentIndex], url: known.url, hash: known.hash }
        imageUrlMap.set(fileName, known.url)
        return
      }

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
        binaryFragments[fragmentIndex] = { ...binaryFragments[fragmentIndex], url: uploadResult.url, hash: uploadResult.hash }
        imageUrlMap.set(fileName, uploadResult.url)
      }
    })

    await runWithConcurrency(tasks, concurrency)
  }

  return { binaryFragments, imageUrlMap, markdownByName, counts }
}

/**
 * Upsertet EIN Artefakt (Markdown) anhand der bereits pro Quelle vorbereiteten Daten.
 * Bilder sind bereits in `prepared` enthalten und werden NICHT erneut verarbeitet.
 */
export async function upsertArtifactFromPrepared(args: {
  libraryId: string
  userEmail: string
  sourceItem: StorageItem
  artifactKey: ArtifactKey
  prepared: PreparedSource
}): Promise<{ imageFiles: number }> {
  const { libraryId, userEmail, sourceItem, artifactKey, prepared } = args

  // Exakten Dateinamen ueber buildArtifactName konstruieren (verhindert Verwechslung
  // zwischen Transcript "...de.md" und Transformation "...template.de.md").
  const expectedFileName = buildArtifactName(artifactKey, sourceItem.metadata.name)
  let markdownContent = prepared.markdownByName.get(expectedFileName)
  if (markdownContent === undefined) {
    // Case-insensitiver Fallback (OneDrive normalisiert ggf. Gross-/Kleinschreibung)
    const lower = expectedFileName.toLowerCase()
    for (const [name, content] of prepared.markdownByName) {
      if (name.toLowerCase() === lower) {
        markdownContent = content
        break
      }
    }
  }
  markdownContent = markdownContent ?? ''

  // Relative Bild-Pfade -> Azure-URLs
  if (markdownContent && prepared.imageUrlMap.size > 0) {
    markdownContent = rewriteMarkdownImageUrls(markdownContent, prepared.imageUrlMap)
  }

  await upsertShadowTwinArtifact({
    libraryId,
    userEmail,
    sourceId: sourceItem.id,
    sourceName: sourceItem.metadata.name,
    parentId: sourceItem.parentId,
    artifactKey,
    markdown: markdownContent,
    binaryFragments: prepared.binaryFragments as unknown as Array<Record<string, unknown>>,
  })

  return { imageFiles: prepared.counts.imageFiles }
}
