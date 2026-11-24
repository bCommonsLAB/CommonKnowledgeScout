/**
 * @fileoverview `datei_von_adresse_holen` — Dateien aus dem Netz ins Archiv, vom Server geladen.
 *
 * @description
 * Luecke bis hierher: `datei_binaer_anlegen` verlangt den Inhalt als base64 vom
 * Agenten. Der kann eine Datei aus dem Netz oft gar nicht laden (kein
 * Netzzugang, Sperre fuer Automaten) — und 30 PDFs durch den Kontext zu
 * schieben, waere auch dann der falsche Weg. Hier laedt der Server, prueft
 * (Typ, Endung, Signatur, Groesse) und legt ab.
 *
 * Stapel: Jede Datei hat ihr eigenes Ergebnis. Eine abgelehnte Datei haelt die
 * anderen nicht auf, und sie verschwindet nicht — sie steht mit Grund in der
 * Antwort. Ist das Zeitbudget des Aufrufs verbraucht, werden die restlichen
 * Adressen als `nicht_begonnen` gemeldet, statt den Aufruf sterben zu lassen.
 *
 * Herkunft: Adresse, Abrufzeit und sha256 stehen in der Antwort und damit im
 * Aktions-Protokoll (`protokoll_lesen`). Vorhandene Dateien werden nie
 * ueberschrieben.
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { StorageProvider } from '@/lib/storage/types'
import { holeDatei, saubererName } from '@/lib/web-source/datei-holen'
import { BEGRUENDUNG, mitProtokoll } from '../protokoll'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from '../tool-shared'
import { kindPfad, normalisiere } from './adressierung'
import { storageFehler } from './fehler'
import { ordnerSicherstellen } from './pfad-helfer'
import { pruefeSchreibschutz } from './schreibschutz'

export const MAX_ADRESSEN = 30
const GLEICHZEITIG = 3
/** Unter dem Zeitlimit der Route (600 s), mit Luft fuer den letzten laufenden Abruf. */
const ZEITBUDGET_MS = 7 * 60_000

export interface HolAuftrag {
  url: string
  dateiname?: string
  erwarteterTyp?: string
}

export type HolErgebnis =
  | { url: string; status: 'abgelegt'; pfad: string; id: string; groesse: number; mimeType: string; sha256: string; endAdresse: string; abgerufenAm: string }
  | { url: string; status: 'abgelehnt' | 'vorhanden' | 'nicht_begonnen'; grund: string }

/** Holt alle Auftraege in den Ordner; je Auftrag ein Ergebnis in der Reihenfolge der Eingabe. */
export async function holeInOrdner(args: {
  provider: StorageProvider
  ordnerId: string
  ordnerPfad: string
  auftraege: HolAuftrag[]
  hole?: typeof holeDatei
  jetzt?: () => number
  zeitbudgetMs?: number
}): Promise<HolErgebnis[]> {
  const { provider, ordnerId, ordnerPfad, auftraege } = args
  const hole = args.hole ?? holeDatei
  const jetzt = args.jetzt ?? Date.now
  const ende = jetzt() + (args.zeitbudgetMs ?? ZEITBUDGET_MS)
  const belegt = new Set((await provider.listItemsById(ordnerId)).map((k) => k.metadata.name.toLowerCase()))
  const ergebnisse: HolErgebnis[] = new Array<HolErgebnis>(auftraege.length)
  let naechster = 0

  const arbeite = async (): Promise<void> => {
    for (let i = naechster++; i < auftraege.length; i = naechster++) {
      const { url, dateiname, erwarteterTyp } = auftraege[i]
      if (jetzt() >= ende) {
        ergebnisse[i] = { url, status: 'nicht_begonnen', grund: 'Zeitbudget des Aufrufs verbraucht — diese Adresse in einem weiteren Aufruf holen' }
        continue
      }
      try {
        const datei = await hole(url, { dateiname, erwarteterTyp })
        const pfad = kindPfad(ordnerPfad, datei.dateiname)
        pruefeSchreibschutz(pfad, 'anlegen')
        // Belegung VOR dem Hochladen vormerken: zwei Adressen mit demselben Namen duerfen sich nicht gegenseitig ersetzen.
        if (belegt.has(datei.dateiname.toLowerCase())) {
          ergebnisse[i] = { url, status: 'vorhanden', grund: `"${pfad}" gibt es schon — nichts geschrieben. Anderen dateiname waehlen.` }
          continue
        }
        belegt.add(datei.dateiname.toLowerCase())
        const item = await provider.uploadFile(ordnerId, new File([new Uint8Array(datei.buffer)], datei.dateiname, { type: datei.mimeType }))
        ergebnisse[i] = {
          url, status: 'abgelegt', pfad, id: item.id, groesse: datei.bytes, mimeType: datei.mimeType,
          sha256: datei.sha256, endAdresse: datei.endAdresse, abgerufenAm: datei.abgerufenAm,
        }
      } catch (fehler) {
        ergebnisse[i] = { url, status: 'abgelehnt', grund: fehler instanceof Error ? fehler.message : String(fehler) }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(GLEICHZEITIG, auftraege.length) }, arbeite))
  return ergebnisse
}

export function registerStorageAdresseHolenTool(server: McpServer): void {
  server.registerTool(
    'datei_von_adresse_holen',
    {
      title: 'Dateien von Adressen ins Archiv holen (SCHREIBT)',
      description:
        `Der Server laedt bis zu ${MAX_ADRESSEN} Dateien von http/https-Adressen in einen Ordner (z. B. die PDF-Links aus seite_lesen), ` +
        'ohne base64 durch den Kontext. Jede Adresse hat ein eigenes Ergebnis: abgelegt | abgelehnt | vorhanden | nicht_begonnen, ' +
        'mit grund. Abgelehnt wird, was nicht passt: Typ, Endung, Signatur, Groesse, interne Adresse. Nichts wird ueberschrieben. ' +
        'Audio/Video gehoeren ueber webseite_erschliessen. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        ordner: z.string().min(1).describe('Library-relativer Zielordner'),
        elternAnlegen: z.boolean().optional().describe('Fehlende Ordner des Pfades anlegen; Vorgabe false'),
        dateien: z.array(z.object({
          url: z.string().url().describe('Adresse der Datei (http/https)'),
          dateiname: z.string().min(1).max(200).optional().describe('Dateiname mit Endung; weglassen = aus Antwort oder Adresse'),
          erwarteterTyp: z.string().min(3).max(120).optional().describe('z. B. "application/pdf" — weicht die Antwort ab, wird die Datei abgelehnt'),
        })).min(1).max(MAX_ADRESSEN).describe(`1 bis ${MAX_ADRESSEN} Adressen`),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, ordner, elternAnlegen, dateien, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'datei_von_adresse_holen', libraryId, akteur: mcpUserEmail(), begruendung, pfad: ordner }, async () => {
          const userEmail = mcpUserEmail()
          await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const namen = dateien.map((d) => d.dateiname).filter((n): n is string => n !== undefined).map((n) => saubererName(n).toLowerCase())
          const doppelt = namen.find((n, i) => namen.indexOf(n) !== i)
          if (doppelt) throw new Error(`dateiname "${doppelt}" kommt in diesem Aufruf mehrfach vor — nichts geschrieben`)
          for (const d of dateien) if (d.dateiname) pruefeSchreibschutz(kindPfad(ordner, saubererName(d.dateiname)), 'anlegen')
          const ordnerId = await ordnerSicherstellen(provider, ordner, elternAnlegen === true)
          const ergebnisse = await holeInOrdner({ provider, ordnerId, ordnerPfad: normalisiere(ordner), auftraege: dateien })
          const zahl = (s: HolErgebnis['status']): number => ergebnisse.filter((e) => e.status === s).length
          return jsonResult({
            ordner: normalisiere(ordner),
            abgelegt: zahl('abgelegt'), abgelehnt: zahl('abgelehnt'), vorhanden: zahl('vorhanden'), nichtBegonnen: zahl('nicht_begonnen'),
            dateien: ergebnisse,
          })
        })
      } catch (error) {
        return storageFehler(error)
      }
    },
  )
}
