/**
 * @fileoverview Storage-Werkzeug: `datei_patchen` (Welle ST3).
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supportsVersioning } from '@/lib/storage/types'
import { BEGRUENDUNG, mitProtokoll } from '../protokoll'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from '../tool-shared'
import { storageFehler } from './fehler'
import { ADRESSE_ID, ADRESSE_PFAD, loeseAdresse } from './adressierung'
import { konfliktAntwort } from './konflikt'
import { type PatchModus, wendePatchAn } from './patch'
import { pruefeSchreibschutz } from './schreibschutz'

const MODUS_SCHEMA = z.object({
  art: z.enum(['ersetze', 'abschnitt_ersetzen', 'frontmatter_setzen']),
  altText: z.string().optional().describe('art="ersetze": muss GENAU EINMAL in der Datei vorkommen'),
  neuText: z.string().optional().describe('art="ersetze": was an die Stelle tritt'),
  ueberschrift: z.string().optional().describe('art="abschnitt_ersetzen": z. B. "## Befunde"'),
  neuerInhalt: z.string().optional().describe('art="abschnitt_ersetzen": inkl. der Ueberschriftszeile'),
  felder: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
    .describe('art="frontmatter_setzen": flache snake_case-Keys, Skalare. Keine Listen/Objekte.'),
})

/** Uebersetzt die Eingabe in einen {@link PatchModus} — ohne fehlende Felder zu raten. */
function leseModus(eingabe: z.infer<typeof MODUS_SCHEMA>): PatchModus {
  if (eingabe.art === 'ersetze') {
    if (eingabe.altText === undefined || eingabe.neuText === undefined) {
      throw new Error('art="ersetze" braucht `altText` und `neuText`')
    }
    return { art: 'ersetze', altText: eingabe.altText, neuText: eingabe.neuText }
  }
  if (eingabe.art === 'abschnitt_ersetzen') {
    if (!eingabe.ueberschrift || eingabe.neuerInhalt === undefined) {
      throw new Error('art="abschnitt_ersetzen" braucht `ueberschrift` und `neuerInhalt`')
    }
    return { art: 'abschnitt_ersetzen', ueberschrift: eingabe.ueberschrift, neuerInhalt: eingabe.neuerInhalt }
  }
  if (!eingabe.felder || Object.keys(eingabe.felder).length === 0) {
    throw new Error('art="frontmatter_setzen" braucht `felder` mit mindestens einem Eintrag')
  }
  return { art: 'frontmatter_setzen', felder: eingabe.felder }
}

export function registerStoragePatchTool(server: McpServer): void {
  server.registerTool(
    'datei_patchen',
    {
      title: 'Teiländerung an einer Textdatei (SCHREIBT)',
      description:
        'Aendert einen TEIL einer Datei, ohne sie ganz zu uebertragen — dafuer gedacht, wenn sich ' +
        'eine Zahl oder ein Absatz aendert. Drei Modi: "ersetze" (altText muss GENAU EINMAL ' +
        'vorkommen, sonst Fehler — die Eindeutigkeit ist der Schutz), "abschnitt_ersetzen" ' +
        '(Markdown-Abschnitt bis zur naechsten gleichrangigen Ueberschrift, tiefere ' +
        'Unterueberschriften gehoeren dazu), "frontmatter_setzen" (nur die genannten Felder; Body ' +
        'und fremde Frontmatter-Zeilen bleiben Byte fuer Byte stehen). `ifVersion` ist Pflicht; ' +
        'bei Konflikt kommt der aktuelle Inhalt mit zurueck. _INDEX.md und "_"-Twin-Ordner sind ' +
        'gesperrt — dafuer die Fachwerkzeuge. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: ADRESSE_PFAD,
        id: ADRESSE_ID,
        modus: MODUS_SCHEMA,
        ifVersion: z.string().min(1).describe('version aus datei_lesen/stat — Pflicht'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, pfad, id, modus, ifVersion, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'datei_patchen', libraryId, akteur: mcpUserEmail(), begruendung, pfad },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)

            const adresse = await loeseAdresse({ provider, pfad, id, erwartet: 'file' })
            pruefeSchreibschutz(adresse.pfad)

            if (!supportsVersioning(provider)) {
              throw new Error(
                `Storage-Provider "${provider.name}" kann nicht versioniert schreiben — ` +
                'es wurde NICHTS geaendert.',
              )
            }

            const { blob } = await provider.getBinary(adresse.id)
            const vorher = await blob.text()
            const { inhalt, beschreibung } = wendePatchAn(vorher, leseModus(modus))

            // Ein Patch, der nichts aendert, wird nicht geschrieben: Der
            // Schreibvorgang wuerde die Datei altern lassen (bericht_veraltet)
            // fuer eine Aenderung, die es nicht gab.
            if (inhalt === vorher) {
              return jsonResult({
                pfad: adresse.pfad, id: adresse.id, version: ifVersion,
                geaendert: false,
                hinweis: 'Der Patch ergibt denselben Inhalt — nichts geschrieben.',
              })
            }

            let ergebnis
            try {
              ergebnis = await provider.updateFile(
                adresse.id,
                new Blob([inhalt], { type: 'text/markdown' }),
                { ifVersion },
              )
            } catch (fehler) {
              const antwort = await konfliktAntwort({ fehler, provider, fileId: adresse.id, pfad: adresse.pfad })
              if (antwort) return antwort
              throw fehler
            }

            return jsonResult({
              pfad: adresse.pfad,
              id: ergebnis.id,
              version: ergebnis.version,
              geaendert: true,
              beschreibung,
              bytesVorher: Buffer.byteLength(vorher, 'utf-8'),
              bytesNachher: Buffer.byteLength(inhalt, 'utf-8'),
              ...(ergebnis.idChanged ? { idGeaendert: { alt: ergebnis.idChanged.from, neu: ergebnis.idChanged.to } } : {}),
            })
          },
        )
      } catch (error) {
        return storageFehler(error)
      }
    },
  )
}
