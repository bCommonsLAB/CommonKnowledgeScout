import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import type { Library } from '@/types/library'

export interface BuiltFilters {
  normalized: Record<string, unknown>
  pinecone: Record<string, unknown>
  mongo: Record<string, unknown>
}

export function buildFilters(url: URL, library: Library, userEmail: string, libraryId: string, mode: 'chunk' | 'summary' | 'chunkSummary'): BuiltFilters {
  const defs = parseFacetDefs(library)
  const builtin = buildFilterFromQuery(url, defs)

  // Pinecone-Filter: Für Summary-Mode libraryId optional lassen (Summaries können ohne libraryId indiziert sein)
  // chunkSummary verwendet die gleichen Filter wie summary (beide filtern auf Dokumentebene)
  const pinecone: Record<string, unknown> = mode === 'summary' || mode === 'chunkSummary'
    ? { user: { $eq: userEmail || '' } }
    : { user: { $eq: userEmail || '' }, libraryId: { $eq: libraryId } }

  // Dynamisch alle Facetten-Filter hinzufügen (nicht nur hardcodierte Liste)
  for (const def of defs) {
    const filterValue = builtin[def.metaKey]
    if (filterValue !== undefined && filterValue !== null) {
      pinecone[def.metaKey] = filterValue
    }
  }
  
  // fileId-Filter hinzufügen (wenn vorhanden)
  const fileIdFilter = builtin.fileId
  if (fileIdFilter !== undefined && fileIdFilter !== null) {
    // Für Pinecone: fileId als $in-Array
    if (Array.isArray(fileIdFilter)) {
      pinecone.fileId = { $in: fileIdFilter }
    } else {
      pinecone.fileId = { $eq: fileIdFilter }
    }
  }

  const normalized: Record<string, unknown> = {
    user: { $eq: userEmail || '' },
    libraryId: { $eq: libraryId },
    kind: { $eq: (mode === 'summary' || mode === 'chunkSummary') ? 'chapterSummary' : 'chunk' }
  }

  // Mongo-Filter: Dynamisch alle Facetten-Filter hinzufügen
  const mongo: Record<string, unknown> = {}
  
  // Dynamisch alle Facetten-Filter hinzufügen (nicht nur hardcodierte Liste)
  for (const def of defs) {
    const filterValue = builtin[def.metaKey]
    if (filterValue !== undefined && filterValue !== null) {
      mongo[def.metaKey] = filterValue
    }
  }
  
  // fileId-Filter für MongoDB hinzufügen (wenn vorhanden)
  if (fileIdFilter !== undefined && fileIdFilter !== null) {
    // Für MongoDB: fileId als $in-Array
    if (Array.isArray(fileIdFilter)) {
      mongo.fileId = { $in: fileIdFilter }
    } else {
      mongo.fileId = fileIdFilter
    }
  }

  return { normalized, pinecone, mongo }
}


