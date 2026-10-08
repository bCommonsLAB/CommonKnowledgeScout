/**
 * @fileoverview MCP-Werkzeuge `frage_stellen`, `golden_set_fahren`, `frage_log_lesen` (Welle F).
 *
 * @description
 * Messen vor Aendern: eine Frage ohne Browser stellen (Antwort, Belege,
 * Nachpruefung, Cache-Treffer), ein Golden-Set als Job fahren (Set-Datei aus
 * dem Archiv, Bericht als Markdown daneben, Stand ueber job_status) und
 * einen Query-Log lesen. `baseline` misst den Stand ohne Woerterbuch und
 * Antwortregeln — auch nachtraeglich, wenn die Settings schon gefuellt sind.
 * Das Modell kommt aus der App (Standard-Modell), nicht aus dem Aufruf.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { beantworteFrage } from '@/lib/chat/bruecke-frage'
import { RETRIEVER_WAHL } from '@/lib/chat/golden-set/lauf'
import {
  ACCESS_PERSPECTIVE_ARRAY_ZOD_SCHEMA,
  ANSWER_LENGTH_ZOD_ENUM,
  CHARACTER_ARRAY_ZOD_SCHEMA,
  SOCIAL_CONTEXT_ZOD_ENUM,
  TARGET_LANGUAGE_ZOD_ENUM,
} from '@/lib/chat/constants'
import { getQueryLogById } from '@/lib/db/queries-repo'
import { enqueueGoldenSetJob } from '@/lib/external-jobs/enqueue-golden-set'
import { frageLogSicht } from './frage-log-sicht'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { resolveSourceItem } from './tools-erschliessen-shared'

const RETRIEVER = z.enum(RETRIEVER_WAHL).optional().describe('auto (Server entscheidet), chunk oder summary; Default auto')
const BASELINE = z.boolean().optional().describe('true = Modell ohne Woerterbuch und Antwortregeln (Stand vor m1–m4); Pruefung mit vollem Schema')
const TEMPERATUR = z.number().min(0).max(1).optional().describe('Default 0.3')

export function registerMessenTools(server: McpServer): void {
  server.registerTool(
    'frage_stellen',
    {
      title: 'Eine Frage an den Story-Modus (schreibt einen Query-Log)',
      description:
        'Stellt EINE Frage an den Story-Modus der Library auf demselben Weg wie die Stream-Route ' +
        '(Filter, Retriever-Entscheidung, Antwortregeln, Nachpruefung) und liefert Antwort, nummerierte ' +
        'Dokumente mit Facettenwerten, zitierte Nummern, nachpruefung und queryId. ohneCache: false ' +
        'befragt vorher den Antwort-Cache (cacheTreffer: true); ein frischer Aufruf schreibt den Cache auch mit ' +
        'ohneCache: true. Perspektive (targetLanguage, character, accessPerspective, socialContext, genderInclusive, ' +
        'answerLength) wie die Adresse des Story-Modus; Fehlendes kommt aus der Library-Konfiguration, answerLength ' +
        'wie der Story-Modus "ausführlich". Der Story-Modus schickt die Werte der Besucherin — wer dessen Antwort ' +
        'treffen will, gibt sie mit (z. B. targetLanguage "de"); die Antwort nennt die wirksame perspektive. Dauert 10–40 s (Modellaufruf); fuer ' +
        'ganze Sets golden_set_fahren. Schreibt nur einen Query-Log-Eintrag.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        frage: z.string().min(3).max(2000),
        ohneCache: z.boolean().optional().describe('true = frisch beantworten (Default false = Cache wie im UI)'),
        baseline: BASELINE,
        retriever: RETRIEVER,
        temperature: TEMPERATUR,
        targetLanguage: TARGET_LANGUAGE_ZOD_ENUM.optional().describe('Antwortsprache; Vorgabe Library ("global" verlangt eine Angabe)'),
        character: CHARACTER_ARRAY_ZOD_SCHEMA.optional().describe('1–3 Charaktere; Vorgabe Library'),
        accessPerspective: ACCESS_PERSPECTIVE_ARRAY_ZOD_SCHEMA.optional().describe('1–3 Zugaenge; Vorgabe Library'),
        socialContext: SOCIAL_CONTEXT_ZOD_ENUM.optional().describe('Sprachstil; Vorgabe Library'),
        genderInclusive: z.boolean().optional().describe('Vorgabe Library'),
        answerLength: ANSWER_LENGTH_ZOD_ENUM.optional().describe('Vorgabe "ausführlich" wie der Story-Modus'),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, frage, ohneCache, baseline, retriever, temperature, targetLanguage, character, accessPerspective, socialContext, genderInclusive, answerLength }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const antwort = await beantworteFrage({
          libraryId, userEmail, frage, ohneCache: ohneCache ?? false, baseline: baseline ?? false,
          retriever: retriever ?? 'auto', temperature: temperature ?? 0.3,
          perspektive: { targetLanguage, character, accessPerspective, socialContext, genderInclusive, answerLength },
        })
        return jsonResult(antwort)
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'golden_set_fahren',
    {
      title: 'Golden-Set als Job fahren (SCHREIBT, langlaufend)',
      description:
        'Faehrt die Fragen eines Golden-Sets (JSON-Datei in der Library, Format aus Plan ' +
        'story-status-modalitaet §5: kennungFeld, fragen[] mit erwarteteDokumente und pflicht) gegen den ' +
        'Story-Modus — als Job, weil jede Frage einen Modellaufruf kostet. Jede Frage bekommt einen ' +
        'Query-Log (filtersNormalized.goldenSet). Der Bericht (Quote je Fragetyp und je Facettenwert) ' +
        'landet als Markdown NEBEN der Set-Datei und in job_status (ergebnis). baseline misst den ' +
        'Vorher-Wert; richterModel schaltet die Richter-Rubrik zu. Antwortet sofort mit jobId. ' +
        'SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        setSourceId: z.string().min(1).optional().describe('Storage-Id der Set-Datei (.json)'),
        setPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Set-Datei'),
        titel: z.string().min(1).max(80).describe('Name des Laufs, z. B. "Baseline" oder "Regeln v2"'),
        baseline: BASELINE,
        richterModel: z.string().min(1).optional().describe('LLM-Id fuer die Richter-Rubrik; weglassen = nur deterministische Pruefung'),
        nur: z.array(z.string().min(1)).min(1).optional().describe('Nur diese Frage-IDs'),
        retriever: RETRIEVER,
        temperature: TEMPERATUR,
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, setSourceId, setPfad, titel, baseline, richterModel, nur, retriever, temperature, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'golden_set_fahren', libraryId, akteur: mcpUserEmail(), begruendung, sourceId: setSourceId, pfad: setPfad }, async () => {
          const userEmail = mcpUserEmail()
          await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const set = await resolveSourceItem(provider, setSourceId, setPfad)
          if (!/\.json$/i.test(set.name)) throw new Error(`"${set.name}" ist keine .json-Datei — das Golden-Set ist JSON`)
          const { jobId } = await enqueueGoldenSetJob({
            libraryId, userEmail,
            optionen: {
              setSourceId: set.itemId, setParentId: set.parentId, setName: set.name, titel, baseline: baseline ?? false,
              retriever: retriever ?? 'auto', temperature: temperature ?? 0.3, nur, richterModel,
            },
          })
          const { ExternalJobsWorker } = await import('@/lib/external-jobs-worker')
          await ExternalJobsWorker.tickNow()
          return jsonResult({
            jobId, set: set.name, titel, baseline: baseline ?? false, richter: richterModel ?? null,
            hinweis: 'Lauf laeuft im Hintergrund; Fortschritt je Frage und am Ende der Bericht (ergebnis) ueber job_status. Der Bericht liegt danach als Markdown neben der Set-Datei.',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'frage_log_lesen',
    {
      title: 'Query-Log einer Frage lesen (liest nur)',
      description:
        'Liest einen Query-Log der Library: Frage, Antwort, Belege, Retriever, Cache-Hash und ' +
        'Cache-Parameter, Facettenfilter, nachpruefung, Timing, Tokens. mitPrompt: true liefert auch ' +
        'System- und User-Prompt (gross). Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        queryId: z.string().min(1).describe('queryId aus frage_stellen, golden_set_fahren (ergebnis.queryIds) oder dem Story-Modus'),
        mitPrompt: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, queryId, mitPrompt }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const log = await getQueryLogById({ libraryId, queryId, userEmail })
        if (!log) throw new Error(`Kein Query-Log ${queryId} in dieser Library fuer diesen User`)
        return jsonResult(frageLogSicht(log, mitPrompt ?? false))
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
