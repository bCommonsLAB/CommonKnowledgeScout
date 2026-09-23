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
import { getShadowTwinsBySourceIds, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
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
}): Promise<{ jobId: string; erzwungen: string; hinweis?: string }> {
  const { library, libraryId, userEmail, provider, source, template, llmModel, zielsprache } = args
  const twins = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [source.itemId] })
  const doc = twins.get(source.itemId) ?? null
  const entscheidung = entscheideTransformationErzwingen({
    angefordert: args.erzwingen,
    doc,
    template,
    zielsprache: zielsprache ?? 'de',
    vorlageAktualisiertAm: args.vorlageAktualisiertAm,
  })
  const hinweis = andereVorlagenHinweis(doc, template)

  // Markdown/Sammeldatei: die Quelle IST der Text — kein Transkript noetig.
  if (istMarkdownQuelle(source.name)) {
    const { jobId } = await starteMarkdownTransformation({
      libraryId, userEmail, provider, source, template, llmModel, zielsprache,
      erzwingen: entscheidung.erzwingen,
    })
    return { jobId, erzwungen: entscheidung.grund, ...(hinweis ? { hinweis } : {}) }
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
  return { jobId, erzwungen: entscheidung.grund, ...(hinweis ? { hinweis } : {}) }
}

/**
 * Befund 23.09.2026: `transformation_starten` ohne `template` nimmt die
 * Library-Vorgabe — auch wenn am Twin schon eine ANDERE Vorlage haengt. Die
 * Probe in commoning-methods startete so versehentlich `pdfanalyse-commoning`
 * auf eine `commoning-methode-de`-Familie. Der Start bleibt erlaubt (zwei
 * Vorlagen nebeneinander sind legitim), aber der Aufrufer erfaehrt es.
 */
export function andereVorlagenHinweis(doc: ShadowTwinDocument | null, template: string): string | undefined {
  const vorhanden = Object.entries(doc?.artifacts?.transformation ?? {})
    .filter(([name, langs]) => name !== template && !!langs && Object.values(langs).some((r) => typeof r?.markdown === 'string'))
    .map(([name]) => name)
  if (vorhanden.length === 0) return undefined
  return (
    `Am Twin haengt schon eine Transformation mit Vorlage ${vorhanden.map((n) => `"${n}"`).join(', ')}; ` +
    `dieser Job schreibt Vorlage "${template}" daneben. Galerie und Schaufenster zeigen danach "${template}". ` +
    'Falls die vorhandene gemeint war: template entsprechend angeben.'
  )
}
