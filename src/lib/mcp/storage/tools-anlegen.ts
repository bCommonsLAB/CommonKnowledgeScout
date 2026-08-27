/**
 * @fileoverview Storage-Werkzeuge: `datei_anlegen`, `ordner_anlegen` (ST4).
 *
 * @description
 * `datei_anlegen` ist bewusst von `datei_schreiben` GETRENNT, damit „neu"
 * und „aendern" nicht verwechselt werden — ein Anlegen, das versehentlich
 * ueberschreibt, ist genau der Datenverlust, den `ifVersion` verhindern soll.
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BEGRUENDUNG, mitProtokoll } from '../protokoll'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from '../tool-shared'
import { storageFehler } from './fehler'
import { normalisiere } from './adressierung'
import { ordnerSicherstellen, trenne } from './pfad-helfer'
import { pruefeSchreibschutz } from './schreibschutz'
import { resolveItemByPath } from '../resolve-folder'

export function registerStorageAnlegenTools(server: McpServer): void {
  server.registerTool(
    'datei_anlegen',
    {
      title: 'Neue Textdatei anlegen (SCHREIBT)',
      description:
        'Legt eine NEUE Textdatei an. Getrennt von datei_schreiben, damit "neu" und "aendern" ' +
        'nicht verwechselt werden. `nichtUeberschreiben` ist per Vorgabe true: existiert die ' +
        'Datei, bricht der Aufruf ab und nennt ihre id/version — dann gehoert datei_schreiben ' +
        'oder datei_patchen dorthin. `elternAnlegen` legt fehlende Ordner an. Nur nach ' +
        'Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: z.string().min(1).describe('Library-relativer Zielpfad inkl. Dateiname'),
        inhalt: z.string(),
        nichtUeberschreiben: z.boolean().optional().describe('Vorgabe true'),
        elternAnlegen: z.boolean().optional().describe('Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, pfad, inhalt, nichtUeberschreiben, elternAnlegen, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'datei_anlegen', libraryId, akteur: mcpUserEmail(), begruendung, pfad },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)
            pruefeSchreibschutz(pfad)

            const { eltern, name } = trenne(pfad)
            const ordnerId = await ordnerSicherstellen(provider, eltern, elternAnlegen === true)

            const vorhanden = (await provider.listItemsById(ordnerId))
              .find((k) => k.type === 'file' && k.metadata.name === name)
            if (vorhanden && nichtUeberschreiben !== false) {
              throw new Error(
                `"${normalisiere(pfad)}" existiert bereits (id ${vorhanden.id}, version ` +
                `${vorhanden.metadata.version ?? 'unbekannt'}) — nichts geschrieben. ` +
                'Zum Aendern datei_schreiben/datei_patchen verwenden.',
              )
            }

            const angelegt = await provider.uploadFile(
              ordnerId, new File([inhalt], name, { type: 'text/markdown' }),
            )
            return jsonResult({
              pfad: normalisiere(pfad), id: angelegt.id,
              version: angelegt.metadata.version ?? null,
              ueberschrieben: Boolean(vorhanden),
            })
          },
        )
      } catch (error) {
        return storageFehler(error)
      }
    },
  )

  server.registerTool(
    'ordner_anlegen',
    {
      title: 'Ordner anlegen (SCHREIBT)',
      description:
        'Legt einen Ordner an. `elternAnlegen: true` legt fehlende Zwischenordner mit an. ' +
        'Ein bereits vorhandener Ordner ist KEIN Fehler — die Antwort sagt, ob er neu ist. ' +
        'Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: z.string().min(1),
        elternAnlegen: z.boolean().optional().describe('Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, pfad, elternAnlegen, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'ordner_anlegen', libraryId, akteur: mcpUserEmail(), begruendung, pfad },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)

            let vorhanden = false
            try {
              await resolveItemByPath(provider, pfad, 'folder', [])
              vorhanden = true
            } catch {
              // Nicht auffindbar ist hier der Normalfall — genau deshalb legen wir an.
            }
            const id = await ordnerSicherstellen(provider, pfad, elternAnlegen === true)
            return jsonResult({ pfad: normalisiere(pfad), id, neuAngelegt: !vorhanden })
          },
        )
      } catch (error) {
        return storageFehler(error)
      }
    },
  )
}
