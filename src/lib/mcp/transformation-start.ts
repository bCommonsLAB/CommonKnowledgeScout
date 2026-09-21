/**
 * @fileoverview Start EINER Transformation fuer `transformation_starten`.
 *
 * @description
 * Je Quelle: erst entscheiden, ob das Template-Gate uebergangen werden muss
 * (`transformation-erzwingen.ts` — wirft, wenn die Transformation aktuell ist),
 * dann den passenden Job anlegen: Markdown/Sammeldatei ueber
 * `transformation-markdown.ts`, alles andere mit dem Transkript aus MongoDB.
 * Aus `tools-erschliessen.ts` ausgelagert (200-Zeilen-Regel).
 *
 * @module mcp
 */

import { enqueueTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import type { ResolvedSource } from './tools-erschliessen-shared'
import { entscheideTransformationErzwingen } from './transformation-erzwingen'
import { istMarkdownQuelle, starteMarkdownTransformation } from './transformation-markdown'

export async function starteTransformation(args: {
  library: Library
  libraryId: string
  userEmail: string
  provider: StorageProvider
  source: ResolvedSource
  template: string
  llmModel?: string
  zielsprache?: string
  erzwingen?: boolean
  vorlageAktualisiertAm: string | undefined
}): Promise<{ jobId: string; erzwungen: string }> {
  const { library, libraryId, userEmail, provider, source, template, llmModel, zielsprache } = args
  const twins = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [source.itemId] })
  const entscheidung = entscheideTransformationErzwingen({
    angefordert: args.erzwingen,
    doc: twins.get(source.itemId) ?? null,
    template,
    zielsprache: zielsprache ?? 'de',
    vorlageAktualisiertAm: args.vorlageAktualisiertAm,
  })

  // Markdown/Sammeldatei: die Quelle IST der Text — kein Transkript noetig.
  if (istMarkdownQuelle(source.name)) {
    const { jobId } = await starteMarkdownTransformation({
      libraryId, userEmail, provider, source, template, llmModel, zielsprache,
      erzwingen: entscheidung.erzwingen,
    })
    return { jobId, erzwungen: entscheidung.grund }
  }

  const service = new ShadowTwinService({
    library, userEmail, sourceId: source.itemId, sourceName: source.name, parentId: source.parentId, provider,
  })
  const transcript = await service.getMarkdown({ kind: 'transcript', targetLanguage: '' })
  if (!transcript?.markdown?.trim()) {
    throw new Error(`Kein Transkript fuer "${source.name}" — zuerst quelle_erschliessen (oder Pipeline im KS-UI)`)
  }
  const { jobId } = await enqueueTemplateOnTextJob({
    libraryId, userEmail, source, template, llmModel, targetLanguage: zielsprache,
    erzwingen: entscheidung.erzwingen,
    extractedText: transcript.markdown,
  })
  return { jobId, erzwungen: entscheidung.grund }
}
