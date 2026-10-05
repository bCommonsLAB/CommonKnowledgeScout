/**
 * @fileoverview Unsichtbarer Anhang fuer die Ingestion: die Transkripte der
 * verbundenen Quellen.
 *
 * Owner-Entscheidung 05.10.2026: In die Suche soll die ganze Tiefe, nicht nur
 * das Ergebnis der Vorlage. Deshalb bekommt der eingebettete Text einen letzten
 * Abschnitt, den die Anzeige nicht kennt (`docMetaJson.markdown` bleibt der
 * Body der Transformation): je verbundener Quelle ein Kapitel
 * `## Anhang N: <Dateiname> (<Art>)` mit ihrem Transkript. Der Retriever
 * markiert diese Chunks als `sourceType: 'anhang'` samt Nummer und Quelle, damit
 * eine Antwort sagen kann, aus welchem Anhang sie stammt.
 *
 * Regeln:
 * - Sammeldatei (`_source_files`): jede Quelle in Reihenfolge der Liste; mit
 *   Template-Suffix die Transformation, `.md` der Dateitext, Bilder ohne Text
 *   werden ausgelassen, alles andere das Transkript.
 * - Einzelquelle (PDF, Audio …), deren Transformation ingestiert wird: ein
 *   Anhang mit dem eigenen Transkript. Ist der ingestierte Text schon das
 *   Transkript, gibt es keinen Anhang (keine Dopplung).
 * - Fehlt der Text einer gelisteten Quelle, ist das ein Fehler, kein Skip
 *   (`ingestion-contracts.md` §2).
 * - Deterministisch: gleiche Quellen, gleiche Reihenfolge, gleicher Text.
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { SourceAppendix, SourceAppendixSection } from '@/types/external-jobs'
import { parseCompositeSourceFilesFromMeta } from '@/lib/creation/composite-source-files-meta'
import { parseCompositeSourceEntry } from '@/lib/creation/composite-source-entry'
import { findCompositeSourceItems } from '@/lib/creation/composite-source-path'
import { getShadowTwinArtifact, toArtifactKey } from '@/lib/repositories/shadow-twin-repo'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'
import { isImageMediaFromName } from '@/lib/media-types'
import { FileLogger } from '@/lib/debug/logger'

/** Trennzeile vor dem Anhang — analog zu `DOKUMENT_BODY_MARKER`. */
export const ANHANG_MARKER = '--- Anhang beginnt hier ---'

export interface BuildSourceAppendixArgs {
  libraryId: string
  /** Storage-Id der ingestierten Quelle (Sammeldatei oder Einzeldatei). */
  sourceId: string
  sourceName: string
  /** Ordner der Quelle — Pfade in `_source_files` sind relativ dazu. Pflicht nur bei Sammeldateien. */
  parentId?: string
  targetLanguage: string
  provider: StorageProvider
  /** Frontmatter des ingestierten Markdowns (traegt `_source_files` bei Sammeldateien). */
  meta: Record<string, unknown>
  /** true, wenn der ingestierte Text eine Transformation ist (nicht das Transkript selbst). */
  ingestedIsTransformation: boolean
}

interface GeladenerText {
  name: string
  art: 'Transkript' | 'Transformation' | 'Markdown'
  text: string
}

async function ladeTranskript(libraryId: string, sourceId: string, targetLanguage: string): Promise<string | null> {
  const record = await getShadowTwinArtifact({
    libraryId,
    sourceId,
    artifactKey: toArtifactKey({ sourceId, kind: 'transcript', targetLanguage }),
  })
  return record?.markdown ?? null
}

async function ladeTransformation(
  libraryId: string,
  sourceId: string,
  targetLanguage: string,
  templateName: string,
): Promise<string | null> {
  const record = await getShadowTwinArtifact({
    libraryId,
    sourceId,
    artifactKey: toArtifactKey({ sourceId, kind: 'transformation', targetLanguage, templateName }),
  })
  return record?.markdown ?? null
}

/** Quellen einer Sammeldatei laden — jede gelistete Quelle muss Text liefern. */
async function ladeSammelQuellen(args: BuildSourceAppendixArgs, entries: string[]): Promise<GeladenerText[]> {
  if (!args.parentId) {
    throw new Error(`Anhang fuer Ingestion: Elternordner von "${args.sourceName}" unbekannt — Quellen der Sammeldatei nicht aufloesbar`)
  }
  const parsed = entries.map(parseCompositeSourceEntry)
  const items = await findCompositeSourceItems(args.provider, args.parentId, parsed)
  const texte: GeladenerText[] = []
  for (const entry of parsed) {
    if (isImageMediaFromName(entry.name)) continue
    // `_include_self` traegt die Sammeldatei selbst in `_source_files` ein —
    // ihr Text steckt schon in der Transformation, kein eigener Anhang.
    if (entry.name === args.sourceName) continue
    const item = items.get(entry.raw)
    if (!item) {
      throw new Error(`Anhang fuer Ingestion: Quelle "${entry.raw}" nicht im Storage gefunden`)
    }
    let text: string | null = null
    let art: GeladenerText['art']
    if (entry.templateName) {
      art = 'Transformation'
      text = await ladeTransformation(args.libraryId, item.id, args.targetLanguage, entry.templateName)
    } else if (entry.name.toLowerCase().endsWith('.md')) {
      art = 'Markdown'
      const binary = await args.provider.getBinary(item.id)
      text = await binary.blob.text()
    } else {
      art = 'Transkript'
      text = await ladeTranskript(args.libraryId, item.id, args.targetLanguage)
    }
    const body = text ? stripAllFrontmatter(text).trim() : ''
    if (body.length === 0) {
      throw new Error(`Anhang fuer Ingestion: ${art} von "${entry.raw}" fehlt oder ist leer`)
    }
    texte.push({ name: entry.name, art, text: body })
  }
  return texte
}

function zusammenbauen(texte: GeladenerText[]): SourceAppendix {
  const sections: SourceAppendixSection[] = []
  let markdown = `${ANHANG_MARKER}\n\n`
  texte.forEach((t, i) => {
    const index = i + 1
    const title = `Anhang ${index}: ${t.name} (${t.art})`
    if (i > 0) markdown += '\n\n'
    const start = markdown.length
    markdown += `## ${title}\n\n${t.text}`
    sections.push({ index, title, sourceName: t.name, art: t.art, start, end: markdown.length })
  })
  return { markdown, sections }
}

/**
 * Baut den Anhang oder liefert `null`, wenn es nichts anzuhaengen gibt
 * (ingestierter Text ist selbst das Transkript, oder Einzelquelle ohne Transkript).
 */
export async function buildSourceAppendix(args: BuildSourceAppendixArgs): Promise<SourceAppendix | null> {
  const entries = parseCompositeSourceFilesFromMeta(args.meta)
  if (entries.length > 0) {
    const texte = await ladeSammelQuellen(args, entries)
    if (texte.length === 0) return null
    const appendix = zusammenbauen(texte)
    FileLogger.info('ingest-anhang', 'Anhang aus Sammeldatei-Quellen gebaut', {
      sourceId: args.sourceId, quellen: texte.map((t) => `${t.name} (${t.art})`), zeichen: appendix.markdown.length,
    })
    return appendix
  }

  if (!args.ingestedIsTransformation) return null

  const transcript = await ladeTranskript(args.libraryId, args.sourceId, args.targetLanguage)
  const body = transcript ? stripAllFrontmatter(transcript).trim() : ''
  if (body.length === 0) {
    FileLogger.info('ingest-anhang', 'Kein Transkript fuer Einzelquelle — kein Anhang', { sourceId: args.sourceId })
    return null
  }
  const appendix = zusammenbauen([{ name: args.sourceName, art: 'Transkript', text: body }])
  FileLogger.info('ingest-anhang', 'Anhang mit eigenem Transkript gebaut', {
    sourceId: args.sourceId, zeichen: appendix.markdown.length,
  })
  return appendix
}
