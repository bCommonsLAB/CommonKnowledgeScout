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
import { closeDatabaseConnection } from '@/lib/mongodb-service'
import { parseGoldenSet } from '@/lib/chat/golden-set/schema'
import { baueFrageKontext } from '@/lib/chat/golden-set/kontext'
import { fahreGoldenSet, RETRIEVER_WAHL, type RetrieverWahl } from '@/lib/chat/golden-set/lauf'

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

/**
 * Seit Welle F liegt der Kern in `src/lib/chat/golden-set/lauf.ts` — derselbe
 * Lauf, den die Bruecke als Job faehrt (`golden_set_fahren`). Das Skript
 * parst nur Argumente, liest das Set von der Platte und schreibt die Ausgabe.
 */
async function main(): Promise<void> {
  const libraryId = pflichtArg('libraryId')
  const userEmail = pflichtArg('userEmail')
  const setPfad = pflichtArg('set')
  const titel = arg('titel') ?? 'Lauf'
  const out = arg('out') ?? 'golden-set-laeufe'
  const retrieverArg = arg('retriever') ?? 'auto'
  if (!(RETRIEVER_WAHL as readonly string[]).includes(retrieverArg)) throw new Error(`--retriever muss auto, chunk oder summary sein, nicht „${retrieverArg}"`)
  const temperature = Number(arg('temperature') ?? '0.3')
  if (!Number.isFinite(temperature)) throw new Error('--temperature ist keine Zahl')
  const nur = arg('nur')?.split(',').map((s) => s.trim()).filter(Boolean)
  const richterModel = arg('richterModel')
  const baseline = process.argv.includes('--baseline')

  const set = parseGoldenSet(JSON.parse(await readFile(setPfad, 'utf8')))
  const kontext = await baueFrageKontext({ libraryId, userEmail, baseline, model: arg('model') })
  console.log(`[golden-set] ${titel}: Modell ${kontext.model}, Richter ${richterModel ?? 'keiner'}, Regeln ${kontext.antwortregeln ? 'ja' : 'nein'}${baseline ? ', BASELINE (ohne Wörterbuch und Regeln)' : ''}`)

  const lauf = await fahreGoldenSet({
    kontext, set, titel, retriever: retrieverArg as RetrieverWahl, temperature, nur, richterModel,
    onFortschritt: (stand) => {
      console.log(`[golden-set] ${stand.index}/${stand.gesamt} ${stand.frageId}: ${stand.bestanden ? 'OK' : 'FEHL'} — queryId ${stand.queryId}`)
    },
  })

  await mkdir(out, { recursive: true })
  const stamm = path.join(out, `${new Date().toISOString().replace(/[:.]/g, '-')}-${titel.replace(/[^\w-]+/g, '_')}`)
  await writeFile(`${stamm}.json`, JSON.stringify({ titel, libraryId, model: lauf.model, richterModel, set: setPfad, bericht: lauf.bericht, eintraege: lauf.eintraege }, null, 2), 'utf8')
  await writeFile(`${stamm}.md`, `${lauf.markdown}\n`, 'utf8')
  console.log(`\n${lauf.markdown}\n\n[golden-set] geschrieben: ${stamm}.json / .md`)
}

main()
  .then(() => closeDatabaseConnection())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('[golden-set] Abbruch:', error instanceof Error ? error.message : error)
    await closeDatabaseConnection().catch((e) => console.error('[golden-set] Verbindung schließen fehlgeschlagen:', e))
    process.exit(1)
  })
