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

  if (builtin['authors']) pinecone['authors'] = builtin['authors']
  if (builtin['region']) pinecone['region'] = builtin['region']
  if (builtin['year']) pinecone['year'] = builtin['year']
  if (builtin['docType']) pinecone['docType'] = builtin['docType']
  if (builtin['source']) pinecone['source'] = builtin['source']
  if (builtin['tags']) pinecone['tags'] = builtin['tags']

  const normalized: Record<string, unknown> = {
    user: { $eq: userEmail || '' },
    libraryId: { $eq: libraryId },
    kind: { $eq: mode === 'summary' ? 'chapterSummary' : 'chunk' }
  }

  // Mongo-Filter: Spiegeln der relevanten Felder aus Facetten
  const mongo: Record<string, unknown> = {}
  if (builtin['authors']) mongo['authors'] = builtin['authors']
  if (builtin['region']) mongo['region'] = builtin['region']
  if (builtin['year']) mongo['year'] = builtin['year']
  if (builtin['docType']) mongo['docType'] = builtin['docType']
  if (builtin['source']) mongo['source'] = builtin['source']
  if (builtin['tags']) mongo['tags'] = builtin['tags']

  return { normalized, pinecone, mongo }
}


