/**
 * @fileoverview MCP-Werkzeuge `sitzungen_melden` und `sitzung_setzen` (Plan sitzungen-register, R1).
 *
 * @description
 * Schreiben ins Sitzungs-Register (MongoDB, eine Zeile je Sitzung und
 * Library). Melden ist idempotent und traegt Kopfdaten ein; Entscheidung,
 * Grund, Zugbereiche, Bemerkung und das Nachtragen der Kennung gehen nur
 * ueber `sitzung_setzen`. Beide nur in Libraries mit Archivpflege, beide mit
 * `begruendung` im Aktions-Protokoll. Der Stand einer Zeile wird nie gesetzt,
 * sondern gerechnet (`sitzungen_auflisten`).
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { meldeSitzungen, setzeSitzung } from '@/lib/agent-view/sitzungen-register/register-dienst'
import { ENTSCHEIDUNGEN, SITZUNGS_QUELLEN } from '@/lib/agent-view/sitzungen-register/types'
import { ARCHIVPFLEGE_HINWEIS, pruefeArchivpflege } from './archivpflege'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'

const MAX_STAPEL = 50
const ISO_TAG = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'JJJJ-MM-TT')
const KENNUNG = z.string().trim().min(20).describe('Volle Sitzungs-Kennung (UUID bzw. session_…), nicht das 8-Zeichen-Kuerzel')
const VORSCHLAG = z.object({
  ordner: z.string().trim().min(1).describe('Ordnername des Vorhabens'),
  herkunft: z.string().trim().min(1).describe('Wer vorschlaegt, z. B. skill oder owner'),
})
const ZUGBEREICH = z.object({ von: z.number().int().min(1), bis: z.number().int().min(1) })

export function registerSitzungenRegisterTools(server: McpServer): void {
  server.registerTool(
    'sitzungen_melden',
    {
      title: 'Sitzungen ins Register melden (SCHREIBT)',
      description:
        ARCHIVPFLEGE_HINWEIS +
        'Traegt bis zu 50 Arbeitssitzungen mit Claude ins Sitzungs-Register der Library ein (MongoDB), auch ' +
        'solche ohne Beleg. Schluessel ist die volle Kennung (sitzungId); dieselbe Meldung zweimal ist unveraendert. ' +
        'Gemeldete Kopfdaten ueberschreiben, ein vorhandener Vorhaben-Vorschlag bleibt (belassen). Entscheidung, ' +
        'Bemerkung und Zugbereiche setzt nur sitzung_setzen. Antwort je Zeile: angelegt | ergaenzt (felder) | ' +
        'unveraendert | fehler. Den Stand rechnet sitzungen_auflisten aus Beleg und Notiz — nie abhaken.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sitzungen: z.array(z.object({
          sitzungId: KENNUNG,
          quelle: z.enum(SITZUNGS_QUELLEN).describe('code_lokal | code_cloud | cowork | chat'),
          titel: z.string().trim().min(1).optional(),
          beginn: ISO_TAG.optional(),
          ende: ISO_TAG.optional(),
          link: z.string().url().optional().describe('Adresse der Sitzung, falls es eine gibt'),
          repo: z.string().trim().min(1).optional(),
          branch: z.string().trim().min(1).optional(),
          prs: z.array(z.string().trim().min(1)).optional().describe('PR-Verweise, werden ergaenzt, nie entfernt'),
          vorhabenVorschlag: VORSCHLAG.optional(),
        })).min(1).max(MAX_STAPEL),
        gemeldetVon: z.enum(['skill', 'inventar']).describe('skill = beim Abschluss; inventar = aus einer Bestandsliste'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, sitzungen, gemeldetVon, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'sitzungen_melden', libraryId, akteur: mcpUserEmail(), begruendung }, async () => {
          const library = await requireLibrary(mcpUserEmail(), libraryId)
          pruefeArchivpflege(library, 'sitzungen_melden')
          const zeilen = await meldeSitzungen({ libraryId: library.id, eingaben: sitzungen, gemeldetVon, jetzt: new Date().toISOString() })
          const zaehle = (a: string) => zeilen.filter((z) => z.aktion === a).length
          return jsonResult({
            angelegt: zaehle('angelegt'), ergaenzt: zaehle('ergaenzt'), unveraendert: zaehle('unveraendert'),
            fehler: zeilen.filter((z) => z.fehler !== undefined).length,
            zeilen,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'sitzung_setzen',
    {
      title: 'Register-Zeile pflegen (SCHREIBT)',
      description:
        ARCHIVPFLEGE_HINWEIS +
        'Pflegt EINE Zeile des Sitzungs-Registers (registerId aus sitzungen_auflisten): entscheidung ' +
        '(offen | ueberspringen | trennen), entscheidungGrund (Pflicht bei ueberspringen; "" loescht), zugbereiche ' +
        '(Pflicht bei trennen, mind. zwei, ohne Ueberschneidung), vorhabenVorschlag (null loescht), bemerkung ' +
        '("" loescht), sitzungId (Kennung nachtragen: der Register-Schluessel wird zur Kennung, ein bekanntes ' +
        'Praefix muss passen). Traegt die Kennung schon eine reine Archiv-Zeile, wird sie hineingefuehrt ' +
        '(zusammengefuehrt); traegt sie eine gepflegte Zeile, ist das ein Fehler. Nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        registerId: z.string().trim().min(1).describe('Schluessel der Zeile (Kennung, alt:<Nr> oder beleg:<sourceId>)'),
        entscheidung: z.enum(ENTSCHEIDUNGEN).optional(),
        entscheidungGrund: z.string().optional(),
        zugbereiche: z.array(ZUGBEREICH).optional(),
        vorhabenVorschlag: VORSCHLAG.nullable().optional(),
        bemerkung: z.string().optional(),
        sitzungId: KENNUNG.optional(),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, registerId, begruendung, ...eingabe }) => {
      try {
        return await mitProtokoll({ werkzeug: 'sitzung_setzen', libraryId, akteur: mcpUserEmail(), begruendung }, async () => {
          const library = await requireLibrary(mcpUserEmail(), libraryId)
          pruefeArchivpflege(library, 'sitzung_setzen')
          const r = await setzeSitzung({ libraryId: library.id, registerId, eingabe, jetzt: new Date().toISOString() })
          return jsonResult({
            registerId: r.zeile.registerId,
            geaendert: r.felder,
            unveraendert: r.felder.length === 0,
            umgeschluesselt: r.umgeschluesselt,
            zusammengefuehrt: r.zusammengefuehrt,
            zeile: r.zeile,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
