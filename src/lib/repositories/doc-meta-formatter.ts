import type { DocCardMeta } from '@/lib/gallery/types'
import type { VectorDocument } from './vector-repo'
import { localizeDocMetaJson } from '@/lib/i18n/get-localized'
import type { DocTranslationsMeta } from '@/types/doc-meta'

/**
 * Konvertiert speakers_image_url von verschiedenen Formaten zu string[]
 * Unterstützt: Array, JSON-String, einzelner String
 * 
 * @param value - Wert der konvertiert werden soll (kann Array, String oder undefined sein)
 * @returns Array von Strings oder undefined
 */
export function convertSpeakersImageUrl(value: unknown): string[] | undefined {
  // Direktes Array
  if (Array.isArray(value)) {
    const arr = (value as Array<unknown>).map(x => {
      if (typeof x === 'string' && x.trim().length > 0) return x.trim()
      return ''
    }).filter(Boolean)
    return arr.length > 0 ? arr : undefined
  }
  
  // String der wie ein Array aussieht: "['url1', 'url2']" oder '["url1", "url2"]'
  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim()
    
    // Versuche JSON-Array zu parsen
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
        (trimmed.startsWith("['") && trimmed.endsWith("']"))) {
      try {
        // Ersetze einfache Anführungszeichen durch doppelte für JSON.parse
        const jsonStr = trimmed.replace(/'/g, '"')
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed)) {
          const arr = parsed.map(x => {
            if (typeof x === 'string' && x.trim().length > 0) return x.trim()
            return ''
          }).filter(Boolean)
          return arr.length > 0 ? arr : undefined
        }
      } catch {
        // Fehler beim Parsen, versuche manuell zu extrahieren
        const matches = trimmed.match(/(['"])((?:(?!\1).)*)\1/g)
        if (matches && matches.length > 0) {
          const arr = matches.map(m => m.slice(1, -1).trim()).filter(Boolean)
          return arr.length > 0 ? arr : undefined
        }
      }
    }
    
    // Einzelner String → als Array mit einem Element
    const singleStr = trimmed.length > 0 ? trimmed : undefined
    return singleStr ? [singleStr] : undefined
  }
  
  return undefined
}

/**
 * Interface für MongoDB-Dokumente, die zu DocCardMeta konvertiert werden können
 */
export interface MongoDocForConversion {
  fileId: string
  fileName?: string
  title?: string
  shortTitle?: string
  year?: number | string
  authors?: unknown
  speakers?: unknown
  speakers_image_url?: unknown
  track?: string
  date?: string
  region?: string
  docType?: string
  source?: string
  tags?: unknown
  topics?: unknown
  organisation?: string
  slug?: string
  coverImageUrl?: string
  coverThumbnailUrl?: string
  upsertedAt?: string
  docMetaJson?: unknown
}

/**
 * Konvertiert ein MongoDB-Dokument zu DocCardMeta-Format
 *
 * Diese Funktion wird verwendet, um Dokumente aus MongoDB (z.B. aus find-Queries)
 * in das Format zu konvertieren, das von der Gallery verwendet wird.
 *
 * Doc-Translations (Refactor):
 * - Wenn `options.locale` gesetzt ist, wird `docMetaJson` zuerst per
 *   `localizeDocMetaJson` mit den Galerie-/Detail-Sub-Maps der gewuenschten
 *   Locale (mit Fallback-Kette) ueberlagert.
 * - Filterwerte (`topics`, `tags`, `category`, ...) bleiben kanonisch — die
 *   uebersetzten Display-Labels werden separat als `topicsLabels`,
 *   `tagsLabels`, `categoryLabel` und `trackLabel` mitgegeben.
 *
 * @param doc - MongoDB-Dokument mit den erforderlichen Feldern
 * @param options.locale - Aktive UI-Locale (z.B. 'en', 'de')
 * @param options.fallbackLocale - Fallback-Locale aus `library.config.translations`
 * @returns DocCardMeta-Objekt für Gallery-Anzeige
 */
export function convertMongoDocToDocCardMeta(
  doc: MongoDocForConversion,
  options: { locale?: string; fallbackLocale?: string } = {},
): DocCardMeta {
  // Original docMetaJson fuer Label-Maps und Translations-Lookup behalten.
  const rawDocMeta =
    doc.docMetaJson && typeof doc.docMetaJson === 'object'
      ? (doc.docMetaJson as Record<string, unknown>)
      : undefined

  // Fuer alle Original-Felder verwenden wir das ueberlagerte docMetaJson.
  // Topic-Filterwerte (topics, tags, category) bleiben kanonisch erhalten,
  // weil `applyOverlay` `*Labels`-Maps ueberspringt — die Label-Maps werden
  // weiter unten separat extrahiert.
  const docMeta = options.locale
    ? localizeDocMetaJson(rawDocMeta, options.locale, options.fallbackLocale)
    : rawDocMeta
  
  // speakers_image_url: Priorität: Top-Level > docMetaJson.speakers_image_url
  const speakersImageUrlTopLevel = convertSpeakersImageUrl(doc.speakers_image_url)
  const speakersImageUrlDocMeta = docMeta ? convertSpeakersImageUrl(docMeta.speakers_image_url) : undefined
  const speakersImageUrl = speakersImageUrlTopLevel || speakersImageUrlDocMeta

  // Fuer uebersetzbare Textfelder (title/shortTitle/track) muss bei aktiver
  // Locale die docMetaJson-Variante (= ggf. uebersetzt) Vorrang vor dem
  // Top-Level-Feld (= Originalsprache) haben.
  const pickText = (key: string, top: string | undefined): string | undefined => {
    const localized = docMeta?.[key]
    if (options.locale && typeof localized === 'string' && localized.trim().length > 0) {
      return localized
    }
    return top || (typeof localized === 'string' ? localized : undefined)
  }

  return {
    id: `${doc.fileId}-meta`,
    fileId: doc.fileId,
    fileName: doc.fileName,
    title: pickText('title', doc.title),
    shortTitle: pickText('shortTitle', doc.shortTitle),
    authors: Array.isArray(doc.authors) ? doc.authors : undefined,
    speakers: Array.isArray(doc.speakers) 
      ? doc.speakers 
      : (Array.isArray(docMeta?.speakers) ? docMeta.speakers as string[] : undefined),
    speakers_image_url: speakersImageUrl || undefined,
    year: (typeof doc.year === 'number' || typeof doc.year === 'string') ? doc.year : undefined,
    track: pickText('track', doc.track),
    date: doc.date || (docMeta?.date as string | undefined),
    region: typeof doc.region === 'string' ? doc.region : undefined,
    upsertedAt: typeof doc.upsertedAt === 'string' ? doc.upsertedAt : undefined,
    // docType/detailViewType sind für die Detailansicht-Auswahl im Frontend wichtig.
    // - docType: kann top-level oder in docMetaJson vorhanden sein (Backwards-Compatibility)
    // - detailViewType: ist ein Frontmatter-Feld und liegt in docMetaJson
    docType: (typeof doc.docType === 'string' ? doc.docType : (docMeta?.docType as string | undefined)),
    detailViewType: (docMeta?.detailViewType as string | undefined),
    slug: doc.slug || (docMeta?.slug as string | undefined),
    coverImageUrl: doc.coverImageUrl || (docMeta?.coverImageUrl as string | undefined),
    // Thumbnail-URL für performante Galerie-Ansicht (320x320 WebP)
    coverThumbnailUrl: doc.coverThumbnailUrl || (docMeta?.coverThumbnailUrl as string | undefined),
    pages: (() => {
      const pagesValue = docMeta?.pages
      if (typeof pagesValue === 'number') return pagesValue
      if (typeof pagesValue === 'string') {
        const parsed = Number(pagesValue)
        return Number.isFinite(parsed) ? parsed : undefined
      }
      return undefined
    })(),
    // ClimateAction-spezifische Felder für Gallery-Teaser
    // category mit Fallback auf handlungsfeld für ältere Daten in der DB
    category: (docMeta?.category || docMeta?.handlungsfeld) as string | undefined,
    massnahme_nr: (docMeta?.massnahme_nr as string | undefined),
    lv_bewertung: (docMeta?.lv_bewertung as string | undefined),
    arbeitsgruppe: (docMeta?.arbeitsgruppe as string | undefined),
    // Session/Event-spezifische Felder
    organisation: (typeof doc.organisation === 'string' ? doc.organisation : undefined)
      || (docMeta?.organisation as string | undefined),
    tags: Array.isArray(doc.tags) ? doc.tags.map(String) : (Array.isArray(docMeta?.tags) ? (docMeta.tags as unknown[]).map(String) : undefined),
    topics: Array.isArray(doc.topics) ? doc.topics.map(String) : (Array.isArray(docMeta?.topics) ? (docMeta.topics as unknown[]).map(String) : undefined),
    // Ingest-Herkunft (Performance: kein fileId-Dekodieren im Client nötig)
    sourcePath: typeof docMeta?.sourcePath === 'string' ? docMeta.sourcePath : undefined,
    sourceFileName: typeof docMeta?.sourceFileName === 'string' ? docMeta.sourceFileName : undefined,
    textur_code: typeof docMeta?.textur_code === 'string' ? docMeta.textur_code : undefined,
    // ─── Doc-Translations: Publish-/Translation-Status ───────────────────
    ...buildPublicationFields(rawDocMeta),
    // ─── Doc-Translations: Display-Labels fuer Facetten ──────────────────
    // Filter-Werte (topics/tags/category) bleiben kanonisch (siehe oben);
    // nur die Anzeige wird via Label-Maps lokalisiert.
    ...buildLocalizedLabels(rawDocMeta, options.locale, options.fallbackLocale),
  }
}

/**
 * Liest Publikations- und Translation-Status aus `docMetaJson.publication` /
 * `docMetaJson.translationStatus` fuer die Tabellenansicht.
 */
function buildPublicationFields(
  rawDocMeta: Record<string, unknown> | undefined,
): Partial<Pick<DocCardMeta, 'publicationStatus' | 'publishedAt' | 'translationStatus'>> {
  if (!rawDocMeta) return {}
  const out: Partial<Pick<DocCardMeta, 'publicationStatus' | 'publishedAt' | 'translationStatus'>> = {}
  const pub = rawDocMeta.publication as Record<string, unknown> | undefined
  if (pub) {
    if (pub.status === 'draft' || pub.status === 'published') out.publicationStatus = pub.status
    if (typeof pub.publishedAt === 'string') out.publishedAt = pub.publishedAt
  }
  const ts = rawDocMeta.translationStatus
  if (ts && typeof ts === 'object' && !Array.isArray(ts)) {
    // Whitelist-Filter: nur erwartete Status-Werte uebernehmen.
    const filtered: Record<string, 'pending' | 'done' | 'failed'> = {}
    for (const [loc, val] of Object.entries(ts as Record<string, unknown>)) {
      if (val === 'pending' || val === 'done' || val === 'failed') filtered[loc] = val
    }
    if (Object.keys(filtered).length > 0) out.translationStatus = filtered
  }
  return out
}

/**
 * Liest die Display-Label-Maps aus `docMetaJson.translations.gallery` und
 * baut die optionalen `*Labels`-Felder von DocCardMeta zusammen.
 *
 * Reihenfolge: Fallback-Locale wird zuerst eingespielt, gewuenschte Locale
 * ueberschreibt anschliessend.
 */
function buildLocalizedLabels(
  rawDocMeta: Record<string, unknown> | undefined,
  locale: string | undefined,
  fallbackLocale: string | undefined,
): Partial<Pick<DocCardMeta, 'topicsLabels' | 'tagsLabels' | 'categoryLabel' | 'trackLabel'>> {
  if (!rawDocMeta || !locale) return {}
  const translations = (rawDocMeta as { translations?: DocTranslationsMeta }).translations
  if (!translations?.gallery) return {}
  const gallery = translations.gallery as Record<string, Record<string, unknown>>
  const fb = fallbackLocale && fallbackLocale !== locale ? gallery[fallbackLocale] : undefined
  const cur = gallery[locale]
  if (!fb && !cur) return {}

  const merge = (key: string): Record<string, string> | undefined => {
    const fromFb = (fb?.[key] as Record<string, string> | undefined) || undefined
    const fromCur = (cur?.[key] as Record<string, string> | undefined) || undefined
    if (!fromFb && !fromCur) return undefined
    return { ...(fromFb || {}), ...(fromCur || {}) }
  }
  const pickStr = (key: string): string | undefined => {
    const v = (cur?.[key] as string | undefined) || (fb?.[key] as string | undefined)
    return typeof v === 'string' && v.trim().length > 0 ? v : undefined
  }
  const out: Partial<Pick<DocCardMeta, 'topicsLabels' | 'tagsLabels' | 'categoryLabel' | 'trackLabel'>> = {}
  const topicsLabels = merge('topicsLabels')
  if (topicsLabels) out.topicsLabels = topicsLabels
  const tagsLabels = merge('tagsLabels')
  if (tagsLabels) out.tagsLabels = tagsLabels
  const categoryLabel = pickStr('categoryLabel')
  if (categoryLabel) out.categoryLabel = categoryLabel
  const trackLabel = pickStr('trackLabel')
  if (trackLabel) out.trackLabel = trackLabel
  return out
}

/**
 * Konvertiert ein VectorDocument zu DocCardMeta-Format
 * 
 * Diese Funktion wird verwendet, wenn bereits ein VectorDocument vorhanden ist
 * (z.B. aus getByFileIds).
 * 
 * @param doc - VectorDocument aus dem Repository
 * @returns DocCardMeta-Objekt für Gallery-Anzeige
 */
export function convertVectorDocumentToDocCardMeta(
  doc: VectorDocument,
  options: { locale?: string; fallbackLocale?: string } = {},
): DocCardMeta {
  return convertMongoDocToDocCardMeta(doc, options)
}

