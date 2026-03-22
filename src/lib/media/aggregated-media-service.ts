/**
 * @fileoverview Gemeinsame serverseitige Medienaggregation
 *
 * Zentralisiert die Logik aus dem Sammel-Transkript (binaryFragments + Ordnerbilder,
 * PDF-Sektionen, kanonische Dateinamen aus Transkript-Markdown). Wird von
 * `composite-transcript`, der Aggregations-API und Tests genutzt.
 */

import {
  getShadowTwinArtifact,
  getShadowTwinBinaryFragments,
  toArtifactKey,
} from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getMediaKind } from '@/lib/media-types'
import { FileLogger } from '@/lib/debug/logger'
import { matchBinaryFragmentByLookupName } from '@/lib/shadow-twin/binary-fragment-lookup'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPEN
// ═══════════════════════════════════════════════════════════════════════════════

/** Medien-Info mit optionaler Herkunft (Fragment / Ordner) */
export interface MediaFileInfo {
  name: string
  size: number
  mimeType: string
  /** Quelldatei, aus der das Fragment extrahiert wurde (nur bei Shadow-Twin-Fragmenten) */
  sourceFile?: string
  hash?: string
  originalName?: string
  url?: string
  /** Mongo-/Fragment-Referenz auf Storage (Streaming-URL) */
  fileId?: string
  /** Storage-Item-ID für direkte Ordner-Bilder (ohne Fragment) */
  storageFileId?: string
}

/**
 * Gruppierung für die Prüfansicht: je PDF alle extrahierten Bilder plus
 * Dateinamen, die nur im Transkript vorkommen.
 */
export interface PdfMediaSection {
  pdfFileName: string
  fragments: MediaFileInfo[]
  transcriptOnlyRefs: string[]
}

/** Extrahierte Bilder aus Office/anderen Nicht-PDF-Quellen */
export interface OtherSourceExtractedGroup {
  sourceFileName: string
  fragments: MediaFileInfo[]
}

export interface BuildAggregatedMediaOptions {
  libraryId: string
  userEmail: string
  targetLanguage: string
  sourceItems: Array<{ id: string; name: string; parentId: string }>
}

export interface BuildAggregatedMediaResult {
  mediaFiles: MediaFileInfo[]
  pdfSections: PdfMediaSection[]
  otherExtracted: OtherSourceExtractedGroup[]
}

/**
 * Sammelt Medien und baut PDF-/Office-Layout — gemeinsame Basis für Composite und UI-API.
 */
export async function buildAggregatedMediaForSources(
  options: BuildAggregatedMediaOptions,
): Promise<BuildAggregatedMediaResult> {
  const { libraryId, userEmail, targetLanguage, sourceItems } = options
  const mediaFiles = await collectMediaFiles(libraryId, userEmail, sourceItems)
  const { pdfSections, otherExtracted } = await buildCompositeMediaLayout(
    libraryId,
    targetLanguage,
    sourceItems,
    mediaFiles,
  )
  return { mediaFiles, pdfSections, otherExtracted }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIEN SAMMELN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sammelt verfügbare Medien aus binaryFragments und Geschwister-Bildern im Ordner.
 * Fragmente werden nicht global nach Namen dedupliziert (mehrere PDFs: gleicher Fragment-Name).
 */
export async function collectMediaFiles(
  libraryId: string,
  userEmail: string,
  sourceItems: Array<{ id: string; name: string; parentId: string }>,
): Promise<MediaFileInfo[]> {
  const mediaFiles: MediaFileInfo[] = []

  for (const item of sourceItems) {
    try {
      const fragments = await getShadowTwinBinaryFragments(libraryId, item.id)
      if (!fragments) continue

      for (const frag of fragments) {
        if (frag.variant === 'thumbnail') continue
        const looksLikeImage =
          frag.kind === 'image' ||
          (frag.mimeType?.toLowerCase().startsWith('image/') ?? false) ||
          /\.(jpe?g|png|gif|webp)$/i.test(frag.name || '')
        if (!frag.name || !looksLikeImage) continue

        mediaFiles.push({
          name: frag.name,
          size: frag.size ?? 0,
          mimeType: frag.mimeType ?? 'image/jpeg',
          sourceFile: item.name,
          hash: frag.hash,
          originalName: frag.originalName,
          url: frag.url,
          fileId: frag.fileId,
        })
      }
    } catch (error) {
      FileLogger.warn('aggregated-media', `binaryFragments für "${item.name}" nicht ladbar`, { error })
    }
  }

  const fragmentBasenames = new Set(mediaFiles.map(m => m.name))

  const parentId = sourceItems[0]?.parentId
  if (parentId) {
    try {
      const provider = await getServerProvider(userEmail, libraryId)
      const siblings = await provider.listItemsById(parentId)

      for (const sib of siblings) {
        if (sib.type !== 'file') continue
        if (fragmentBasenames.has(sib.metadata.name)) continue

        const kind = getMediaKind(sib)
        if (kind !== 'image') continue

        mediaFiles.push({
          name: sib.metadata.name,
          size: sib.metadata.size,
          mimeType: sib.metadata.mimeType || 'image/jpeg',
          storageFileId: sib.id,
        })
      }
    } catch (error) {
      FileLogger.warn('aggregated-media', 'Geschwister-Dateien nicht ladbar', { error })
    }
  }

  return mediaFiles
}

/** Bildendungen für Transkript-Parsing */
const IMG_EXT_IN_REGEX = '(?:jpe?g|png|gif|webp)'

/** Nur der Dateiname ohne Pfad (für Transkript-Pfade und URLs) */
function fileNameOnlyFromPathOrUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '')
  const noQuery = trimmed.split('?')[0] ?? trimmed
  const norm = noQuery.replace(/\\/g, '/')
  const slash = norm.lastIndexOf('/')
  return slash >= 0 ? norm.slice(slash + 1) : norm
}

/**
 * Sammelt Bild-Dateinamen aus Transkript-Markdown (Wiki, Embeds, klassische Images, HTML img).
 */
export function extractImageLikeNamesFromMarkdown(markdown: string): string[] {
  if (!markdown || !markdown.trim()) return []

  const found = new Set<string>()
  const push = (raw: string) => {
    const base = fileNameOnlyFromPathOrUrl(raw)
    if (base && new RegExp(`\\.${IMG_EXT_IN_REGEX}$`, 'i').test(base)) {
      found.add(base)
    }
  }

  let m: RegExpExecArray | null

  const reWikiHash = new RegExp(
    `\\[\\[[^\\]#]*#([^\\]]+\\.${IMG_EXT_IN_REGEX})\\]\\]`,
    'gi',
  )
  while ((m = reWikiHash.exec(markdown)) !== null) {
    push(m[1])
  }

  const reWikiEmbed = new RegExp(`!\\[\\[([^\\]]+\\.${IMG_EXT_IN_REGEX})\\]\\]`, 'gi')
  while ((m = reWikiEmbed.exec(markdown)) !== null) {
    push(m[1])
  }

  const reMdImg = new RegExp(`!\\[[^\\]]*\\]\\(([^)]+\\.${IMG_EXT_IN_REGEX})\\)`, 'gi')
  while ((m = reMdImg.exec(markdown)) !== null) {
    push(m[1])
  }

  const reHtmlImg = new RegExp(`<img[^>]+src=["']([^"']+\\.${IMG_EXT_IN_REGEX})["']`, 'gi')
  while ((m = reHtmlImg.exec(markdown)) !== null) {
    push(m[1])
  }

  return [...found].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/**
 * Zuordnung Hash-/Blob-Dateiname → kanonischer Name aus Markdown-Alt-Text (ältere Mongo-Daten).
 */
export function extractCanonicalImageNameByBlobNameFromMarkdown(markdown: string): Map<string, string> {
  const result = new Map<string, string>()
  if (!markdown || !markdown.trim()) return result

  const reMarkdownImage = new RegExp(
    `!\\[([^\\]]+\\.${IMG_EXT_IN_REGEX})\\]\\((https?:\\/\\/[^)]+\\.${IMG_EXT_IN_REGEX})\\)`,
    'gi',
  )

  let m: RegExpExecArray | null
  while ((m = reMarkdownImage.exec(markdown)) !== null) {
    const canonicalName = fileNameOnlyFromPathOrUrl(m[1])
    const blobName = fileNameOnlyFromPathOrUrl(m[2]).toLowerCase()
    if (!canonicalName || !blobName) continue
    result.set(blobName, canonicalName)
  }

  return result
}

/** Hex-Hash-Bildname — in Obsidian nicht auflösbar, keine toten Wikilinks. */
export function looksLikeHexHashImageFileName(ref: string): boolean {
  const base = ref.replace(/\\/g, '/').split('/').pop() || ref
  return /^[a-f0-9]{12,64}\.(jpe?g|png|gif|webp)$/i.test(base.trim())
}

/**
 * Baut die Abschnitte „je PDF“ und „andere Quellen“ für Verfügbare Medien.
 */
export async function buildCompositeMediaLayout(
  libraryId: string,
  targetLanguage: string,
  sourceItems: Array<{ id: string; name: string; parentId: string }>,
  mediaFiles: MediaFileInfo[],
): Promise<{ pdfSections: PdfMediaSection[]; otherExtracted: OtherSourceExtractedGroup[] }> {
  const pdfSections: PdfMediaSection[] = []

  for (const item of sourceItems) {
    if (!item.name.toLowerCase().endsWith('.pdf')) continue

    let fragments = mediaFiles.filter(m => m.sourceFile === item.name)

    let transcriptOnlyRefs: string[] = []
    try {
      const record = await getShadowTwinArtifact({
        libraryId,
        sourceId: item.id,
        artifactKey: toArtifactKey({
          sourceId: item.id,
          kind: 'transcript',
          targetLanguage,
        }),
      })
      if (record?.markdown) {
        const canonicalByBlobName = extractCanonicalImageNameByBlobNameFromMarkdown(record.markdown)
        if (canonicalByBlobName.size > 0) {
          fragments = fragments.map((fragment) => {
            const blobName = fileNameOnlyFromPathOrUrl(fragment.url || fragment.name).toLowerCase()
            const canonical = canonicalByBlobName.get(blobName)
            if (!canonical || canonical === fragment.name) return fragment
            return {
              ...fragment,
              originalName: fragment.originalName || fragment.name,
              name: canonical,
            }
          })
        }

        const fromMd = extractImageLikeNamesFromMarkdown(record.markdown)
        const extra: string[] = []
        const seen = new Set<string>()
        for (const ref of fromMd) {
          if (matchBinaryFragmentByLookupName(fragments, ref)) {
            continue
          }
          const k = ref.toLowerCase()
          if (seen.has(k)) continue
          seen.add(k)
          extra.push(ref)
        }
        transcriptOnlyRefs = extra
          .filter(ref => !looksLikeHexHashImageFileName(ref))
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      }
    } catch (error) {
      FileLogger.warn('aggregated-media', `Transkript für Medien-Scan "${item.name}" nicht ladbar`, {
        error,
      })
    }

    pdfSections.push({
      pdfFileName: item.name,
      fragments,
      transcriptOnlyRefs,
    })
  }

  const otherMap = new Map<string, MediaFileInfo[]>()
  for (const m of mediaFiles) {
    if (!m.sourceFile) continue
    if (m.sourceFile.toLowerCase().endsWith('.pdf')) continue
    const list = otherMap.get(m.sourceFile)
    if (list) list.push(m)
    else otherMap.set(m.sourceFile, [m])
  }

  const otherExtracted: OtherSourceExtractedGroup[] = []
  const consumedOther = new Set<string>()
  for (const item of sourceItems) {
    const list = otherMap.get(item.name)
    if (list?.length && !consumedOther.has(item.name)) {
      consumedOther.add(item.name)
      otherExtracted.push({ sourceFileName: item.name, fragments: list })
    }
  }
  for (const [sourceFileName, fragments] of otherMap) {
    if (!consumedOther.has(sourceFileName) && fragments.length > 0) {
      otherExtracted.push({ sourceFileName, fragments })
    }
  }

  return { pdfSections, otherExtracted }
}
