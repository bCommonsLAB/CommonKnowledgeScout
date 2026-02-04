import type { DocCardMeta } from '@/lib/gallery/types'
import type { VectorDocument } from './vector-repo'

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
  slug?: string
  coverImageUrl?: string
  upsertedAt?: string
  docMetaJson?: unknown
}

/**
 * Konvertiert ein MongoDB-Dokument zu DocCardMeta-Format
 * 
 * Diese Funktion wird verwendet, um Dokumente aus MongoDB (z.B. aus find-Queries)
 * in das Format zu konvertieren, das von der Gallery verwendet wird.
 * 
 * @param doc - MongoDB-Dokument mit den erforderlichen Feldern
 * @returns DocCardMeta-Objekt für Gallery-Anzeige
 */
export function convertMongoDocToDocCardMeta(doc: MongoDocForConversion): DocCardMeta {
  const docMeta = doc.docMetaJson && typeof doc.docMetaJson === 'object' 
    ? doc.docMetaJson as Record<string, unknown> 
    : undefined
  
  // speakers_image_url: Priorität: Top-Level > docMetaJson.speakers_image_url
  const speakersImageUrlTopLevel = convertSpeakersImageUrl(doc.speakers_image_url)
  const speakersImageUrlDocMeta = docMeta ? convertSpeakersImageUrl(docMeta.speakers_image_url) : undefined
  const speakersImageUrl = speakersImageUrlTopLevel || speakersImageUrlDocMeta

  return {
    id: `${doc.fileId}-meta`,
    fileId: doc.fileId,
    fileName: doc.fileName,
    title: doc.title || (docMeta?.title as string | undefined),
    shortTitle: doc.shortTitle || (docMeta?.shortTitle as string | undefined),
    authors: Array.isArray(doc.authors) ? doc.authors : undefined,
    speakers: Array.isArray(doc.speakers) 
      ? doc.speakers 
      : (Array.isArray(docMeta?.speakers) ? docMeta.speakers as string[] : undefined),
    speakers_image_url: speakersImageUrl || undefined,
    year: (typeof doc.year === 'number' || typeof doc.year === 'string') ? doc.year : undefined,
    track: doc.track || (docMeta?.track as string | undefined),
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
  }
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
export function convertVectorDocumentToDocCardMeta(doc: VectorDocument): DocCardMeta {
  return convertMongoDocToDocCardMeta(doc)
}

