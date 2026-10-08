/**
 * @fileoverview MCP-Werkzeuge `konfiguration_lesen` und `konfiguration_setzen` (Welle D).
 *
 * @description
 * Konfiguration ist Vertrag: Was die Bruecke setzt, prueft dasselbe Schema
 * wie das Settings-Formular (`chat-config-validation.ts`, inkl.
 * Platzhalter-Querpruefung der Antwortregeln gegen die Facetten). Nur
 * Owner; nur genannte Bereiche aendern sich; Infrastruktur (Embeddings,
 * Vektor-Store) ist lesbar, nicht setzbar. Die Veroeffentlichung hat ihr
 * eigenes Werkzeug (veroeffentlichung_setzen) — hier nur lesbar.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { LibraryService } from '@/lib/services/library-service'
import type { LibraryChatConfig } from '@/types/library'
import { formatiereChatKonfigurationFehler, validiereChatKonfiguration } from '@/lib/services/chat-config-validation'
import { BEREICHE, chatSicht, wendeKonfigurationAn, CHAT_SETZBAR, GALERIE_SETZBAR } from './konfiguration-bereiche'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'
import { veroeffentlichungSicht } from './tools-website-veroeffentlichung'

export function registerKonfigurationTools(server: McpServer): void {
  server.registerTool(
    'konfiguration_lesen',
    {
      title: 'Library-Konfiguration lesen (liest nur)',
      description:
        'Liest die Konfiguration einer Library je Bereich: facetten (gallery.facets, JSON-Form des ' +
        'Facetten-Editors inkl. Woerterbuch werte), antwortregeln (Text mit Platzhaltern), chat ' +
        '(Platzhalter, Sprache, Charakter, Perspektive; Embeddings und Vektor-Store nur lesbar), galerie ' +
        '(detailViewType, Sortierung, Gruppierung), veroeffentlichung (wie veroeffentlichung_lesen). ' +
        'Ohne bereich alle fuenf. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        bereich: z.enum(BEREICHE).optional().describe('Ein Bereich; weglassen = alle'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, bereich }) => {
      try {
        const library = await requireLibrary(mcpUserEmail(), libraryId)
        const chat = library.config?.chat
        const alle = {
          facetten: chatSicht(chat, 'facetten'),
          antwortregeln: chatSicht(chat, 'antwortregeln'),
          chat: chatSicht(chat, 'chat'),
          galerie: chatSicht(chat, 'galerie'),
          veroeffentlichung: veroeffentlichungSicht(library.config?.publicPublishing),
        }
        return jsonResult(bereich ? { libraryId, bereich, [bereich]: alle[bereich] } : { libraryId, ...alle })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'konfiguration_setzen',
    {
      title: 'Library-Konfiguration setzen (SCHREIBT)',
      description:
        'Setzt Bereiche der Chat-Konfiguration mit derselben Pruefung wie das Formular: facetten ' +
        '(ersetzt gallery.facets als Ganzes, JSON-Form des Editor-Exports; Woerterbuch werte nur bei ' +
        'string/string[]; Basis-Facetten bleiben erzwungen), antwortregeln (Text; Platzhalter ' +
        '{{facette:key}}/{{legende:key}} muessen auf Facetten zeigen, sonst Abweisung; "" loescht), chat ' +
        `(Teil-Update: ${[...CHAT_SETZBAR].join(', ')}), galerie (Teil-Update: ${[...GALERIE_SETZBAR].join(', ')}). ` +
        'Embeddings, Vektor-Store und Modelle sind nicht setzbar; Veroeffentlichung ueber ' +
        'veroeffentlichung_setzen. Nach geaenderten Facetten tragen aeltere Chunks die neue Facette nicht — ' +
        'dann index_aktualisieren. Nur Owner. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        facetten: z.array(z.record(z.unknown())).optional().describe('Komplette Facettenliste (ersetzt), JSON-Form des Facetten-Editors'),
        antwortregeln: z.string().max(20000).optional().describe('Antwortregeln-Text; "" loescht'),
        chat: z.record(z.unknown()).optional().describe('Teil-Update der Chat-Einstellungen'),
        galerie: z.record(z.unknown()).optional().describe('Teil-Update der Galerie-Einstellungen'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, facetten, antwortregeln, chat, galerie, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'konfiguration_setzen', libraryId, akteur: mcpUserEmail(), begruendung }, async () => {
          if (facetten === undefined && antwortregeln === undefined && chat === undefined && galerie === undefined) {
            throw new Error('facetten, antwortregeln, chat oder galerie ist Pflicht')
          }
          const userEmail = mcpUserEmail()
          const service = LibraryService.getInstance()
          if (!(await service.isOwner(userEmail, libraryId))) throw new Error('Nur Owner koennen die Konfiguration aendern')
          const library = await requireLibrary(userEmail, libraryId)
          const altChat = library.config?.chat as Record<string, unknown> | undefined
          const { chat: neuChat, geaendert } = wendeKonfigurationAn(altChat, { facetten, antwortregeln, chat, galerie })
          const pruefung = validiereChatKonfiguration(neuChat)
          if (!pruefung.ok) throw new Error(formatiereChatKonfigurationFehler(pruefung.fehler))
          if (geaendert.length === 0) return jsonResult({ geaendert: [], hinweis: 'Nichts geaendert' })
          const ok = await service.updateLibrary(userEmail, {
            ...library, config: { ...library.config, chat: neuChat as LibraryChatConfig },
          })
          if (!ok) throw new Error('Library konnte nicht gespeichert werden')
          return jsonResult({
            geaendert,
            facetten: geaendert.includes('facetten') ? chatSicht(neuChat, 'facetten') : undefined,
            antwortregeln: geaendert.includes('antwortregeln') ? chatSicht(neuChat, 'antwortregeln') : undefined,
            chat: geaendert.some((g) => g.startsWith('chat.')) ? chatSicht(neuChat, 'chat') : undefined,
            galerie: geaendert.some((g) => g.startsWith('galerie.')) ? chatSicht(neuChat, 'galerie') : undefined,
            hinweis: geaendert.includes('facetten')
              ? 'Facetten geaendert: Meta-Dokumente und Chunks tragen eine neue Facette erst nach index_aktualisieren; der Facetten-Cache der App laeuft bis zu 5 Minuten nach.'
              : null,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
