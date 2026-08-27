/**
 * @fileoverview Storage-Werkzeuge zum Lesen: `datei_lesen`, `stat` (ST2).
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from '../tool-shared'
import { storageFehler } from './fehler'
import { ADRESSE_ID, ADRESSE_PFAD, loeseAdresse } from './adressierung'
import { MAX_BYTES_VORGABE, type Bereich, begrenze, schneideBereich } from './bereich'

const BEREICH_SCHEMA = z
  .object({
    art: z.enum(['ganz', 'frontmatter', 'abschnitt', 'zeilen']),
    ueberschrift: z.string().min(1).optional().describe('Nur bei art="abschnitt"'),
    von: z.number().int().min(1).optional().describe('Nur bei art="zeilen", 1-basiert'),
    bis: z.number().int().min(1).optional().describe('Nur bei art="zeilen", inklusive'),
  })
  .optional()
  .describe('Ausschnitt statt ganzer Datei — "frontmatter" spart bei einem Feld-Check ~97 % der Uebertragung.')

type BereichEingabe = z.infer<typeof BEREICH_SCHEMA>

/** Uebersetzt die Werkzeug-Eingabe in einen {@link Bereich} — ohne zu raten. */
function leseBereich(eingabe: BereichEingabe): Bereich {
  if (!eingabe || eingabe.art === 'ganz') return { art: 'ganz' }
  if (eingabe.art === 'frontmatter') return { art: 'frontmatter' }
  if (eingabe.art === 'abschnitt') {
    if (!eingabe.ueberschrift) throw new Error('art="abschnitt" braucht `ueberschrift`')
    return { art: 'abschnitt', ueberschrift: eingabe.ueberschrift }
  }
  if (eingabe.von === undefined || eingabe.bis === undefined) {
    throw new Error('art="zeilen" braucht `von` und `bis`')
  }
  return { art: 'zeilen', von: eingabe.von, bis: eingabe.bis }
}

export function registerStorageLeseTools(server: McpServer): void {
  server.registerTool(
    'datei_lesen',
    {
      title: 'Textdatei (ausschnittsweise) lesen',
      description:
        'Liest eine Textdatei. `bereich` holt nur einen Ausschnitt (frontmatter | abschnitt | ' +
        'zeilen) statt der ganzen Datei. `maxBytes` (Vorgabe 256 kB) und `offset` begrenzen die ' +
        'Antwort IMMER; `gekuerzt` und `naechsterOffset` sagen, ob und wo es weitergeht. Die ' +
        'Antwort nennt pfad UND id, dazu version fuer ein spaeteres datei_schreiben. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: ADRESSE_PFAD,
        id: ADRESSE_ID,
        bereich: BEREICH_SCHEMA,
        maxBytes: z.number().int().min(1).max(1024 * 1024).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, pfad, id, bereich, maxBytes, offset }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)

        const adresse = await loeseAdresse({ provider, pfad, id, erwartet: 'file' })
        const item = await provider.getItemById(adresse.id)
        const { blob } = await provider.getBinary(adresse.id)
        const ausschnitt = begrenze(
          schneideBereich(await blob.text(), leseBereich(bereich)),
          maxBytes ?? MAX_BYTES_VORGABE,
          offset ?? 0,
        )

        return jsonResult({
          pfad: adresse.pfad,
          id: adresse.id,
          version: item.metadata.version ?? null,
          geaendertAm: item.metadata.modifiedAt.toISOString(),
          groesse: item.metadata.size,
          ...ausschnitt,
        })
      } catch (error) {
        return storageFehler(error)
      }
    },
  )

  server.registerTool(
    'stat',
    {
      title: 'Nur Metadaten',
      description:
        'Metadaten einer Datei oder eines Ordners, ohne den Inhalt zu lesen: geaendertAm, ' +
        'groesse, version, id, pfad, existiert. Fuer Zeitstempel-Vergleiche (bericht_veraltet, ' +
        'verweis_veraltet) gedacht — dafuer Dateien zu lesen ist Verschwendung. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID, pfad: ADRESSE_PFAD, id: ADRESSE_ID },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, pfad, id }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)

        // „Existiert nicht" ist bei stat eine ANTWORT, kein Fehler — genau
        // dafuer fragt der Aufrufer. Andere Fehler bleiben Fehler.
        let adresse
        try {
          adresse = await loeseAdresse({ provider, pfad, id, erwartet: 'file' })
        } catch {
          try {
            adresse = await loeseAdresse({ provider, pfad, id, erwartet: 'folder' })
          } catch (fehler) {
            const meldung = fehler instanceof Error ? fehler.message : String(fehler)
            return jsonResult({ existiert: false, pfad: pfad ?? null, id: id ?? null, grund: meldung })
          }
        }

        const item = await provider.getItemById(adresse.id)
        return jsonResult({
          existiert: true,
          pfad: adresse.pfad,
          id: adresse.id,
          name: item.metadata.name,
          typ: item.type === 'folder' ? 'ordner' : 'datei',
          groesse: item.metadata.size,
          geaendertAm: item.metadata.modifiedAt.toISOString(),
          version: item.metadata.version ?? null,
        })
      } catch (error) {
        return storageFehler(error)
      }
    },
  )
}
