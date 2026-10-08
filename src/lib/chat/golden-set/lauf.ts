/**
 * @fileoverview Golden-Set-Lauf als Service (Welle F) — Kern aus `scripts/golden-set-run.ts`.
 *
 * @description
 * Faehrt die Fragen eines Golden-Sets gegen den Story-Modus EINER Library
 * (Orchestrator direkt, derselbe Weg wie die Stream-Route, OHNE
 * Antwort-Cache), prueft jede Antwort deterministisch und optional mit dem
 * Richter-Modell, und baut den Bericht. Skript und Bruecken-Job rufen
 * dieselbe Funktion; jede Frage bekommt einen Query-Log-Eintrag.
 *
 * @module chat/golden-set
 */

import { buildFilters } from '@/lib/chat/common/filters'
import { decideRetrieverMode } from '@/lib/chat/common/retriever-decider'
import { runChatOrchestrated } from '@/lib/chat/orchestrator'
import { callLlmJson } from '@/lib/chat/common/llm'
import { dokumenteNummerieren } from '@/lib/chat/common/zitatmarken'
import { ANSWER_LENGTH_DEFAULT } from '@/lib/chat/constants'
import { startQueryLog } from '@/lib/logging/query-logger'
import { getCollectionOnly } from '@/lib/repositories/vector-repo'
import { pruefeGoldenSetGegenFacetten, type GoldenSet } from './schema'
import { antwortOhneFussnote, pruefeGoldenSetFrage } from './pruefung'
import { buildRichterMessages, richterSchemaJson, richterUrteilSchema, werteRichterUrteil, type RichterErgebnis } from './richter'
import { baueBericht, berichtAlsMarkdown, erwarteteWerteDerFrage, type GoldenSetBericht, type GoldenSetLaufEintrag } from './bericht'
import type { FrageKontext } from './kontext'

export const RETRIEVER_WAHL = ['auto', 'chunk', 'summary'] as const
export type RetrieverWahl = (typeof RETRIEVER_WAHL)[number]

export interface GoldenSetLaufArgs {
  kontext: FrageKontext
  set: GoldenSet
  titel: string
  retriever: RetrieverWahl
  temperature: number
  /** Nur diese Frage-IDs; weglassen = alle. */
  nur?: string[]
  richterModel?: string
  onFortschritt?: (stand: { index: number; gesamt: number; frageId: string; queryId: string; bestanden: boolean }) => Promise<void> | void
}

export interface GoldenSetLaufErgebnis {
  bericht: GoldenSetBericht
  markdown: string
  eintraege: GoldenSetLaufEintrag[]
  queryIds: string[]
  model: string
}

/** Kennungen des Sets → fileId ueber die Meta-Dokumente; fehlende oder doppelte Kennungen sind Fehler. */
export async function loeseKennungenAuf(set: GoldenSet, libraryKey: string, libraryId: string): Promise<Map<string, string>> {
  const kennungen = [...new Set(set.fragen.flatMap((f) => f.erwarteteDokumente.map((d) => d[set.kennungFeld])))]
  const feld = `docMetaJson.${set.kennungFeld}`
  const varianten = kennungen.flatMap((k) => (Number.isFinite(Number(k)) ? [k, Number(k)] : [k]))
  const col = await getCollectionOnly(libraryKey)
  const docs = await col
    .find({ kind: 'meta', libraryId, [feld]: { $in: varianten } }, { projection: { fileId: 1, [feld]: 1, _id: 0 } })
    .toArray()
  const map = new Map<string, string>()
  const doppelt: string[] = []
  for (const doc of docs) {
    const meta = doc.docMetaJson as Record<string, unknown> | undefined
    const kennung = String(meta?.[set.kennungFeld] ?? '')
    const fileId = typeof doc.fileId === 'string' ? doc.fileId : ''
    if (!kennung || !fileId) continue
    if (map.has(kennung) && map.get(kennung) !== fileId) doppelt.push(kennung)
    map.set(kennung, fileId)
  }
  const fehlend = kennungen.filter((k) => !map.has(k))
  if (fehlend.length > 0) throw new Error(`Kennungen ohne Meta-Dokument (${set.kennungFeld}): ${fehlend.join(', ')}`)
  if (doppelt.length > 0) throw new Error(`Kennungen mit mehreren Dokumenten (${set.kennungFeld}): ${doppelt.join(', ')}`)
  return map
}

export async function fahreGoldenSet(args: GoldenSetLaufArgs): Promise<GoldenSetLaufErgebnis> {
  const { kontext, set, titel, temperature, richterModel } = args
  const { ctx, libraryKey, facetDefs, facetDefsFuerModell, chatConfig, antwortregeln, facettenKontext, apiKey, model } = kontext
  const libraryId = ctx.library.id
  const userEmail = kontext.userEmail
  const setFehler = pruefeGoldenSetGegenFacetten(set, facetDefs)
  if (setFehler.length > 0) throw new Error(`Golden-Set passt nicht zum Facetten-Schema:\n${setFehler.join('\n')}`)
  const kennungZuFileId = await loeseKennungenAuf(set, libraryKey, libraryId)
  const fragen = args.nur ? set.fragen.filter((f) => args.nur?.includes(f.id)) : set.fragen
  if (fragen.length === 0) throw new Error('Keine Fragen ausgewaehlt (nur passt auf keine ID)')

  const eintraege: GoldenSetLaufEintrag[] = []
  const queryIds: string[] = []
  for (const [index, frage] of fragen.entries()) {
    const explicit = args.retriever === 'auto' ? null : args.retriever
    const built = buildFilters(new URL('http://golden-set.local/'), ctx.library, userEmail, libraryId, explicit ?? 'chunk')
    const entscheidung = await decideRetrieverMode({ libraryId, userEmail, filter: built.mongo, isTOCQuery: false, explicitRetriever: explicit })
    const retriever = entscheidung.mode
    const queryId = await startQueryLog({
      libraryId, userEmail, question: frage.frage, mode: retriever === 'summary' ? 'summaries' : 'chunks',
      queryType: 'question', answerLength: ANSWER_LENGTH_DEFAULT, retriever, llmModel: model, antwortregeln, facettenKontext,
      filtersNormalized: { ...built.normalized, goldenSet: { titel, frageId: frage.id, baseline: kontext.baseline } },
    })
    const output = await runChatOrchestrated({
      retriever, libraryId, userEmail, question: frage.frage, answerLength: ANSWER_LENGTH_DEFAULT, filters: built.mongo,
      queryId, context: {}, chatConfig, facetDefs: facetDefsFuerModell, apiKey, llmModel: model, temperature,
    })
    const antwort = antwortOhneFussnote(output.answer, output.nachpruefung)
    const gruppen = dokumenteNummerieren(output.sources)
    const benutzt = output.references.map((r) => r.number)
    const ergebnis = pruefeGoldenSetFrage({ frage, kennungFeld: set.kennungFeld, kennungZuFileId, antwort, gruppen, benutzt, facetDefs })

    let richter: RichterErgebnis | undefined
    if (richterModel) {
      const zitiert = gruppen.filter((g) => ergebnis.zitiert.includes(g.nummer))
      const { data } = await callLlmJson(
        { apiKey, model: richterModel, temperature: 0.1, responseFormat: { type: 'json_object' }, messages: buildRichterMessages({ frage, antwort, zitiert, facetDefs }) },
        richterUrteilSchema,
        richterSchemaJson,
      )
      richter = werteRichterUrteil(frage, data)
    }
    eintraege.push({ ergebnis, richter, erwarteteWerte: erwarteteWerteDerFrage(set, frage.id) })
    queryIds.push(queryId)
    await args.onFortschritt?.({ index: index + 1, gesamt: fragen.length, frageId: frage.id, queryId, bestanden: ergebnis.deterministisch.bestanden && (richter?.bestanden ?? true) })
  }

  const bericht = baueBericht(eintraege)
  const markdown = berichtAlsMarkdown(bericht, `${titel} (${new Date().toISOString().slice(0, 10)}, Modell ${model}${kontext.baseline ? ', BASELINE' : ''})`)
  return { bericht, markdown, eintraege, queryIds, model }
}
