/**
 * @fileoverview Storage-Werkzeug zum Schreiben: `datei_schreiben` (ST2).
 *
 * @description
 * Der generische Schreibweg. Drei Dinge unterscheiden ihn von `uploadFile`:
 *
 * - `ifVersion` ist PFLICHT (Q1). Ein optionales Feld waere in der Praxis
 *   ein weggelassenes — und die Sperre waere genau dann weg, wenn sie
 *   gebraucht wird.
 * - Bei Konflikt kommt der aktuelle Inhalt mit zurueck (`konflikt.ts`).
 * - Geschuetzte Pfade gehoeren den Fachwerkzeugen (`schreibschutz.ts`).
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
import { pruefeSchreibschutz } from './schreibschutz'

export function registerStorageSchreibTools(server: McpServer): void {
  server.registerTool(
    'datei_schreiben',
    {
      title: 'Textdatei ersetzen (SCHREIBT)',
      description:
        'Ersetzt den GESAMTEN Inhalt einer bestehenden Textdatei. `ifVersion` ist Pflicht: die ' +
        'version aus datei_lesen/stat. Stimmt sie nicht mehr, kommt ein Konflikt MIT dem aktuellen ' +
        'Inhalt und der aktuellen Version zurueck — dann mergen und erneut schreiben, ohne noch ' +
        'einmal zu lesen. Die Datei behaelt ihre id. Legt NICHTS an (dafuer datei_anlegen). ' +
        '_INDEX.md und "_"-Twin-Ordner sind gesperrt — dafuer die Fachwerkzeuge. Nur nach ' +
        'Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: ADRESSE_PFAD,
        id: ADRESSE_ID,
        inhalt: z.string().describe('Neuer Volltext (UTF-8)'),
        ifVersion: z.string().min(1).describe('version aus datei_lesen/stat — Pflicht, kein optionaler Schutz'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, pfad, id, inhalt, ifVersion, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'datei_schreiben', libraryId, akteur: mcpUserEmail(), begruendung, pfad },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)

            const adresse = await loeseAdresse({ provider, pfad, id, erwartet: 'file' })
            pruefeSchreibschutz(adresse.pfad, 'ganz_ersetzen')

            if (!supportsVersioning(provider)) {
              throw new Error(
                `Storage-Provider "${provider.name}" kann nicht versioniert schreiben — ` +
                'es wurde NICHTS geaendert.',
              )
            }

            let ergebnis
            try {
              ergebnis = await provider.updateFile(
                adresse.id,
                new Blob([inhalt], { type: 'text/markdown' }),
                { ifVersion },
              )
            } catch (fehler) {
              // Q1: Der Konflikt kommt MIT aktuellem Inhalt und Version
              // zurueck, damit der Aufrufer mergen kann, ohne neu zu lesen.
              const antwort = await konfliktAntwort({ fehler, provider, fileId: adresse.id, pfad: adresse.pfad })
              if (antwort) return antwort
              throw fehler
            }
            return jsonResult({
              pfad: adresse.pfad,
              id: ergebnis.id,
              version: ergebnis.version,
              geschriebeneBytes: Buffer.byteLength(inhalt, 'utf-8'),
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
