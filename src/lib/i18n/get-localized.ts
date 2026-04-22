/**
 * @fileoverview Lookup-Helper fuer Doc-Translations
 *
 * @description
 * Resolves Felder eines Dokuments fuer eine bestimmte UI-Locale entsprechend
 * der Fallback-Kette:
 *   1. `docMetaJson.translations.gallery|detail.<locale>.<field>`
 *   2. `docMetaJson.translations.gallery|detail.<fallbackLocale>.<field>`
 *   3. Originalfeld (`docMetaJson.<field>` oder Top-Level-Property)
 *
 * Wird von Galerie-, Tabellen- und Detail-Komponenten verwendet, damit es
 * im UI nur eine Quelle der Wahrheit fuer „welche Sprachvariante zeigen wir
 * gerade?" gibt. Filter (z.B. fuer Topics/Tags) bleiben kanonisch in der
 * Originalsprache; nur das Display-Label wird uebersetzt – siehe
 * `getLocalizedLabel`.
 *
 * @module i18n
 */

import type { Locale } from '@/lib/i18n'
import type {
  DocTranslationsMeta,
  GalleryTranslatedFields,
  DetailTranslatedFields,
} from '@/types/doc-meta'

/** Sub-Map-Auswahl: aus welcher der beiden Translations-Maps gelesen werden soll. */
export type TranslationScope = 'gallery' | 'detail'

/**
 * Minimal benoetigte Form eines Dokuments fuer den Lookup.
 * Sowohl `DocCardMeta` (Galerie) als auch `DocMeta` (Detail) erfuellen das.
 */
export interface LocalizableDoc {
  /** Top-Level Frontmatter-Felder (Originalsprache) */
  [key: string]: unknown
  /** Eingebettete Metadaten incl. translations und Quellsprache */
  docMetaJson?: Record<string, unknown> & {
    language?: string
    translations?: DocTranslationsMeta
  }
}

/**
 * Liefert den Wert eines Feldes in der gewuenschten Locale.
 *
 * Reihenfolge:
 *   1. translations.<scope>.<locale>.<field>
 *   2. translations.<scope>.<fallbackLocale>.<field>
 *   3. docMetaJson.<field>
 *   4. doc.<field> (Top-Level, fuer aeltere Datensaetze ohne docMetaJson)
 *
 * Gibt `undefined` zurueck, wenn das Feld nirgends gesetzt ist – nicht den
 * leeren String, damit Aufrufer eigene Defaults setzen koennen.
 *
 * @example
 * const title = getLocalized<string>(doc, 'title', 'de', { fallbackLocale: 'en', scope: 'gallery' })
 */
export function getLocalized<T = unknown>(
  doc: LocalizableDoc | null | undefined,
  field: string,
  locale: Locale | string | undefined,
  options: {
    /** Welche Sub-Map durchsucht wird (`gallery` oder `detail`). Default: `gallery`. */
    scope?: TranslationScope
    /** Fallback-Locale aus `library.config.translations.fallbackLocale`. */
    fallbackLocale?: Locale | string
  } = {},
): T | undefined {
  if (!doc) return undefined
  const scope: TranslationScope = options.scope ?? 'gallery'
  const fallbackLocale = options.fallbackLocale

  const translations = doc.docMetaJson?.translations
  // 1) gewuenschte Locale
  const fromLocale = readFromTranslations(translations, scope, locale, field)
  if (isPresent(fromLocale)) return fromLocale as T
  // 2) fallback-Locale (sofern abweichend)
  if (fallbackLocale && fallbackLocale !== locale) {
    const fromFallback = readFromTranslations(translations, scope, fallbackLocale, field)
    if (isPresent(fromFallback)) return fromFallback as T
  }
  // 3) Original aus docMetaJson
  const fromMeta = (doc.docMetaJson as Record<string, unknown> | undefined)?.[field]
  if (isPresent(fromMeta)) return fromMeta as T
  // 4) Original auf Top-Level (Legacy-Datensaetze)
  const fromTop = doc[field]
  if (isPresent(fromTop)) return fromTop as T
  return undefined
}

/**
 * Liefert das Display-Label fuer einen kanonischen Facet-/Topic-Wert.
 *
 * Filter und URL-Parameter bleiben weiterhin der `canonicalValue` – nur die
 * Anzeige wird uebersetzt. Wenn kein Mapping existiert, faellt der Helper auf
 * den Originalwert zurueck.
 *
 * @example
 * const label = getLocalizedLabel(doc, 'topics', 'sustainability', 'de', { fallbackLocale: 'en' })
 */
export function getLocalizedLabel(
  doc: LocalizableDoc | null | undefined,
  facetKey: string,
  canonicalValue: string,
  locale: Locale | string | undefined,
  options: { fallbackLocale?: Locale | string } = {},
): string {
  if (!doc) return canonicalValue
  // Convention: Label-Maps liegen unter <facetKey>Labels (z.B. topicsLabels, tagsLabels)
  const mapKey = `${facetKey}Labels`
  const translations = doc.docMetaJson?.translations
  // 1) gewuenschte Locale
  const fromLocale = readLabelMap(translations, locale, mapKey)
  if (fromLocale && fromLocale[canonicalValue]) return fromLocale[canonicalValue]
  // 2) fallback-Locale
  if (options.fallbackLocale && options.fallbackLocale !== locale) {
    const fromFallback = readLabelMap(translations, options.fallbackLocale, mapKey)
    if (fromFallback && fromFallback[canonicalValue]) return fromFallback[canonicalValue]
  }
  // 3) kanonischer Wert
  return canonicalValue
}

/**
 * Praktischer Wrapper: liefert ein Array kanonischer Werte mit zugehoerigen
 * Display-Labels in der gewaehlten Locale. Filtert leere Strings heraus.
 */
export function getLocalizedTopics(
  doc: LocalizableDoc | null | undefined,
  facetKey: string,
  locale: Locale | string | undefined,
  options: { fallbackLocale?: Locale | string } = {},
): Array<{ value: string; label: string }> {
  if (!doc) return []
  const raw = (doc.docMetaJson as Record<string, unknown> | undefined)?.[facetKey] ?? doc[facetKey]
  if (!Array.isArray(raw)) return []
  return raw
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((value) => ({
      value,
      label: getLocalizedLabel(doc, facetKey, value, locale, options),
    }))
}

/**
 * Veredelt eine `docMetaJson`-Struktur mit den Uebersetzungen einer Locale.
 *
 * Erzeugt eine flache Kopie und ueberlagert die Top-Level-Felder mit den
 * Werten aus `translations.detail.<locale>` und `translations.gallery.<locale>`.
 * Detail-Werte gewinnen ueber Galerie-Werte, weil sie typischerweise
 * vollstaendiger sind (z.B. `summary`, `markdown`).
 *
 * Das ist der bequemste Weg, bestehende Detail-Mapper (mapToBookDetail etc.)
 * sprachfaehig zu machen, ohne sie umzuschreiben: Aufrufer ruft erst
 * `localizeDocMetaJson(...)` und dann den Mapper mit dem veredelten Objekt auf.
 *
 * Label-Maps wie `topicsLabels` werden NICHT auf die Originalfelder
 * (`topics`, `tags`) angewendet, weil Filter kanonisch bleiben muessen.
 *
 * Reihenfolge der Ueberlagerung:
 *   Original  <  gallery[fallbackLocale]  <  detail[fallbackLocale]
 *             <  gallery[locale]          <  detail[locale]
 */
export function localizeDocMetaJson(
  docMetaJson: Record<string, unknown> | undefined,
  locale: Locale | string | undefined,
  fallbackLocale?: Locale | string,
): Record<string, unknown> | undefined {
  if (!docMetaJson) return docMetaJson
  const translations = (docMetaJson as { translations?: DocTranslationsMeta }).translations
  if (!translations) return docMetaJson
  const result: Record<string, unknown> = { ...docMetaJson }

  // Reihenfolge: erst Fallback (niedrigere Prio), dann gewuenschte Locale (hoechste Prio).
  applyOverlay(result, translations.gallery, fallbackLocale)
  applyOverlay(result, translations.detail, fallbackLocale)
  applyOverlay(result, translations.gallery, locale)
  applyOverlay(result, translations.detail, locale)

  return result
}

/**
 * Helper fuer `localizeDocMetaJson`: kopiert alle Felder einer Sub-Map
 * (`gallery`/`detail`) der gewuenschten Locale auf das Ziel-Objekt.
 * Label-Maps (`*Labels`) und Meta-Felder werden NICHT ueberlagert.
 */
function applyOverlay(
  target: Record<string, unknown>,
  subMap: DocTranslationsMeta['gallery'] | DocTranslationsMeta['detail'] | undefined,
  locale: Locale | string | undefined,
): void {
  if (!subMap || !locale) return
  const perLocale = (subMap as Record<string, Record<string, unknown>>)[locale]
  if (!perLocale) return
  for (const [key, value] of Object.entries(perLocale)) {
    // Convention: `xLabels`-Maps NICHT auf das Original-Topfeld anwenden.
    if (key.endsWith('Labels')) continue
    // Meta-Felder der Detail-Translation nicht ueberlagern, bleiben als
    // Inspection-Helper im translations-Objekt.
    if (key === 'sourceLanguage' || key === 'translatedAt' || key === 'translationModel' || key === 'cacheVersion') continue
    if (!isPresent(value)) continue
    target[key] = value
  }
}

// ─── interne Helper ─────────────────────────────────────────────────────────

/**
 * Liest aus translations[scope][locale][field] und beachtet, dass die Sub-Maps
 * `gallery` und `detail` jeweils `Partial<Record<Locale, ...>>` sind.
 */
function readFromTranslations(
  translations: DocTranslationsMeta | undefined,
  scope: TranslationScope,
  locale: Locale | string | undefined,
  field: string,
): unknown {
  if (!translations || !locale) return undefined
  const subMap =
    scope === 'gallery' ? translations.gallery : translations.detail
  if (!subMap) return undefined
  const perLocale = (subMap as Record<string, GalleryTranslatedFields | DetailTranslatedFields>)[
    locale
  ]
  if (!perLocale) return undefined
  return (perLocale as Record<string, unknown>)[field]
}

/**
 * Liest die Label-Map fuer einen Facet-Key (`topicsLabels`, `tagsLabels`, ...).
 * Label-Maps liegen ausschliesslich in der `gallery`-Sub-Map (Galerie-Filter).
 */
function readLabelMap(
  translations: DocTranslationsMeta | undefined,
  locale: Locale | string | undefined,
  mapKey: string,
): Record<string, string> | undefined {
  if (!translations || !locale) return undefined
  const perLocale = translations.gallery?.[locale as Locale]
  if (!perLocale) return undefined
  const map = (perLocale as Record<string, unknown>)[mapKey]
  if (!map || typeof map !== 'object' || Array.isArray(map)) return undefined
  return map as Record<string, string>
}

/**
 * Praesenz-Check: leere Strings/Arrays gelten NICHT als praesent, damit der
 * Lookup auf die naechste Stufe der Fallback-Kette weiterspringt. `0`, `false`
 * und `null` gelten hingegen als bewusst gesetzt.
 */
function isPresent(value: unknown): boolean {
  if (value === undefined) return false
  if (value === null) return false
  if (typeof value === 'string' && value.trim().length === 0) return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}
