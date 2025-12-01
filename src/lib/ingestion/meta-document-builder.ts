import type { DocMeta, ChapterMetaEntry } from '@/types/doc-meta'

export interface MetaDocument {
  libraryId: string
  user: string
  fileId: string
  fileName: string
  // Top-Level Felder
  year?: number
  authors?: string[]
  region?: string
  docType?: string
  source?: string
  tags?: string[]
  topics?: string[]
  // Aus docMetaJsonObj
  title?: string
  shortTitle?: string
  slug?: string
  summary?: string
  teaser?: string
  // Chapters
  chapters: ChapterMetaEntry[]
  chaptersCount: number
  chunkCount: number
  // Komplettes docMetaJson
  docMetaJson: Record<string, unknown>
  upsertedAt: string
  // Dokument-Embedding für globale Dokumentensuche (optional)
  embedding?: number[]
  // Dynamische Facetten-Felder
  [key: string]: unknown
}

/**
 * Erstellt ein Meta-Dokument für MongoDB Vector Collection (kind: 'meta').
 */
export function buildMetaDocument(
  mongoDoc: DocMeta,
  docMetaJsonObj: Record<string, unknown>,
  chaptersForMongo: ChapterMetaEntry[],
  chaptersCount: number,
  chunksUpserted: number,
  facetValues: Record<string, unknown>,
  userEmail: string
): MetaDocument {
  return {
    libraryId: mongoDoc.libraryId,
    user: userEmail,
    fileId: mongoDoc.fileId,
    fileName: mongoDoc.fileName || '',
    // Top-Level Felder
    year: typeof mongoDoc.year === 'number' ? mongoDoc.year : undefined,
    authors: Array.isArray(mongoDoc.authors) ? mongoDoc.authors as string[] : undefined,
    region: typeof mongoDoc.region === 'string' ? mongoDoc.region : undefined,
    docType: typeof mongoDoc.docType === 'string' ? mongoDoc.docType : undefined,
    source: typeof mongoDoc.source === 'string' ? mongoDoc.source : undefined,
    tags: Array.isArray(mongoDoc.tags) ? mongoDoc.tags as string[] : undefined,
    topics: docMetaJsonObj.topics as string[] | undefined,
    // Aus docMetaJsonObj
    title: docMetaJsonObj.title as string | undefined,
    shortTitle: docMetaJsonObj.shortTitle as string | undefined,
    slug: docMetaJsonObj.slug as string | undefined,
    summary: docMetaJsonObj.summary as string | undefined,
    teaser: docMetaJsonObj.teaser as string | undefined,
    // Chapters
    chapters: chaptersForMongo,
    chaptersCount,
    chunkCount: chunksUpserted,
    // Komplettes docMetaJson
    docMetaJson: docMetaJsonObj,
    upsertedAt: new Date().toISOString(),
    // Dynamische Facetten-Felder
    ...facetValues,
  }
}

