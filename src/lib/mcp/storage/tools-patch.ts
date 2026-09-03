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
import { wendePatchesAn } from './patch'
import { MODUS_SCHEMA, aktionZuModus, leseModus } from './patch-schema'
import { pruefeSchreibschutz } from './schreibschutz'

export function registerStoragePatchTool(server: McpServer): void {
  server.registerTool(
    'datei_patchen',
    {
      title: 'Teiländerung an einer Textdatei (SCHREIBT)',
      description:
        'Aendert einen TEIL einer Datei, ohne sie ganz zu uebertragen. Sechs Modi: "ersetze" ' +
        '(altText muss GENAU EINMAL vorkommen, sonst Fehler — die Eindeutigkeit ist der Schutz), ' +
        '"abschnitt_ersetzen" (Markdown-Abschnitt bis zur naechsten gleichrangigen Ueberschrift, ' +
        'tiefere Unterueberschriften gehoeren dazu), "frontmatter_setzen" (nur die genannten ' +
        'Felder; Body und fremde Frontmatter-Zeilen bleiben Byte fuer Byte stehen), ' +
        '"abschnitt_einfuegen" (Block vor/nach einem Abschnitt — dafuer NICHT mehr ersetze auf ' +
        'die Ueberschrift missbrauchen) und "tabelle_zeile_einfuegen" (eine Zeile, ohne die ' +
        'Tabelle neu zu schreiben). STAPEL: `modi: [...]` wendet mehrere Teilaenderungen in EINEM ' +
        'Aufruf an — alles oder nichts, jeder Schritt sieht das Ergebnis des vorigen; scheitert ' +
        'einer, wird NICHTS geschrieben. Entweder `modus` ODER `modi`. `ifVersion` ist Pflicht; ' +
        'bei Konflikt kommt der aktuelle Inhalt mit zurueck. _INDEX.md und "_"-Twin-Ordner sind ' +
        'gesperrt — dafuer die Fachwerkzeuge. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: ADRESSE_PFAD,
        id: ADRESSE_ID,
        modus: MODUS_SCHEMA.optional().describe('Eine Teilaenderung. Entweder `modus` oder `modi`.'),
        modi: z.array(MODUS_SCHEMA).min(1).max(20).optional()
          .describe('Mehrere Teilaenderungen in Reihenfolge — alles oder nichts.'),
        ifVersion: z.string().min(1).describe('version aus datei_lesen/stat — Pflicht'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, pfad, id, modus, modi, ifVersion, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'datei_patchen', libraryId, akteur: mcpUserEmail(), begruendung, pfad },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)

            if ((modus && modi) || (!modus && !modi)) {
              throw new Error('Entweder `modus` (eine Aenderung) ODER `modi` (mehrere) angeben — nicht beides, nicht keines')
            }
            const adresse = await loeseAdresse({ provider, pfad, id, erwartet: 'file' })
            // Welle ST5: Der Modus entscheidet mit. Am Fliesstext einer
            // _INDEX.md darf gearbeitet werden, an ihrem Feldkern nicht —
            // sonst steht Ordnerarbeit (Cowork-Befund 28.08.2026). Im Stapel
            // wird JEDER Schritt geprueft: sonst waere die Sperre dadurch zu
            // umgehen, dass man sie hinter einen erlaubten Schritt haengt.
            const geleseneModi = (modi ?? [modus as NonNullable<typeof modus>]).map(leseModus)
            for (const einzeln of geleseneModi) {
              pruefeSchreibschutz(adresse.pfad, aktionZuModus(einzeln))
            }

            if (!supportsVersioning(provider)) {
              throw new Error(
                `Storage-Provider "${provider.name}" kann nicht versioniert schreiben — ` +
                'es wurde NICHTS geaendert.',
              )
            }

            const { blob } = await provider.getBinary(adresse.id)
            const vorher = await blob.text()
            const { inhalt, beschreibung } = wendePatchesAn(vorher, geleseneModi)

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
