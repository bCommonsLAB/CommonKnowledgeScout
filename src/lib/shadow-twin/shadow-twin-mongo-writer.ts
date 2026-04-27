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
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { LibraryService } from '@/lib/services/library-service'
import { FileLogger } from '@/lib/debug/logger'
import { generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import { persistOcrImages, freezeMarkdownImageUrls } from '@/lib/shadow-twin/media-persistence-service'
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
  // Optional: Markierung als Seitenrendering (variant='page-render') und 1-basierte
  // Seitennummer. Genutzt vom Locator (page-images-locator.ts) im Mongo-only-Modus.
  variant?: 'original' | 'thumbnail' | 'preview' | 'page-render'
  pageNumber?: number
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
  // Optional: zusätzliche Markierungen für Page-Render-Fragmente.
  variant?: 'original' | 'thumbnail' | 'preview' | 'page-render'
  pageNumber?: number
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
    variant: args.variant,
    pageNumber: args.pageNumber,
  }
}


/**
 * Diagnose-Felder, die `persistShadowTwinToMongo` zurueckgibt, damit der Aufrufer
 * (extract-only.ts) sie ins Trace schreiben kann. Ziel: ohne in den Innereien
 * herumzulesen klar sehen, welcher Pfad lief und warum 0 Bilder rauskamen.
 */
export interface PersistShadowTwinDiagnostics {
  /** Strategie-Modus (azure-only | azure-with-fs-backup | filesystem-only | unavailable). */
  strategyMode: string
  /** Aus der Strategie abgeleitet: schreiben wir nach Azure? */
  writeToAzure: boolean
  /** Aus der Strategie abgeleitet: schreiben wir auch ins Filesystem? */
  writeToFilesystem: boolean
  /** Anzahl ZIP-Archive, die hereinkamen (vor Verarbeitung). */
  zipArchivesPassed: number
  /** Lief der schnelle ZIP -> Azure-Direktupload? */
  ranDirectUpload: boolean
  /** Lief der ImageProcessor (Filesystem-Pfad/Backup)? */
  ranImageProcessor: boolean
  /** Anzahl Bilder aus dem Direktupload (== `mediaResult.imageMetadata.length`). */
  directUploadCount: number
  /** Anzahl im Markdown gefundener absoluter Bild-URLs nach der Bild-Verarbeitung. */
  imageUrlsInMarkdown: number
  /** Anzahl finaler binaryFragments, die wir in Mongo schreiben. */
  binaryFragmentsCount: number
  /** Wie viele relative Bildpfade hat das Freeze ersetzt? (nur azure-Pfad) */
  freezeReplacedCount: number
  /** Wie viele blieben unaufgeloest? (nur azure-Pfad) */
  freezeUnresolvedCount: number
  /** Beispiele unaufgeloester Pfade (max. 5). */
  freezeUnresolvedSample: string[]
}

export async function persistShadowTwinToMongo(args: {
  libraryId: string
  userEmail: string
  sourceItem: StorageItem
  provider: StorageProvider
  artifactKey: ArtifactKey
  markdown: string
  shadowTwinFolderId?: string
  /**
   * Optional: ZIP-Daten für direkten Upload nach Azure (ohne Filesystem).
   * `variantHint='page-render'` markiert das Mistral-Pages-Archiv (Seitenrenderings),
   * dessen Inhalte unabhängig von Markdown-Referenzen als binaryFragments gespeichert werden.
   */
  zipArchives?: Array<{ base64Data: string; fileName: string; variantHint?: 'page-render' }>
  /** Optional: Job-ID für Logging */
  jobId?: string
}): Promise<{
  markdown: string
  imageCount: number
  imageErrorsCount: number
  diagnostics: PersistShadowTwinDiagnostics
}> {
  const { libraryId, userEmail, sourceItem, provider, artifactKey, markdown, shadowTwinFolderId, zipArchives, jobId } = args

  // Bild-Persistenz ist seit Phase 2 vollstaendig in `persistOcrImages` zentralisiert.
  // Die Funktion entscheidet auf Basis der `MediaStorageStrategy` (azure-only, azure-with-fs-backup,
  // filesystem-only, unavailable) deterministisch ueber Schreibziele und Fallbacks; insbesondere
  // entfaellt der frueher unconditional zweite ImageProcessor-Lauf, der den Log-Spam verursacht hat.
  const mediaResult = await persistOcrImages({
    libraryId,
    sourceItemId: sourceItem.id,
    markdown,
    provider,
    shadowTwinFolderId,
    zipArchives,
    jobId,
  })

  const directUploadMetadata = mediaResult.imageMetadata.length > 0 ? mediaResult.imageMetadata : undefined
  const processed = {
    markdown: mediaResult.markdown,
    imageErrors: mediaResult.imageErrors,
    imageMapping: mediaResult.imageMapping,
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

  // Erstelle binaryFragments mit konsistenten Pflicht-/Metadatenfeldern.
  // (Wird unten von der Phase-3-Freeze-Logik konsumiert, daher VOR dem Markdown-Persist-Schritt.)
  const binaryFragments: PersistableImageBinaryFragment[] = []

  // Wenn direkter Upload verwendet wurde, verwende die Metadaten direkt
  if (directUploadMetadata && directUploadMetadata.length > 0) {
    // Erstelle Map für schnellen Zugriff: URL -> metadata
    // WICHTIG: Mappe über URL, da extractImageUrls den Dateinamen aus der URL extrahiert
    const metadataMap = new Map<string, typeof directUploadMetadata[0]>()
    for (const meta of directUploadMetadata) {
      metadataMap.set(meta.url, meta)
    }

    // 1) Bilder, die im Markdown referenziert sind (Standard-Fall: img-N.jpeg von Mistral OCR).
    //    Set sammelt URLs, die wir bereits als binaryFragment aufgenommen haben - damit wir im
    //    zweiten Schritt (Page-Renders) keine Duplikate produzieren.
    const persistedUrls = new Set<string>()
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
            // Im Normalfall sind die im Markdown referenzierten Bilder OCR-Bilder ohne variant-Hint.
            // Sollte ein Page-Render trotzdem im Markdown stehen, geben wir den Hint trotzdem mit.
            variant: metadata.variant,
            pageNumber: metadata.pageNumber,
          })
        )
        persistedUrls.add(metadata.url)
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
        persistedUrls.add(imageInfo.url)
        FileLogger.warn('shadow-twin-mongo-writer', 'Bild-Metadaten nicht gefunden (direkter Upload)', {
          fileName,
          url: imageInfo.url,
          sourceId: sourceItem.id,
          availableUrls: Array.from(metadataMap.keys()),
        })
      }
    }

    // 2) Seiten-Renderings (HighRes + Thumbnails), die NICHT im Markdown stehen.
    //    Mistral schreibt typischerweise nur OCR-Bilder ins Markdown. Damit Folgefunktionen
    //    (z.B. split-pages-to-images, UI-Thumbnails) die Bilder im Mongo-only-Modus finden,
    //    persistieren wir hier sowohl variant='page-render' (HighRes 200 DPI) als auch
    //    variant='thumbnail' (Vorschau ~360 px) ausdruecklich als binaryFragments.
    let pageRenderFragmentsAdded = 0
    let thumbnailFragmentsAdded = 0
    for (const meta of directUploadMetadata) {
      if (meta.variant !== 'page-render' && meta.variant !== 'thumbnail') continue
      if (persistedUrls.has(meta.url)) continue // war ja im Markdown referenziert -> bereits drin
      binaryFragments.push(
        buildPersistableImageBinaryFragment({
          canonicalName: meta.fileName,    // bereits normalisiert (page_NNN.<ext> bzw. preview_NNN.<ext>)
          blobStyleName: meta.fileName,
          url: meta.url,
          hash: meta.hash,
          mimeType: meta.mimeType,
          size: meta.size,
          variant: meta.variant,
          pageNumber: meta.pageNumber,
        })
      )
      persistedUrls.add(meta.url)
      if (meta.variant === 'page-render') pageRenderFragmentsAdded++
      else thumbnailFragmentsAdded++
    }
    if (pageRenderFragmentsAdded > 0 || thumbnailFragmentsAdded > 0) {
      FileLogger.info('shadow-twin-mongo-writer', 'Page-Renderings zusaetzlich persistiert', {
        sourceId: sourceItem.id,
        pageRenderFragmentsAdded,
        thumbnailFragmentsAdded,
      })
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

  // Phase 3: Markdown deterministisch einfrieren.
  // - Im Azure-Modus (writeToAzure=true) bleiben absolute Azure-URLs erhalten, damit der Browser
  //   spaeter direkt aus Azure laedt (kein streaming-url-Round-Trip mehr).
  // - Etwaige verbliebene relative Pfade (z.B. wenn ein Bild im OCR-Output anders heisst als im ZIP)
  //   werden mittels binaryFragments noch in absolute URLs aufgeloest.
  // - Im reinen Filesystem-Modus bleibt das alte Verhalten (URL -> kanonischer Vault-Pfad), damit
  //   das Markdown portabel im Filesystem liegt.
  let markdownToPersist: string
  // Diagnose: Freeze-Statistik (nur im Azure-Pfad relevant), wird unten ans Ergebnis gehaengt.
  let freezeReplacedCount = 0
  let freezeUnresolvedCount = 0
  let freezeUnresolvedSample: string[] = []
  if (mediaResult.strategy.writeToAzure) {
    const frozen = freezeMarkdownImageUrls(processed.markdown, binaryFragments)
    markdownToPersist = frozen.markdown
    freezeReplacedCount = frozen.replacedCount
    freezeUnresolvedCount = frozen.unresolved.length
    freezeUnresolvedSample = frozen.unresolved.slice(0, 5)
    if (frozen.unresolved.length > 0) {
      FileLogger.warn('shadow-twin-mongo-writer', 'Relative Bildpfade nach Freeze nicht aufloesbar', {
        libraryId,
        sourceId: sourceItem.id,
        unresolvedSample: freezeUnresolvedSample,
        unresolvedCount: freezeUnresolvedCount,
      })
    }
  } else {
    markdownToPersist = rewriteMarkdownAzureUrlsToCanonicalFileNames(processed.markdown, urlToCanonical)
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
    // WICHTIG: variant und pageNumber müssen mitwandern, damit page-render-Fragmente in Mongo
    // landen und vom Locator (page-images-locator.ts) gefunden werden können.
    const serviceBinaryFragments = binaryFragments.map((f) => ({
      name: f.name,
      originalName: f.originalName,
      url: f.url,
      hash: f.hash,
      mimeType: f.mimeType,
      size: f.size,
      kind: f.kind,
      createdAt: f.createdAt,
      variant: f.variant,
      pageNumber: f.pageNumber,
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
    diagnostics: {
      strategyMode: mediaResult.strategy.mode,
      writeToAzure: mediaResult.strategy.writeToAzure,
      writeToFilesystem: mediaResult.strategy.writeToFilesystem,
      zipArchivesPassed: mediaResult.diagnostics.zipArchiveCount,
      ranDirectUpload: mediaResult.diagnostics.ranDirectUpload,
      ranImageProcessor: mediaResult.diagnostics.ranImageProcessor,
      directUploadCount: mediaResult.imageMetadata.length,
      imageUrlsInMarkdown: imageUrls.length,
      binaryFragmentsCount: binaryFragments.length,
      freezeReplacedCount,
      freezeUnresolvedCount,
      freezeUnresolvedSample,
    },
  }
}
