/**
 * @fileoverview MCP-Werkzeug `quelle_suchen` (Wunschliste 8, W8-2).
 *
 * @description
 * Findet eine Quelle in ALLEN eigenen Libraries — die dritte Antwort auf
 * `quelle_verschwunden` neben „zurueckholen" und `quelle_verwerfen`: „sie
 * liegt in Library X". Anlass 13.10.: acht Dateien, gefunden von Hand.
 *
 * Eingabe genau eine von: `hash` | `dateiname` (+ `groesse`) |
 * `vonLibraryId` + `sourceId` (Merkmale aus dem Twin-Dokument). Suche in
 * MongoDB (`quelle-suche-lauf.ts`), dann Pfade und Groessen im Speicher
 * (`quelle-suchen-speicher.ts`). Liest nur — ausser `nachrechnen: true`,
 * das die Quellkennung ans Twin-Dokument schreibt (mit Protokoll).
 *
 * Grenze, ehrlich benannt: Eine verschwundene Quelle von vor 2.49.1 traegt
 * weder Kennung noch Groesse, und ihr Inhalt ist nicht mehr lesbar. Fuer sie
 * bleibt es bei `name`; der Hinweis nennt den naechsten Beleg (Transkripte
 * vergleichen).
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getShadowTwinsBySourceIds, setzeQuellkennung } from '@/lib/repositories/shadow-twin-repo'
import { LibraryService } from '@/lib/services/library-service'
import { sortiereNachUebereinstimmung, type Suchmerkmale } from '@/lib/shadow-twin/quelle-suche'
import { sucheQuelle, suchLibrariesAus } from '@/lib/shadow-twin/quelle-suche-lauf'
import { quellkennungAusBlob } from '@/lib/shadow-twin/quellkennung'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { loeseTrefferAuf, MAX_NACHRECHNEN_BYTES, providerJeLibrary, rechneNach, type ProviderJeLibrary, type TrefferZeile } from './quelle-suchen-speicher'
import { errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'

interface Eingabe {
  hash?: string
  dateiname?: string
  groesse?: number
  vonLibraryId?: string
  sourceId?: string
  nachrechnen?: boolean
  begruendung?: string
}

interface Quelle { libraryId: string; sourceId: string; sourceName: string; imSpeicher: boolean; grund?: string }

function pruefeEingabe(e: Eingabe): void {
  const formen = [e.hash !== undefined, e.dateiname !== undefined, e.vonLibraryId !== undefined || e.sourceId !== undefined].filter(Boolean).length
  if (formen !== 1) throw new Error('Genau eine Eingabe: hash ODER dateiname ODER vonLibraryId + sourceId')
  if ((e.vonLibraryId === undefined) !== (e.sourceId === undefined)) throw new Error('vonLibraryId und sourceId nur zusammen')
  if (e.groesse !== undefined && e.dateiname === undefined) throw new Error('groesse nur zusammen mit dateiname')
  if (e.nachrechnen && !e.begruendung) throw new Error('nachrechnen schreibt die Quellkennung ans Twin-Dokument — begruendung ist Pflicht')
}

async function bestimmeMerkmale(e: Eingabe, userEmail: string, provider: ProviderJeLibrary): Promise<{ such: Suchmerkmale; quelle: Quelle | null }> {
  if (e.hash !== undefined) return { such: { name: null, hash: e.hash.toLowerCase(), groesse: null }, quelle: null }
  if (e.dateiname !== undefined) return { such: { name: e.dateiname.trim(), hash: null, groesse: e.groesse ?? null }, quelle: null }
  const libraryId = e.vonLibraryId as string
  const sourceId = e.sourceId as string
  await requireLibrary(userEmail, libraryId)
  const doc = (await getShadowTwinsBySourceIds({ libraryId, sourceIds: [sourceId] })).get(sourceId)
  if (!doc) throw new Error(`Kein Twin-Dokument zu sourceId ${sourceId} in Library ${libraryId}`)
  let groesse = typeof doc.sourceSize === 'number' ? doc.sourceSize : null
  const quelle: Quelle = { libraryId, sourceId, sourceName: doc.sourceName, imSpeicher: false }
  try {
    const item = await (await provider(libraryId)).getItemById(sourceId)
    quelle.imSpeicher = true
    groesse ??= typeof item.metadata.size === 'number' ? item.metadata.size : null
  } catch (error) {
    quelle.grund = `nicht im Speicher: ${error instanceof Error ? error.message : String(error)}`
  }
  return { such: { name: doc.sourceName, hash: doc.sourceContentHash ?? null, groesse }, quelle }
}

/** Die gesuchte Quelle selbst nachrechnen, wenn sie lesbar ist und keine Kennung hat. */
async function rechneQuelleNach(such: Suchmerkmale, quelle: Quelle | null, provider: ProviderJeLibrary): Promise<string | null> {
  if (quelle === null || !quelle.imSpeicher || such.hash !== null) return null
  if (such.groesse !== null && such.groesse > MAX_NACHRECHNEN_BYTES) return 'gesuchte Quelle uebersprungen: groesser als 50 MB'
  const { blob } = await (await provider(quelle.libraryId)).getBinary(quelle.sourceId)
  const kennung = await quellkennungAusBlob(blob, new Date().toISOString())
  await setzeQuellkennung({ libraryId: quelle.libraryId, sourceId: quelle.sourceId, quellkennung: kennung })
  such.hash = kennung.sourceContentHash
  such.groesse = kennung.sourceSize
  return 'gesuchte Quelle: Kennung gesetzt'
}

function hinweis(zeilen: readonly TrefferZeile[], such: Suchmerkmale, quelle: Quelle | null): string {
  if (zeilen.length === 0) return 'Keine Kopie in den eigenen Libraries gefunden — Datei zurueckholen oder quelle_verwerfen.'
  switch (zeilen[0].uebereinstimmung) {
    case 'hash':
      return 'Inhaltsgleich (Quellkennung) — der Ort ist belegt.'
    case 'name_groesse':
      return 'Name und Groesse gleich, Inhalt nicht belegt — nachrechnen: true belegt ihn, wenn beide Seiten lesbar sind.'
    case 'name':
      return quelle !== null && !quelle.imSpeicher && such.hash === null
        ? 'Nur der Name ist gleich. Die gesuchte Quelle liegt nicht mehr im Speicher und traegt keine Kennung — mehr als Namensgleichheit ist nicht belegbar; Transkripte vergleichen (artefakt_lesen auf beiden Seiten).'
        : 'Nur der Name ist gleich — nachrechnen: true schaerft das.'
  }
}

export function registerQuelleSuchenTool(server: McpServer): void {
  server.registerTool(
    'quelle_suchen',
    {
      title: 'Quelle ueber alle Libraries suchen (liest; nachrechnen schreibt die Kennung)',
      description:
        'Findet eine Quelle in ALLEN eigenen Libraries — nach Quellkennung (sourceContentHash), sonst nach Name und ' +
        'Groesse, sonst nach Name. Eingabe genau eine von: hash | dateiname (+ groesse) | vonLibraryId + sourceId ' +
        '(Merkmale aus dem Twin-Dokument, z. B. aus einem Befund quelle_verschwunden). Je Treffer: libraryId, libraryName, ' +
        'slug, adresse (@<slug>/<pfad>), pfad, sourceId, imSpeicher, groesse, erschliessung (transkript, transformationen), ' +
        'uebereinstimmung hash | name_groesse | name. Gleicher Name mit belegt anderem Inhalt steht unter inhaltVerschieden. ' +
        'Hoechstens 20 Kandidaten je Library, 20 Treffer im Speicher aufgeloest. nachrechnen: true liest die gesuchte Quelle ' +
        '(wenn sie im Speicher liegt) und bis zu 5 Treffer ohne Kennung (je bis 50 MB), rechnet die Quellkennung und schreibt ' +
        'sie ans Twin-Dokument (begruendung Pflicht). Eine verschwundene Quelle ohne Kennung bleibt bei Namensgleichheit.',
      inputSchema: {
        hash: z.string().regex(/^[0-9a-fA-F]{64}$/).optional().describe('sourceContentHash (SHA-256, hex)'),
        dateiname: z.string().min(1).optional().describe('Exakter Dateiname inkl. Endung'),
        groesse: z.number().int().nonnegative().optional().describe('Bytes; nur mit dateiname'),
        vonLibraryId: z.string().min(1).optional().describe('Library der gesuchten Quelle (mit sourceId)'),
        sourceId: z.string().min(1).optional().describe('sourceId der gesuchten Quelle (mit vonLibraryId)'),
        nachrechnen: z.boolean().optional().describe('Kennungen nachrechnen und schreiben (Vorgabe false)'),
        begruendung: BEGRUENDUNG.optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (eingabe) => {
      try {
        pruefeEingabe(eingabe)
        const userEmail = mcpUserEmail()
        const ausfuehren = async () => {
          const provider = providerJeLibrary(userEmail)
          const libraries = suchLibrariesAus(await LibraryService.getInstance().getUserLibraries(userEmail))
          const { such, quelle } = await bestimmeMerkmale(eingabe, userEmail, provider)
          const quelleNachgerechnet = eingabe.nachrechnen ? await rechneQuelleNach(such, quelle, provider) : null
          const roh = await sucheQuelle({ libraries, such, ausser: quelle ? { libraryId: quelle.libraryId, sourceId: quelle.sourceId } : undefined })
          const aufgeloest = await loeseTrefferAuf({ treffer: roh.treffer, such, provider })
          const nach = eingabe.nachrechnen ? await rechneNach({ zeilen: aufgeloest.zeilen, such, provider }) : null
          const zeilen = sortiereNachUebereinstimmung(nach?.zeilen ?? aufgeloest.zeilen)
          return jsonResult({
            merkmale: { ...such, herkunft: quelle ? 'twin' : 'aufruf', ...(quelle ? { quelle } : {}) },
            durchsucht: roh.durchsucht,
            treffer: zeilen,
            inhaltVerschieden: [...roh.verschieden, ...aufgeloest.verschieden, ...(nach?.verschieden ?? [])],
            ...(eingabe.nachrechnen
              ? { nachgerechnet: [...(quelleNachgerechnet ? [{ libraryName: '(gesuchte Quelle)', sourceName: such.name ?? '', ergebnis: quelleNachgerechnet }] : []), ...(nach?.nachgerechnet ?? [])] }
              : {}),
            hinweis: hinweis(zeilen, such, quelle),
          })
        }
        if (!eingabe.nachrechnen) return await ausfuehren()
        return await mitProtokoll(
          { werkzeug: 'quelle_suchen', libraryId: eingabe.vonLibraryId ?? '(alle)', akteur: userEmail, begruendung: eingabe.begruendung as string, ...(eingabe.sourceId ? { sourceId: eingabe.sourceId } : {}) },
          ausfuehren,
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
