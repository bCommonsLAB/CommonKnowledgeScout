/**
 * @fileoverview MCP-Werkzeug `sitzungen_importieren` (Plan sitzungen-register, R2).
 *
 * @description
 * Einmal-Werkzeug: liest die Arbeitsliste „Sitzungen nachtragen" auf dem
 * Server und uebernimmt jede Zeile ins Sitzungs-Register — auch Sitzungen
 * ohne Beleg und ohne Kennung (`alt:<Nr>`). Vorgabe ist die Vorschau; erst
 * `nurVorschau: false` schreibt. Ein zweiter Lauf aendert nichts. Nach
 * Owner-Entscheid E2 (Liste loeschen) kann das Werkzeug wieder entfernt werden.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { importiereArbeitsliste } from '@/lib/agent-view/sitzungen-register/import/import-dienst'
import { ARCHIVPFLEGE_HINWEIS, pruefeArchivpflege } from './archivpflege'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { loeseAdresse } from './storage/adressierung'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

const VORGABE_MAX_ZEILEN = 60

export function registerSitzungenImportTool(server: McpServer): void {
  server.registerTool(
    'sitzungen_importieren',
    {
      title: 'Arbeitsliste ins Sitzungs-Register uebernehmen (Vorgabe: Vorschau)',
      description:
        ARCHIVPFLEGE_HINWEIS +
        'Einmal-Werkzeug (R2): liest die Arbeitsliste (pfad, Markdown mit Abschnitt „## Sitzungen nach Vorhaben" und ' +
        'Tabellen | Erl. | Nr | Beginn | Ende | Titel | Quelle | Repo · Branch/PR · Link | Bemerkung |) auf dem Server und ' +
        'ordnet jede Zeile ihrer Sitzung zu: Sitzungs-Link (session_…) → Verweis [[Notiz]] nach „erledigt" → ' +
        'Export-Kuerzel (8 Zeichen, nur eindeutig) → sonst alt:<Nr>. Fuellt nur, was die Register-Zeile noch nicht weiss ' +
        '(Titel, Daten, Repo, Vorhaben-Vorschlag, Notiz-Kopie, Bemerkung); „überspringen: <Grund>" setzt die ' +
        'Entscheidung, wenn sie offen ist. nurVorschau (Vorgabe true) plant nur; false SCHREIBT (nur nach Bestaetigung). ' +
        'Antwort: Bilanz je Teil (A–D: erledigt, offen, uebersprungen), Wege, neu/ergaenzt, Zeilen mit Hinweisen ' +
        '(bis maxZeilen), Belege ohne Listenzeile, Lese- und Parse-Fehler. Ein zweiter Lauf aendert nichts.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: z.string().trim().min(1).describe('Library-relativer Pfad der Arbeitsliste'),
        nurVorschau: z.boolean().optional().describe('Vorgabe true: nur planen. false = schreiben'),
        maxZeilen: z.number().int().min(1).max(500).optional().describe(`Wie viele auffaellige Zeilen die Antwort nennt (Vorgabe ${VORGABE_MAX_ZEILEN})`),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, pfad, nurVorschau, maxZeilen, begruendung }) => {
      const vorschau = nurVorschau !== false
      try {
        return await mitProtokoll(
          { werkzeug: 'sitzungen_importieren', libraryId, akteur: mcpUserEmail(), begruendung, pfad, modus: vorschau ? 'vorschau' : undefined },
          async () => {
            const userEmail = mcpUserEmail()
            const library = await requireLibrary(userEmail, libraryId)
            pruefeArchivpflege(library, 'sitzungen_importieren')
            const provider = await requireProvider(userEmail, libraryId)
            const adresse = await loeseAdresse({ provider, pfad, erwartet: 'file' })
            const text = await (await provider.getBinary(adresse.id)).blob.text()
            const r = await importiereArbeitsliste({ libraryId: library.id, text, nurVorschau: vorschau, jetzt: new Date().toISOString() })
            const n = maxZeilen ?? VORGABE_MAX_ZEILEN
            return jsonResult({
              ...r,
              datei: { pfad: adresse.pfad, id: adresse.id },
              auffaellig: r.auffaellig.slice(0, n),
              auffaelligGesamt: r.auffaellig.length,
              hinweis: vorschau
                ? 'Vorschau — nichts geschrieben. Mit nurVorschau: false uebernehmen (zweiter Lauf aendert nichts).'
                : 'Uebernommen. Stand jetzt mit sitzungen_auflisten pruefen.',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
