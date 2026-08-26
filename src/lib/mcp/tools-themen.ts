/**
 * @fileoverview MCP-Werkzeug `themen_setzen` (Nachzug aus der Testsession A6).
 *
 * @description
 * Die Themen-Zuordnung ist Aufgabe des Aufraeum-Agenten, nicht des Menschen
 * im Dropdown (Ergebnis-Dokument 25.08.2026, §7) — er hat beim Aufraeumen
 * die Uebersicht. Dieses Werkzeug nutzt exakt den Weg der Oberflaeche
 * (`setzeThemen` + `baueIndexPorts`): dieselbe Zeilen-Chirurgie, dieselbe
 * Ruecklese-Pruefung, derselbe Wiederherstellungs-Pfad. Zusaetzlich ist
 * `erwarteteThemen` PFLICHT — der Riegel gegen konkurrierende Schreiber,
 * analog `erwarteterStand` in `tools-stand.ts`.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { baueIndexPorts } from '@/lib/agent-view/stand-ausfuehren'
import { setzeThemen } from '@/lib/agent-view/themen-schreiben'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

export function registerThemenTool(server: McpServer): void {
  server.registerTool(
    'themen_setzen',
    {
      title: 'Gepflegte Themen eines Vorhabens setzen (SCHREIBT)',
      description:
        'Setzt die von Hand gepflegte Themenliste (`themen:` im _INDEX.md eines Vorhabens) — ueber ' +
        'denselben geschuetzten Weg wie der Themen-Editor der Werkbank: zeilen-chirurgisch, mit ' +
        'Ruecklese-Pruefung, Body und fremde Frontmatter-Felder bleiben Byte fuer Byte stehen. ' +
        '`themen` ERSETZT die komplette Liste (ergaenzt nicht); Namen aus dem Vokabular der ' +
        'Kompaktsicht verwenden (abdeckung_lesen → themen.vokabular). erwarteteThemen ist PFLICHT ' +
        '(explizit null, wenn der Ordner keine deklariert) — weicht der Stand im Storage ab, wird ' +
        'NICHTS geschrieben. Ohne _INDEX.md wird keins angelegt (kein_index). Die Ordnernamen ' +
        'verraten das Thema NICHT (Ereignisnamen) — Zuordnung verlangt den Blick in den Bericht. ' +
        'Nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        folderId: z.string().min(1)
          .describe('Storage-Ordner-Id des Vorhabens (aus abdeckung_lesen → filter.ordner)'),
        themen: z.array(z.string())
          .describe('Vollstaendige neue Themenliste; [] entfernt alle. Kein Komma / keine eckige Klammer im Namen'),
        erwarteteThemen: z.union([z.array(z.string()), z.null()])
          .describe('Themen, die der Aufrufer aktuell am Vorhaben sieht; explizit null = Ordner deklariert keine'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, folderId, themen, erwarteteThemen }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const ergebnis = await setzeThemen(folderId, themen, baueIndexPorts(provider, folderId), {
          erwarteteThemen,
        })
        return jsonResult({
          gesetzt: ergebnis,
          vokabular: library.config?.agentView?.themen ?? null,
          hinweis:
            'Der gespeicherte Report zeigt die alten Themen, bis erneut gescannt wird — ' +
            'abdeckung_scannen auf denselben Teilbaum zieht sie nach.',
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
