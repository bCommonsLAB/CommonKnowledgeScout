/**
 * @fileoverview Binaerdateien ueber die Bruecke (Welle W6, Stufe 1).
 *
 * @description
 * Cowork-Befund 02.09.2026, die einzige echte Luecke der Schicht: **Zwoelf
 * Anhaenge liegen nach drei Wochen weiter im Postfach**, weil die Bruecke sie
 * nicht ins Archiv bekommt. Die Storage-Werkzeuge sind durchgehend Text —
 * gelesen wird mit `blob.text()`, geschrieben als `text/markdown`.
 *
 * Die „Abschrift" ist kein Ersatz. Sie traegt fuer ein Protokoll; sie traegt
 * nicht fuer ein PDF-Layout und nicht fuer eine PEC-Vertragsunterlage, wo das
 * Dokument selbst der Beleg ist.
 *
 * **Stufe 1 (hier): base64 fuer kleine Dateien.** Deckt Anhaenge aus dem
 * Postfach ab — die typische Groesse. Stufe 2 (kurzlebige Upload-URL fuer
 * grosse Dateien, am 60-Sekunden-Limit vorbei) ist NICHT gebaut; wer sie
 * braucht, bekommt hier `zu_gross` und den Hinweis darauf, statt eine
 * Uebertragung, die im Zeitlimit stirbt.
 *
 * **Warum keine Blaetterung beim Lesen.** `datei_lesen` kuerzt Text mit
 * `maxBytes`/`offset` und laesst weiterblaettern — bei einer Binaerdatei
 * waere das sinnlos: Ein halbes PDF ist kein PDF. Deshalb gibt es hier keine
 * Teil-Antwort, sondern eine Absage mit Groessenangabe. Und deshalb ist die
 * Vorgabe klein: Base64 blaeht um ein Drittel auf und laeuft durch den
 * Kontext des Agenten.
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BEGRUENDUNG, mitProtokoll } from '../protokoll'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from '../tool-shared'
import { storageFehler } from './fehler'
import { ADRESSE_ID, ADRESSE_PFAD, loeseAdresse, normalisiere } from './adressierung'
import { ordnerSicherstellen, trenne } from './pfad-helfer'
import { pruefeSchreibschutz } from './schreibschutz'

/** Harte Obergrenze der Stufe 1, roh (vor base64). */
export const MAX_BINAER_BYTES = 6 * 1024 * 1024

/** Vorgabe beim Lesen — kleiner, weil die Antwort durch den Kontext laeuft. */
export const LESE_VORGABE_BYTES = 1024 * 1024

const ZU_GROSS_HINWEIS =
  'Stufe 2 (kurzlebige Upload-URL am Zeitlimit vorbei) ist noch nicht gebaut. Bis dahin geht ' +
  'eine Datei dieser Groesse nicht ueber die Bruecke — sie gehoert ueber die Werkbank oder ' +
  'direkt in den Speicher gelegt.'

/** Wirft, wenn die Groesse die Stufe 1 sprengt — mit Zahlen statt „zu gross". */
function pruefeGroesse(bytes: number, grenze: number, was: string): void {
  if (bytes <= grenze) return
  const fehler = new Error(
    `${was} ist ${Math.round(bytes / 1024)} kB gross, die Grenze liegt bei ` +
    `${Math.round(grenze / 1024)} kB. ${ZU_GROSS_HINWEIS}`,
  )
  ;(fehler as Error & { code: string }).code = 'EFBIG'
  throw fehler
}

/** Nur diese Zeichen — Zeilenumbrueche sind erlaubt und werden entfernt. */
const BASE64_ZEICHEN = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Dekodiert base64 STRENG.
 *
 * Node verwirft ungueltige Zeichen stillschweigend: Aus einem `data:`-Praefix
 * oder einem abgeschnittenen String wird kommentarlos ein kuerzerer Puffer.
 * Genau das darf nicht ins Archiv — deshalb wird die Form vorher geprueft.
 */
export function dekodiereBase64(eingabe: string): Buffer {
  const roh = eingabe.replace(/\s/g, '')
  if (roh === '') throw new Error('`inhaltBase64` ist leer — nichts geschrieben.')
  if (roh.startsWith('data:')) {
    throw new Error(
      '`inhaltBase64` traegt einen data:-Praefix — nur den Teil NACH dem Komma uebergeben. ' +
      'Nichts geschrieben.',
    )
  }
  if (roh.length % 4 !== 0 || !BASE64_ZEICHEN.test(roh)) {
    throw new Error(
      '`inhaltBase64` ist kein gueltiges base64 (Laenge oder Zeichen) — nichts geschrieben. ' +
      'Node wuerde ungueltige Zeichen stillschweigend verwerfen und eine halbe Datei ablegen.',
    )
  }
  return Buffer.from(roh, 'base64')
}

export function registerStorageBinaerTools(server: McpServer): void {
  server.registerTool(
    'datei_binaer_lesen',
    {
      title: 'Binaerdatei als base64 lesen',
      description:
        'Liest eine Datei BINAER und gibt sie als base64 zurueck — fuer PDF, Bilder, Anhaenge, ' +
        'also alles, wofuer datei_lesen (Text) nicht taugt. Keine Blaetterung: Ein halbes PDF ist ' +
        `kein PDF; ist die Datei groesser als maxBytes (Vorgabe ${LESE_VORGABE_BYTES / 1024} kB, ` +
        `Grenze ${MAX_BINAER_BYTES / 1024 / 1024} MB), kommt eine Absage MIT Groessenangabe statt ` +
        'eines Bruchstuecks. ACHTUNG: base64 blaeht um ein Drittel auf und laeuft durch den ' +
        'Kontext — nur lesen, was wirklich gebraucht wird. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: ADRESSE_PFAD,
        id: ADRESSE_ID,
        maxBytes: z.number().int().min(1024).max(MAX_BINAER_BYTES).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, pfad, id, maxBytes }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)

        const adresse = await loeseAdresse({ provider, pfad, id, erwartet: 'file' })
        const item = await provider.getItemById(adresse.id)
        const grenze = maxBytes ?? LESE_VORGABE_BYTES
        // Erst die Metadaten fragen: Eine 200-MB-Datei soll nicht geladen
        // werden, nur um danach abgelehnt zu werden.
        pruefeGroesse(item.metadata.size, grenze, `"${adresse.pfad}"`)

        const { blob } = await provider.getBinary(adresse.id)
        const puffer = Buffer.from(await blob.arrayBuffer())
        // Zweite Pruefung: Die Metadaten-Groesse ist eine Angabe des
        // Providers, die tatsaechliche Laenge ist die Wahrheit.
        pruefeGroesse(puffer.byteLength, grenze, `"${adresse.pfad}" (tatsaechlich)`)

        return jsonResult({
          pfad: adresse.pfad,
          id: adresse.id,
          version: item.metadata.version ?? null,
          mimeType: item.metadata.mimeType ?? null,
          groesse: puffer.byteLength,
          kodierung: 'base64',
          inhaltBase64: puffer.toString('base64'),
        })
      } catch (error) {
        return storageFehler(error)
      }
    },
  )

  server.registerTool(
    'datei_binaer_anlegen',
    {
      title: 'Binaerdatei aus base64 anlegen (SCHREIBT)',
      description:
        'Legt eine NEUE Datei aus base64-Inhalt an — der Weg, um einen Anhang (PDF, Bild, ' +
        'Vertragsunterlage) ins Archiv zu bekommen, ohne ihn abzuschreiben. Wie datei_anlegen ' +
        'getrennt von „aendern": `nichtUeberschreiben` ist per Vorgabe true. `elternAnlegen` legt ' +
        `fehlende Ordner an. Grenze ${MAX_BINAER_BYTES / 1024 / 1024} MB (Stufe 1); darueber ` +
        'kommt eine Absage mit Zahlen. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: z.string().min(1).describe('Library-relativer Zielpfad inkl. Dateiname und Endung'),
        inhaltBase64: z.string().min(1).describe('Dateiinhalt base64-kodiert, ohne data:-Praefix'),
        mimeType: z.string().min(1).optional()
          .describe('z. B. "application/pdf". Weglassen = application/octet-stream'),
        nichtUeberschreiben: z.boolean().optional().describe('Vorgabe true'),
        elternAnlegen: z.boolean().optional().describe('Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, pfad, inhaltBase64, mimeType, nichtUeberschreiben, elternAnlegen, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'datei_binaer_anlegen', libraryId, akteur: mcpUserEmail(), begruendung, pfad },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)
            pruefeSchreibschutz(pfad, 'anlegen')

            // `Buffer.from(..., 'base64')` wirft bei Muell NICHT, es
            // verwirft ihn still. Ohne Vorpruefung laege eine leere oder
            // halbe Datei im Archiv, und niemand haette es gemerkt.
            const puffer = dekodiereBase64(inhaltBase64)
            pruefeGroesse(puffer.byteLength, MAX_BINAER_BYTES, 'Der Inhalt')

            const { eltern, name } = trenne(pfad)
            const ordnerId = await ordnerSicherstellen(provider, eltern, elternAnlegen === true)

            const vorhanden = (await provider.listItemsById(ordnerId))
              .find((kind) => kind.type === 'file' && kind.metadata.name === name)
            if (vorhanden && nichtUeberschreiben !== false) {
              throw new Error(
                `"${normalisiere(pfad)}" existiert bereits (id ${vorhanden.id}) — nichts ` +
                'geschrieben. Zum Ersetzen nichtUeberschreiben=false setzen.',
              )
            }

            const typ = mimeType ?? 'application/octet-stream'
            const angelegt = await provider.uploadFile(
              ordnerId,
              new File([new Uint8Array(puffer)], name, { type: typ }),
            )
            return jsonResult({
              pfad: normalisiere(pfad),
              id: angelegt.id,
              version: angelegt.metadata.version ?? null,
              groesse: puffer.byteLength,
              mimeType: typ,
              ueberschrieben: Boolean(vorhanden),
            })
          },
        )
      } catch (error) {
        return storageFehler(error)
      }
    },
  )
}
