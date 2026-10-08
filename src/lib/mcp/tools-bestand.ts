/**
 * @fileoverview MCP-Werkzeuge `dokumente_auflisten` und `bestand_pruefen` (Welle A).
 *
 * @description
 * Die Index-Seite einer Library sichtbar machen, bevor die Bruecke dort
 * schreibt: `dokumente_auflisten` ist die Galerie-Sicht als Feldzeilen
 * (derselbe Filter wie die Galerie-Route, Facettenwerte, Suche, Seiten);
 * `bestand_pruefen` laeuft die Pruefregeln aus `bestand-pruefung.ts` ueber
 * den Bestand und liefert eine Befundliste mit sourceIds, die direkt an
 * `index_entfernen` oder `dokument_felder_setzen` gehen kann. Beide lesen nur.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getRequiredFields } from '@/lib/detail-view-types/registry'
import { getTopLevelValue } from '@/lib/chat/dynamic-facets'
import { buildGallerySort } from '@/lib/documents/gallery-sort'
import { alleMetaFelder, findeMetaFelder, META_LISTE_MAX, type MetaFeldZeile } from '@/lib/repositories/doc-meta-liste'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import type { StorageProvider } from '@/lib/storage/types'
import { baueBestandFilter } from './bestand-filter'
import { pruefeBestand, type BestandEintrag } from './bestand-pruefung'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

const FACETTEN_WERTE = z.record(z.array(z.string().min(1)).min(1)).optional()
  .describe('Facettenfilter: metaKey → Werte (ODER innerhalb einer Facette, UND zwischen Facetten)')
const TYP = z.string().min(1).optional().describe('detailViewType als Leitfilter; ohne Angabe alle Typen')
const SUCHE = z.string().min(1).optional().describe('Teilstring-Suche in Titel und String-/Zahl-Facetten')
const MAX_PRUEFUNG = 2000

/** Pfad des Quellordners je Twin — ein Aufruf je Ordner, nicht je Quelle. */
async function ordnerPfade(provider: StorageProvider, parentIds: Iterable<string>): Promise<Map<string, string | null>> {
  const pfade = new Map<string, string | null>()
  for (const parentId of parentIds) {
    if (pfade.has(parentId)) continue
    try {
      pfade.set(parentId, await provider.getPathById(parentId))
    } catch {
      pfade.set(parentId, null)
    }
  }
  return pfade
}

async function alsEintraege(
  zeilen: readonly MetaFeldZeile[],
  args: { libraryId: string; provider: StorageProvider },
): Promise<BestandEintrag[]> {
  const twins = new Map<string, { parentId: string }>()
  for (let i = 0; i < zeilen.length; i += 100) {
    const teil = await getShadowTwinsBySourceIds({ libraryId: args.libraryId, sourceIds: zeilen.slice(i, i + 100).map((z) => z.fileId) })
    for (const [sourceId, doc] of teil) twins.set(sourceId, { parentId: doc.parentId })
  }
  const pfade = await ordnerPfade(args.provider, [...twins.values()].map((t) => t.parentId))
  return zeilen.map((z) => {
    const twin = twins.get(z.fileId)
    return {
      sourceId: z.fileId, quelle: z.fileName || z.title || z.fileId, detailViewType: z.detailViewType,
      felder: z.docMetaJson, pfad: twin ? (pfade.get(twin.parentId) ?? null) : null,
    }
  })
}

export function registerBestandTools(server: McpServer): void {
  server.registerTool(
    'dokumente_auflisten',
    {
      title: 'Galerie-Eintraege als Feldzeilen',
      description:
        'Listet die publizierten Dokumente (Meta-Dokumente des Index) einer Library mit demselben ' +
        'Filter wie die Galerie: Typ, Facettenwerte, Suche, Seiten. Je Eintrag sourceId, Quelle, Typ, ' +
        'Veroeffentlichungs-Stand und die Werte der Facetten — Felder, keine Karten. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        detailViewType: TYP,
        facettenWerte: FACETTEN_WERTE,
        suche: SUCHE,
        seite: z.number().int().min(1).optional().describe('Seite (1-basiert, Default 1)'),
        proSeite: z.number().int().min(1).max(META_LISTE_MAX).optional().describe(`Eintraege je Seite (Default 50, max ${META_LISTE_MAX})`),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, detailViewType, facettenWerte, suche, seite, proSeite }) => {
      try {
        const library = await requireLibrary(mcpUserEmail(), libraryId)
        const { filter, defs, typ, libraryKey } = await baueBestandFilter({ library, detailViewType, facettenWerte, suche })
        const limit = proSeite ?? 50
        const skip = ((seite ?? 1) - 1) * limit
        const galleryCfg = library.config?.chat?.gallery as { defaultSortField?: string; defaultSortDirection?: 'asc' | 'desc' } | undefined
        const sort = buildGallerySort({ rawSort: null, isMember: true, config: galleryCfg, facetDefs: defs })
        const { zeilen, total } = await findeMetaFelder(libraryKey, library.id, filter, { skip, limit, sort })
        return jsonResult({
          total, seite: seite ?? 1, proSeite: limit, typ, facetten: defs.map((d) => d.metaKey),
          dokumente: zeilen.map((z) => ({
            sourceId: z.fileId, quelle: z.fileName, titel: z.title, kurztitel: z.shortTitle,
            detailViewType: z.detailViewType, publikation: z.publikation, aktualisiert: z.upsertedAt,
            facettenWerte: Object.fromEntries(defs.map((d) => [d.metaKey, getTopLevelValue(z.docMetaJson, d) ?? null])),
          })),
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'bestand_pruefen',
    {
      title: 'Index-Bestand pruefen (Befundliste)',
      description:
        'Prueft die publizierten Dokumente einer Library nach festen Regeln: doppelte Kennung ' +
        '(kennungsfeld, z. B. massnahme_nr), Werte ausserhalb des Bedeutungs-Woerterbuchs einer ' +
        'Facette, fehlende Pflichtfelder des Typs, Eintraege aus Twin- (_…) oder test/-Ordnern. ' +
        'Liefert Befunde mit sourceIds (direkt an index_entfernen oder dokument_felder_setzen ' +
        'weiterreichbar) und nennt Regeln, die nicht laufen konnten. Meldet nur, bereinigt nichts. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        detailViewType: TYP,
        facettenWerte: FACETTEN_WERTE,
        kennungsfeld: z.string().min(1).optional().describe('Feld, das je Dokument eindeutig sein muss (z. B. massnahme_nr); ohne Angabe entfaellt die Dublettenpruefung'),
        maxDokumente: z.number().int().min(1).max(MAX_PRUEFUNG).optional().describe(`Obergrenze (Default ${MAX_PRUEFUNG})`),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, detailViewType, facettenWerte, kennungsfeld, maxDokumente }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const { filter, defs, typ, standardTyp, libraryKey } = await baueBestandFilter({ library, detailViewType, facettenWerte })
        const { zeilen, total, abgeschnitten } = await alleMetaFelder(libraryKey, library.id, filter, maxDokumente ?? MAX_PRUEFUNG)
        const eintraege = await alsEintraege(zeilen, { libraryId: library.id, provider })
        const pruefung = pruefeBestand(eintraege, { defs, kennungsfeld, standardTyp, pflichtfelder: getRequiredFields })
        return jsonResult({
          geprueft: eintraege.length, total, typ,
          ...(abgeschnitten ? { hinweis: `Nur ${eintraege.length} von ${total} Dokumenten geprueft — maxDokumente erhoehen oder nach Typ/Facette einschraenken` } : {}),
          zaehler: pruefung.zaehler,
          uebersprungen: pruefung.uebersprungen,
          befunde: pruefung.befunde,
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
