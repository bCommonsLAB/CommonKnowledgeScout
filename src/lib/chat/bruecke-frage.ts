/**
 * @fileoverview EINE Frage an den Story-Modus stellen, ohne Browser (Welle F, `frage_stellen`).
 *
 * @description
 * Derselbe Weg wie die Stream-Route: Filter, Retriever-Entscheidung,
 * Antwortregeln, Nachpruefung, Query-Log. Mit `ohneCache: false` wird vorher
 * der Antwort-Cache befragt (derselbe Hash wie im UI); ein Treffer wird als
 * solcher benannt. `baseline` misst den Stand ohne Woerterbuch und Regeln.
 * Keine Zusammenfassung des Orchestrators — Antwort, Belege und
 * Nachpruefung kommen roh zurueck, damit der Agent sie pruefen kann.
 *
 * @module chat
 */

import { buildFilters } from '@/lib/chat/common/filters'
import { decideRetrieverMode } from '@/lib/chat/common/retriever-decider'
import { runChatOrchestrated } from '@/lib/chat/orchestrator'
import { dokumenteNummerieren } from '@/lib/chat/common/zitatmarken'
import { ANSWER_LENGTH_DEFAULT } from '@/lib/chat/constants'
import { startQueryLog } from '@/lib/logging/query-logger'
import { findQueryByQuestionAndContext } from '@/lib/db/queries-repo'
import type { NachpruefungErgebnis } from '@/types/nachpruefung'
import { baueFrageKontext } from './golden-set/kontext'
import type { RetrieverWahl } from './golden-set/lauf'

export interface FrageAntwort {
  queryId: string
  cacheTreffer: boolean
  antwort: string
  retriever: string
  model: string
  baseline: boolean
  /** Nummerierte Dokumente wie in den Belegen des UI. */
  dokumente: Array<{ nummer: number; fileId: string; name: string | null; facetten: Record<string, unknown> }>
  /** Nummern der Dokumente, die die Antwort zitiert. */
  zitiert: number[]
  nachpruefung: NachpruefungErgebnis | null
  timing: { retrievalMs: number; llmMs: number } | null
}

export async function beantworteFrage(args: {
  libraryId: string
  userEmail: string
  frage: string
  ohneCache: boolean
  baseline: boolean
  retriever: RetrieverWahl
  temperature: number
}): Promise<FrageAntwort> {
  const { libraryId, userEmail } = args
  const frage = args.frage.trim()
  if (!frage) throw new Error('frage ist leer')
  const kontext = await baueFrageKontext({ libraryId, userEmail, baseline: args.baseline })
  const { ctx, chatConfig, facetDefsFuerModell, antwortregeln, facettenKontext, apiKey, model } = kontext
  const explicit = args.retriever === 'auto' ? null : args.retriever
  const built = buildFilters(new URL('http://bruecke.local/'), ctx.library, userEmail, libraryId, explicit ?? 'chunk')
  const entscheidung = await decideRetrieverMode({ libraryId, userEmail, filter: built.mongo, isTOCQuery: false, explicitRetriever: explicit })
  const retriever = entscheidung.mode

  if (!args.ohneCache) {
    // Cache-Hash wie im UI: Retriever auf chunk|summary normalisiert, Regeln und Facetten-Kontext im Hash.
    const treffer = await findQueryByQuestionAndContext({
      libraryId, userEmail, question: frage, queryType: 'question', answerLength: ANSWER_LENGTH_DEFAULT,
      targetLanguage: chatConfig.targetLanguage, character: chatConfig.character, accessPerspective: chatConfig.accessPerspective,
      socialContext: chatConfig.socialContext, genderInclusive: chatConfig.genderInclusive,
      retriever: retriever === 'chunkSummary' ? 'chunk' : retriever, llmModel: model, antwortregeln, facettenKontext,
    })
    if (treffer?.answer?.trim()) {
      return {
        queryId: treffer.queryId, cacheTreffer: true, antwort: treffer.answer, retriever: treffer.retriever ?? retriever, model, baseline: args.baseline,
        dokumente: [], zitiert: (treffer.references ?? []).map((r) => r.number), nachpruefung: treffer.nachpruefung ?? null, timing: null,
      }
    }
  }

  const queryId = await startQueryLog({
    libraryId, userEmail, question: frage, mode: retriever === 'summary' ? 'summaries' : 'chunks',
    queryType: 'question', answerLength: ANSWER_LENGTH_DEFAULT, retriever, llmModel: model, antwortregeln, facettenKontext,
    filtersNormalized: { ...built.normalized, bruecke: { werkzeug: 'frage_stellen', baseline: args.baseline } },
  })
  const output = await runChatOrchestrated({
    retriever, libraryId, userEmail, question: frage, answerLength: ANSWER_LENGTH_DEFAULT, filters: built.mongo,
    queryId, context: {}, chatConfig, facetDefs: facetDefsFuerModell, apiKey, llmModel: model, temperature: args.temperature,
  })
  const gruppen = dokumenteNummerieren(output.sources)
  return {
    queryId, cacheTreffer: false, antwort: output.answer, retriever, model, baseline: args.baseline,
    dokumente: gruppen.map((g) => ({
      nummer: g.nummer, fileId: g.fileId, name: g.fileName ?? null,
      facetten: Object.fromEntries(kontext.facetDefs.map((d) => [d.metaKey, g.sources[0]?.metadata?.[d.metaKey] ?? null]).filter(([, v]) => v !== null)),
    })),
    zitiert: output.references.map((r) => r.number),
    nachpruefung: output.nachpruefung ?? null,
    timing: { retrievalMs: output.retrievalMs, llmMs: output.llmMs },
  }
}
