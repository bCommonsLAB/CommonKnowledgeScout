/**
 * Facetten-Scope (Plan 1 · A4a — „Typ als Leitfilter").
 *
 * Owner-Entscheidung 2026-06-18: Der Inhaltstyp ist der erste Filter. Ohne
 * Typ-Wahl zeigt die Galerie nur die GEMEINSAMEN Facetten der vorhandenen
 * Typen; mit Typ-Wahl die Facetten DIESES Typs, und die Liste zeigt STRENG nur
 * Dokumente dieses Typs. Dadurch entfaellt jede „OR-ueber-Typen"-Aggregation.
 *
 * Dieses Modul ist rein (kein Storage, kein React) und leitet das Scoping
 * deterministisch aus der Library-Facetten-Konfiguration + der ViewType-
 * Registry ab. Basis-Facetten sind IMMER dabei. Konfigurierte Facetten, die in
 * KEINEM Registry-Typ vorkommen (custom), gelten als library-global und werden
 * NICHT versteckt (no-silent-fallbacks.mdc).
 */

import type { Library } from '@/types/library'
import { parseFacetDefs, type FacetDef } from './dynamic-facets'
import { isBaseFacetField } from '@/lib/detail-view-types/base-fields'
import {
  DETAIL_VIEW_TYPES,
  getOptionalFields,
  getRequiredFields,
  isValidDetailViewType,
} from '@/lib/detail-view-types/registry'

/** Pfad des Dokument-Typs im Meta-Dokument (Frontmatter → docMetaJson). */
export const DETAIL_VIEW_TYPE_PATH = 'docMetaJson.detailViewType'

/** Feld-Keys (required + optional) eines gueltigen ViewTypes als Set. */
function fieldSetForType(viewType: string): Set<string> {
  return new Set<string>([...getRequiredFields(viewType), ...getOptionalFields(viewType)])
}

/** Ist `metaKey` in IRGENDEINEM Registry-Typ als Feld bekannt? */
function isKnownRegistryField(metaKey: string): boolean {
  return DETAIL_VIEW_TYPES.some((t) => fieldSetForType(t).has(metaKey))
}

/**
 * Behaelt eine konfigurierte (Nicht-Basis-)Facette im Scope, wenn sie entweder
 * library-global (in keinem Registry-Typ) ist oder das Praedikat erfuellt.
 */
function keepConfigured(def: FacetDef, keepIfKnown: (metaKey: string) => boolean): boolean {
  if (!isKnownRegistryField(def.metaKey)) return true // custom → global, nie verstecken
  return keepIfKnown(def.metaKey)
}

/**
 * Wirft bei ungueltigem ViewType — explizit statt stillem Default. Aufrufer
 * (Route) validiert den Query-Parameter vorher und mappt das auf HTTP 400.
 */
export class UnknownDetailViewTypeError extends Error {
  readonly viewType: string
  constructor(viewType: string) {
    super(`Unbekannter detailViewType „${viewType}".`)
    this.name = 'UnknownDetailViewTypeError'
    this.viewType = viewType
  }
}

/** Facetten fuer EINEN gewaehlten Typ: Basis + Felder dieses Typs + globale. */
export function facetDefsForType(library: Library, viewType: string): FacetDef[] {
  if (!isValidDetailViewType(viewType)) throw new UnknownDetailViewTypeError(viewType)
  const typeFields = fieldSetForType(viewType)
  return parseFacetDefs(library).filter((d) =>
    isBaseFacetField(d.metaKey) ? true : keepConfigured(d, (k) => typeFields.has(k)),
  )
}

/**
 * GEMEINSAME Facetten (ohne Typ-Wahl): Basis + konfigurierte Facetten, die in
 * ALLEN vorhandenen Typen vorkommen + globale. Ohne (gueltige) vorhandene Typen
 * bleibt die volle konfigurierte Liste (heutiges Verhalten).
 */
export function commonFacetDefs(library: Library, presentTypes: readonly string[]): FacetDef[] {
  const validTypes = dedupeValidTypes(presentTypes)
  const all = parseFacetDefs(library)
  if (validTypes.length === 0) return all
  const fieldSets = validTypes.map((t) => fieldSetForType(t))
  return all.filter((d) =>
    isBaseFacetField(d.metaKey)
      ? true
      : keepConfigured(d, (k) => fieldSets.every((set) => set.has(k))),
  )
}

/** Validiert + dedupliziert eine Typliste; unbekannte werden geloggt + verworfen. */
export function dedupeValidTypes(types: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of types) {
    if (typeof t !== 'string' || seen.has(t)) continue
    if (!isValidDetailViewType(t)) {
      console.warn(`[facet-scope] Unbekannter detailViewType „${t}" — uebersprungen.`)
      continue
    }
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * Mongo-Filter-Fragment, das Dokumente eines Typs trifft. Dokumente OHNE
 * `detailViewType` gelten als der Library-Default-Typ — beim Filtern auf den
 * Default werden sie deshalb mit einbezogen.
 */
export function viewTypeMatchFilter(
  viewType: string,
  libraryDefaultType: string,
): Record<string, unknown> {
  if (!isValidDetailViewType(viewType)) throw new UnknownDetailViewTypeError(viewType)
  if (viewType === libraryDefaultType) {
    return {
      $or: [
        { [DETAIL_VIEW_TYPE_PATH]: viewType },
        { [DETAIL_VIEW_TYPE_PATH]: { $exists: false } },
        { [DETAIL_VIEW_TYPE_PATH]: null },
      ],
    }
  }
  return { [DETAIL_VIEW_TYPE_PATH]: viewType }
}

/** Ergebnis der Scope-Aufloesung fuer eine Route. */
export interface FacetScope {
  /** Facetten fuer Sidebar/Filter (bereits typ-gescoped). */
  defs: FacetDef[]
  /** Zusatz-Filter (nur bei gewaehltem Typ), sonst null. */
  typeFilter: Record<string, unknown> | null
  /** Der aufgeloeste, gewaehlte Typ (oder null). */
  selectedType: string | null
}

/**
 * Zentrale Scope-Aufloesung fuer beide Routen (facets + docs).
 * - `selectedType` gesetzt → Facetten dieses Typs + strenger Typ-Filter.
 * - `selectedType` leer → gemeinsame Facetten der `presentTypes`, kein Filter.
 * Wirft bei ungueltigem `selectedType` (Route → 400).
 */
export function resolveFacetScope(args: {
  library: Library
  selectedType: string | null | undefined
  presentTypes: readonly string[]
  libraryDefaultType: string
}): FacetScope {
  const selected = (args.selectedType ?? '').trim()
  if (selected) {
    return {
      defs: facetDefsForType(args.library, selected),
      typeFilter: viewTypeMatchFilter(selected, args.libraryDefaultType),
      selectedType: selected,
    }
  }
  return {
    defs: commonFacetDefs(args.library, args.presentTypes),
    typeFilter: null,
    selectedType: null,
  }
}
