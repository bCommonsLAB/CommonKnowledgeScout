/**
 * @fileoverview MCP-Werkzeug: `seite_pruefen` (B5). Liest nur.
 *
 * @description
 * Liefert Menue, Fusszeile und je Seite die geparsten Sektionen samt
 * Befunden — aus den publizierten website-Docs, nicht aus dem Storage.
 * Was hier ohne Fehler ist, rendert die Landingpage; was hier fehlt, ist
 * noch nicht publiziert (dokument_publizieren).
 *
 * @module mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { findDocs, getCollectionNameForLibrary, getMetaByFileId } from '@/lib/repositories/vector-repo'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'
import { baueSeitenBericht } from './website-seite'

/** Website-Docs sind wenige; mehr waere ein Zeichen fuer falsche Typen. */
const MAX_SEITEN = 50

export function registerWebsitePruefenTool(server: McpServer): void {
  server.registerTool(
    'seite_pruefen',
    {
      title: 'Website einer Library pruefen (liest nur)',
      description:
        'Die Vorschau ohne Browser: listet die publizierten website-Docs als Menue (menu_order, ' +
        'menu_area), nennt Startseite, Footer-Links und Footer-Doc und zeigt je Seite die geparsten ' +
        'Sektionen (layout, bg, Bild) mit Befunden — ungueltige Marker, fehlendes Markdown, nicht ' +
        'anonym ladbare Bilder, tote ?site=-Links, fehlender menu_order. Dazu die Veroeffentlichung ' +
        '(isPublic, slug, siteEnabled) und die Adresse der Seite. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        fileId: z.string().min(1).optional().describe('Nur diese Seite (Storage-Id der Quelle)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, fileId }) => {
      try {
        const library = await requireLibrary(mcpUserEmail(), libraryId)
        const libraryKey = getCollectionNameForLibrary(library)
        const typFilter = { $or: [{ detailViewType: 'website' }, { 'docMetaJson.detailViewType': 'website' }] }
        const filter = fileId ? { ...typFilter, fileId } : typFilter
        const { items } = await findDocs(libraryKey, libraryId, filter, { limit: MAX_SEITEN })

        const markdownJeFileId = new Map<string, string | undefined>()
        for (const doc of items) {
          if (!doc.fileId) continue
          const meta = await getMetaByFileId(libraryKey, doc.fileId)
          const md = meta?.docMetaJson?.['markdown']
          markdownJeFileId.set(doc.fileId, typeof md === 'string' ? md : undefined)
        }

        const pub = library.config?.publicPublishing
        const slug = pub?.slugName?.trim() || null
        return jsonResult({
          veroeffentlichung: {
            isPublic: pub?.isPublic === true,
            slug,
            siteEnabled: pub?.siteEnabled === true,
            adresse: slug ? `/explore/${slug}` : null,
            hinweis: pub?.siteEnabled
              ? null
              : 'siteEnabled ist aus — /explore/<slug> zeigt die Galerie, nicht die Website',
          },
          ...baueSeitenBericht(items, markdownJeFileId),
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
