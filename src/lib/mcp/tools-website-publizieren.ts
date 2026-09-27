/**
 * @fileoverview MCP-Werkzeuge: `dokument_publizieren`, `dokument_depublizieren` (B1).
 *
 * @description
 * Schliesst Station 2 des Website-Wegs (docs/plans/mcp-bruecke-website-publizieren.plan.md):
 * Eine Markdown-Datei im Storage wird unveraendert Galerie-Eintrag. Vorher
 * war das nur ueber die App-Oberflaeche oder ein lokales Skript moeglich;
 * `transformation_starten` haette den Text durch das Sprachmodell geschickt.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { resolveSourceItem } from './tools-erschliessen-shared'
import { depubliziereQuelle, publiziereMarkdownQuelle, type PublizierZeile } from './website-publizieren'

const MAX_STAPEL = 30

export function registerWebsitePublizierenTools(server: McpServer): void {
  server.registerTool(
    'dokument_publizieren',
    {
      title: 'Markdown-Quelle als Galerie-Eintrag publizieren (SCHREIBT)',
      description:
        'Macht eine Markdown-Datei (.md/.mdx/.txt) UNVERAENDERT zum Galerie-Eintrag — ohne Sprachmodell, ' +
        'anders als transformation_starten. Registriert die Datei als Transformation am Twin ' +
        '(Vorlage website-page bei detailViewType website, sonst markdown-page) und ingestiert sie; ' +
        'ein zweiter Aufruf aktualisiert den Eintrag. Vorher wird geprueft: detailViewType, Pflichtfelder ' +
        'der Registry, bei website die Sektions-Marker und ob Bild-URLs anonym ladbar sind. ' +
        'Warnungen blockieren, bis `trotzWarnungen: true` gesetzt ist; harte Fehler (kein Text, ' +
        'unbekannter Typ, ungueltiger Marker) blockieren immer. Stapel via sourceIds (bis 30), Fehler ' +
        'je Zeile. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der Markdown-Quelle'),
        quellPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelldatei'),
        sourceIds: z.array(z.string().min(1)).min(1).max(MAX_STAPEL).optional()
          .describe('STAPEL: mehrere Storage-Ids — eine Ergebniszeile je Quelle'),
        zielsprache: z.string().min(2).max(5).optional().describe('Sprache des Eintrags (Default de)'),
        trotzWarnungen: z.boolean().optional().describe('true = auch mit Warnungen publizieren (Vorgabe false)'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, sourceId, quellPfad, sourceIds, zielsprache, trotzWarnungen, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'dokument_publizieren', libraryId, akteur: mcpUserEmail(), begruendung, sourceId, pfad: quellPfad },
          async () => {
            const userEmail = mcpUserEmail()
            const library = await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)
            const einzeln = Boolean(sourceId) || Boolean(quellPfad)
            const stapel = Array.isArray(sourceIds) && sourceIds.length > 0
            if (einzeln && stapel) throw new Error('Entweder sourceId/quellPfad ODER sourceIds — nicht beides')
            if (!einzeln && !stapel) throw new Error('sourceId, quellPfad oder sourceIds ist Pflicht')

            const ziele: Array<{ sourceId?: string; quellPfad?: string }> = stapel
              ? (sourceIds ?? []).map((id) => ({ sourceId: id }))
              : [{ sourceId, quellPfad }]
            const zeilen: Array<PublizierZeile | { quelle: string; fehler: string }> = []
            for (const ziel of ziele) {
              let name = ziel.sourceId ?? ziel.quellPfad ?? '(unbekannt)'
              try {
                const source = await resolveSourceItem(provider, ziel.sourceId, ziel.quellPfad)
                name = source.name
                zeilen.push(await publiziereMarkdownQuelle({
                  library, userEmail, provider, source,
                  zielsprache: zielsprache ?? 'de', trotzWarnungen: trotzWarnungen === true,
                }))
              } catch (error) {
                zeilen.push({ quelle: name, fehler: error instanceof Error ? error.message : String(error) })
              }
            }
            return jsonResult({
              zeilen,
              publiziert: zeilen.filter((z) => 'fileId' in z && z.fileId).length,
              uebersprungen: zeilen.filter((z) => 'uebersprungen' in z && z.uebersprungen).length,
              gescheitert: zeilen.filter((z) => 'fehler' in z).length,
              hinweis: 'Sichtbar in der Galerie und — bei detailViewType website und siteEnabled — auf /explore/<slug>. Struktur pruefen mit seite_pruefen.',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'dokument_depublizieren',
    {
      title: 'Galerie-Eintrag zuruecknehmen (SCHREIBT)',
      description:
        'Entfernt den Galerie-Eintrag und die Vektoren einer Quelle. Twin und Quelldatei bleiben; ' +
        'dokument_publizieren stellt den Eintrag wieder her. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).describe('Storage-Id der Quelle (= fileId des Eintrags)'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, sourceId, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'dokument_depublizieren', libraryId, akteur: mcpUserEmail(), begruendung, sourceId },
          async () => {
            const library = await requireLibrary(mcpUserEmail(), libraryId)
            return jsonResult(await depubliziereQuelle({ library, fileId: sourceId }))
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
