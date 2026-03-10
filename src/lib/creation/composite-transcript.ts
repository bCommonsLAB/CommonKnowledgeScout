/**
 * @fileoverview Wiki-Link-basiertes Sammel-Transkript
 *
 * Zwei Funktionen mit klarer Trennung:
 *
 * 1. `buildCompositeReference()` -- Erzeugt eine leichtgewichtige Markdown-Datei
 *    mit Obsidian-Wiki-Links zu den Quelldateien und Medien. Diese Datei wird
 *    im Storage persistiert und ist Obsidian-kompatibel.
 *
 * 2. `resolveCompositeTranscript()` -- Löst die Wiki-Links dynamisch auf,
 *    lädt Transkripte aus Shadow-Twins (MongoDB-first) und baut die geflachte
 *    Version im Speicher. Wird nie persistiert, sondern nur als Input für
 *    die Template-Phase (LLM) verwendet.
 *
 * Wiki-Link-Syntax:
 * - `[[datei.pdf]]` → Direkte Datei im Verzeichnis
 * - `[[quelldatei.pdf#fragment.jpeg]]` → Binary Fragment aus Shadow-Twin
 *
 * @see docs/media-lifecycle-architektur.md
 */

import {
  getShadowTwinsBySourceIds,
  getShadowTwinArtifact,
  getShadowTwinBinaryFragments,
  toArtifactKey,
} from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getMediaKind } from '@/lib/media-types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { FileLogger } from '@/lib/debug/logger'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPEN
// ═══════════════════════════════════════════════════════════════════════════════

/** Eingabe für buildCompositeReference (Erstellung im UI/API) */
export interface CompositeReferenceOptions {
  libraryId: string
  userEmail: string
  targetLanguage: string
  /** Ausgewählte Quelldateien (StorageItems mit id, name, parentId) */
  sourceItems: Array<{ id: string; name: string; parentId: string }>
}

/** Ergebnis von buildCompositeReference */
export interface CompositeReferenceResult {
  /** Leichtgewichtiges Markdown mit Wiki-Links (zum Persistieren) */
  markdown: string
  /** Dateinamen aller Quellen */
  sourceFileNames: string[]
  /** Quellen ohne Transkript (Caller kann Warnung anzeigen) */
  missingTranscripts: string[]
  /** Gesammelte Medien-Infos (für Response an Client) */
  mediaFiles: MediaFileInfo[]
}

/** Eingabe für resolveCompositeTranscript (JobWorker, Server-side) */
export interface CompositeResolveOptions {
  libraryId: string
  userEmail: string
  targetLanguage: string
  /** Das persistierte Composite-Markdown (mit Wiki-Links) */
  compositeMarkdown: string
  /** Parent-Folder-ID (für Medien-Lookup im Verzeichnis) */
  parentId: string
}

/** Ergebnis von resolveCompositeTranscript */
export interface CompositeResolveResult {
  /** Geflachte Version mit <source>-Blöcken (für LLM) */
  markdown: string
  /** Quellen, deren Transkript nicht geladen werden konnte */
  unresolvedSources: string[]
}

/** Medien-Info mit optionaler Herkunft */
export interface MediaFileInfo {
  name: string
  size: number
  mimeType: string
  /** Quelldatei, aus der das Fragment extrahiert wurde (nur bei #-Links) */
  sourceFile?: string
}

/** Internes Zwischenergebnis pro Quelle bei Resolution */
interface ResolvedSource {
  name: string
  index: number
  markdown: string | null
  mimeType: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERSTELLUNG: buildCompositeReference
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Erzeugt ein leichtgewichtiges Composite-Markdown mit Obsidian-Wiki-Links.
 *
 * Lädt KEINE Transkript-Inhalte -- nur Metadaten für Validierung und Medien.
 * Das Ergebnis wird im Storage persistiert und ist Obsidian-kompatibel.
 */
export async function buildCompositeReference(
  options: CompositeReferenceOptions
): Promise<CompositeReferenceResult> {
  const { libraryId, userEmail, targetLanguage: _targetLanguage, sourceItems } = options

  if (sourceItems.length === 0) {
    throw new Error('Mindestens eine Quelldatei erforderlich')
  }

  const sourceIds = sourceItems.map(s => s.id)
  const sourceFileNames = sourceItems.map(s => s.name)

  FileLogger.info('composite-transcript', 'Erstelle Composite-Reference', {
    libraryId,
    sourceCount: sourceItems.length,
    sourceFileNames,
  })

  // Shadow-Twins laden (nur für Validierung + binaryFragments)
  const shadowTwinDocs = await getShadowTwinsBySourceIds({ libraryId, sourceIds })

  // Transkript-Existenz prüfen (ohne Inhalt zu laden)
  const missingTranscripts: string[] = []
  for (const item of sourceItems) {
    // Markdown-Dateien brauchen kein separates Transkript
    if (item.name.toLowerCase().endsWith('.md')) continue

    const doc = shadowTwinDocs.get(item.id)
    const hasTranscript = doc?.artifacts?.transcript
      && typeof doc.artifacts.transcript === 'object'
      && Object.keys(doc.artifacts.transcript as Record<string, unknown>).length > 0

    if (!hasTranscript) {
      missingTranscripts.push(item.name)
    }
  }

  // Medien sammeln (binaryFragments + Verzeichnis-Dateien)
  const mediaFiles = await collectMediaFiles(libraryId, userEmail, sourceItems)

  // Wiki-Link-Markdown zusammenbauen
  const markdown = assembleReferenceMarkdown({
    sourceFileNames,
    sourceItems,
    mediaFiles,
  })

  FileLogger.info('composite-transcript', 'Composite-Reference erstellt', {
    sourceCount: sourceItems.length,
    missingCount: missingTranscripts.length,
    mediaCount: mediaFiles.length,
    markdownLength: markdown.length,
  })

  return { markdown, sourceFileNames, missingTranscripts, mediaFiles }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESOLUTION: resolveCompositeTranscript
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Löst ein persistiertes Composite-Markdown dynamisch auf.
 *
 * Parst `_source_files` aus dem Frontmatter, lädt Transkripte aus Shadow-Twins
 * (MongoDB-first) und baut die geflachte Version mit <source>-Blöcken im Speicher.
 * Das Ergebnis wird nie persistiert, sondern direkt an die Template-Phase übergeben.
 */
export async function resolveCompositeTranscript(
  options: CompositeResolveOptions
): Promise<CompositeResolveResult> {
  const { libraryId, userEmail, targetLanguage, compositeMarkdown, parentId } = options

  // Frontmatter parsen, um _source_files zu lesen
  const { meta } = parseFrontmatter(compositeMarkdown)
  const sourceFileNames = parseSourceFiles(meta)

  if (sourceFileNames.length === 0) {
    throw new Error('Composite-Markdown enthält keine _source_files im Frontmatter')
  }

  FileLogger.info('composite-transcript', 'Starte Resolution', {
    libraryId,
    sourceCount: sourceFileNames.length,
    sourceFileNames,
  })

  // Quelldateien im Verzeichnis suchen, um sourceIds zu ermitteln
  const provider = await getServerProvider(userEmail, libraryId)
  const siblings = await provider.listItemsById(parentId)

  // Source-Dateien anhand des Namens im Verzeichnis finden
  const sourceItems: Array<{ id: string; name: string; parentId: string }> = []
  for (const name of sourceFileNames) {
    const match = siblings.find(s => s.type === 'file' && s.metadata.name === name)
    if (match) {
      sourceItems.push({ id: match.id, name, parentId })
    }
  }

  // Shadow-Twins für gefundene Quellen laden
  const sourceIds = sourceItems.map(s => s.id)
  const _shadowTwinDocs = sourceIds.length > 0
    ? await getShadowTwinsBySourceIds({ libraryId, sourceIds })
    : new Map()

  // Transkripte pro Quelle laden
  const resolvedSources: ResolvedSource[] = []
  const unresolvedSources: string[] = []

  for (let i = 0; i < sourceFileNames.length; i++) {
    const name = sourceFileNames[i]
    const item = sourceItems.find(s => s.name === name)
    const mimeType = guessMimeType(name)
    let markdown: string | null = null

    if (!item) {
      // Datei nicht im Verzeichnis gefunden
      unresolvedSources.push(name)
      resolvedSources.push({ name, index: i + 1, markdown: null, mimeType })
      continue
    }

    // Markdown-Dateien direkt aus dem Storage lesen
    if (name.toLowerCase().endsWith('.md')) {
      try {
        const binary = await provider.getBinary(item.id)
        markdown = await binary.blob.text()
      } catch (error) {
        FileLogger.warn('composite-transcript', `Markdown "${name}" nicht ladbar`, { error })
        unresolvedSources.push(name)
      }
    } else {
      // Transkript aus Shadow-Twin laden (MongoDB-first)
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
        markdown = record?.markdown ?? null

        if (!markdown) {
          unresolvedSources.push(name)
        }
      } catch (error) {
        FileLogger.warn('composite-transcript', `Transkript für "${name}" nicht ladbar`, { error })
        unresolvedSources.push(name)
      }
    }

    resolvedSources.push({ name, index: i + 1, markdown, mimeType })
  }

  // Medien aus Wiki-Links im Body parsen + anreichern
  const mediaFiles = await collectMediaFiles(libraryId, userEmail, sourceItems)

  // Geflachte Version zusammenbauen
  const resolvedMarkdown = assembleFlattenedMarkdown({
    sourceFileNames,
    sources: resolvedSources,
    mediaFiles,
  })

  FileLogger.info('composite-transcript', 'Resolution abgeschlossen', {
    sourceCount: sourceFileNames.length,
    resolvedCount: resolvedSources.filter(s => s.markdown).length,
    unresolvedCount: unresolvedSources.length,
    mediaCount: mediaFiles.length,
    markdownLength: resolvedMarkdown.length,
  })

  return { markdown: resolvedMarkdown, unresolvedSources }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIEN SAMMELN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sammelt verfügbare Medien aus zwei Quellen:
 * 1. binaryFragments aus Shadow-Twins (Bilder aus PDFs) → mit sourceFile-Herkunft
 * 2. Geschwister-Dateien im Verzeichnis (direkte Bild-Dateien)
 *
 * Dedupliziert nach Dateiname (binaryFragments haben Vorrang).
 */
async function collectMediaFiles(
  libraryId: string,
  userEmail: string,
  sourceItems: Array<{ id: string; name: string; parentId: string }>,
): Promise<MediaFileInfo[]> {
  const mediaMap = new Map<string, MediaFileInfo>()

  // A) binaryFragments aus Shadow-Twins (PDF-Bilder etc.)
  for (const item of sourceItems) {
    try {
      const fragments = await getShadowTwinBinaryFragments(libraryId, item.id)
      if (!fragments) continue

      for (const frag of fragments) {
        if (frag.variant === 'thumbnail') continue
        if (!frag.name || frag.kind !== 'image') continue

        mediaMap.set(frag.name, {
          name: frag.name,
          size: frag.size ?? 0,
          mimeType: frag.mimeType ?? 'image/jpeg',
          sourceFile: item.name,
        })
      }
    } catch (error) {
      FileLogger.warn('composite-transcript', `binaryFragments für "${item.name}" nicht ladbar`, { error })
    }
  }

  // B) Geschwister-Dateien im Verzeichnis (nur Bilder)
  const parentId = sourceItems[0]?.parentId
  if (parentId) {
    try {
      const provider = await getServerProvider(userEmail, libraryId)
      const siblings = await provider.listItemsById(parentId)

      for (const sib of siblings) {
        if (sib.type !== 'file') continue
        if (mediaMap.has(sib.metadata.name)) continue

        const kind = getMediaKind(sib)
        if (kind !== 'image') continue

        mediaMap.set(sib.metadata.name, {
          name: sib.metadata.name,
          size: sib.metadata.size,
          mimeType: sib.metadata.mimeType || 'image/jpeg',
        })
      }
    } catch (error) {
      FileLogger.warn('composite-transcript', 'Geschwister-Dateien nicht ladbar', { error })
    }
  }

  return Array.from(mediaMap.values())
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKDOWN-BUILDER: Reference (persistiert, Wiki-Links)
// ═══════════════════════════════════════════════════════════════════════════════

interface ReferenceAssembleOptions {
  sourceFileNames: string[]
  sourceItems: Array<{ id: string; name: string; parentId: string }>
  mediaFiles: MediaFileInfo[]
}

/**
 * Baut das leichtgewichtige Composite-Markdown mit Obsidian-Wiki-Links.
 * Diese Version wird im Storage persistiert.
 */
function assembleReferenceMarkdown(options: ReferenceAssembleOptions): string {
  const { sourceFileNames, mediaFiles } = options
  const now = new Date().toISOString()
  const parts: string[] = []

  // Frontmatter
  const sourceFilesJson = JSON.stringify(sourceFileNames)
  parts.push([
    '---',
    `_source_files: ${sourceFilesJson}`,
    'kind: composite-transcript',
    `createdAt: ${now}`,
    '---',
  ].join('\n'))

  // Titel
  parts.push('')
  parts.push('# Sammel-Transkript')

  // Quellen als Wiki-Links
  parts.push('')
  parts.push('## Quellen')
  for (const name of sourceFileNames) {
    parts.push(`- [[${name}]]`)
  }

  // Medien als Wiki-Links (getrennt nach Herkunft)
  if (mediaFiles.length > 0) {
    parts.push('')
    parts.push('## Verfügbare Medien')

    // Direkte Verzeichnis-Dateien (ohne sourceFile)
    const directMedia = mediaFiles.filter(m => !m.sourceFile)
    if (directMedia.length > 0) {
      parts.push('')
      parts.push('### Im Verzeichnis')
      for (const m of directMedia) {
        parts.push(`- [[${m.name}]]`)
      }
    }

    // Extrahierte Fragmente (mit sourceFile → #-Syntax)
    const fragmentMedia = mediaFiles.filter(m => m.sourceFile)
    if (fragmentMedia.length > 0) {
      parts.push('')
      parts.push('### Aus Quelldateien extrahiert')
      for (const m of fragmentMedia) {
        parts.push(`- [[${m.sourceFile}#${m.name}]]`)
      }
    }
  }

  parts.push('')
  return parts.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKDOWN-BUILDER: Flattened (nur im Speicher, für LLM)
// ═══════════════════════════════════════════════════════════════════════════════

interface FlattenedAssembleOptions {
  sourceFileNames: string[]
  sources: ResolvedSource[]
  mediaFiles: MediaFileInfo[]
}

/**
 * Baut die geflachte Version des Composite-Markdowns für die LLM-Verarbeitung.
 * Enthält Quellenübersicht, Medien-Liste und <source>-Blöcke mit Transkript-Inhalt.
 * Wird nur im Speicher erzeugt und nie persistiert.
 */
function assembleFlattenedMarkdown(options: FlattenedAssembleOptions): string {
  const { sourceFileNames, sources, mediaFiles } = options
  const parts: string[] = []

  // Frontmatter (minimal, für Erkennung im Pipeline-Flow)
  const sourceFilesJson = JSON.stringify(sourceFileNames)
  parts.push([
    '---',
    `_source_files: ${sourceFilesJson}`,
    'kind: composite-transcript',
    '---',
  ].join('\n'))

  // Quellenübersicht als Tabelle
  parts.push('')
  parts.push('# Quellenübersicht')
  parts.push('')
  parts.push('| Nr. | Datei | Typ |')
  parts.push('|-----|-------|-----|')
  for (const s of sources) {
    const typ = fileTypeLabel(s.mimeType)
    const status = s.markdown ? '' : ' *(nicht aufgelöst)*'
    parts.push(`| ${s.index} | ${s.name}${status} | ${typ} |`)
  }

  // Verfügbare Medien (für semantische Zuordnung durch LLM)
  if (mediaFiles.length > 0) {
    parts.push('')
    parts.push('## Verfügbare Medien im Verzeichnis')
    parts.push('')
    for (const m of mediaFiles) {
      const sizeStr = formatFileSize(m.size)
      const sourceHint = m.sourceFile ? ` (PDF-Fragment aus ${m.sourceFile})` : ''
      parts.push(`- ${m.name} (Bild, ${sizeStr}${sourceHint})`)
    }
  }

  // Trennlinie vor den Transkripten
  parts.push('')
  parts.push('---')

  // <source>-Blöcke pro Quelle
  for (const s of sources) {
    parts.push('')
    parts.push(`<source file="${s.name}" index="${s.index}">`)
    parts.push('')
    if (s.markdown) {
      parts.push(s.markdown.trim())
    } else {
      parts.push(`*(Kein Transkript für "${s.name}" verfügbar)*`)
    }
    parts.push('')
    parts.push('</source>')
  }

  parts.push('')
  return parts.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ═══════════════════════════════════════════════════════════════════════════════

/** Parst _source_files aus dem Frontmatter-Meta-Objekt */
function parseSourceFiles(meta: Record<string, unknown>): string[] {
  const raw = meta['_source_files']
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string')
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string')
      }
    } catch {
      // Kein gültiges JSON-Array
    }
  }
  return []
}

/** Leitet MIME-Type aus Dateiendung ab */
function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    webm: 'video/webm',
    md: 'text/markdown',
    txt: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  }
  return map[ext] || 'application/octet-stream'
}

/** Gibt ein lesbares Label für den Dateityp zurück */
function fileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('audio/')) return 'Audio'
  if (mimeType.startsWith('video/')) return 'Video'
  if (mimeType.startsWith('image/')) return 'Bild'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('markdown') || mimeType.includes('text/plain')) return 'Text'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'Office'
  if (mimeType.includes('presentation')) return 'Präsentation'
  return 'Datei'
}

/** Formatiert eine Dateigröße in lesbarer Form */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return 'unbekannt'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
