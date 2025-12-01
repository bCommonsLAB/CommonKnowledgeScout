/**
 * @fileoverview RAG Embeddings Service - Abstraktion für Secretary Service RAG API
 * 
 * @description
 * Zentrale Abstraktion für alle Embedding-Operationen im Chat/RAG-Kontext.
 * Alle Embeddings laufen über den Secretary Service RAG API Endpoint.
 * 
 * @module chat
 * 
 * @exports
 * - getEmbeddingConfig: Liest Embedding-Konfiguration aus Library Config
 * - embedDocumentWithSecretary: Embeddet komplettes Dokument und gibt Chunks zurück
 * - embedQuestionWithSecretary: Embeddet eine Frage (für Retriever)
 * 
 * @usedIn
 * - src/lib/chat/ingestion-service.ts: Dokument-Ingestion
 * - src/lib/chat/retrievers: Query-Embeddings für Retrieval
 * 
 * @dependencies
 * - @/lib/secretary/client: Secretary Service Client für RAG API
 * - @/lib/chat/loader: LibraryChatContext für Config-Zugriff
 */

import type { LibraryChatContext } from '@/lib/chat/loader'
import { embedTextRag } from '@/lib/secretary/client'
import { getDefaultEmbeddings } from '@/lib/chat/config'

/**
 * Embedding-Konfiguration aus Library Config lesen.
 * WICHTIG: Dimension muss explizit in der Config gespeichert sein (wird nicht mehr automatisch abgeleitet).
 */
export function getEmbeddingConfig(ctx: LibraryChatContext): {
  model: string
  chunkSize: number
  chunkOverlap: number
  dimensions: number
} {
  const embeddingsConfig = (ctx.chat as { embeddings?: { embeddingModel?: string; chunkSize?: number; chunkOverlap?: number; dimensions?: number } }).embeddings
  const defaults = getDefaultEmbeddings()
  
  // Verwende Defaults aus zentralem Schema
  const model = embeddingsConfig?.embeddingModel || defaults.embeddingModel
  const chunkSize = embeddingsConfig?.chunkSize ?? defaults.chunkSize
  let chunkOverlap = embeddingsConfig?.chunkOverlap ?? defaults.chunkOverlap
  
  // Validierung: chunkOverlap muss kleiner als chunkSize sein
  if (chunkOverlap >= chunkSize) {
    console.warn(`[getEmbeddingConfig] chunkOverlap (${chunkOverlap}) >= chunkSize (${chunkSize}). Setze chunkOverlap auf ${Math.max(0, Math.floor(chunkSize * 0.2))}`)
    chunkOverlap = Math.max(0, Math.floor(chunkSize * 0.2)) // 20% von chunkSize, mindestens 0
  }
  
  // Dimension: Muss explizit gesetzt sein (wird nicht mehr automatisch abgeleitet)
  // Verwende Default aus zentralem Schema
  const dimensions = embeddingsConfig?.dimensions || defaults.dimensions
  
  if (!embeddingsConfig?.dimensions) {
    console.warn(`[getEmbeddingConfig] Keine Dimension in Config gefunden für Library ${ctx.library.id}, verwende Fallback ${defaults.dimensions}`)
  }
  
  return { model, chunkSize, chunkOverlap, dimensions }
}

/**
 * Normalisierter Chunk aus Secretary RAG Response
 */
export interface NormalizedChunk {
  text: string
  index: number
  embedding: number[]
  headingContext?: string | null
  startChar?: number | null
  endChar?: number | null
  metadata?: Record<string, unknown>
}

/**
 * Embeddet ein komplettes Dokument über Secretary Service RAG API.
 * Gibt normalisierte Chunks mit Embeddings zurück.
 * 
 * @param markdown Vollständiger Markdown-Text des Dokuments
 * @param ctx Library Chat Context für Config-Zugriff
 * @param options Optionale Parameter (documentId, metadata)
 * @returns Normalisierte Chunks mit Embeddings, Dimension und Model
 */
export async function embedDocumentWithSecretary(
  markdown: string,
  ctx: LibraryChatContext,
  options?: {
    documentId?: string
    meta?: Record<string, unknown>
  }
): Promise<{
  chunks: NormalizedChunk[]
  dimensions: number
  model: string
}> {
  const config = getEmbeddingConfig(ctx)
  
  // Validierung: chunkOverlap muss kleiner als chunkSize sein
  if (config.chunkOverlap >= config.chunkSize) {
    throw new Error(`Chunk-Overlap (${config.chunkOverlap}) muss kleiner als Chunk-Größe (${config.chunkSize}) sein`)
  }
  
  // Secretary Service RAG API aufrufen
  const response = await embedTextRag({
    markdown,
    documentId: options?.documentId,
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
    embeddingModel: config.model,
    embedding_dimensions: config.dimensions,
    metadata: options?.meta || {},
  })
  
  if (response.status !== 'success' || !response.data) {
    throw new Error(`RAG Embedding fehlgeschlagen: ${response.error?.message || 'Unbekannter Fehler'}`)
  }
  
  // Chunks normalisieren
  const chunks: NormalizedChunk[] = response.data.chunks.map(chunk => ({
    text: chunk.text,
    index: chunk.chunk_index,
    embedding: chunk.embedding,
    headingContext: chunk.heading_context ?? undefined,
    startChar: chunk.start_char ?? undefined,
    endChar: chunk.end_char ?? undefined,
    metadata: chunk.metadata || {},
  }))
  
  return {
    chunks,
    dimensions: response.data.embedding_dimensions,
    model: response.data.embedding_model,
  }
}

/**
 * Embeddet eine Frage (für Retriever) über Secretary Service RAG API.
 * Gibt einen einzelnen Embedding-Vektor zurück.
 * 
 * @param question Die Frage, die eingebettet werden soll
 * @param ctx Library Chat Context für Config-Zugriff
 * @returns Embedding-Vektor (Array von Zahlen)
 */
export async function embedQuestionWithSecretary(
  question: string,
  ctx: LibraryChatContext
): Promise<number[]> {
  const config = getEmbeddingConfig(ctx)
  
  // Frage als "Dokument" senden (wird zu einem Chunk)
  // Sicherstellen, dass chunkSize groß genug ist (mindestens 100 Zeichen)
  const chunkSize = Math.max(question.length + 100, 100)
  const chunkOverlap = 0 // Kein Overlap für Fragen
  
  // Validierung: chunkOverlap muss kleiner als chunkSize sein
  if (chunkOverlap >= chunkSize) {
    throw new Error(`Chunk-Overlap (${chunkOverlap}) muss kleiner als Chunk-Größe (${chunkSize}) sein`)
  }
  
  const response = await embedTextRag({
    markdown: question,
    chunkSize,
    chunkOverlap,
    embeddingModel: config.model,
    embedding_dimensions: config.dimensions,
    metadata: { type: 'query' },
  })
  
  if (response.status !== 'success' || !response.data || response.data.chunks.length === 0) {
    throw new Error(`Query Embedding fehlgeschlagen: ${response.error?.message || 'Unbekannter Fehler'}`)
  }
  
  // Ersten (und einzigen) Chunk zurückgeben
  return response.data.chunks[0].embedding
}

