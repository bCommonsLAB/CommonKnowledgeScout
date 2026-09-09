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
 * Wunschliste 5, A1 (09.09.2026): Namen werden gegen das Vokabular der
 * Library geprueft (`config.agentView.themen`). Unbekannte Namen werden
 * abgewiesen und die naechstliegenden Eintraege genannt — vorher wurde jeder
 * Tippfehler geschrieben und wurde in der Werkbank selbst zum Vokabular.
 * `neuesThemaErlauben: true` schreibt trotzdem; die Absicht steht dann als
 * `neueThemen` in der Antwort und damit im Aktions-Protokoll. Ohne
 * konfiguriertes Vokabular gibt es nichts zu pruefen — die Antwort sagt das
 * ausdruecklich (`vokabularPruefung`), statt still durchzuwinken.
 *
 * @module mcp
 */

import { z } from 'zod'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { baueIndexPorts } from '@/lib/agent-view/stand-ausfuehren'
import { setzeThemen } from '@/lib/agent-view/themen-schreiben'
import { ThemaUnbekanntError, pruefeGegenVokabular } from '@/lib/agent-view/themen-vokabular'
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
        'NICHTS geschrieben. Namen, die nicht im Vokabular der Library stehen, werden ABGEWIESEN ' +
        '(thema_unbekannt, mit Vorschlaegen); nur mit neuesThemaErlauben: true wird ein bewusst ' +
        'neues Thema geschrieben — dann auch in die Library-Einstellungen aufnehmen. Ohne _INDEX.md ' +
        'wird keins angelegt (kein_index). Die Ordnernamen verraten das Thema NICHT (Ereignisnamen) ' +
        '— Zuordnung verlangt den Blick in den Bericht. Nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        folderId: z.string().min(1)
          .describe('Storage-Ordner-Id des Vorhabens (aus abdeckung_lesen → filter.ordner)'),
        themen: z.array(z.string())
          .describe('Vollstaendige neue Themenliste; [] entfernt alle. Kein Komma / keine eckige Klammer im Namen'),
        erwarteteThemen: z.union([z.array(z.string()), z.null()])
          .describe('Themen, die der Aufrufer aktuell am Vorhaben sieht; explizit null = Ordner deklariert keine'),
        neuesThemaErlauben: z.boolean().optional()
          .describe('true = Namen ausserhalb des Vokabulars trotzdem schreiben (bewusst neues Thema); Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, folderId, themen, erwarteteThemen, neuesThemaErlauben, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'themen_setzen', libraryId, akteur: mcpUserEmail(), begruendung, folderId }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const vokabular = library.config?.agentView?.themen ?? null
          // Pruefung VOR dem Storage-Zugriff: ein abgewiesener Name kostet kein Listing.
          const konfiguriert = Array.isArray(vokabular) && vokabular.length > 0
          const unbekannt = konfiguriert ? pruefeGegenVokabular(themen, vokabular) : []
          if (unbekannt.length > 0 && neuesThemaErlauben !== true) throw new ThemaUnbekanntError(unbekannt)
          const provider = await requireProvider(userEmail, libraryId)
          const ergebnis = await setzeThemen(folderId, themen, baueIndexPorts(provider, folderId), {
            erwarteteThemen,
          })
          return jsonResult({
            gesetzt: ergebnis,
            vokabular,
            vokabularPruefung: konfiguriert ? 'geprueft' : 'kein_vokabular_konfiguriert',
            ...(unbekannt.length > 0 ? { neueThemen: unbekannt.map((u) => u.name) } : {}),
            hinweis:
              'Der gespeicherte Report zeigt die alten Themen, bis erneut gescannt wird — ' +
              'abdeckung_scannen auf denselben Teilbaum zieht sie nach.',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
