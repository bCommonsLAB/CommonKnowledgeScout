import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import type { Library } from '@/types/library'

export interface BuiltFilters {
  normalized: Record<string, unknown>
  pinecone: Record<string, unknown>
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
  
  // shortTitle-Filter: Wird später zu fileIds gemappt über MongoDB (in API-Endpunkten)
  // fileId-Filter hinzufügen (wenn vorhanden) - für Rückwärtskompatibilität
  const fileIdFilter = builtin.fileId
  if (fileIdFilter !== undefined && fileIdFilter !== null) {
    // Für Pinecone: fileId kann bereits als { $in: [...] } von buildFilterFromQuery kommen
    // Oder als Array, wenn direkt übergeben
    if (Array.isArray(fileIdFilter)) {
      pinecone.fileId = { $in: fileIdFilter }
    } else if (typeof fileIdFilter === 'object' && '$in' in fileIdFilter) {
      // Bereits im richtigen Format von buildFilterFromQuery
      pinecone.fileId = fileIdFilter
    } else {
      pinecone.fileId = { $eq: fileIdFilter }
    }
  }
  
  // shortTitle-Filter wird NICHT direkt an Pinecone gesendet
  // Muss zuerst über MongoDB zu fileIds gemappt werden

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

  return { normalized, pinecone, mongo }
}


