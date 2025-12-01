/**
 * @fileoverview Document Text Builder - Erstellt Text für Dokument-Embeddings
 * 
 * @description
 * Kombiniert Summary, Metadaten, Titel und andere relevante Felder zu einem
 * Text, der für die globale Dokumentensuche eingebettet wird.
 * 
 * @module ingestion
 */

import type { DocMeta } from '@/types/doc-meta'

/**
 * Erstellt einen kombinierten Text aus Dokument-Metadaten für Embedding.
 * 
 * Dieser Text wird verwendet, um ein Embedding für das gesamte Dokument
 * zu erstellen, das für die globale Dokumentensuche verwendet werden kann.
 * 
 * @param docMetaJsonObj - Vollständiges docMetaJson Objekt
 * @param mongoDoc - DocMeta mit Top-Level Feldern
 * @returns Kombinierter Text für Embedding
 */
export function buildDocumentTextForEmbedding(
  docMetaJsonObj: Record<string, unknown>,
  mongoDoc: DocMeta
): string {
  const parts: string[] = []
  
  // Titel (höchste Priorität)
  const title = docMetaJsonObj.title as string | undefined
  if (title && title.trim().length > 0) {
    parts.push(`Titel: ${title.trim()}`)
  }
  
  // Short Title
  const shortTitle = docMetaJsonObj.shortTitle as string | undefined
  if (shortTitle && shortTitle.trim().length > 0 && shortTitle !== title) {
    parts.push(`Kurztitel: ${shortTitle.trim()}`)
  }
  
  // Autoren
  const authors = mongoDoc.authors || (docMetaJsonObj.authors as string[] | undefined)
  if (authors && Array.isArray(authors) && authors.length > 0) {
    parts.push(`Autoren: ${authors.join(', ')}`)
  }
  
  // Jahr
  const year = mongoDoc.year || (docMetaJsonObj.year as number | string | undefined)
  if (year !== undefined && year !== null) {
    parts.push(`Jahr: ${year}`)
  }
  
  // Summary (wichtigster Teil für semantische Suche)
  const summary = docMetaJsonObj.summary as string | undefined
  if (summary && summary.trim().length > 0) {
    parts.push(`Zusammenfassung: ${summary.trim()}`)
  }
  
  // Teaser (falls vorhanden und unterschiedlich von Summary)
  const teaser = docMetaJsonObj.teaser as string | undefined
  if (teaser && teaser.trim().length > 0 && teaser !== summary) {
    parts.push(`Teaser: ${teaser.trim()}`)
  }
  
  // Tags
  const tags = mongoDoc.tags || (docMetaJsonObj.tags as string[] | undefined)
  if (tags && Array.isArray(tags) && tags.length > 0) {
    parts.push(`Tags: ${tags.join(', ')}`)
  }
  
  // Topics
  const topics = docMetaJsonObj.topics as string[] | undefined
  if (topics && Array.isArray(topics) && topics.length > 0) {
    parts.push(`Themen: ${topics.join(', ')}`)
  }
  
  // Region
  const region = mongoDoc.region || (typeof docMetaJsonObj.region === 'string' ? docMetaJsonObj.region : undefined)
  if (region && typeof region === 'string' && region.trim().length > 0) {
    parts.push(`Region: ${region.trim()}`)
  }
  
  // DocType
  const docType = mongoDoc.docType || (typeof docMetaJsonObj.docType === 'string' ? docMetaJsonObj.docType : undefined)
  if (docType && typeof docType === 'string' && docType.trim().length > 0) {
    parts.push(`Dokumenttyp: ${docType.trim()}`)
  }
  
  // Chapter Summaries (wenn vorhanden)
  const chapters = docMetaJsonObj.chapters as Array<{ title?: string; summary?: string }> | undefined
  if (chapters && Array.isArray(chapters) && chapters.length > 0) {
    const chapterSummaries = chapters
      .filter(ch => ch.summary && typeof ch.summary === 'string' && ch.summary.trim().length > 0)
      .map(ch => {
        const chapterTitle = ch.title && typeof ch.title === 'string' ? ch.title.trim() : ''
        const chapterSummary = typeof ch.summary === 'string' ? ch.summary.trim() : ''
        return chapterTitle ? `${chapterTitle}: ${chapterSummary}` : chapterSummary
      })
    
    if (chapterSummaries.length > 0) {
      parts.push(`Kapitel-Zusammenfassungen:\n${chapterSummaries.join('\n\n')}`)
    }
  }
  
  return parts.join('\n\n')
}

