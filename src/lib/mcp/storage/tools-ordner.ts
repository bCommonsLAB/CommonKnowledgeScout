/**
 * @fileoverview Storage-Werkzeuge: `ordner_listen`, `pfad_aufloesen` (ST2).
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from '../tool-shared'
import { storageFehler } from './fehler'
import { ADRESSE_ID, ADRESSE_PFAD, loeseAdresse } from './adressierung'
import { MAX_LISTINGS, listeOrdner } from './listen'
import { MAX_BYTES_LISTE_VORGABE } from './listen-verdichten'

export function registerStorageOrdnerTools(server: McpServer): void {
  server.registerTool(
    'ordner_listen',
    {
      title: 'Ordnerinhalt mit Metadaten',
      description:
        'Listet einen Ordner — je Eintrag name, pfad, id, typ, groesse, geaendertAm und version, ' +
        'sodass KEIN zweiter Aufruf pro Datei noetig ist. Adressierung per `pfad` ODER `id`; die ' +
        'Antwort nennt immer beides. `limit`/`cursor` sind Pflicht-Blaetterung — `weitereVorhanden` ' +
        `sagt, ob noch etwas kommt. Rekursiv nur mit ausdruecklicher \`tiefe\`; ueber ${MAX_LISTINGS} ` +
        'Ordner-Listings bricht der Aufruf ab und sagt es (Zeitlimit-Schutz). ' +
        `\`maxBytes\` (Vorgabe ${MAX_BYTES_LISTE_VORGABE / 1024} kB) begrenzt zusaetzlich die GROESSE ` +
        'der Antwort — `limit` begrenzt nur ihre Zahl, und bei tiefen Laeufen ist die Groesse die ' +
        'bindende Grenze; eine Kuerzung steht in `gekuerzt`. `zusammenfassung: true` liefert STATT ' +
        'der Namensliste je direktem Unterordner nur Anzahl, Gesamtgroesse und juengstes Datum — ' +
        'die billige Antwort auf „wo liegt ueberhaupt Arbeit?". Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: ADRESSE_PFAD,
        id: ADRESSE_ID,
        tiefe: z.number().int().min(0).max(5).optional()
          .describe('0 (Vorgabe) = nur dieser Ordner. 1 = plus direkte Unterordner, usw.'),
        muster: z.string().min(1).optional()
          .describe('Glob auf den NAMEN, z. B. "*.md" oder "_*". Filtert die Ausgabe, nicht den Abstieg.'),
        limit: z.number().int().min(1).max(500).describe('Wie viele Eintraege diese Seite hat (Pflicht).'),
        cursor: z.string().optional().describe('naechsterCursor der vorigen Seite, unveraendert.'),
        maxBytes: z.number().int().min(1024).max(1024 * 1024).optional()
          .describe(`Groessenbudget der Seite in Bytes (Vorgabe ${MAX_BYTES_LISTE_VORGABE}).`),
        zusammenfassung: z.boolean().optional()
          .describe('true = statt der Eintraege je direktem Unterordner eine verdichtete Zeile.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, pfad, id, tiefe, muster, limit, cursor, maxBytes, zusammenfassung }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)

        // Sonderfall Wurzel: ohne Adresse ist die Library selbst gemeint.
        const adresse = pfad || id
          ? await loeseAdresse({ provider, pfad, id, erwartet: 'folder' })
          : { id: 'root', pfad: '', name: '(Wurzel)', typ: 'folder' as const }

        const ergebnis = await listeOrdner({
          liste: (folderId) => provider.listItemsById(folderId),
          folderId: adresse.id,
          ordnerPfad: adresse.pfad,
          tiefe: tiefe ?? 0,
          muster,
          limit,
          cursor,
          maxBytes,
          zusammenfassung,
        })
        return jsonResult({ ordner: { pfad: adresse.pfad || '(Wurzel)', id: adresse.id }, ...ergebnis })
      } catch (error) {
        return storageFehler(error)
      }
    },
  )

  server.registerTool(
    'pfad_aufloesen',
    {
      title: 'Pfad → Id (billig)',
      description:
        'Loest einen library-relativen Pfad auf seine Storage-Id auf, OHNE Inhalt zu lesen — ' +
        'ein Listing je Pfadsegment. Dafuer gedacht, eine Id wiederzufinden, die nach einem ' +
        'Schreibvorgang oder Umzug ins Leere lief. `erwartet` sagt, ob am Ende eine Datei oder ' +
        'ein Ordner stehen muss (bei Namensgleichheit wird nicht geraten). Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: z.string().min(1).describe('Library-relativer Pfad, z. B. "26.01 Klima/BERICHT.md"'),
        erwartet: z.enum(['datei', 'ordner']).describe('Was am Ende des Pfades stehen muss'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, pfad, erwartet }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const adresse = await loeseAdresse({
          provider, pfad, erwartet: erwartet === 'ordner' ? 'folder' : 'file',
        })
        return jsonResult({ pfad: adresse.pfad, id: adresse.id, name: adresse.name, typ: erwartet })
      } catch (error) {
        return storageFehler(error)
      }
    },
  )
}
