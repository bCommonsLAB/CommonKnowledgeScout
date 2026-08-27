/**
 * @fileoverview MCP-Werkzeug `stand_setzen` (F8-Nachzug zur Bruecke).
 *
 * @description
 * Bis hierher hatte die Bruecke KEINEN Weg, den erklaerten
 * `bearbeitungsstand` zu setzen — Agenten schrieben ihn ueber die Datei-Bridge
 * direkt ins Frontmatter und umgingen damit alle vier Schutzstufen aus W7
 * (Live-Befund 24.08.2026). Dieses Werkzeug nutzt exakt den Weg der
 * Agentensicht (`fuehreStandAus`): gleiche Stufen, gleiche Zeilen-Chirurgie,
 * gleicher Wiederherstellungs-Pfad.
 *
 * GRENZE (Projektauftrag §F8): `abgenommen` ist hier NICHT setzbar — die
 * Abnahme ist eine menschliche Selbstauskunft und geht nur ueber den Knopf in
 * der Werkbank, hinter dem der frische Precheck-Scan haengt. Dieselbe Grenze
 * zieht das Stand-Menue der Oberflaeche.
 *
 * @module mcp
 */

import { z } from 'zod'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { fuehreStandAus } from '@/lib/agent-view/stand-ausfuehren'
import { parseStandRequest } from '@/lib/agent-view/stand-plan'
import { BEARBEITUNGSSTAND_VALUES } from '@/lib/agent-view/types'
import { getCoverageReport } from '@/lib/repositories/agent-view-coverage-repo'
import { FOLDER_ID, LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

/** Ueber die Bruecke setzbare Staende — `abgenommen` bleibt dem Menschen. */
export const STAND_WERTE_BRUECKE = BEARBEITUNGSSTAND_VALUES.filter((wert) => wert !== 'abgenommen')

export function registerStandTool(server: McpServer): void {
  server.registerTool(
    'stand_setzen',
    {
      title: 'Erklaerten Bearbeitungsstand setzen (SCHREIBT)',
      description:
        'Setzt `bearbeitungsstand` + `bearbeitungsstand_seit` im _INDEX.md eines Vorhabens — ueber ' +
        'denselben geschuetzten Weg wie die Agentensicht, NICHT ueber die Datei-Bridge. Vier ' +
        'Schutzstufen: kein _INDEX.md (wird nie angelegt) · Stand im Storage weicht von ' +
        'erwarteterStand ab · Report veraltet · nicht bereit. Bei jedem Befund wird NICHTS ' +
        'geschrieben, Body und fremde Frontmatter-Felder bleiben unangetastet. ' +
        '„abgenommen" ist hier bewusst NICHT waehlbar: die Abnahme ist Peters Klick in der ' +
        'Werkbank. erwarteterStand ist PFLICHT (explizit null, wenn der Ordner keinen deklariert) ' +
        '— er verhindert, dass zwei Schreiber einander ueberholen. Nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        folderId: FOLDER_ID,
        stand: z.enum(STAND_WERTE_BRUECKE as unknown as [string, ...string[]])
          .describe('Zielstand; „abgenommen" ist nicht setzbar (menschliche Selbstauskunft)'),
        erwarteterStand: z.union([z.enum(BEARBEITUNGSSTAND_VALUES as unknown as [string, ...string[]]), z.null()])
          .describe('Stand, den der Aufrufer aktuell sieht; explizit null = Ordner deklariert keinen'),
        bestaetigen: z.boolean().optional()
          .describe('true = gleicher Stand, nur das Datum neu (loest einen Widerspruch nach Pruefung auf)'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, folderId, stand, erwarteterStand, bestaetigen , begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'stand_setzen', libraryId, akteur: mcpUserEmail(), begruendung, folderId }, async () => {
          const userEmail = mcpUserEmail()
          await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const gespeichert = await getCoverageReport(libraryId)
          if (gespeichert === null) {
            return errorResult(new Error('Kein gespeicherter Report — erst abdeckung_scannen, dann Stand setzen.'))
          }
          // Der Client urteilt per Definition auf dem gespeicherten Report; die
          // Stufe-3-Pruefung bleibt trotzdem drin (der Report kann zwischen
          // Lesen und Schreiben neu gerechnet worden sein).
          const request = parseStandRequest({
            folderId, stand, erwarteterStand,
            reportGeneratedAt: gespeichert.generatedAt,
            bestaetigen,
          })
          const ergebnis = await fuehreStandAus({
            libraryId, userEmail, provider, request,
            gespeicherterGeneratedAt: gespeichert.generatedAt,
          })
          return jsonResult({
            gesetzt: ergebnis,
            hinweis:
              'Der gespeicherte Report zeigt den alten Stand, bis erneut gescannt wird — ' +
              'abdeckung_scannen auf denselben Teilbaum zieht ihn nach.',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
