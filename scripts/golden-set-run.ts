/**
 * @fileoverview Golden-Set-Läufer (Plan `story-status-modalitaet`, m0).
 *
 * @description
 * Fährt die Fragen eines Golden-Sets gegen den Story-Modus EINER Library und
 * prüft jede Antwort deterministisch (zitierte Dokumente, Pflicht-Labels,
 * Verbotslisten) und optional mit einem Richter-Modell (vier Ja/Nein-Fragen).
 * Ergebnis: JSON mit allen Antworten und Markdown-Bericht (Quote je Fragetyp
 * und je Facettenwert) — der Bericht ist das, was in den Plan kommt.
 *
 * Der Läufer ruft den Orchestrator direkt (gleicher Weg wie die Stream-Route:
 * Filter, Retriever-Entscheidung, Antwortregeln, Nachprüfung), OHNE
 * Antwort-Cache: jede Frage wird frisch beantwortet. Jede Frage bekommt einen
 * Query-Log-Eintrag (Plan §5 „Die Läufe landen im Query-Log").
 *
 * Sicherheit:
 * - `--libraryId`, `--userEmail` und `--set` sind PFLICHT (kein stiller Default).
 *   `--userEmail` sollte der Owner sein: sonst fehlen Entwürfe als Quelle.
 * - Schreibt in Mongo NUR Query-Log-Einträge (wie eine Frage in der UI).
 * - Das Golden-Set liegt bei der Library, nicht im Repo; der Ausgabeordner
 *   `golden-set-laeufe/` ist gitignoriert.
 *
 * @usage
 *   pnpm tsx scripts/golden-set-run.ts --libraryId=<id> --userEmail=<owner> --set=<pfad.json> \
 *     [--model=<llm-id>] [--richterModel=<llm-id>] [--titel=Baseline] [--nur=id1,id2] \
 *     [--retriever=auto|chunk|summary] [--temperature=0.3] [--out=golden-set-laeufe]
 *
 *   Ohne `--model` gilt das Standard-Modell der App (`getDefaultLlmModel`);
 *   ohne `--richterModel` läuft nur die deterministische Ebene.
 *   `--baseline` nimmt dem Modell Wörterbuch und Antwortregeln weg (Stand vor
 *   m1–m4), die Prüfung nutzt weiter das volle Schema — so lässt sich der
 *   Vorher-Wert auch mit gefüllten Settings messen.
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { buildFilters } from '@/lib/chat/common/filters'
import { decideRetrieverMode } from '@/lib/chat/common/retriever-decider'
import { runChatOrchestrated } from '@/lib/chat/orchestrator'
import { callLlmJson } from '@/lib/chat/common/llm'
import { loeseAntwortregelnAuf } from '@/lib/chat/antwortregeln'
import { facettenKontextFuerCache } from '@/lib/chat/quellen-kontext'
import { dokumenteNummerieren } from '@/lib/chat/common/zitatmarken'
import { ANSWER_LENGTH_DEFAULT } from '@/lib/chat/constants'
import { startQueryLog } from '@/lib/logging/query-logger'
import { getDefaultLlmModel } from '@/lib/db/llm-models-repo'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import { closeDatabaseConnection } from '@/lib/mongodb-service'
import { parseGoldenSet, pruefeGoldenSetGegenFacetten, type GoldenSet } from '@/lib/chat/golden-set/schema'
import { antwortOhneFussnote, pruefeGoldenSetFrage } from '@/lib/chat/golden-set/pruefung'
import { buildRichterMessages, richterSchemaJson, richterUrteilSchema, werteRichterUrteil, type RichterErgebnis } from '@/lib/chat/golden-set/richter'
import { baueBericht, berichtAlsMarkdown, erwarteteWerteDerFrage, type GoldenSetLaufEintrag } from '@/lib/chat/golden-set/bericht'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

function pflichtArg(name: string): string {
  const v = arg(name)
  if (!v) throw new Error(`--${name}=<wert> ist Pflicht`)
  return v
}

const RETRIEVER_ARG = new Set(['auto', 'chunk', 'summary'])

/** Kennungen des Sets → fileId über die Meta-Dokumente der Library; fehlende oder doppelte Kennungen sind Fehler. */
async function loeseKennungenAuf(set: GoldenSet, libraryKey: string, libraryId: string): Promise<Map<string, string>> {
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

async function main(): Promise<void> {
  const libraryId = pflichtArg('libraryId')
  const userEmail = pflichtArg('userEmail')
  const setPfad = pflichtArg('set')
  const titel = arg('titel') ?? 'Lauf'
  const out = arg('out') ?? 'golden-set-laeufe'
  const retrieverArg = arg('retriever') ?? 'auto'
  if (!RETRIEVER_ARG.has(retrieverArg)) throw new Error(`--retriever muss auto, chunk oder summary sein, nicht „${retrieverArg}"`)
  const temperature = Number(arg('temperature') ?? '0.3')
  if (!Number.isFinite(temperature)) throw new Error('--temperature ist keine Zahl')
  const nur = arg('nur')?.split(',').map((s) => s.trim()).filter(Boolean)
  const richterModel = arg('richterModel')
  // --baseline: das Modell bekommt weder Wörterbuch (Header, Fußnote) noch Antwortregeln —
  // Stand „vor m1–m4", auch wenn die Settings schon gefüllt sind. Die Prüfung nutzt das volle Schema.
  const baseline = process.argv.includes('--baseline')

  const set = parseGoldenSet(JSON.parse(await readFile(setPfad, 'utf8')))
  const ctx = await loadLibraryChatContext(userEmail, libraryId)
  if (!ctx) throw new Error(`Library ${libraryId} für ${userEmail} nicht gefunden`)
  const facetDefs = parseFacetDefs(ctx.library)
  const setFehler = pruefeGoldenSetGegenFacetten(set, facetDefs)
  if (setFehler.length > 0) throw new Error(`Golden-Set passt nicht zum Facetten-Schema:\n${setFehler.join('\n')}`)

  const model = arg('model') ?? (await getDefaultLlmModel())?.modelId
  if (!model) throw new Error('Kein Modell: --model fehlt und die App hat kein Standard-Modell')
  const libraryKey = getCollectionNameForLibrary(ctx.library)
  const kennungZuFileId = await loeseKennungenAuf(set, libraryKey, libraryId)
  const facetDefsFuerModell = baseline
    ? facetDefs.map((f) => { const ohne = { ...f }; delete ohne.werte; return ohne })
    : facetDefs
  const chatConfig = baseline ? { ...ctx.chat, antwortregeln: undefined } : ctx.chat
  const antwortregeln = loeseAntwortregelnAuf(chatConfig.antwortregeln, facetDefsFuerModell)
  const facettenKontext = facettenKontextFuerCache(facetDefsFuerModell)
  const apiKey = ctx.library.config?.publicPublishing?.apiKey
  const fragen = nur ? set.fragen.filter((f) => nur.includes(f.id)) : set.fragen
  if (fragen.length === 0) throw new Error('Keine Fragen ausgewählt (--nur passt auf keine ID)')
  console.log(`[golden-set] ${titel}: ${fragen.length} Fragen, Modell ${model}, Richter ${richterModel ?? 'keiner'}, Regeln ${antwortregeln ? 'ja' : 'nein'}${baseline ? ', BASELINE (ohne Wörterbuch und Regeln)' : ''}`)

  const eintraege: GoldenSetLaufEintrag[] = []
  for (const frage of fragen) {
    const explicit = retrieverArg === 'auto' ? null : (retrieverArg as 'chunk' | 'summary')
    const vorlaeufig = explicit ?? 'chunk'
    const built = buildFilters(new URL('http://golden-set.local/'), ctx.library, userEmail, libraryId, vorlaeufig)
    const entscheidung = await decideRetrieverMode({ libraryId, userEmail, filter: built.mongo, isTOCQuery: false, explicitRetriever: explicit })
    const retriever = entscheidung.mode
    const queryId = await startQueryLog({
      libraryId, userEmail, question: frage.frage, mode: retriever === 'summary' ? 'summaries' : 'chunks',
      queryType: 'question', answerLength: ANSWER_LENGTH_DEFAULT, retriever, llmModel: model, antwortregeln, facettenKontext,
      filtersNormalized: { ...built.normalized, goldenSet: { titel, frageId: frage.id } },
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
    const d = ergebnis.deterministisch
    console.log(`[golden-set] ${frage.id} (${frage.typ}): deterministisch ${d.bestanden ? 'OK' : 'FEHL'} (Dok fehlend ${d.dokumente.fehlend.length}, Labels ${d.labelsGenannt ? 'ja' : 'nein'}, Verstöße ${d.verstoesse.length})${richter ? `, Richter ${richter.bestanden ? 'OK' : 'FEHL'}` : ''} — queryId ${queryId}`)
  }

  const bericht = baueBericht(eintraege)
  const markdown = berichtAlsMarkdown(bericht, `${titel} (${new Date().toISOString().slice(0, 10)}, Modell ${model})`)
  await mkdir(out, { recursive: true })
  const stamm = path.join(out, `${new Date().toISOString().replace(/[:.]/g, '-')}-${titel.replace(/[^\w-]+/g, '_')}`)
  await writeFile(`${stamm}.json`, JSON.stringify({ titel, libraryId, model, richterModel, set: setPfad, bericht, eintraege }, null, 2), 'utf8')
  await writeFile(`${stamm}.md`, `${markdown}\n`, 'utf8')
  console.log(`\n${markdown}\n\n[golden-set] geschrieben: ${stamm}.json / .md`)
}

main()
  .then(() => closeDatabaseConnection())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('[golden-set] Abbruch:', error instanceof Error ? error.message : error)
    await closeDatabaseConnection().catch((e) => console.error('[golden-set] Verbindung schließen fehlgeschlagen:', e))
    process.exit(1)
  })
