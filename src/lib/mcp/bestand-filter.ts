/**
 * @fileoverview Filteraufbau fuer `dokumente_auflisten` und `bestand_pruefen`.
 *
 * @description
 * Baut den Mongo-Filter so, wie ihn die Galerie-Route baut: Typ-Scope
 * (`resolveFacetScope`), Facettenwerte (`buildFilterFromQuery` ueber dieselbe
 * URL-Form), Abbildung auf Mongo (`facetsSelectedToMongoFilter`) und die
 * Freitextsuche (`baueSuchFilter`). Die Bruecke bekommt Werte als Objekt,
 * nicht als URL — deshalb wird hier eine URL gebaut, statt die Logik zu
 * kopieren.
 *
 * @module mcp
 */

import { getDetailViewType } from '@ks/contracts'
import { facetsSelectedToMongoFilter } from '@/lib/chat/common/filters'
import { buildFilterFromQuery, type FacetDef } from '@/lib/chat/dynamic-facets'
import { baueSuchFilter } from '@/lib/chat/docs-suchfilter'
import { resolveFacetScope } from '@/lib/chat/facet-scope'
import { isValidDetailViewType } from '@/lib/detail-view-types/registry'
import { distinctViewTypes, getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import type { Library } from '@/types/library'

export interface BestandFilter {
  filter: Record<string, unknown>
  defs: FacetDef[]
  /** Gewaehlter Typ oder null (dann gemeinsame Facetten aller Typen). */
  typ: string | null
  /** Typ, der fuer Dokumente ohne eigenes Feld gilt (Library-Vorgabe). */
  standardTyp: string
  libraryKey: string
}

/** Facettenwerte als URL-Suchparameter, damit `buildFilterFromQuery` sie liest. */
function alsUrl(werte: Record<string, string[]> | undefined): URL {
  const url = new URL('http://bruecke.local/docs')
  for (const [key, liste] of Object.entries(werte ?? {})) {
    for (const wert of liste) url.searchParams.append(key, wert)
  }
  return url
}

export async function baueBestandFilter(args: {
  library: Library
  detailViewType?: string
  facettenWerte?: Record<string, string[]>
  suche?: string
  /** Nur diese Quellen (Ordner-Filter, Handover W5); leere Liste = kein Treffer. */
  fileIds?: string[]
}): Promise<BestandFilter> {
  const { library } = args
  const typ = args.detailViewType?.trim() || null
  if (typ && !isValidDetailViewType(typ)) throw new Error(`Unbekannter detailViewType "${typ}"`)
  const libraryKey = getCollectionNameForLibrary(library)
  const standardTyp = getDetailViewType({}, library.config?.chat)
  const presentTypes = typ ? [] : await distinctViewTypes(libraryKey, library.id)
  const scope = resolveFacetScope({ library, selectedType: typ, presentTypes, libraryDefaultType: standardTyp })
  const defs = scope.defs

  const unbekannt = Object.keys(args.facettenWerte ?? {}).filter((key) => !defs.some((d) => d.metaKey === key))
  if (unbekannt.length > 0) {
    throw new Error(
      `Unbekannte Facette(n) im Filter: ${unbekannt.join(', ')} — bekannt sind ${defs.map((d) => d.metaKey).join(', ') || '(keine)'}`,
    )
  }
  const filter = facetsSelectedToMongoFilter(buildFilterFromQuery(alsUrl(args.facettenWerte), defs))
  if (scope.typeFilter) filter.$and = [scope.typeFilter]
  const suche = args.suche?.trim()
  if (suche) filter.$or = baueSuchFilter(defs, suche)
  if (args.fileIds) filter.fileId = { $in: args.fileIds }
  return { filter, defs, typ, standardTyp, libraryKey }
}
