/**
 * @fileoverview MCP-Werkzeug `sitzung_eintragen` (Plan sitzungen-register, Welle R4b).
 *
 * @description
 * Traegt EINE abgeschlossene Sitzung in den Block „Sitzungen" jedes Vorhabens
 * und in die Chronik `Organisation/SITZUNGEN.md` ein — ohne Speicher-Scan,
 * in Sekunden. Ersetzt die beiden vollen Laeufe in den Folgeaufrufen von
 * `sitzung_abschliessen` (Befund 16.11.2026: je 90–100 s, ueber der
 * 80-s-Grenze des Geraets; der Teilbaum-Lauf loeschte Querverweise).
 * E7 bleibt: der Skill ruft es nach `job_status: completed`. Ablauf:
 * `eintragen-dienst.ts`, Anschluesse: `sitzung-eintragen-ports.ts`.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { trageSitzungEin } from '@/lib/agent-view/sitzungen-register/eintragen/eintragen-dienst'
import { ARCHIVPFLEGE_HINWEIS, pruefeArchivpflege } from './archivpflege'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { eintragPorts } from './sitzung-eintragen-ports'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

export function registerSitzungEintragenTool(server: McpServer): void {
  server.registerTool(
    'sitzung_eintragen',
    {
      title: 'Sitzung in Block und Chronik eintragen, ohne Scan (SCHREIBT)',
      description:
        ARCHIVPFLEGE_HINWEIS +
        'Traegt EINE Sitzung nach sitzung_abschliessen und job_status completed ein: je Beleg der Register-Zeile ' +
        'die Zeile im Block "### Sitzungen mit Claude (erzeugt)" des Ablage-Vorhabens, die Querverweis-Zeile in jedem ' +
        'Nebenvorhaben aus vorhaben: des Beleg-Kopfs (Pfade) und die Zeilen in Organisation/SITZUNGEN.md; dann die ' +
        'Stempel im Register. Kein Speicher-Scan — Sekunden statt der vollen Laeufe. Der Rest von Bericht und Chronik ' +
        'bleibt, wie er ist; geschrieben wird nur bei Aenderung und nur versioniert. Was ohne Scan nicht sicher geht ' +
        '(Bericht ohne erzeugten Block, Ablage ohne BERICHT.md, Nebenvorhaben nur als Name), steht in offen, die vollen ' +
        'Laeufe dann in folgeaufrufe. Fehler mit code: nicht_im_register, ohne_beleg, notiz_fehlt (Job noch nicht fertig). ' +
        'Idempotent. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sitzungId: z.string().trim().min(20).describe('Volle Sitzungs-Kennung wie bei sitzung_abschliessen'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sitzungId, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'sitzung_eintragen', libraryId, akteur: mcpUserEmail(), begruendung },
          async () => {
            const userEmail = mcpUserEmail()
            const library = await requireLibrary(userEmail, libraryId)
            pruefeArchivpflege(library, 'sitzung_eintragen')
            const provider = await requireProvider(userEmail, libraryId)
            const started = Date.now()
            const ergebnis = await trageSitzungEin(sitzungId, eintragPorts({ library, provider }))
            return jsonResult({ ...ergebnis, dauerMs: Date.now() - started })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
