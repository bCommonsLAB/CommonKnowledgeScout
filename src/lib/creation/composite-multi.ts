/**
 * @fileoverview Wiki-Link-basierte Bild-Sammelanalyse (composite-multi)
 *
 * Paralleles Konzept zu `composite-transcript`, aber speziell für **reine
 * Bildsammlungen**, die zusammen an einen Vision-LLM gehen sollen.
 *
 * Zwei Funktionen mit klarer Trennung:
 *
 * 1. `buildCompositeMultiReference()` — Erzeugt eine leichtgewichtige
 *    Markdown-Datei mit Frontmatter `kind: composite-multi` und
 *    Obsidian-Embeds (`![[bild.jpeg]]`). Persistierbar, Obsidian-kompatibel.
 *
 * 2. `resolveCompositeMulti()` — Löst die Wiki-Embeds dynamisch auf, lädt
 *    die Bild-Binaries via Provider und gibt sie zusammen mit einer kurzen
 *    Kontext-Markdown an den Caller. Das Ergebnis wird nicht persistiert,
 *    sondern direkt als Multi-Image-Input für den Secretary verwendet.
 *
 * Hartes Limit: max. 10 Bilder pro Composite (Secretary-Spec
 * `ImageAnalyzerProcessor.MAX_IMAGES_PER_REQUEST`).
 *
 * @see docs/_secretary-service-docu/image-analyzer.md
 * @see src/lib/creation/composite-transcript.ts
 */

import { isImageMediaFromName } from '@/lib/media-types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { parseCompositeSourceFilesFromMeta } from '@/lib/creation/composite-source-files-meta'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'

// ═══════════════════════════════════════════════════════════════════════════════
// KONSTANTEN
// ═══════════════════════════════════════════════════════════════════════════════

/** Hartes Limit aus der Secretary-Spec (`MAX_IMAGES_PER_REQUEST`). */
export const COMPOSITE_MULTI_MAX_IMAGES = 10

/** Mindestanzahl Quellen — sonst macht Sammelanalyse keinen Sinn. */
export const COMPOSITE_MULTI_MIN_IMAGES = 2

// ═══════════════════════════════════════════════════════════════════════════════
// TYPEN
// ═══════════════════════════════════════════════════════════════════════════════

/** Eingabe für `buildCompositeMultiReference` (Erstellung im UI/API). */
export interface CompositeMultiBuildOptions {
  libraryId: string
  /**
   * Ausgewählte Bild-Quelldateien.
   * Die Reihenfolge im Array bleibt im Composite-Markdown erhalten und ist
   * Teil des Secretary-Cache-Keys (`docs/_secretary-service-docu/image-analyzer.md`).
   */
  sourceItems: Array<{ id: string; name: string; parentId: string }>
  /** Optionaler Titel/Kommentar, der als Body über die Embed-Liste gesetzt wird. */
  title?: string
}

/** Ergebnis von `buildCompositeMultiReference`. */
export interface CompositeMultiBuildResult {
  /** Persistierbares Markdown mit `kind: composite-multi` und Wiki-Embeds. */
  markdown: string
  /** Dateinamen aller Quellen, in der gewählten Reihenfolge. */
  sourceFileNames: string[]
}

/** Eingabe für `resolveCompositeMulti` (Server-side, im JobWorker). */
export interface CompositeMultiResolveOptions {
  libraryId: string
  /** Persistiertes Composite-Markdown (mit Frontmatter `kind: composite-multi`). */
  compositeMarkdown: string
  /** Parent-Folder-ID — Bilder werden im selben Verzeichnis erwartet. */
  parentId: string
  /** Provider-Instanz für `listItemsById` und `getBinary`. */
  provider: StorageProvider
}

/** Geladenes Bild-Binary mit Metadaten. */
export interface CompositeMultiImageBinary {
  /** Dateiname (entspricht Eintrag in `_source_files`). */
  name: string
  /** Reihenfolge-Index (1-basiert), entspricht der Reihenfolge in `_source_files`. */
  index: number
  /** Bild-Bytes als Buffer. */
  buffer: Buffer
  /** MIME-Type (vom Provider, Fallback aus Dateiendung). */
  mimeType: string
}

/** Ergebnis von `resolveCompositeMulti`. */
export interface CompositeMultiResolveResult {
  /**
   * Kurze Quellen-Tabelle als Markdown-String — kann optional als Text-Kontext
   * an den LLM mitgesendet werden. Enthält KEINE Base64-Daten.
   */
  contextMarkdown: string
  /** Geladene Bild-Binaries in derselben Reihenfolge wie `_source_files`. */
  imageBinaries: CompositeMultiImageBinary[]
  /** Dateinamen, die im Verzeichnis nicht gefunden wurden. */
  unresolvedSources: string[]
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERSTELLUNG: buildCompositeMultiReference
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Erzeugt das persistierbare Composite-Multi-Markdown.
 *
 * Validiert hart, dass:
 * - mindestens `COMPOSITE_MULTI_MIN_IMAGES` Quellen vorhanden sind
 * - höchstens `COMPOSITE_MULTI_MAX_IMAGES` Quellen vorhanden sind
 * - alle Quellen Bild-MIME-Types sind (kein silent skip)
 *
 * Der Output enthält Frontmatter (`kind: composite-multi`, `_source_files`,
 * `createdAt`) und im Body eine kurze Quellen-Liste plus Obsidian-Embeds für
 * jede Bilddatei.
 */
export function buildCompositeMultiReference(
  options: CompositeMultiBuildOptions
): CompositeMultiBuildResult {
  const { libraryId, sourceItems, title } = options

  if (sourceItems.length < COMPOSITE_MULTI_MIN_IMAGES) {
    throw new Error(
      `Composite-Multi: Mindestens ${COMPOSITE_MULTI_MIN_IMAGES} Bilder erforderlich (erhalten: ${sourceItems.length})`
    )
  }

  if (sourceItems.length > COMPOSITE_MULTI_MAX_IMAGES) {
    throw new Error(
      `Composite-Multi: Maximal ${COMPOSITE_MULTI_MAX_IMAGES} Bilder erlaubt (erhalten: ${sourceItems.length}). ` +
        `Limit kommt vom Secretary-Endpoint (MAX_IMAGES_PER_REQUEST).`
    )
  }

  // Alle Quellen müssen Bilder sein. Kein silent skip — wir wollen, dass der
  // Aufrufer eine fehlerhafte Selektion bemerkt und korrigieren kann.
  const nonImage = sourceItems.filter(s => !isImageMediaFromName(s.name))
  if (nonImage.length > 0) {
    throw new Error(
      `Composite-Multi: Nur Bild-Quellen erlaubt. Nicht-Bild-Dateien: ${nonImage.map(s => s.name).join(', ')}`
    )
  }

  const sourceFileNames = sourceItems.map(s => s.name)
  const markdown = assembleMultiReferenceMarkdown({ sourceFileNames, title })

  FileLogger.info('composite-multi', 'Composite-Multi-Reference erstellt', {
    libraryId,
    sourceCount: sourceItems.length,
    sourceFileNames,
    markdownLength: markdown.length,
  })

  return { markdown, sourceFileNames }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESOLUTION: resolveCompositeMulti
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Löst ein persistiertes Composite-Multi-Markdown auf.
 *
 * Parst `_source_files` aus dem Frontmatter, sucht jede Bilddatei im
 * Verzeichnis (`parentId`) und lädt das Binary via Provider. Gibt die
 * Binaries in der durch `_source_files` vorgegebenen Reihenfolge zurück.
 *
 * Nicht gefundene Bilder werden in `unresolvedSources` gemeldet (kein Throw).
 * Der Caller entscheidet, wie er damit umgeht (warnen vs. abbrechen).
 *
 * Wirft ausschließlich, wenn `_source_files` selbst leer/fehlt — denn dann
 * ist das Composite-Markdown defekt.
 */
export async function resolveCompositeMulti(
  options: CompositeMultiResolveOptions
): Promise<CompositeMultiResolveResult> {
  const { libraryId, compositeMarkdown, parentId, provider } = options

  const { meta } = parseFrontmatter(compositeMarkdown)
  const sourceFileNames = parseCompositeSourceFilesFromMeta(meta)

  if (sourceFileNames.length === 0) {
    throw new Error('Composite-Multi-Markdown enthält keine _source_files im Frontmatter')
  }

  FileLogger.info('composite-multi', 'Starte Multi-Image-Resolution', {
    libraryId,
    sourceCount: sourceFileNames.length,
    sourceFileNames,
  })

  // Geschwister-Items im Verzeichnis listen, damit wir Namen → IDs auflösen können.
  const siblings = await provider.listItemsById(parentId)

  const imageBinaries: CompositeMultiImageBinary[] = []
  const unresolvedSources: string[] = []

  for (let i = 0; i < sourceFileNames.length; i++) {
    const name = sourceFileNames[i]

    // Datei im Verzeichnis suchen (case-sensitiv, wie der Provider sie listet).
    const match = siblings.find(s => s.type === 'file' && s.metadata.name === name)
    if (!match) {
      FileLogger.warn('composite-multi', `Bildquelle nicht gefunden im Verzeichnis: ${name}`, {
        libraryId,
        parentId,
      })
      unresolvedSources.push(name)
      continue
    }

    try {
      const binaryResult = await provider.getBinary(match.id)
      const arrayBuffer = await binaryResult.blob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const mimeType = binaryResult.mimeType || guessImageMimeType(name)

      imageBinaries.push({
        name,
        index: i + 1,
        buffer,
        mimeType,
      })
    } catch (error) {
      FileLogger.warn('composite-multi', `Binary-Load fehlgeschlagen für ${name}`, {
        libraryId,
        sourceId: match.id,
        error: error instanceof Error ? error.message : String(error),
      })
      unresolvedSources.push(name)
    }
  }

  const contextMarkdown = assembleContextMarkdown({ sourceFileNames, imageBinaries, unresolvedSources })

  FileLogger.info('composite-multi', 'Multi-Image-Resolution abgeschlossen', {
    libraryId,
    sourceCount: sourceFileNames.length,
    resolvedCount: imageBinaries.length,
    unresolvedCount: unresolvedSources.length,
  })

  return { contextMarkdown, imageBinaries, unresolvedSources }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKDOWN-BUILDER: Reference (persistiert, Wiki-Embeds)
// ═══════════════════════════════════════════════════════════════════════════════

interface MultiReferenceAssembleOptions {
  sourceFileNames: string[]
  title?: string
}

/**
 * Baut das leichtgewichtige Composite-Multi-Markdown mit Frontmatter und
 * Obsidian-Embeds. Diese Version wird im Storage persistiert.
 *
 * Aufbau:
 *   ---
 *   _source_files: [...]
 *   kind: composite-multi
 *   createdAt: ...
 *   ---
 *
 *   # Bild-Sammelanalyse
 *
 *   ## Quellen
 *   1. bild_001.jpeg
 *   2. bild_002.jpeg
 *   ...
 *
 *   ## Vorschau
 *   ![[bild_001.jpeg]]
 *   ![[bild_002.jpeg]]
 */
function assembleMultiReferenceMarkdown(options: MultiReferenceAssembleOptions): string {
  const { sourceFileNames, title } = options
  const now = new Date().toISOString()
  const parts: string[] = []

  // Frontmatter
  const sourceFilesJson = JSON.stringify(sourceFileNames)
  parts.push([
    '---',
    `_source_files: ${sourceFilesJson}`,
    'kind: composite-multi',
    `createdAt: ${now}`,
    '---',
  ].join('\n'))

  // Titel
  parts.push('')
  parts.push(`# ${title?.trim() || 'Bild-Sammelanalyse'}`)
  parts.push('')
  parts.push(
    `*Sammlung von ${sourceFileNames.length} Bildern. Reihenfolge ist semantisch relevant ` +
      'und Teil des Secretary-Cache-Keys.*'
  )

  // Quellen-Liste (mit 1-basiertem Index, deutlich für menschliche Leser).
  parts.push('')
  parts.push('## Quellen')
  parts.push('')
  for (let i = 0; i < sourceFileNames.length; i++) {
    parts.push(`${i + 1}. [[${sourceFileNames[i]}]]`)
  }

  // Embed-Block für Obsidian-/App-Vorschau (Grid).
  parts.push('')
  parts.push('## Vorschau')
  parts.push('')
  for (const name of sourceFileNames) {
    parts.push(`![[${name}]]`)
    parts.push('')
  }

  return parts.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKDOWN-BUILDER: Context (nur im Speicher, optional an LLM)
// ═══════════════════════════════════════════════════════════════════════════════

interface ContextAssembleOptions {
  sourceFileNames: string[]
  imageBinaries: CompositeMultiImageBinary[]
  unresolvedSources: string[]
}

/**
 * Baut eine kurze Quellen-Tabelle als Text-Kontext für den LLM (optional).
 * Enthält KEINE Base64-Daten — die Bilder werden separat als Buffer übergeben.
 */
function assembleContextMarkdown(options: ContextAssembleOptions): string {
  const { sourceFileNames, imageBinaries, unresolvedSources } = options
  const parts: string[] = []

  parts.push('# Bild-Sammlung')
  parts.push('')
  parts.push(
    `Gesamt: ${sourceFileNames.length} Bilder | Geladen: ${imageBinaries.length} | Fehlend: ${unresolvedSources.length}`
  )
  parts.push('')
  parts.push('| Nr. | Datei | Status |')
  parts.push('|-----|-------|--------|')

  // Status pro Quelle ableiten — für den Resolver ist `imageBinaries` die Quelle der Wahrheit.
  const loadedNames = new Set(imageBinaries.map(b => b.name))
  for (let i = 0; i < sourceFileNames.length; i++) {
    const name = sourceFileNames[i]
    const status = loadedNames.has(name) ? 'geladen' : '*fehlt*'
    parts.push(`| ${i + 1} | ${name} | ${status} |`)
  }

  return parts.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ═══════════════════════════════════════════════════════════════════════════════

/** Leitet einen Bild-MIME-Type aus der Dateiendung ab (Fallback wenn Provider nichts liefert). */
function guessImageMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  }
  return map[ext] || 'application/octet-stream'
}
