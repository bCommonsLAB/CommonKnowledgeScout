/**
 * @fileoverview Retriever Context - Zentrale Abstraktion für Retriever-Konfiguration
 * 
 * @description
 * Stellt eine zentrale Funktion bereit, um alle benötigten Konfigurationswerte
 * für Retrievers und Ingestion aus einem LibraryChatContext zu extrahieren.
 * Reduziert Code-Duplikation und stellt Konsistenz sicher.
 * 
 * @module chat
 * 
 * @exports
 * - RetrieverContext: Interface für Retriever-Konfiguration
 * - getRetrieverContext: Funktion zum Laden und Erstellen des Retriever-Contexts
 * 
 * @usedIn
 * - src/lib/chat/retrievers: Alle Retriever verwenden getRetrieverContext
 * - src/lib/chat/ingestion-service.ts: Ingestion verwendet getRetrieverContext
 * 
 * @dependencies
 * - @/lib/chat/loader: LibraryChatContext Loading
 * - @/lib/chat/config: Embedding-Konfiguration
 * - @/lib/chat/dynamic-facets: Facetten-Definitionen
 * - @/lib/repositories/vector-repo: Collection-Name-Extraktion
 */

import type { LibraryChatContext } from '@/lib/chat/loader'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import { getEmbeddingDimensionForModel } from '@/lib/chat/config'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { getEmbeddingConfig } from '@/lib/chat/rag-embeddings'

/**
 * Retriever-Kontext mit allen benötigten Konfigurationswerten
 */
export interface RetrieverContext {
  /** Library Chat Context (Library + normalisierte Chat-Config) */
  ctx: LibraryChatContext
  /** MongoDB Collection-Name für Vektoren */
  libraryKey: string
  /** Embedding-Dimension */
  dimension: number
  /** Facetten-Definitionen für die Library */
  facetDefs: Array<{
    metaKey: string
    label: string
    type: 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range'
    multi: boolean
    visible: boolean
  }>
  /** Embedding-Konfiguration (Model, ChunkSize, ChunkOverlap, Dimensions) */
  embeddingConfig: {
    model: string
    chunkSize: number
    chunkOverlap: number
    dimensions: number
  }
}

/**
 * Lädt Library-Context und extrahiert alle benötigten Konfigurationswerte für Retrievers.
 * 
 * @param userEmail User-Email für Library-Zugriff
 * @param libraryId Library-ID
 * @returns RetrieverContext mit allen benötigten Werten
 * @throws Error wenn Library nicht gefunden wird
 */
export async function getRetrieverContext(
  userEmail: string,
  libraryId: string
): Promise<RetrieverContext> {
  // Library-Context laden
  const ctx = await loadLibraryChatContext(userEmail, libraryId)
  
  if (!ctx) {
    throw new Error('Library context nicht gefunden')
  }
  
  // Collection-Name extrahieren
  const libraryKey = getCollectionNameForLibrary(ctx.library)
  
  // Dimension extrahieren
  const dimension = getEmbeddingDimensionForModel(ctx.library.config?.chat)
  
  // Facetten-Definitionen extrahieren
  const parsedFacetDefs = parseFacetDefs(ctx.library)
  
  // Facetten-Definitionen mappen, um sicherzustellen, dass label immer ein string ist
  const facetDefs: RetrieverContext['facetDefs'] = parsedFacetDefs.map(f => ({
    metaKey: f.metaKey,
    label: f.label || f.metaKey, // Fallback auf metaKey wenn label fehlt
    type: f.type,
    multi: f.multi ?? true,
    visible: f.visible ?? true,
  }))
  
  // Embedding-Config extrahieren
  const embeddingConfig = getEmbeddingConfig(ctx)
  
  return {
    ctx,
    libraryKey,
    dimension,
    facetDefs,
    embeddingConfig,
  }
}


