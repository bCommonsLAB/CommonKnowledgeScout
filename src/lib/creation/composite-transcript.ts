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
 * Wiki-Link-Syntax (Obsidian):
 * - `[[datei.pdf]]` / Quellen: Dokumente als normale Wikilinks
 * - „Verfügbare Medien“: zuerst Ordner-Bilder, dann **je PDF** extrahierte Fragmente plus optional
 *   „Im Transkript erwähnt“ (aus Transkript-Markdown geparste Bild-Dateinamen), dann andere Quelltypen (Office …)
 * - Vor jedem Embed: **Dateiname** als Prüfansicht-Label
 * - `![[bild.jpg]]` im Quellverzeichnis: eingebettete Vorschau
 * - `![[_Quelle.pdf/fragment.jpeg]]` für PDF-Fragmente: Pfad = Shadow-Twin-Ordner (`generateShadowTwinFolderName`)
 * - Legacy in älteren Dateien: `[[quelle.pdf#fragment.jpeg]]` (App-Vorschau löst weiter auf)
 *
 * @see docs/media-lifecycle-architektur.md
 */

import {
  getShadowTwinsBySourceIds,
  getShadowTwinArtifact,
  toArtifactKey,
} from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'
import { isImageMediaFromName } from '@/lib/media-types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { FileLogger } from '@/lib/debug/logger'
import type { Library } from '@/types/library'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { parseCompositeSourceFilesFromMeta } from '@/lib/creation/composite-source-files-meta'
import {
  parseCompositeSourceEntry,
  appendTemplateSuffix,
} from '@/lib/creation/composite-source-entry'
import { generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import {
  buildAggregatedMediaForSources,
  type MediaFileInfo,
  type OtherSourceExtractedGroup,
  type PdfMediaSection,
} from '@/lib/media/aggregated-media-service'

/** Für Tests und Abwärtskompatibilität — kanonische Medien-Helfer liegen im Aggregations-Service. */
export type { MediaFileInfo, PdfMediaSection } from '@/lib/media/aggregated-media-service'
export {
  extractCanonicalImageNameByBlobNameFromMarkdown,
  extractImageLikeNamesFromMarkdown,
} from '@/lib/media/aggregated-media-service'

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
  /**
   * Optional: Library-Dokument für Shadow-Twin-Konfiguration.
   * Wenn gesetzt und Transkripte werden ins Dateisystem gespiegelt, enthält das Markdown
   * pro Nicht-.md-Quelle eine zweite Zeile `[[…transcript….md|Transkript prüfen]]` (Obsidian-Alias).
   */
  library?: Library | null
  /**
   * Optional: Wenn gesetzt, wird pro Nicht-`.md`-Quelle ein Schraegstrich-Suffix mit
   * diesem Template-Namen an den `_source_files`-Eintrag und den Quellen-Wikilink
   * angehaengt. Der Resolver laedt dann statt eines `transcript`-Artefakts die
   * `transformation` mit `(sourceId, kind='transformation', targetLanguage, templateName)`.
   *
   * Hartes Determinismus-Contract (siehe `shadow-twin-contracts.mdc`):
   * `templateName` ist hier Pflicht, kein "pick latest". Caller muss vorher
   * sicherstellen, dass die markierten Quellen die Transformation besitzen.
   */
  transformationTemplateName?: string
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

/** Internes Zwischenergebnis pro Quelle bei Resolution */
interface ResolvedSource {
  name: string
  index: number
  markdown: string | null
  mimeType: string
}

/**
 * Quellen, die ein echtes Transkript-Artefakt brauchen (PDF, Audio, Office, …).
 * Markdown ist schon Text; Bilder werden nicht transkribiert.
 */
function compositeSourceExpectsTranscript(item: { id: string; name: string; parentId: string }): boolean {
  if (item.name.toLowerCase().endsWith('.md')) return false
  if (isImageMediaFromName(item.name)) return false
  return true
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
  const {
    libraryId,
    userEmail,
    targetLanguage,
    sourceItems,
    library: libraryDoc,
    transformationTemplateName,
  } = options

  if (sourceItems.length === 0) {
    throw new Error('Mindestens eine Quelldatei erforderlich')
  }

  const sourceIds = sourceItems.map(s => s.id)
  const sourceFileNames = sourceItems.map(s => s.name)

  FileLogger.info('composite-transcript', 'Erstelle Composite-Reference', {
    libraryId,
    sourceCount: sourceItems.length,
    sourceFileNames,
    transformationTemplateName: transformationTemplateName ?? null,
  })

  // Shadow-Twins laden (fuer Validierung von Transcripts und Transformations)
  const shadowTwinDocs = await getShadowTwinsBySourceIds({ libraryId, sourceIds })

  // Existenz-Pruefung pro Quelle.
  // - Im Default-Modus (Sammel-Transkript): pruefen, ob ein `transcript`-Artefakt existiert.
  //   `.md`-Quellen und Bilder werden uebersprungen, da sie kein Transcript benoetigen.
  // - Im Transformations-Modus: pruefen, ob die Transformation mit
  //   `(templateName, targetLanguage)` existiert. Hier MUESSEN auch `.md`-Quellen
  //   geprueft werden, denn Markdown-Originale koennen ebenfalls via Template
  //   transformiert werden (z.B. Steckbrief-MD → gaderform-bett-steckbrief).
  //   Bilder bleiben ausgeschlossen, da sie nie eine Text-Transformation haben.
  //   Caller hat das vorher schon gegen den Pool gecheckt; das hier ist die
  //   zweite Verteidigungslinie.
  const missingTranscripts: string[] = []
  for (const item of sourceItems) {
    const doc = shadowTwinDocs.get(item.id)

    if (transformationTemplateName) {
      // Bilder haben nie eine Text-Transformation — ueberspringen.
      if (isImageMediaFromName(item.name)) continue

      // Pfad: `artifacts.transformation.<templateName>.<targetLanguage>`
      const transformationByTemplate = doc?.artifacts?.transformation as
        | Record<string, Record<string, unknown> | undefined>
        | undefined
      const langBucket = transformationByTemplate?.[transformationTemplateName]
      const hasTransformation = !!langBucket?.[targetLanguage]
      if (!hasTransformation) {
        missingTranscripts.push(item.name)
      }
      continue
    }

    // Default-Modus: nur Nicht-`.md`/Nicht-Bild-Quellen brauchen ein Transcript.
    if (!compositeSourceExpectsTranscript(item)) continue

    const hasTranscript = doc?.artifacts?.transcript
      && typeof doc.artifacts.transcript === 'object'
      && Object.keys(doc.artifacts.transcript as Record<string, unknown>).length > 0

    if (!hasTranscript) {
      missingTranscripts.push(item.name)
    }
  }

  // Medien sammeln (binaryFragments + Verzeichnis-Dateien) — gemeinsamer Aggregations-Service
  const { mediaFiles, pdfSections, otherExtracted } = await buildAggregatedMediaForSources({
    libraryId,
    userEmail,
    targetLanguage,
    sourceItems,
  })

  // Obsidian: zweite Zeile „Transkript prüfen“ nur, wenn Transkript-Artefakte im Vault/Storage liegen.
  const st = getShadowTwinConfig(libraryDoc ?? null)
  const includeTranscriptWikiLinks =
    libraryDoc != null &&
    (st.primaryStore === 'filesystem' || st.persistToFilesystem === true)

  // Wiki-Link-Markdown zusammenbauen
  const markdown = assembleReferenceMarkdown({
    sourceFileNames,
    sourceItems,
    mediaFiles,
    pdfSections,
    otherExtracted,
    targetLanguage,
    includeTranscriptWikiLinks,
    transformationTemplateName,
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

  // Frontmatter parsen, um _source_files zu lesen.
  // Eintraege koennen ein optionales Schraegstrich-Suffix haben:
  //   "seite1.pdf"                              → Transcript-Lookup (wie bisher)
  //   "seite1.pdf/gaderform-bett-steckbrief"    → Transformation-Lookup mit templateName
  // Siehe `composite-source-entry.ts` und `docs/composite-transformations-e2e.md`.
  const { meta } = parseFrontmatter(compositeMarkdown)
  const rawSourceEntries = parseCompositeSourceFilesFromMeta(meta)

  if (rawSourceEntries.length === 0) {
    throw new Error('Composite-Markdown enthält keine _source_files im Frontmatter')
  }

  // Pro Eintrag: Suffix vom Dateinamen trennen.
  const parsedEntries = rawSourceEntries.map(parseCompositeSourceEntry)
  // Nur die reinen Dateinamen — wird unten an Builder/Logger gegeben.
  const sourceFileNames = parsedEntries.map(e => e.name)

  FileLogger.info('composite-transcript', 'Starte Resolution', {
    libraryId,
    sourceCount: rawSourceEntries.length,
    sourceFileNames,
    transformationCount: parsedEntries.filter(e => e.templateName).length,
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

  // Shadow-Twins für gefundene Quellen laden (nur fuer evtl. Logging/Validierung)
  const sourceIds = sourceItems.map(s => s.id)
  const _shadowTwinDocs = sourceIds.length > 0
    ? await getShadowTwinsBySourceIds({ libraryId, sourceIds })
    : new Map()

  // Transkripte / Transformationen pro Quelle laden
  const resolvedSources: ResolvedSource[] = []
  const unresolvedSources: string[] = []

  for (let i = 0; i < parsedEntries.length; i++) {
    const entry = parsedEntries[i]
    const { name, templateName, raw } = entry
    const item = sourceItems.find(s => s.name === name)
    const mimeType = guessMimeType(name)
    let markdown: string | null = null

    if (!item) {
      // Datei nicht im Verzeichnis gefunden
      unresolvedSources.push(raw)
      resolvedSources.push({ name, index: i + 1, markdown: null, mimeType })
      continue
    }

    if (templateName) {
      // ── Transformations-Pfad: explizit kein Fallback auf Transcript ──
      // Siehe shadow-twin-contracts.mdc: templateName ist Pflicht und es gibt
      // kein "pick latest". Wir laden GENAU diese Transformation oder melden
      // sie als unresolved.
      // Achtung: `.md`-Quellen koennen ebenfalls transformiert werden
      // (z.B. Steckbrief-MD → `gaderform-bett-steckbrief`). Daher KEINE
      // Sonderbehandlung mehr fuer `.md` — der Pfad ist identisch zu PDFs/Audios.
      try {
        const record = await getShadowTwinArtifact({
          libraryId,
          sourceId: item.id,
          artifactKey: toArtifactKey({
            sourceId: item.id,
            kind: 'transformation',
            targetLanguage,
            templateName,
          }),
        })
        markdown = record?.markdown ?? null

        if (!markdown) {
          FileLogger.warn(
            'composite-transcript',
            `Transformation "${templateName}" fuer "${name}" nicht gefunden`,
            { libraryId, sourceId: item.id, targetLanguage },
          )
          unresolvedSources.push(raw)
        }
      } catch (error) {
        FileLogger.warn(
          'composite-transcript',
          `Transformation "${templateName}" fuer "${name}" nicht ladbar`,
          { error },
        )
        unresolvedSources.push(raw)
      }
    } else if (name.toLowerCase().endsWith('.md')) {
      // Markdown-Dateien direkt aus dem Storage lesen
      try {
        const binary = await provider.getBinary(item.id)
        markdown = await binary.blob.text()
      } catch (error) {
        FileLogger.warn('composite-transcript', `Markdown "${name}" nicht ladbar`, { error })
        unresolvedSources.push(raw)
      }
    } else if (!compositeSourceExpectsTranscript(item)) {
      // Bilder (u. a.): kein Shadow-Twin-Transkript — Platzhalter für LLM, nicht als Fehler zählen
      markdown = `*(Bildquelle „${name}“ — kein Text-Transkript; Zuordnung über Dateiname und Medienliste.)*`
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
          unresolvedSources.push(raw)
        }
      } catch (error) {
        FileLogger.warn('composite-transcript', `Transkript für "${name}" nicht ladbar`, { error })
        unresolvedSources.push(raw)
      }
    }

    // Leere/Whitespace-Inhalte gelten als "nicht aufgelöst".
    // Sonst entstehen stillschweigend Quellen ohne nutzbaren Inhalt.
    if (typeof markdown === 'string' && markdown.trim().length === 0) {
      FileLogger.warn('composite-transcript', `Leerer Inhalt für "${raw}"`, {
        libraryId,
        sourceId: item.id,
      })
      markdown = null
      unresolvedSources.push(raw)
    }

    resolvedSources.push({ name, index: i + 1, markdown, mimeType })
  }

  // Medien — dieselbe Aggregation wie im Sammel-Transkript / Medien-API
  const { mediaFiles, pdfSections, otherExtracted } = await buildAggregatedMediaForSources({
    libraryId,
    userEmail,
    targetLanguage,
    sourceItems,
  })

  // Geflachte Version zusammenbauen
  const resolvedMarkdown = assembleFlattenedMarkdown({
    sourceFileNames,
    sources: resolvedSources,
    mediaFiles,
    pdfSections,
    otherExtracted,
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
// MARKDOWN-BUILDER: Reference (persistiert, Wiki-Links)
// ═══════════════════════════════════════════════════════════════════════════════

interface ReferenceAssembleOptions {
  sourceFileNames: string[]
  sourceItems: Array<{ id: string; name: string; parentId: string }>
  mediaFiles: MediaFileInfo[]
  /** PDF → Fragmente + Transkript-Verweise */
  pdfSections: PdfMediaSection[]
  /** Nicht-PDF-Quellen mit extrahierten Bildfragmenten */
  otherExtracted: OtherSourceExtractedGroup[]
  targetLanguage: string
  /** Transkript-Dateiname als Wikilink-Zeile (Alias „Transkript prüfen“) für Nicht-.md-Quellen */
  includeTranscriptWikiLinks: boolean
  /**
   * Wenn gesetzt: Quellen-Wikilinks und `_source_files`-Eintraege erhalten ein
   * `/templateName`-Suffix (Sammel-Transformations-Modus). Markdown-Quellen
   * (`.md`) werden nicht mit Suffix versehen.
   */
  transformationTemplateName?: string
}

/**
 * Baut das leichtgewichtige Composite-Markdown mit Obsidian-Wiki-Links.
 * Diese Version wird im Storage persistiert.
 */
function assembleReferenceMarkdown(options: ReferenceAssembleOptions): string {
  const {
    sourceFileNames,
    sourceItems,
    mediaFiles,
    pdfSections,
    otherExtracted,
    targetLanguage,
    includeTranscriptWikiLinks,
    transformationTemplateName,
  } = options
  const now = new Date().toISOString()
  const parts: string[] = []

  // Helfer: liefert pro Quelldateiname den `_source_files`-Eintrag.
  // Im Transformations-Modus haengen wir IMMER das `/templateName`-Suffix an —
  // auch bei `.md`-Quellen. Markdown-Originale werden naemlich genauso wie
  // PDFs/Audios via Template transformiert und liegen dann als
  // `artifacts.transformation.<templateName>.<targetLanguage>` im Shadow-Twin.
  // Der Pool-Lookup behandelt `.md` ebenfalls als gleichwertige Quelle —
  // siehe `composite-transformations-pool.ts` — und der Submit-Button im
  // Dialog wird nur freigegeben, wenn alle Quellen das Template tatsaechlich
  // besitzen. Wuerden wir hier fuer `.md` den Suffix weglassen, wuerde die
  // Sammeldatei stillschweigend auf das Original zeigen statt auf die
  // Transformation — was die Anwender-Erwartung bricht.
  const entryForName = (name: string): string => {
    if (!transformationTemplateName) return name
    return appendTemplateSuffix(name, transformationTemplateName)
  }

  // `_source_files` mit Suffix (oder ohne im Default-Modus).
  const sourceFileEntries = sourceFileNames.map(entryForName)

  // Frontmatter
  // Kind bleibt `composite-transcript` (auch im Transformations-Modus) —
  // der Resolver erkennt den Modus am Schraegstrich-Suffix in `_source_files`.
  const sourceFilesJson = JSON.stringify(sourceFileEntries)
  parts.push([
    '---',
    `_source_files: ${sourceFilesJson}`,
    'kind: composite-transcript',
    `createdAt: ${now}`,
    '---',
  ].join('\n'))

  // Titel
  parts.push('')
  parts.push(transformationTemplateName ? '# Sammel-Transformationen' : '# Sammel-Transkript')

  // Quellen: nur „Dokument“-Quellen (keine Bilder) — Bilder stehen nur unter „Verfügbare Medien“,
  // sonst doppelte [[…]]-Liste (Quellen + Im Verzeichnis). _source_files bleibt vollständig.
  parts.push('')
  parts.push('## Quellen')
  let quellenNonImage = 0
  for (const name of sourceFileNames) {
    if (isImageMediaFromName(name)) continue
    quellenNonImage += 1
    parts.push('')
    parts.push(`### ${name}`)
    parts.push(`- [[${entryForName(name)}]]`)
    // Zweite Zeile: echte Transkript-MD im Storage (nur wenn Konfiguration FS-Spiegelung nutzt).
    // Im Transformations-Modus ueberspringen wir den Transkript-Pruefen-Link, da der
    // Wikilink bereits auf die Transformation zeigt und nicht auf das Transkript.
    if (includeTranscriptWikiLinks && !transformationTemplateName) {
      const item = sourceItems.find(s => s.name === name)
      if (item && compositeSourceExpectsTranscript(item)) {
        const transcriptFileName = buildArtifactName(
          { sourceId: item.id, kind: 'transcript', targetLanguage },
          name
        )
        parts.push(`  - [[${transcriptFileName}|Transkript prüfen]]`)
      }
    }
  }
  if (quellenNonImage === 0) {
    parts.push('')
    parts.push('*Nur Bilder ausgewählt — siehe „Verfügbare Medien“; alle Namen stehen weiterhin im Frontmatter.*')
  }

  // Medien: Ordner-Dateien, dann je PDF (Fragmente + Transkript-Verweise), dann andere Quelltypen
  const directMedia = mediaFiles.filter(m => !m.sourceFile)
  const showMediaSection =
    directMedia.length > 0 || pdfSections.length > 0 || otherExtracted.length > 0

  if (showMediaSection) {
    parts.push('')
    parts.push('## Verfügbare Medien')

    if (directMedia.length > 0) {
      parts.push('')
      parts.push('### Im Quellverzeichnis (eigene Bilddateien)')
      for (const m of directMedia) {
        parts.push('')
        parts.push(`**${m.name}**`)
        parts.push('')
        parts.push(`![[${m.name}]]`)
        parts.push('')
      }
    }

    if (pdfSections.length > 0) {
      parts.push('')
      parts.push('### Medien je PDF-Datei')
      parts.push('')
      parts.push(
        '*Extrahierte Seiten-/Objektbilder aus dem Shadow-Twin; zusätzlich Dateinamen, die im Transkript dieser PDF vorkommen (z. B. Verweise auf Ordner-Bilder).*',
      )

      for (const section of pdfSections) {
        parts.push('')
        parts.push(`#### ${section.pdfFileName}`)
        parts.push('')
        parts.push(`- [[${section.pdfFileName}]]`)

        if (section.fragments.length > 0) {
          parts.push('')
          parts.push('*Aus dieser Datei extrahiert:*')
          for (const m of section.fragments) {
            const twinFolder = generateShadowTwinFolderName(section.pdfFileName)
            const pathInVault = `${twinFolder}/${m.name}`
            parts.push('')
            parts.push(`**${m.name}**`)
            parts.push('')
            parts.push(`![[${pathInVault}]]`)
            parts.push('')
          }
        }

        if (section.transcriptOnlyRefs.length > 0) {
          parts.push('')
          parts.push('*Im Transkript dieser PDF erwähnt (weitere Medien — oft Dateien im gleichen Ordner):*')
          for (const ref of section.transcriptOnlyRefs) {
            parts.push(`- [[${ref}]]`)
          }
          parts.push('')
        }

        if (section.fragments.length === 0 && section.transcriptOnlyRefs.length === 0) {
          parts.push('')
          parts.push(
            '*Keine extrahierten Bilder; im Transkript wurden keine weiteren Bild-Dateinamen erkannt.*',
          )
          parts.push('')
        }
      }
    }

    if (otherExtracted.length > 0) {
      parts.push('')
      parts.push('### Medien aus anderen Quelldateien (z. B. Office)')
      for (const group of otherExtracted) {
        parts.push('')
        parts.push(`#### ${group.sourceFileName}`)
        parts.push('')
        parts.push(`- [[${group.sourceFileName}]]`)
        parts.push('')
        parts.push('*Aus dieser Datei extrahiert:*')
        for (const m of group.fragments) {
          const twinFolder = generateShadowTwinFolderName(group.sourceFileName)
          const pathInVault = `${twinFolder}/${m.name}`
          parts.push('')
          parts.push(`**${m.name}**`)
          parts.push('')
          parts.push(`![[${pathInVault}]]`)
          parts.push('')
        }
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
  pdfSections: PdfMediaSection[]
  otherExtracted: OtherSourceExtractedGroup[]
}

/**
 * Baut die geflachte Version des Composite-Markdowns für die LLM-Verarbeitung.
 * Enthält Quellenübersicht, Medien-Liste und <source>-Blöcke mit Transkript-Inhalt.
 * Wird nur im Speicher erzeugt und nie persistiert.
 */
function assembleFlattenedMarkdown(options: FlattenedAssembleOptions): string {
  const { sourceFileNames, sources, mediaFiles, pdfSections, otherExtracted } = options
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

  // Verfügbare Medien (für semantische Zuordnung durch LLM) — gleiche Logik wie in der persistierten Prüfansicht
  const directMedia = mediaFiles.filter(m => !m.sourceFile)
  const showMedia = directMedia.length > 0 || pdfSections.length > 0 || otherExtracted.length > 0
  if (showMedia) {
    parts.push('')
    parts.push('## Verfügbare Medien')

    if (directMedia.length > 0) {
      parts.push('')
      parts.push('### Im Quellverzeichnis')
      for (const m of directMedia) {
        const sizeStr = formatFileSize(m.size)
        parts.push(`- ${m.name} (Bild, ${sizeStr})`)
      }
    }

    if (pdfSections.length > 0) {
      parts.push('')
      parts.push('### Je PDF-Datei')
      for (const section of pdfSections) {
        parts.push('')
        parts.push(`#### ${section.pdfFileName}`)
        if (section.fragments.length > 0) {
          parts.push('*Extrahiert:*')
          for (const m of section.fragments) {
            parts.push(`- ${m.name} (${formatFileSize(m.size)})`)
          }
        }
        if (section.transcriptOnlyRefs.length > 0) {
          parts.push('*Im Transkript erwähnt:*')
          for (const ref of section.transcriptOnlyRefs) {
            parts.push(`- ${ref}`)
          }
        }
        if (section.fragments.length === 0 && section.transcriptOnlyRefs.length === 0) {
          parts.push('- *(keine Bilder / keine Verweise erkannt)*')
        }
      }
    }

    if (otherExtracted.length > 0) {
      parts.push('')
      parts.push('### Aus anderen Quelldateien extrahiert')
      for (const group of otherExtracted) {
        parts.push('')
        parts.push(`#### ${group.sourceFileName}`)
        for (const m of group.fragments) {
          parts.push(`- ${m.name} (${formatFileSize(m.size)})`)
        }
      }
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
