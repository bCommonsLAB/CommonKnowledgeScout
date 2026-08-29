/**
 * @fileoverview Dokument-Slug für die NAVIGATION (`?doc=…`).
 *
 * Gegenstück zu `@/lib/documents/document-slug-persist`, das den Slug erzeugt,
 * der als `meta.slug` dauerhaft geschrieben wird. Hier wird NICHT neu
 * slugifiziert: die Regel kommt aus `buildDocumentSlugFallback`, diese Datei
 * legt nur zwei Dinge obendrauf, die ausschließlich für URLs gelten —
 * Längenbegrenzung und ein stabiler Suffix gegen Kollisionen.
 *
 * Die Persist-Seite gewinnt: sie schreibt dauerhafte Daten, ihre Ergebnisse
 * liegen in MongoDB und im Frontmatter. Wer die Regel ändert, ändert sie
 * dort — nicht hier.
 *
 * @module utils/document-slug-navigation
 */
import type { DocCardMeta } from '@ks/contracts'
import { buildDocumentSlugFallback } from '@/lib/documents/document-slug-persist'

/** Längenbegrenzung des synthetischen Navigations-Slugs (ohne Suffix). */
export const NAVIGATION_SLUG_MAX_LEN = 80

/**
 * Stabiler kurzer Suffix aus fileId (FNV-1a-ähnlich), damit synthetische Slugs
 * bei gleichem Titel/Dateinamen nicht kollidieren.
 */
function shortStableSuffix(fileId: string): string {
  let h = 2166136261
  for (let i = 0; i < fileId.length; i++) {
    h ^= fileId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = h >>> 0
  return n.toString(36).slice(0, 8)
}

function truncateSlug(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen).replace(/-+$/g, '')
}

function readPersistedSlug(doc: DocCardMeta): string {
  return typeof doc.slug === 'string' ? doc.slug.trim() : ''
}

/**
 * Basis des synthetischen Slugs — DIESELBE Kandidaten-Reihenfolge wie beim
 * Persistieren (`ingestion-service`: fileName → source_file → title;
 * `phase-template`: Artefaktname → Quellname → title). Beide Seiten sehen
 * denselben `fileName` (`mapItemToDocCardMeta` reicht `item.fileName` durch),
 * also rechnen sie für dasselbe Dokument dieselbe Basis.
 */
function buildNavigationSlugBase(doc: DocCardMeta): string {
  return truncateSlug(
    buildDocumentSlugFallback(doc.fileName, doc.title, doc.shortTitle),
    NAVIGATION_SLUG_MAX_LEN
  )
}

/**
 * Kandidaten-Reihenfolge VOR der Vereinheitlichung (Titel zuerst). Wird NUR
 * noch zum MATCHEN gebraucht, damit bereits geteilte Links nicht ins Leere
 * zeigen. Nicht zum Erzeugen neuer Links verwenden.
 */
function buildLegacyNavigationSlugBase(doc: DocCardMeta): string {
  return truncateSlug(
    buildDocumentSlugFallback(doc.title, doc.shortTitle, doc.fileName),
    NAVIGATION_SLUG_MAX_LEN
  )
}

/**
 * Effektiver Slug für Gallery-Navigation (`?doc=…`):
 * - Wenn in den Metadaten ein Slug gesetzt ist: diesen verwenden (kanonisch).
 * - Sonst aus Dateiname / Titel / Kurztitel ableiten + kurzer eindeutiger
 *   Suffix aus fileId, damit alte Archive ohne `meta.slug` trotzdem
 *   eindeutig adressierbar sind.
 *
 * @returns `null` nur wenn weder fileId noch id vorhanden sind
 */
export function getEffectiveDocumentNavigationSlug(doc: DocCardMeta): string | null {
  const fid = doc.fileId || doc.id
  if (!fid) return null

  const persisted = readPersistedSlug(doc)
  if (persisted.length > 0) return persisted

  return `${buildNavigationSlugBase(doc)}-${shortStableSuffix(fid)}`
}

/**
 * Prüft, ob `docSlug` aus der URL zu diesem Dokument gehört.
 *
 * Akzeptiert drei Formen — bewusst, nicht als stiller Fallback: ein Link wird
 * geteilt, WÄHREND das Dokument noch keinen `meta.slug` hat, und ein
 * späterer Ingest schreibt ihn nach. Würde hier nur der persistierte Slug
 * zählen, zeigte genau dieser Link danach ins Leere.
 * 1. der persistierte `meta.slug`,
 * 2. der synthetische Slug nach heutiger Regel,
 * 3. der synthetische Slug nach der alten, titelzuerst-Regel.
 */
export function docMatchesNavigationSlug(doc: DocCardMeta, docSlug: string): boolean {
  if (!docSlug) return false

  const persisted = readPersistedSlug(doc)
  if (persisted.length > 0 && persisted === docSlug) return true

  const fid = doc.fileId || doc.id
  if (!fid) return false

  const suffix = shortStableSuffix(fid)
  if (`${buildNavigationSlugBase(doc)}-${suffix}` === docSlug) return true
  return `${buildLegacyNavigationSlugBase(doc)}-${suffix}` === docSlug
}
