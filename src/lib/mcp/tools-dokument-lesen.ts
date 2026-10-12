/**
 * @fileoverview MCP-Werkzeug `dokument_lesen` (Welle K1): die Lesersicht eines Eintrags.
 *
 * @description
 * Neben `dokumente_auflisten` (Feldzeilen der Galerie) liest dieses Werkzeug
 * EIN Meta-Dokument so, wie Galerie-Karte und Session-Detail es zeigen:
 * Cover, Anhaenge als Paare, Folien mit und ohne Adresse, Galeriebilder,
 * Stand (`upsertedAt`) und die oeffentliche Adresse — oder den Grund, warum es
 * keine gibt. Kein Markdown-Body (dafuer `artefakt_lesen`). Liest nur.
 * Mapping in `lesersicht.ts` (reine Funktionen, getestet).
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getCollectionNameForLibrary, getMetaByFileId } from '@/lib/repositories/vector-repo'
import { galerieAdresse, lesersichtAusMeta } from './lesersicht'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { resolveSourceItem } from './tools-erschliessen-shared'

export function registerDokumentLesenTool(server: McpServer): void {
  server.registerTool(
    'dokument_lesen',
    {
      title: 'Lesersicht eines Galerie-Eintrags',
      description:
        'Liest EIN Meta-Dokument des Index (die Lesersicht, nicht das Twin-Frontmatter): Titel, Typ, ' +
        'Veroeffentlichungs-Stand, coverImageUrl/coverThumbnailUrl, Anhaenge als Paare (Name, Adresse), ' +
        'folien { anzahl, mitAdresse, ohneAdresse: [Seitenzahlen] }, Anzahl Galeriebilder, upsertedAt und ' +
        'galerieAdresse (/explore/<slug>?doc=…) oder null mit Grund. Formen, die nicht passen (slides als ' +
        'Text), stehen in hinweise. Damit ist das Pruefkriterium einer Welle ueber die Bruecke lesbar, ' +
        'ohne Blick in Galerie oder Datenbank. Kein Markdown-Body (artefakt_lesen). Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der Quelle (= fileId des Eintrags)'),
        pfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelldatei'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, sourceId, pfad }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const quelle = pfad
          ? await resolveSourceItem(await requireProvider(userEmail, libraryId), undefined, pfad)
          : null
        const fileId = quelle?.itemId ?? sourceId
        if (!fileId) throw new Error('sourceId oder pfad ist Pflicht')
        const doc = await getMetaByFileId(getCollectionNameForLibrary(library), fileId)
        if (!doc) {
          return jsonResult({
            sourceId: fileId, quelle: quelle?.name ?? null, vorhanden: false,
            hinweis: 'Kein Meta-Dokument zu dieser Quelle — der Eintrag steht nicht in der Galerie (dokument_publizieren oder index_aktualisieren mit nurPublizierte: false)',
          })
        }
        const roh = doc as unknown as Record<string, unknown>
        return jsonResult({
          sourceId: fileId,
          quelle: typeof roh['fileName'] === 'string' ? roh['fileName'] : (quelle?.name ?? null),
          vorhanden: true,
          ...lesersichtAusMeta(roh),
          ...galerieAdresse(library.config, roh),
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
