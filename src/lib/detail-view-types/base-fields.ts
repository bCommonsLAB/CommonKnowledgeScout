/**
 * Basis-Feld-Contract — der gemeinsame Nenner, den JEDE Library/jedes Dokument
 * fuehrt (Single Source of Truth).
 *
 * Entscheidung 2026-06-14 ("Erweiterter Kern"): Jedes Dokument einer (auch
 * heterogenen, themenzentrierten) Library traegt dieselben Pflichtfelder, damit
 * eine library-uebergreifende, deterministische Facettensuche moeglich ist.
 * Diese Felder werden bei Template-Erstellung AUTOMATISCH beruecksichtigt und
 * sind NICHT loeschbar. Der Anwender kann nur ZUSAETZLICHE (spezifische)
 * Facetten ergaenzen.
 *
 * Andere Stellen (Default-Facetten in `config.ts`, Template-Gates,
 * Library-Verifikation) leiten ihre Pflicht-Logik aus diesem Modul ab, statt
 * eigene Listen zu fuehren. Fehlende Basis-Felder sind ein EXPLIZITER Fehler
 * (siehe `no-silent-fallbacks.mdc`), kein stiller Default.
 *
 * Frontmatter-Format: flach, snake_case, Obsidian-kompatibel (siehe AGENTS.md).
 * `authors` und `tags` sind Arrays (mehrere Werte moeglich).
 */

/**
 * Verbindliche Basis-Pflichtfelder (Reihenfolge = Anzeige-/Facetten-Reihenfolge).
 * - `title`    Anzeige-Titel (kein Facetten-Feld)
 * - `date`     Datum (ISO/`YYYY-MM-DD`) — Facette, ersetzt fachlich das frueher
 *              rein numerische `year` (das als abgeleitete Facette erhalten bleibt)
 * - `authors`  Autoren als Array (mehrere moeglich) — Facette
 * - `language` Sprache (technisch, kein sichtbares Facetten-Feld)
 * - `source`   Herkunft/Quelle — Facette
 * - `tags`     Schlagworte als Array — Facette
 */
export const BASE_REQUIRED_FIELDS = [
  'title',
  'date',
  'authors',
  'language',
  'source',
  'tags',
] as const

export type BaseRequiredField = (typeof BASE_REQUIRED_FIELDS)[number]

/**
 * Teilmenge der Basis-Felder, die als NICHT loeschbare Facetten erscheinen.
 * `title` und `language` sind Pflicht, aber keine Filter-Facetten.
 */
export const BASE_FACET_FIELDS = ['date', 'authors', 'source', 'tags'] as const

export type BaseFacetField = (typeof BASE_FACET_FIELDS)[number]

/** Facetten-Typ — bewusst lokal definiert, um Import-Zyklen zu vermeiden. */
export type BaseFacetType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'date'
  | 'integer-range'

/**
 * Definition einer Basis-Facette. `mandatory: true` markiert sie als
 * verbindlich/nicht entfernbar fuer UI und Parser.
 */
export interface BaseFacetDef {
  metaKey: BaseFacetField
  label: string
  type: BaseFacetType
  multi: boolean
  visible: boolean
  mandatory: true
}

/**
 * Verbindliche Default-Definitionen der Basis-Facetten.
 * Werden von `getDefaultFacets()` vorangestellt und beim Parsen erzwungen.
 */
export const BASE_FACET_DEFS: ReadonlyArray<BaseFacetDef> = [
  { metaKey: 'date', label: 'Date', type: 'date', multi: true, visible: true, mandatory: true },
  { metaKey: 'authors', label: 'Authors', type: 'string[]', multi: true, visible: true, mandatory: true },
  { metaKey: 'source', label: 'Source', type: 'string', multi: true, visible: true, mandatory: true },
  { metaKey: 'tags', label: 'Tags', type: 'string[]', multi: true, visible: true, mandatory: true },
]

const BASE_REQUIRED_SET: ReadonlySet<string> = new Set(BASE_REQUIRED_FIELDS)
const BASE_FACET_SET: ReadonlySet<string> = new Set(BASE_FACET_FIELDS)

/** Ist `fieldKey` eines der verbindlichen Basis-Pflichtfelder? */
export function isBaseRequiredField(fieldKey: string): boolean {
  return BASE_REQUIRED_SET.has(fieldKey)
}

/** Ist `fieldKey` eine verbindliche, nicht loeschbare Basis-Facette? */
export function isBaseFacetField(fieldKey: string): boolean {
  return BASE_FACET_SET.has(fieldKey)
}

/**
 * Liefert die Basis-Pflichtfelder, die in `fields` FEHLEN — kanonische Namen,
 * exakte Pruefung (keine stillen Aliasse). Reihenfolge wie `BASE_REQUIRED_FIELDS`.
 *
 * Genutzt vom Template-Gate (decken Template-Felder den Kern ab?) und von der
 * Library-Verifikation (decken Dokument-Metadaten den Kern ab?).
 */
export function missingBaseFields(fields: readonly string[]): BaseRequiredField[] {
  const present = new Set(fields)
  return BASE_REQUIRED_FIELDS.filter((field) => !present.has(field))
}
