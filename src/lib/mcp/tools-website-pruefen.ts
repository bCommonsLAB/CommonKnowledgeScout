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
import type { KopfFelder } from './website-kopf-befunde'

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
        'Sektionen (layout, bg, Bild; je Seite heroTon, wenn hero_tone gesetzt ist; bei layout=story die Zahl der Beispielfragen, der Facettenfilter filter="…", n des Blocks popular, kartenDarstellung cards=column|inline und regelsatz rules=<name>, bei Kachel-Bloecken die Zahl der Kacheln; layout=topics = Themenuebersicht, braucht eine Story-Sektion) mit Befunden — ungueltige Marker, rules ohne Regelsatz in der Library, fehlendes Markdown, nicht ' +
        'anonym ladbare Bilder, tote ?site=-Links, fehlender menu_order, ungueltiger oder wirkungsloser hero_tone, banner_sort stars ohne ' +
        'starCountsPublic (Banner bliebe leer). Dazu die Veroeffentlichung (isPublic, slug, siteEnabled, ' +
        'starCountsPublic) und die Adresse der Seite. Liest nur.',
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
        const bannerSortJeFileId = new Map<string, unknown>()
        const kopfJeFileId = new Map<string, KopfFelder>()
        for (const doc of items) {
          if (!doc.fileId) continue
          const meta = await getMetaByFileId(libraryKey, doc.fileId)
          const md = meta?.docMetaJson?.['markdown']
          markdownJeFileId.set(doc.fileId, typeof md === 'string' ? md : undefined)
          bannerSortJeFileId.set(doc.fileId, meta?.docMetaJson?.['banner_sort'])
          kopfJeFileId.set(doc.fileId, {
            heroTone: meta?.docMetaJson?.['hero_tone'],
            heroLayout: meta?.docMetaJson?.['hero_layout'],
            heroImage: meta?.docMetaJson?.['hero_image'],
          })
        }

        const pub = library.config?.publicPublishing
        const slug = pub?.slugName?.trim() || null
        const starCountsPublic = pub?.starCountsPublic === true
        const regelsaetze = Object.keys(library.config?.chat?.antwortregelnVarianten ?? {})
        return jsonResult({
          veroeffentlichung: {
            isPublic: pub?.isPublic === true,
            slug,
            siteEnabled: pub?.siteEnabled === true,
            // F3 (ADR 0012): Voraussetzung fuer banner_sort stars.
            starCountsPublic,
            adresse: slug ? `/explore/${slug}` : null,
            hinweis: pub?.siteEnabled
              ? null
              : 'siteEnabled ist aus — /explore/<slug> zeigt die Galerie, nicht die Website',
          },
          ...baueSeitenBericht(items, markdownJeFileId, { starCountsPublic, bannerSortJeFileId, kopfJeFileId, regelsaetze }),
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
