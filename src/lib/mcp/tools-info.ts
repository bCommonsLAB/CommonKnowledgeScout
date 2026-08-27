/**
 * @fileoverview Werkzeugsatz-Version der MCP-Bruecke + `bruecke_info` (A2).
 *
 * @description
 * Pilot-Befund A2: Die Desktop-App cached die Toolliste — nach
 * Schema-Aenderungen sieht der Agent alte Werkzeuge, bis der Mensch die
 * Erweiterung aus- und einschaltet. Serverseitig ist der Cache in unserem
 * statuslosen HTTP-Transport nicht invalidierbar (kein Push-Kanal) — aber
 * Drift wird ERKENNBAR: `bruecke_info` nennt Version und Soll-Toolliste des
 * Servers; sieht der Agent etwas anderes, bittet er den Menschen um den
 * Toggle, statt raetselhaft zu scheitern.
 *
 * REGEL: `TOOLSET_VERSION` bei JEDER Werkzeug-/Schema-Aenderung erhoehen
 * (sie erscheint auch als serverInfo.version im initialize-Handshake).
 *
 * @module mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jsonResult } from './tool-shared'

/** Version des Werkzeugsatzes — bei jeder Werkzeug-/Schema-Aenderung erhoehen. */
export const TOOLSET_VERSION = '2.9.0'

/** Soll-Liste der Werkzeuge (Reihenfolge = Registrierung in tools.ts). */
export const TOOL_NAMES = [
  'bibliotheken_auflisten',
  'abdeckung_lesen',
  'abdeckung_scannen',
  'twins_pruefen',
  'twins_synchronisieren',
  'familie_umziehen',
  'quelle_verwerfen',
  'ordner_erstellen',
  'ordner_umbenennen',
  // Welle ST2 — generische Storage-Schicht (alle Provider, nicht nur OneDrive).
  'ordner_listen',
  'pfad_aufloesen',
  'datei_lesen',
  'stat',
  'datei_schreiben',
  'datei_patchen',
  'datei_anlegen',
  'ordner_anlegen',
  'verschieben',
  'loeschen',
  'speicher_info',
  'quelle_erschliessen',
  'transformation_starten',
  'job_status',
  'job_liste',
  'sichten_regenerieren',
  'aenderungen_seit',
  'erschliessung_block_schreiben',
  'stand_setzen',
  'themen_setzen',
  'protokoll_lesen',
  'bruecke_info',
] as const

/** Registriert `bruecke_info` (siehe Datei-Kommentar). */
export function registerInfoTool(server: McpServer): void {
  server.registerTool(
    'bruecke_info',
    {
      title: 'Bruecken-Version + Soll-Toolliste',
      description:
        'Nennt Werkzeugsatz-Version und Soll-Toolliste des Servers. Weicht die eigene Sicht ab ' +
        '(fehlende/andere Werkzeuge), ist die Toolliste der Desktop-App veraltet — den Menschen ' +
        'bitten, die Erweiterung aus- und wieder einzuschalten. Liest nur.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      return jsonResult({
        toolsetVersion: TOOLSET_VERSION,
        werkzeuge: TOOL_NAMES,
        hinweis:
          'Fehlt hier gelistetes Werkzeug in deiner Sicht: Toolliste der Desktop-App ist veraltet — ' +
          'Erweiterung aus-/einschalten (Einstellungen → Erweiterungen).',
      })
    },
  )
}
