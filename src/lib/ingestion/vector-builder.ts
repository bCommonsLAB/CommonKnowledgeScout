import type { FacetDef } from '@/lib/chat/dynamic-facets'
import type { DocMeta } from '@/types/doc-meta'
import { safeText } from '@/lib/utils/string-utils'

export interface VectorDocument {
  _id: string
  kind: 'chunk'
  libraryId: string
  user: string
  fileId: string
  fileName: string
  chunkIndex: number
  text: string
  embedding: number[]
  headingContext?: string
  startChar?: number
  endChar?: number
  upsertedAt: string
  // Facetten-Metadaten für direkte Filterung
  year?: number
  authors?: string[]
  region?: string
  docType?: string
  source?: string
  tags?: string[]
  topics?: string[]
  track?: string
  speakers?: string[]
  date?: string
  shortTitle?: string
  [key: string]: unknown
}

export interface RAGChunk {
  index: number
  text: string
  embedding: number[]
  headingContext?: string | null
  startChar?: number | null
  endChar?: number | null
  metadata?: Record<string, unknown> | null
}

export interface RAGResult {
  chunks: RAGChunk[]
  dimensions: number
  model: string
}

/**
 * Extrahiert Facetten-Werte aus mongoDoc und docMetaJsonObj für Chunks.
 */
export function extractFacetValues(
  mongoDoc: DocMeta,
  docMetaJsonObj: Record<string, unknown>,
  facetDefs: FacetDef[]
): Record<string, unknown> {
  const facetValues: Record<string, unknown> = {}
  
  // Facetten aus mongoDoc extrahieren
  for (const def of facetDefs) {
    const v = (mongoDoc as Record<string, unknown>)[def.metaKey]
    if (v !== undefined && v !== null) {
      facetValues[def.metaKey] = v
    }
  }
  
  // Zusätzliche Felder aus docMetaJsonObj
  if (docMetaJsonObj.title) facetValues.title = docMetaJsonObj.title
  if (docMetaJsonObj.shortTitle) facetValues.shortTitle = docMetaJsonObj.shortTitle
  if (docMetaJsonObj.track) facetValues.track = docMetaJsonObj.track
  if (docMetaJsonObj.date) facetValues.date = docMetaJsonObj.date
  if (docMetaJsonObj.speakers) facetValues.speakers = docMetaJsonObj.speakers
  
  return facetValues
}

/**
 * Erstellt Vector-Dokumente aus RAG-Chunks mit Facetten-Metadaten.
 */
export function buildVectorDocuments(
  ragResult: RAGResult,
  fileId: string,
  fileName: string,
  libraryId: string,
  userEmail: string,
  facetValues: Record<string, unknown>
): VectorDocument[] {
  const vectors: VectorDocument[] = []
  const upsertedAt = new Date().toISOString()
  
  for (const chunk of ragResult.chunks) {
    const vectorDoc: VectorDocument = {
      _id: `${fileId}-${chunk.index}`,
      kind: 'chunk',
      libraryId,
      user: userEmail,
      fileId,
      fileName,
      chunkIndex: chunk.index,
      text: safeText(chunk.text, 1200),
      embedding: chunk.embedding,
      upsertedAt,
      // Facetten-Metadaten kopieren
      ...facetValues,
    }
    
    // Optional: Heading Context und Position hinzufügen
    if (chunk.headingContext !== null && chunk.headingContext !== undefined) {
      vectorDoc.headingContext = chunk.headingContext
    }
    if (chunk.startChar !== null && chunk.startChar !== undefined) {
      vectorDoc.startChar = chunk.startChar
    }
    if (chunk.endChar !== null && chunk.endChar !== undefined) {
      vectorDoc.endChar = chunk.endChar
    }
    
    // Chunk-spezifische Metadaten übernehmen
    if (chunk.metadata && typeof chunk.metadata === 'object') {
      for (const [k, v] of Object.entries(chunk.metadata)) {
        if (v !== null && v !== undefined) {
          vectorDoc[k] = v
        }
      }
    }
    
    vectors.push(vectorDoc)
  }
  
  return vectors
}







