/**
 * @fileoverview MCP-Werkzeuge `fragen_log` (liest) und `antworten_verwerfen` (schreibt).
 *
 * @description
 * Dieselbe Verwaltungssicht wie der Reiter „Fragen & Antworten" in den
 * Library-Einstellungen: gespeicherte Antworten als Hash-Gruppen mit
 * Aktualitaet (aktuell/veraltet/unbekannt), und das Verwerfen (setzt
 * `cacheInvalidatedAt`, loescht nichts). Nur Owner oder Moderator; die
 * Begruendung geht ins Aktions-Protokoll der Library.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { LibraryService } from '@/lib/services/library-service'
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'
import { normalizeChatConfig } from '@/lib/chat/config'
import { baueAktualitaetsPruefer } from '@/lib/chat/utils/cache-aktualitaet'
import { PRO_SEITE_MAX, PRO_SEITE_VORGABE, baueFragenLogSeite } from '@/lib/chat/verwaltung/fragen-log-sicht'
import { listeFragenLogGruppen, verwerfeAntworten, zaehleGueltigeAntworten } from '@/lib/db/queries-verwaltung'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail } from './tool-shared'

/** Owner oder aktiver Moderator — dieselbe Regel wie die Routen (`pruefeVerwaltungsZugang`). */
async function requireModeratorOrOwner(userEmail: string, libraryId: string) {
  if (!(await isModeratorOrOwner(libraryId, userEmail))) {
    throw new Error(`Nur Owner oder Moderator der Library ${libraryId} duerfen gespeicherte Antworten verwalten`)
  }
  const library = await LibraryService.getInstance().getLibraryById(libraryId)
  if (!library) throw new Error(`Bibliothek nicht gefunden: ${libraryId}`)
  return library
}

export function registerFragenLogTools(server: McpServer): void {
  server.registerTool(
    'fragen_log',
    {
      title: 'Gespeicherte Fragen und Antworten einer Library (liest nur)',
      description:
        'Liste der gespeicherten Antworten (= Fragen-Log, der Antwort-Cache) einer Library, je Cache-Hash eine Zeile: ' +
        'frage, kurztitel, erstellt, sprache, modell, anzahlQuellen, facetten, anzahlEintraege, cacheInvalidatedAt und ' +
        'aktualitaet (aktuell = Hash passt zu Antwortregeln, Facetten und Dokumentzahl von heute; veraltet = eine neue ' +
        'Frage trifft diese Antwort nicht mehr; unbekannt = ohne Cache-Parameter). Keine Antworttexte (frage_log_lesen ' +
        'mit queryId), keine Erstellerdaten. gesamtTreffer = noch gueltige Antworten der Library. Owner/Moderator. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        seite: z.number().int().min(1).optional().describe('Seite, Vorgabe 1'),
        proSeite: z.number().int().min(1).max(PRO_SEITE_MAX).optional().describe(`Zeilen je Seite, Vorgabe ${PRO_SEITE_VORGABE}`),
        suche: z.string().trim().min(1).optional().describe('Teiltext in der Frage'),
        nurTreffer: z.boolean().optional().describe('true = nur Antworten, die noch als Treffer gelten (nicht verworfen)'),
        nurVeraltete: z.boolean().optional().describe('true = nur Antworten, deren Hash nicht mehr zur Konfiguration passt'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, seite, proSeite, suche, nurTreffer, nurVeraltete }) => {
      try {
        const library = await requireModeratorOrOwner(mcpUserEmail(), libraryId)
        const [gruppen, gesamtTreffer] = await Promise.all([
          listeFragenLogGruppen({ libraryId, suche, nurTreffer: nurTreffer === true }),
          zaehleGueltigeAntworten(libraryId),
        ])
        const pruefer = baueAktualitaetsPruefer(library, normalizeChatConfig(library.config?.chat))
        const ergebnis = await baueFragenLogSeite(gruppen, pruefer, {
          seite: seite ?? 1,
          proSeite: proSeite ?? PRO_SEITE_VORGABE,
          nurVeraltete: nurVeraltete === true,
        })
        return jsonResult({ libraryId, ...ergebnis, gesamtTreffer })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'antworten_verwerfen',
    {
      title: 'Gespeicherte Antworten verwerfen (schreibt cacheInvalidatedAt, loescht nichts)',
      description:
        'Verwirft gespeicherte Antworten: queryIds (aus fragen_log) verwerfen jeden Eintrag mit demselben Cache-Hash, ' +
        'alle: true jede noch gueltige Antwort der Library. Die naechste gleiche Frage wird neu beantwortet; Chronik, ' +
        'Sitzungen und populaere Fragen der Besucher bleiben vollstaendig — es wird NICHTS geloescht. Typischer Anlass: ' +
        'Antwortregeln oder Woerterbuch geaendert, Dokumente korrigiert. Owner/Moderator. Nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        queryIds: z.array(z.string().min(1)).min(1).max(500).optional().describe('Kennungen aus fragen_log (1 bis 500)'),
        alle: z.literal(true).optional().describe('true = alle noch gueltigen Antworten der Library'),
        begruendung: BEGRUENDUNG,
      },
    },
    async ({ libraryId, queryIds, alle, begruendung }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireModeratorOrOwner(userEmail, libraryId)
        if ((alle === true) === (Array.isArray(queryIds) && queryIds.length > 0)) {
          throw new Error('Genau eines angeben: queryIds ODER alle: true')
        }
        const ergebnis = await mitProtokoll(
          { werkzeug: 'antworten_verwerfen', libraryId, akteur: userEmail, begruendung },
          () => verwerfeAntworten({ libraryId, queryIds, alle }),
        )
        return jsonResult({ libraryId, ...ergebnis, zeitpunkt: ergebnis.zeitpunkt.toISOString() })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
