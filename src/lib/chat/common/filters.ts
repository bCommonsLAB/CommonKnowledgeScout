import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import type { Library } from '@/types/library'

export interface BuiltFilters {
  normalized: Record<string, unknown>
  mongo: Record<string, unknown>
}

/**
 * Konvertiert facetsSelected zu MongoDB-Filter-Format
 * Mappt shortTitle zu docMetaJson.shortTitle für MongoDB-Queries
 * 
 * @param facetsSelected - Facetten-Filter im Format { key: value | value[] }
 * @returns MongoDB-Filter im Format { key: { $in: [...] } } oder { 'docMetaJson.shortTitle': { $in: [...] } }
 */
export function facetsSelectedToMongoFilter(
  facetsSelected: Record<string, unknown> | undefined | null
): Record<string, unknown> {
  const mongoFilter: Record<string, unknown> = {}
  
  if (!facetsSelected || Object.keys(facetsSelected).length === 0) {
    return mongoFilter
  }
  
  for (const [key, value] of Object.entries(facetsSelected)) {
    if (key === 'shortTitle') {
      // shortTitle muss zu docMetaJson.shortTitle gemappt werden für MongoDB
      if (Array.isArray(value)) {
        mongoFilter['docMetaJson.shortTitle'] = { $in: value }
      } else if (value !== undefined && value !== null) {
        mongoFilter['docMetaJson.shortTitle'] = value
      }
    } else {
      // Normale Facetten-Filter: Array-Werte zu $in-Format konvertieren
      if (Array.isArray(value)) {
        mongoFilter[key] = { $in: value }
      } else if (value !== undefined && value !== null) {
        mongoFilter[key] = value
      }
    }
  }
  
  return mongoFilter
}

export function buildFilters(url: URL, library: Library, userEmail: string, libraryId: string, mode: 'chunk' | 'summary' | 'chunkSummary'): BuiltFilters {
  const defs = parseFacetDefs(library)
  const builtin = buildFilterFromQuery(url, defs)

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
  
  // fileId-Filter für MongoDB hinzufügen (wenn vorhanden) - für Rückwärtskompatibilität
  const fileIdFilter = builtin.fileId
  if (fileIdFilter !== undefined && fileIdFilter !== null) {
    // Für MongoDB: fileId kann bereits als { $in: [...] } von buildFilterFromQuery kommen
    if (Array.isArray(fileIdFilter)) {
      mongo.fileId = { $in: fileIdFilter }
    } else if (typeof fileIdFilter === 'object' && '$in' in fileIdFilter) {
      // Bereits im richtigen Format von buildFilterFromQuery
      mongo.fileId = fileIdFilter
    } else {
      mongo.fileId = fileIdFilter
    }
  }
  
  // shortTitle-Filter für MongoDB hinzufügen (wenn vorhanden)
  // Wird in MongoDB nach docMetaJson.shortTitle gefiltert
  // Verwende Utility-Funktion für konsistente Konvertierung
  const shortTitleFilter = builtin.shortTitle
  if (shortTitleFilter !== undefined && shortTitleFilter !== null) {
    const shortTitleMongo = facetsSelectedToMongoFilter({ shortTitle: shortTitleFilter })
    Object.assign(mongo, shortTitleMongo)
  }

  return { normalized, mongo }
}

/**
 * Baut einen Vector Search Filter für MongoDB Atlas Vector Search.
 * Kombiniert Basis-Filter (libraryId, user, kind) mit Facetten-Filtern.
 * Unterstützt shortTitle-Ausschluss (wird separat zu fileIds konvertiert).
 * 
 * @param libraryId Library-ID
 * @param userEmail User-Email
 * @param kind Dokument-Typ ('chunk' oder 'chapterSummary')
 * @param filters Facetten-Filter (optional)
 * @param fileIds File-IDs für Filterung (optional, wird aus shortTitle konvertiert)
 * @returns Vector Search Filter für MongoDB
 */
export function buildVectorSearchFilter(
  libraryId: string,
  userEmail: string,
  kind: 'chunk' | 'chapterSummary',
  filters?: Record<string, unknown>,
  fileIds?: string[]
): Record<string, unknown> {
  // Basis-Filter: libraryId, kind
  // user-Filter entfernt: libraryId ist ausreichend für Filterung
  const baseFilter: Record<string, unknown> = {
    libraryId, // Direkter Vergleich statt $eq
    kind, // Explizit nur Chunks oder Chapter-Summaries suchen
  }
  
  // Facetten-Filter hinzufügen (alle außer shortTitle, das bereits zu fileIds gemappt wurde)
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'shortTitle') continue // Bereits zu fileIds gemappt
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          baseFilter[key] = { $in: value }
        } else {
          baseFilter[key] = value
        }
      }
    }
  }
  
  // fileId-Filter hinzufügen (falls vorhanden)
  if (fileIds && fileIds.length > 0) {
    baseFilter.fileId = { $in: fileIds }
  }
  
  return baseFilter
}


