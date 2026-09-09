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
 * Wunschliste 5, B3 (09.09.2026): Das Werkzeug nimmt jetzt JEDEN Ordner,
 * nicht nur das Vorhaben — mit `indexAnlegen: true` legt es ein fehlendes
 * `_INDEX.md` nach Vorlage an (ohne `bearbeitungsstand`, der bleibt
 * `stand_setzen`), und `folderIds` vergibt dieselbe Liste an bis zu
 * {@link MAX_THEMEN_ORDNER} Ordner in einem Aufruf.
 *
 * @module mcp
 */

import { z } from 'zod'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { baueIndexPorts } from '@/lib/agent-view/stand-ausfuehren'
import { setzeThemen } from '@/lib/agent-view/themen-schreiben'
import { ThemaUnbekanntError, pruefeGegenVokabular } from '@/lib/agent-view/themen-vokabular'
import { MAX_THEMEN_ORDNER, fuehreStapelThemenAus, sammleOrdnerIds } from './themen-stapel'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

const HINWEIS_SCAN =
  'Der gespeicherte Report zeigt die alten Themen, bis erneut gescannt wird — ' +
  'abdeckung_scannen auf denselben Teilbaum zieht sie nach.'

export function registerThemenTool(server: McpServer): void {
  server.registerTool(
    'themen_setzen',
    {
      title: 'Gepflegte Themen eines Ordners setzen (SCHREIBT)',
      description:
        'Setzt die von Hand gepflegte Themenliste (`themen:` im _INDEX.md) — ueber denselben ' +
        'geschuetzten Weg wie der Themen-Editor der Werkbank: zeilen-chirurgisch, mit ' +
        'Ruecklese-Pruefung, Body und fremde Frontmatter-Felder bleiben Byte fuer Byte stehen. ' +
        'Nimmt JEDEN Ordner, auch Ereignisordner UNTERHALB des Vorhabens — nur so zeigt das ' +
        'Themenregister in ein Vorhaben hinein statt nur bis zu ihm. `themen` ERSETZT die ' +
        'komplette Liste (ergaenzt nicht); Namen aus dem Vokabular der Kompaktsicht verwenden ' +
        '(abdeckung_lesen → themen.vokabular). erwarteteThemen ist PFLICHT (explizit null, wenn ' +
        'der Ordner keine deklariert) — weicht der Stand im Storage ab, wird NICHTS geschrieben. ' +
        'Namen, die nicht im Vokabular der Library stehen, werden ABGEWIESEN (thema_unbekannt, ' +
        'mit Vorschlaegen); nur mit neuesThemaErlauben: true wird ein bewusst neues Thema ' +
        'geschrieben — dann auch in die Library-Einstellungen aufnehmen. Ohne _INDEX.md wird ' +
        'keins angelegt (kein_index), ausser mit indexAnlegen: true — die Vorlage traegt KEINEN ' +
        `bearbeitungsstand (der bleibt stand_setzen). STAPEL: folderIds (bis ${MAX_THEMEN_ORDNER}) ` +
        'gibt allen Ordnern DIESELBE Liste; Fehler eines Ordners brechen den Stapel nicht ab. ' +
        'Die Ordnernamen verraten das Thema NICHT (Ereignisnamen) — Zuordnung verlangt den Blick ' +
        'in Bericht bzw. Transformation. Nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        folderId: z.string().min(1).optional()
          .describe('Storage-Ordner-Id (aus abdeckung_lesen → filter.ordner bzw. folderId eines Befunds). Alternative zu folderIds — genau eines von beiden'),
        folderIds: z.array(z.string().min(1)).min(1).max(MAX_THEMEN_ORDNER).optional()
          .describe(`STAPEL statt folderId: bis ${MAX_THEMEN_ORDNER} Ordner, alle bekommen DIESELBE Themenliste und denselben erwarteteThemen-Riegel`),
        themen: z.array(z.string())
          .describe('Vollstaendige neue Themenliste; [] entfernt alle. Kein Komma / keine eckige Klammer im Namen'),
        erwarteteThemen: z.union([z.array(z.string()), z.null()])
          .describe('Themen, die der Aufrufer aktuell am Ordner sieht; explizit null = Ordner deklariert keine (der Regelfall unterhalb des Vorhabens)'),
        neuesThemaErlauben: z.boolean().optional()
          .describe('true = Namen ausserhalb des Vokabulars trotzdem schreiben (bewusst neues Thema); Vorgabe false'),
        indexAnlegen: z.boolean().optional()
          .describe('true = fehlendes _INDEX.md nach Vorlage anlegen (ohne bearbeitungsstand), statt mit kein_index abzubrechen; Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, folderId, folderIds, themen, erwarteteThemen, neuesThemaErlauben, indexAnlegen, begruendung }) => {
      try {
        // Im Stapel gibt es keinen EINEN Ordner fuer den Protokollkopf — die
        // Zeilen stehen im Ergebnis, das `mitProtokoll` ohnehin mitschreibt.
        const kopf = { werkzeug: 'themen_setzen', libraryId, akteur: mcpUserEmail(), begruendung, ...(folderId ? { folderId } : {}) }
        return await mitProtokoll(kopf, async () => {
          const ordnerIds = sammleOrdnerIds({ folderId, folderIds })
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const vokabular = library.config?.agentView?.themen ?? null
          // Pruefung VOR dem Storage-Zugriff: ein abgewiesener Name kostet kein Listing.
          const konfiguriert = Array.isArray(vokabular) && vokabular.length > 0
          const unbekannt = konfiguriert ? pruefeGegenVokabular(themen, vokabular) : []
          if (unbekannt.length > 0 && neuesThemaErlauben !== true) throw new ThemaUnbekanntError(unbekannt)
          const provider = await requireProvider(userEmail, libraryId)
          const optionen = { erwarteteThemen, indexAnlegen: indexAnlegen === true }
          const gemeinsam = {
            vokabular,
            vokabularPruefung: konfiguriert ? 'geprueft' : 'kein_vokabular_konfiguriert',
            ...(unbekannt.length > 0 ? { neueThemen: unbekannt.map((u) => u.name) } : {}),
            hinweis: HINWEIS_SCAN,
          }

          // Die Antwortform haengt an der ADRESSIERUNG, nicht an der Anzahl:
          // `folderIds` liefert immer Zeilen, auch bei einem Ordner. Der
          // Einzelaufruf bleibt der Weg von A6 — dort ist ein Fehlschlag ein
          // Fehler und keine Ergebniszeile, sonst uebersaehe ein Agent ihn als „ok".
          if (folderId !== undefined) {
            const gesetzt = await setzeThemen(folderId, themen, baueIndexPorts(provider, folderId), optionen)
            return jsonResult({ gesetzt, ...gemeinsam })
          }

          const stapel = await fuehreStapelThemenAus({
            folderIds: ordnerIds,
            setze: (id) => setzeThemen(id, themen, baueIndexPorts(provider, id), optionen),
          })
          return jsonResult({ ok: stapel.gescheitert === 0, ...stapel, ...gemeinsam })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
