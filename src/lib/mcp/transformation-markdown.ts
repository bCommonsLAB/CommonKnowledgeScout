/**
 * @fileoverview `transformation_starten` fuer Markdown-Quellen und Sammeldateien.
 *
 * @description
 * Eine Markdown-Quelle hat kein Transkript-Artefakt — sie IST der Text. Frueher
 * verwiesen `transformation_starten` („zuerst quelle_erschliessen") und
 * `quelle_erschliessen` („Markdown laeuft ueber transformation_starten")
 * aufeinander; ueber die Bruecke gab es keinen Weg (Befund 21.09.2026).
 *
 * Hier wird der Job in der Form des UI-Wegs angelegt (der Worker laedt die
 * Quelle selbst). Bei `kind: composite-transcript` wird VORHER geprueft, ob alle
 * `_source_files` aufloesbar sind — sonst stirbt der Job erst im Worker, und der
 * Agent erfaehrt die fehlenden Dateien nur ueber `job_status`.
 * Aus `tools-erschliessen.ts` ausgelagert (200-Zeilen-Regel).
 *
 * @module mcp
 */

import { resolveCompositeTranscript } from '@/lib/creation/composite-transcript'
import { enqueueSourceMarkdownJob } from '@/lib/external-jobs/enqueue-markdown-job'
import { parseFrontmatter, stripAllFrontmatter } from '@/lib/markdown/frontmatter'
import { getMediaKindFromName } from '@/lib/media-types'
import type { StorageProvider } from '@/lib/storage/types'
import type { ResolvedSource } from './tools-erschliessen-shared'

/**
 * Quellen, die `transformation_starten` direkt (ohne Transkript) nimmt —
 * dieselbe Erkennung wie die Pipeline-Route des UI (`.md`, `.mdx`, `.txt`).
 */
export function istMarkdownQuelle(fileName: string): boolean {
  return getMediaKindFromName(fileName) === 'markdown'
}

export async function starteMarkdownTransformation(args: {
  libraryId: string
  userEmail: string
  provider: StorageProvider
  source: ResolvedSource
  template: string
  llmModel?: string
  zielsprache?: string
}): Promise<{ jobId: string }> {
  const { libraryId, userEmail, provider, source, template, llmModel, zielsprache } = args
  const { blob } = await provider.getBinary(source.itemId)
  const markdown = await blob.text()
  const { meta } = parseFrontmatter(markdown)

  if (meta['kind'] === 'composite-transcript') {
    const { unresolvedSources } = await resolveCompositeTranscript({
      libraryId,
      userEmail,
      targetLanguage: zielsprache ?? 'de',
      compositeMarkdown: markdown,
      parentId: source.parentId,
      compositeFileName: source.name,
      compositeSourceId: source.itemId,
      nurQuellenPruefen: true,
    })
    if (unresolvedSources.length > 0) {
      throw new Error(
        `Sammeldatei "${source.name}": ${unresolvedSources.length} Quelle(n) aus _source_files nicht aufloesbar: ` +
          `${unresolvedSources.join(', ')} — Datei fehlt am Pfad oder hat noch kein Transkript; ` +
          'genau diese Dateien zuerst mit quelle_erschliessen erschliessen. Kein Job angelegt.',
      )
    }
  } else if (!stripAllFrontmatter(markdown).trim()) {
    throw new Error(`"${source.name}" hat keinen Text unter dem Frontmatter — nichts zu transformieren`)
  }

  return enqueueSourceMarkdownJob({
    libraryId, userEmail, source, template, llmModel, targetLanguage: zielsprache,
  })
}
