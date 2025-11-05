import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import type { Library } from '@/types/library'

export interface BuiltFilters {
  normalized: Record<string, unknown>
  pinecone: Record<string, unknown>
  mongo: Record<string, unknown>
}

export function buildFilters(url: URL, library: Library, userEmail: string, libraryId: string, mode: 'chunk' | 'summary'): BuiltFilters {
  const defs = parseFacetDefs(library)
  const builtin = buildFilterFromQuery(url, defs)

  // Pinecone-Filter: Für Summary-Mode libraryId optional lassen (Summaries können ohne libraryId indiziert sein)
  const pinecone: Record<string, unknown> = mode === 'summary'
    ? { user: { $eq: userEmail || '' } }
    : { user: { $eq: userEmail || '' }, libraryId: { $eq: libraryId } }

  // Dynamisch alle Facetten-Filter hinzufügen (nicht nur hardcodierte Liste)
  for (const def of defs) {
    const filterValue = builtin[def.metaKey]
    if (filterValue !== undefined && filterValue !== null) {
      pinecone[def.metaKey] = filterValue
    }
  }

  const normalized: Record<string, unknown> = {
    user: { $eq: userEmail || '' },
    libraryId: { $eq: libraryId },
    kind: { $eq: mode === 'summary' ? 'chapterSummary' : 'chunk' }
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

  return { normalized, pinecone, mongo }
}


