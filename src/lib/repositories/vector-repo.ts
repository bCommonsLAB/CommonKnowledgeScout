/**
 * @fileoverview Vector Repository - MongoDB Repository for Vector Search
 * 
 * @description
 * Repository for managing vectors in MongoDB using Atlas Vector Search.
 * Handles CRUD operations for vectors, supports vector search queries with filtering,
 * and manages meta-documents (kind: 'meta') alongside chunk vectors (kind: 'chunk').
 * Uses per-library collection strategy for data isolation.
 * 
 * @module chat
 * 
 * @exports
 * - getVectorCollectionName: Gets collection name for library
 * - getVectorCollection: Gets collection with indexes
 * - upsertVectors: Batch upsert of vectors
 * - upsertVectorMeta: Upsert meta-document (kind: 'meta')
 * - queryVectors: Vector search query with filtering
 * - deleteVectorsByFileId: Delete vectors by fileId
 * - findDocs: Find meta-documents (for gallery)
 * - aggregateFacets: Aggregate facets from meta-documents
 * 
 * @usedIn
 * - src/lib/chat/ingestion-service.ts: Ingestion service uses repository
 * - src/lib/chat/retrievers/chunks.ts: Retriever uses vector search
 * - src/app/api/chat: Chat API routes may use repository
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB connection and collection access
 * - @/lib/chat/config: Config utilities for dimensions
 * - @/types/library: Library type definitions
 * - mongodb: MongoDB driver types
 */

import type { Collection, Document } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import type { Library } from '@/types/library'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { FileLogger } from '@/lib/debug/logger'

/**
 * Konstante für den Vector Search Index-Namen.
 * Wird in allen Vector Search Operationen verwendet.
 */
export const VECTOR_SEARCH_INDEX_NAME = 'vector_search_idx'

const colCache = new Map<string, Collection<Document>>()
const ensuredIndexKeys = new Set<string>()
// Cache für Index-Erstellung in findDocs, um wiederholte Index-Checks zu vermeiden
const ensuredIndexesForCollections = new Set<string>()

/**
 * Leert den Cache für einen Vector Search Index.
 * Wird verwendet, wenn ein Index gelöscht wurde und neu erstellt werden soll.
 * @param libraryKey Collection-Name
 */
export function clearVectorSearchIndexCache(libraryKey: string): void {
  const cacheKey = `${libraryKey}::${VECTOR_SEARCH_INDEX_NAME}`
  ensuredIndexKeys.delete(cacheKey)
}

/**
 * Vector-Dokument Interface
 */
export interface VectorDocument {
  _id: string
  kind: 'meta' | 'chunk' | 'chapterSummary'
  libraryId: string
  user: string
  fileId: string
  fileName?: string
  // Für chunks/chapterSummary
  chunkIndex?: number
  text?: string
  embedding?: number[]
  headingContext?: string
  startChar?: number
  endChar?: number
  // Für meta
  title?: string
  shortTitle?: string
  slug?: string
  summary?: string
  teaser?: string
  chapters?: Array<{
    index: number
    id: string
    title: string
    summary: string
    chunkCount: number
  }>
  chaptersCount?: number
  chunkCount?: number
  docMetaJson?: Record<string, unknown>
  // Facetten-Metadaten (für Filterung)
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
  // Metadata
  upsertedAt: string
  [key: string]: unknown
}

/**
 * Query Match Result
 */
export interface QueryMatch {
  id: string
  score: number
  metadata: Record<string, unknown>
}

/**
 * Validiert die Embedding-Dimension.
 * @param dimension Die zu validierende Dimension
 * @throws Error wenn Dimension ungültig ist
 */
function validateDimension(dimension: number): void {
  if (!dimension || dimension <= 0) {
    throw new Error(`Ungültige Dimension: ${dimension}. Dimension muss eine positive Zahl sein.`)
  }
}

/**
 * Validiert das Library-Objekt.
 * @param library Das zu validierende Library-Objekt
 * @throws Error wenn Library ungültig ist
 */
function validateLibrary(library: Library): void {
  if (!library) {
    throw new Error('Library muss angegeben sein')
  }
}

/**
 * Ermittelt den MongoDB Collection-Namen für Vektoren einer Library.
 * Verwendet den Wert aus der Config (deterministisch).
 * @param library Die Library mit Config
 * @returns Der Collection-Name
 * @throws Error wenn collectionName nicht in Config vorhanden ist
 */
export function getVectorCollectionName(library: Library): string {
  const collectionName = library.config?.chat?.vectorStore?.collectionName
  if (!collectionName || collectionName.trim().length === 0) {
    throw new Error(
      `Collection-Name nicht in Config gefunden für Library ${library.id}. ` +
      `Die Library muss migriert werden. Bitte Library einmal laden, um automatische Migration auszulösen.`
    )
  }
  // Für Vektoren: Prefix "vectors__" statt "doc_meta__"
  // Aber wir verwenden die gleiche Collection wie doc_meta (alles in einer Collection)
  return collectionName
}

/**
 * Holt die Vector Collection mit automatischem Index-Setup.
 * @param libraryKey Collection-Name
 * @param dimension Embedding-Dimension (MUSS explizit angegeben sein)
 * @param library Library-Objekt für dynamische Index-Definition basierend auf Facetten (MUSS vorhanden sein)
 * @returns Collection
 * @throws Error wenn Dimension oder Library nicht angegeben sind
 */
/**
 * Holt Collection ohne Index-Setup (nur für reine Lese-/Schreib-Operationen).
 * WICHTIG: Verwende diese Funktion nur, wenn kein Index-Setup benötigt wird.
 * Für Index-Setup verwende getVectorCollection() mit dimension und library.
 * @param libraryKey Collection-Name
 * @returns Collection
 */
export async function getCollectionOnly(libraryKey: string): Promise<Collection<Document>> {
  if (colCache.has(libraryKey)) {
    return colCache.get(libraryKey) as Collection<Document>
  }
  
  const col = await getCollection<Document>(libraryKey)
  colCache.set(libraryKey, col)
  return col
}

/**
 * Holt die Vector Collection mit automatischem Index-Setup.
 * @param libraryKey Collection-Name
 * @param dimension Embedding-Dimension (MUSS explizit angegeben sein)
 * @param library Library-Objekt für dynamische Index-Definition basierend auf Facetten (MUSS vorhanden sein)
 * @returns Collection
 * @throws Error wenn Dimension oder Library nicht angegeben sind
 */
export async function getVectorCollection(
  libraryKey: string,
  dimension: number,
  library: Library
): Promise<Collection<Document>> {
  validateDimension(dimension)
  validateLibrary(library)
  
  if (colCache.has(libraryKey)) {
    return colCache.get(libraryKey) as Collection<Document>
  }
  
  const col = await getCollection<Document>(libraryKey)
  
  try {
    // Basis-Indizes für häufig verwendete Felder
    await Promise.all([
      // Index auf kind für schnelle Trennung zwischen meta/chunk/chapterSummary
      col.createIndex({ kind: 1 }, { name: 'kind' }),
      // Index auf fileId für Lookups
      col.createIndex({ fileId: 1 }, { name: 'fileId' }),
      // Index auf libraryId (falls mehrere Libraries in einer Collection)
      col.createIndex({ libraryId: 1 }, { name: 'libraryId' }),
      // Index auf user für Filterung
      col.createIndex({ user: 1 }, { name: 'user' }),
      // Verbund-Index für häufige Queries
      col.createIndex({ kind: 1, libraryId: 1, user: 1 }, { name: 'kind_libraryId_user' }),
      col.createIndex({ fileId: 1, kind: 1 }, { name: 'fileId_kind' }),
      // Index auf upsertedAt für Sortierung
      col.createIndex({ upsertedAt: -1 }, { name: 'upsertedAt_desc' }),
    ])
  } catch {
    // Ignoriere Fehler bei Index-Erstellung (können bereits existieren)
  }
  
  // Vector Search Index erstellen mit expliziter Dimension und Library
  await ensureVectorSearchIndex(col, libraryKey, dimension, library)
  
  colCache.set(libraryKey, col)
  return col
}

/**
 * Prüft ob der Vector Search Index existiert durch Test-Query.
 * @param col Collection
 * @param dimension Embedding-Dimension (MUSS explizit angegeben sein)
 * @returns true wenn Index existiert und funktionsfähig ist
 * @throws Error wenn Dimension nicht angegeben ist oder Test fehlschlägt
 */
async function checkIndexExists(
  col: Collection<Document>,
  dimension: number
): Promise<boolean> {
  validateDimension(dimension)
  
  const indexName = VECTOR_SEARCH_INDEX_NAME
  
  try {
    // Versuche Index-Liste zu holen (präferierte Methode)
    const indexes = await col.listSearchIndexes().toArray()
    const exists = indexes.some((idx: { name: string }) => idx.name === indexName)
    console.log(`[vector-repo] checkIndexExists via listSearchIndexes: ${exists ? 'gefunden' : 'nicht gefunden'} für Index "${indexName}"`)
    return exists
  } catch (listError) {
    // Fallback: Test-Query wenn listSearchIndexes nicht verfügbar
    console.log(`[vector-repo] listSearchIndexes nicht verfügbar, verwende Fallback-Methode:`, listError instanceof Error ? listError.message : String(listError))
    try {
      // Hole ein existierendes Dokument mit Embedding für Test
      const sampleDoc = await col.findOne(
        { embedding: { $exists: true, $type: 'array' } },
        { projection: { embedding: 1 } }
      ) as { embedding?: number[] } | null
      
      if (!sampleDoc?.embedding || !Array.isArray(sampleDoc.embedding) || sampleDoc.embedding.length === 0) {
        // Kein Dokument mit Embedding gefunden - kann nicht testen, aber Index könnte trotzdem existieren
        // In diesem Fall geben wir false zurück, damit der Index erstellt wird
        console.log(`[vector-repo] Kein Dokument mit Embedding gefunden für Index-Test - nehme an Index existiert nicht`)
        return false
      }
      
      // Prüfe ob Dimension übereinstimmt
      if (sampleDoc.embedding.length !== dimension) {
        console.warn(`[vector-repo] Dimension-Mismatch: Dokument hat ${sampleDoc.embedding.length} Dimensionen, erwartet ${dimension}`)
        return false
      }
      
      // Test-Query mit echtem Embedding
      await col.aggregate([
        {
          $vectorSearch: {
            index: indexName,
            path: 'embedding',
            queryVector: sampleDoc.embedding,
            numCandidates: 1,
            limit: 1,
          },
        },
      ]).toArray()
      
      console.log(`[vector-repo] checkIndexExists via Test-Query: Index existiert`)
      return true
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      
      // Prüfe ob Fehler wegen fehlendem Index ist
      if (errorMsg.includes('index') && (errorMsg.includes('not found') || errorMsg.includes('does not exist'))) {
        console.log(`[vector-repo] checkIndexExists via Test-Query: Index existiert nicht (Fehler: ${errorMsg})`)
        return false
      }
      
      // Andere Fehler: Index existiert möglicherweise, aber Test schlägt fehl
      console.warn(`[vector-repo] Index-Prüfung fehlgeschlagen: ${errorMsg}`)
      throw new Error(`Index-Prüfung fehlgeschlagen: ${errorMsg}`)
    }
  }
}

/**
 * Prüft die Vector Search Index-Definition und gibt Details zurück.
 * Versucht die tatsächliche Definition aus MongoDB zu holen, falls nicht verfügbar wird die erwartete Definition zurückgegeben.
 * @param libraryKey Collection-Name
 * @param dimension Embedding-Dimension (MUSS explizit angegeben sein)
 * @param library Library-Objekt für dynamische Index-Definition (MUSS vorhanden sein)
 * @returns Index-Definition oder null wenn nicht gefunden
 * @throws Error wenn Dimension oder Library nicht angegeben sind
 */
export async function getVectorSearchIndexDefinition(
  libraryKey: string,
  dimension: number,
  library: Library
): Promise<{ name: string; definition: unknown; status?: string; isActualDefinition?: boolean } | null> {
  validateDimension(dimension)
  validateLibrary(library)
  
  const indexName = VECTOR_SEARCH_INDEX_NAME
  // Verwende getCollectionOnly() da wir nur prüfen, nicht erstellen
  const col = await getCollectionOnly(libraryKey)
  
  const exists = await checkIndexExists(col, dimension)
  if (!exists) {
    return null
  }
  
  // Versuche tatsächliche Index-Definition von MongoDB zu holen
  let actualDefinition: unknown | null = null
  let status: string | undefined = 'ACTIVE'
  
  try {
    const indexes = await col.listSearchIndexes().toArray()
    const index = indexes.find((idx: { name: string }) => idx.name === indexName)
    if (index) {
      status = (index as { status?: string }).status || 'ACTIVE'
      // Prüfe ob Definition im Index-Objekt vorhanden ist
      // MongoDB Atlas Search gibt möglicherweise 'latestDefinition' oder 'definition' zurück
      const indexWithDef = index as { 
        status?: string
        latestDefinition?: { mappings?: unknown }
        definition?: { mappings?: unknown }
        [key: string]: unknown // Für zusätzliche Felder
      }
      if (indexWithDef.latestDefinition) {
        actualDefinition = indexWithDef.latestDefinition
        console.log(`[vector-repo] Index-Definition von MongoDB geholt für Collection "${libraryKey}" (latestDefinition)`)
      } else if (indexWithDef.definition) {
        actualDefinition = indexWithDef.definition
        console.log(`[vector-repo] Index-Definition von MongoDB geholt für Collection "${libraryKey}" (definition)`)
      } else {
        // Versuche über db.command() die vollständige Definition zu holen
        try {
          const db = col.db
          const result = await db.command({
            listSearchIndexes: col.collectionName,
          }) as { indexes?: Array<{ name: string; latestDefinition?: unknown; definition?: unknown }> }
          
          const fullIndex = result.indexes?.find((idx) => idx.name === indexName)
          if (fullIndex?.latestDefinition) {
            actualDefinition = fullIndex.latestDefinition
            console.log(`[vector-repo] Index-Definition von MongoDB geholt für Collection "${libraryKey}" (via db.command, latestDefinition)`)
          } else if (fullIndex?.definition) {
            actualDefinition = fullIndex.definition
            console.log(`[vector-repo] Index-Definition von MongoDB geholt für Collection "${libraryKey}" (via db.command, definition)`)
          }
        } catch (cmdError) {
          console.warn(`[vector-repo] Konnte Index-Definition nicht über db.command() holen für Collection "${libraryKey}":`, cmdError instanceof Error ? cmdError.message : String(cmdError))
        }
      }
    } else {
      console.warn(`[vector-repo] Index "${indexName}" nicht in Index-Liste gefunden für Collection "${libraryKey}"`)
    }
  } catch (error) {
    // listSearchIndexes nicht verfügbar oder Fehler - verwende Fallback
    console.warn(`[vector-repo] Konnte Index-Definition nicht von MongoDB holen für Collection "${libraryKey}":`, error instanceof Error ? error.message : String(error))
  }
  
  // Falls keine tatsächliche Definition gefunden, verwende erwartete Definition
  if (!actualDefinition) {
    const { buildVectorSearchIndexDefinition } = await import('@/lib/chat/vector-search-index')
    const expectedDefinition = buildVectorSearchIndexDefinition(library, dimension)
    return {
      name: indexName,
      definition: expectedDefinition.definition,
      status,
      isActualDefinition: false, // Kennzeichnung dass es die erwartete Definition ist
    }
  }
  
  return {
    name: indexName,
    definition: actualDefinition,
    status,
    isActualDefinition: true, // Kennzeichnung dass es die tatsächliche Definition ist
  }
}

/**
 * Prüft ob der Vector Search Index bereit ist (nicht im INITIAL_SYNC Status).
 * @param libraryKey Collection-Name
 * @param dimension Embedding-Dimension (MUSS explizit angegeben sein)
 * @param library Library-Objekt für dynamische Index-Definition (MUSS vorhanden sein)
 * @returns true wenn Index bereit ist, false wenn nicht bereit oder nicht gefunden
 */
export async function isVectorSearchIndexReady(
  libraryKey: string,
  dimension: number,
  library: Library
): Promise<{ ready: boolean; status?: string; message?: string }> {
  validateDimension(dimension)
  validateLibrary(library)
  
  try {
    const indexDef = await getVectorSearchIndexDefinition(libraryKey, dimension, library)
    if (!indexDef) {
      return { ready: false, message: 'Index nicht gefunden' }
    }
    
    const status = indexDef.status
    // Index-Status: 'ACTIVE' oder 'READY' = bereit, 'INITIAL_SYNC' = wird gerade indiziert, 'FAILED' = Fehler
    // MongoDB Atlas Vector Search gibt sowohl 'ACTIVE' als auch 'READY' zurück, wenn der Index bereit ist
    if (status === 'ACTIVE' || status === 'READY') {
      return { ready: true, status }
    } else if (status === 'INITIAL_SYNC') {
      return { ready: false, status, message: 'Index wird gerade indiziert, bitte warten...' }
    } else if (status === 'FAILED') {
      return { ready: false, status, message: 'Index-Erstellung fehlgeschlagen' }
    } else {
      return { ready: false, status, message: `Index-Status: ${status || 'unbekannt'}` }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[vector-repo] Fehler beim Prüfen des Index-Status: ${errorMsg}`)
    return { ready: false, message: `Fehler: ${errorMsg}` }
  }
}

/**
 * Erstellt oder aktualisiert den Vector Search Index.
 * @param col Collection
 * @param libraryKey Collection-Name (für Cache-Key)
 * @param dimension Embedding-Dimension (MUSS explizit angegeben sein)
 * @param library Library-Objekt für dynamische Index-Definition (MUSS vorhanden sein)
 * @throws Error wenn Dimension oder Library nicht angegeben sind
 */
async function ensureVectorSearchIndex(
  col: Collection<Document>,
  libraryKey: string,
  dimension: number,
  library: Library
): Promise<void> {
  validateDimension(dimension)
  validateLibrary(library)
  
  const indexName = VECTOR_SEARCH_INDEX_NAME
  const cacheKey = `${libraryKey}::${indexName}`
  
  if (ensuredIndexKeys.has(cacheKey)) {
    console.log(`[vector-repo] Cache-Hit: Index "${indexName}" bereits im Cache für Collection "${libraryKey}"`)
    return // Bereits erstellt
  }
  
  try {
    const db = col.db
    
    // Prüfe ob Index bereits existiert
    console.log(`[vector-repo] Prüfe ob Index "${indexName}" existiert für Collection "${libraryKey}"`)
    const indexExists = await checkIndexExists(col, dimension)
    console.log(`[vector-repo] Index-Existenz-Prüfung: ${indexExists ? 'existiert' : 'existiert nicht'} für Collection "${libraryKey}"`)
    
    if (!indexExists) {
      // Erstelle Vector Search Index über MongoDB Atlas Search API
      // Verwende dynamische Index-Definition basierend auf Facetten-Config
      const { buildVectorSearchIndexDefinition } = await import('@/lib/chat/vector-search-index')
      const indexDefinition = buildVectorSearchIndexDefinition(library, dimension)
      
      console.log(`[vector-repo] Erstelle Vector Search Index für Library "${library.id}" mit ${parseFacetDefs(library).length} Facetten (Dimension: ${dimension})`)
      console.log(`[vector-repo] Index-Definition:`, JSON.stringify(indexDefinition, null, 2))
      
      try {
        await db.command({
          createSearchIndexes: col.collectionName,
          indexes: [indexDefinition],
        })
        
        console.log(`[vector-repo] ✅ Vector Search Index "${indexName}" erfolgreich erstellt für Collection "${libraryKey}"`)
        
        // Warte kurz, damit MongoDB den Index registrieren kann
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Prüfe nochmal, ob Index jetzt existiert
        const verifyExists = await checkIndexExists(col, dimension)
        if (verifyExists) {
          console.log(`[vector-repo] ✅ Index-Verifizierung erfolgreich: Index existiert jetzt für Collection "${libraryKey}"`)
        } else {
          console.warn(`[vector-repo] ⚠️ Index-Verifizierung: Index wurde erstellt, aber noch nicht gefunden für Collection "${libraryKey}" (kann einige Sekunden dauern)`)
        }
      } catch (createError) {
        const createErrorMsg = createError instanceof Error ? createError.message : String(createError)
        console.error(`[vector-repo] ❌ Fehler beim Erstellen des Index:`, createErrorMsg)
        throw createError
      }
    } else {
      // Index existiert bereits - hole Status für Logging
      try {
        const indexes = await col.listSearchIndexes().toArray()
        const existingIndex = indexes.find((idx: { name: string }) => idx.name === indexName)
        if (existingIndex) {
          const status = (existingIndex as { status?: string }).status || 'UNKNOWN'
          if (status === 'READY' || status === 'ACTIVE') {
            console.log(`[vector-repo] Vector Search Index "${indexName}" existiert bereits für Collection "${libraryKey}" (Status: ${status})`)
          } else {
            console.warn(`[vector-repo] ⚠️ Index-Status ist nicht READY: ${status}`)
          }
        }
      } catch {
        // listSearchIndexes nicht verfügbar - Index existiert aber (Test-Query erfolgreich)
        console.log(`[vector-repo] Vector Search Index "${indexName}" existiert bereits für Collection "${libraryKey}"`)
      }
    }
    
    ensuredIndexKeys.add(cacheKey)
    console.log(`[vector-repo] Cache gesetzt für Index "${indexName}" auf Collection "${libraryKey}"`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    // Prüfe ob es ein "Index bereits vorhanden" Fehler ist
    if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
      console.log(`[vector-repo] Index existiert bereits (Fehlermeldung), setze Cache für Collection "${libraryKey}"`)
      ensuredIndexKeys.add(cacheKey)
      return
    }
    
    // Fehler weiterwerfen - keine stille Fehlerbehandlung mehr
    console.error(`[vector-repo] ❌ Fehler beim Erstellen des Vector Search Index für Collection "${libraryKey}":`, errorMsg)
    throw new Error(`Fehler beim Erstellen des Vector Search Index für Collection "${libraryKey}": ${errorMsg}`)
  }
}

/**
 * Batch-Upsert von Vektoren.
 * @param libraryKey Collection-Name
 * @param vectors Array von Vektor-Dokumenten
 * @param dimension Embedding-Dimension (MUSS explizit angegeben sein)
 * @param library Library-Objekt (MUSS vorhanden sein)
 */
export async function upsertVectors(
  libraryKey: string,
  vectors: Array<Omit<VectorDocument, '_id'> & { _id: string }>,
  dimension: number,
  library: Library
): Promise<void> {
  const col = await getVectorCollection(libraryKey, dimension, library)
  
  // Batch-Upsert mit bulkWrite für bessere Performance
  const operations = vectors.map(vector => ({
    updateOne: {
      filter: { _id: vector._id } as Partial<Document>,
      update: { $set: vector },
      upsert: true,
    },
  }))
  
  // MongoDB bulkWrite unterstützt max 1000 Operationen pro Batch
  const BATCH_SIZE = 1000
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = operations.slice(i, i + BATCH_SIZE)
    await col.bulkWrite(batch)
  }
}

/**
 * Upsert eines Meta-Dokuments (kind: 'meta').
 * @param libraryKey Collection-Name
 * @param metaDoc Meta-Dokument (ohne _id, wird automatisch generiert)
 * @param dimension Embedding-Dimension (MUSS explizit angegeben sein)
 * @param library Library-Objekt (MUSS vorhanden sein)
 */
export async function upsertVectorMeta(
  libraryKey: string,
  metaDoc: Omit<VectorDocument, '_id' | 'kind'> & { fileId: string },
  dimension: number,
  library: Library
): Promise<void> {
  const col = await getVectorCollection(libraryKey, dimension, library)
  
  const doc: VectorDocument = {
    _id: `${metaDoc.fileId}-meta`,
    kind: 'meta',
    ...metaDoc,
  } as VectorDocument
  
  await col.updateOne(
    { _id: doc._id } as Partial<Document>,
    { $set: doc },
    { upsert: true }
  )
}

/**
 * Vector Search Query mit Filterung.
 * @param libraryKey Collection-Name
 * @param queryVector Query-Vektor
 * @param topK Anzahl der Ergebnisse
 * @param filter MongoDB-Filter
 * @param dimension Embedding-Dimension (für Index-Setup)
 * @returns Array von Query-Matches
 */
/**
 * Query Vectors mit Vector Search
 * 
 * @param libraryKey - Collection-Name für die Library
 * @param queryVector - Query-Vektor für Suche
 * @param topK - Anzahl der Ergebnisse
 * @param filter - MongoDB-Filter (kann kind überschreiben)
 * @param dimension - Embedding-Dimension (optional)
 * @returns Array von Query-Matches
 */
// Bekannte Array-Felder, die Token-Indexe benötigen
const ARRAY_FIELDS_REQUIRING_TOKEN_INDEX = new Set([
  'authors',
  'speakers',
  'tags',
  'topics',
  'speakers_image_url',
])

/**
 * Prüft, ob ein Filter-Key ein Array-Feld ist, das einen Token-Index benötigt
 */
function requiresTokenIndex(key: string): boolean {
  return ARRAY_FIELDS_REQUIRING_TOKEN_INDEX.has(key)
}

export async function queryVectors(
  libraryKey: string,
  queryVector: number[],
  topK: number,
  filter: Record<string, unknown>,
  dimension: number,
  library: Library
): Promise<QueryMatch[]> {
  validateDimension(dimension)
  validateLibrary(library)
  
  const col = await getVectorCollection(libraryKey, dimension, library)
  
  // Filter für kind: Standard nur Chunks/Chapter Summaries, kann überschrieben werden
  // Entferne kind aus filter, damit es nicht doppelt gesetzt wird
  const { kind, ...restFilter } = filter
  const kindFilter = kind || { $in: ['chunk', 'chapterSummary'] }
  
  // Vector Search Filter: MongoDB Vector Search unterstützt direkte Werte und $eq/$in Operatoren
  // Konvertiere direkte Werte zu $eq für bessere Kompatibilität
  const vectorSearchFilter: Record<string, unknown> = {
    kind: kindFilter,
  }
  
  // Prüfe, ob Array-Felder verwendet werden, die Token-Indexe benötigen
  const arrayFieldsInFilter: string[] = []
  
  // Konvertiere restFilter zu Vector Search kompatiblem Format
  for (const [key, value] of Object.entries(restFilter)) {
    if (value === null || value === undefined) {
      continue // Überspringe null/undefined Werte
    }
    
    // Wenn bereits ein MongoDB-Operator ($eq, $in, etc.), verwende direkt
    if (typeof value === 'object' && !Array.isArray(value) && ('$eq' in value || '$in' in value || '$ne' in value || '$gt' in value || '$lt' in value)) {
      vectorSearchFilter[key] = value
      // Prüfe, ob $in verwendet wird (kann auf Array-Feld hinweisen)
      if ('$in' in value && requiresTokenIndex(key)) {
        arrayFieldsInFilter.push(key)
      }
    } else if (Array.isArray(value)) {
      // Arrays werden zu $in konvertiert
      vectorSearchFilter[key] = { $in: value }
      if (requiresTokenIndex(key)) {
        arrayFieldsInFilter.push(key)
      }
    } else {
      // Direkte Werte werden zu $eq konvertiert (für bessere Kompatibilität mit Vector Search)
      vectorSearchFilter[key] = { $eq: value }
    }
  }
  
  // Warnung ausgeben, wenn Array-Felder verwendet werden (für Debugging)
  if (arrayFieldsInFilter.length > 0) {
    console.warn(`[vector-repo] ⚠️ Array-Felder in Filter verwendet, die Token-Indexe benötigen: ${arrayFieldsInFilter.join(', ')}. Stelle sicher, dass der Vector Search Index diese Felder als Token-Indexe definiert hat.`)
  }
  
  // Debug-Logging für Filter entfernt (Performance-Optimierung)
  // Filter wird nur noch bei Fehlern geloggt
  
  // Index-Status-Check entfernt: Wird bereits in config.chat geprüft, daher nicht zur Laufzeit nötig
  
  // Vector Search Aggregation Pipeline
  const pipeline: Document[] = [
    {
      $vectorSearch: {
        index: VECTOR_SEARCH_INDEX_NAME,
        path: 'embedding',
        queryVector: queryVector,
        numCandidates: topK > 100 
          ? Math.min(topK * 10, 1000) // Optimiert: 10x Multiplikator, max 1000 Kandidaten
          : Math.max(topK * 10, 100), // Konsistent 10x für alle Top-K Werte
        limit: topK,
        filter: vectorSearchFilter,
      },
    },
      {
        $project: {
          _id: 1,
          score: { $meta: 'vectorSearchScore' },
          libraryId: 1,
          user: 1,
          fileId: 1,
          fileName: 1,
          kind: 1,
          // Chunk-spezifische Felder
          chunkIndex: 1,
          text: 1,
          headingContext: 1,
          startChar: 1,
          endChar: 1,
          // Meta-Dokument-spezifische Felder
          title: 1,
          summary: 1,
          teaser: 1,
          chunkCount: 1,
          chaptersCount: 1,
          upsertedAt: 1,
          // Facetten-Metadaten
          year: 1,
          authors: 1,
          region: 1,
          docType: 1,
          source: 1,
          tags: 1,
          topics: 1,
          track: 1,
          speakers: 1,
          date: 1,
          shortTitle: 1,
        },
      },
  ]
  
  let results: Document[]
  try {
    results = await col.aggregate(pipeline).toArray()
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    // Prüfe, ob es ein Token-Index-Fehler ist
    if (errorMsg.includes('needs to be indexed as token')) {
      const fieldMatch = errorMsg.match(/Path '([^']+)' needs to be indexed as token/)
      const fieldName = fieldMatch ? fieldMatch[1] : 'unbekanntes Feld'
      
      // Prüfe Index-Status für zusätzliche Informationen
      let indexStatusInfo = ''
      try {
        const indexDef = await getVectorSearchIndexDefinition(libraryKey, dimension, library)
        if (indexDef) {
          indexStatusInfo = `\n\nIndex-Status: ${indexDef.status || 'unbekannt'}`
          if (indexDef.status === 'INITIAL_SYNC') {
            indexStatusInfo += '\n⚠️ Der Index wird gerade indiziert. Bitte warten Sie einige Minuten, bis die Indizierung abgeschlossen ist.'
          }
        } else {
          indexStatusInfo = '\n\n⚠️ Index-Definition konnte nicht abgerufen werden.'
        }
      } catch {
        // Ignoriere Fehler beim Abrufen des Index-Status
      }
      
      const helpfulMessage = `MongoDB Vector Search Index-Fehler: Das Feld '${fieldName}' benötigt einen Token-Index für Array-Filter.

Collection: ${libraryKey}
Index-Name: ${VECTOR_SEARCH_INDEX_NAME}${indexStatusInfo}

Lösung:
1. Prüfen Sie in MongoDB Atlas, ob der Index '${VECTOR_SEARCH_INDEX_NAME}' auf der Collection '${libraryKey}' existiert
2. Prüfen Sie, ob der Index-Status 'ACTIVE' ist (nicht 'INITIAL_SYNC')
3. Wenn der Index existiert, aber '${fieldName}' fehlt:
   - Löschen Sie den Index '${VECTOR_SEARCH_INDEX_NAME}' in MongoDB Atlas
   - Der Index wird beim nächsten Aufruf automatisch mit allen benötigten Token-Indexen neu erstellt
   ODER aktualisieren Sie den Index manuell und fügen Sie '${fieldName}' als Token-Index hinzu

Siehe: docs/mongodb-vector-search-index.md für Details.`
      
      console.error(`[vector-repo] ${helpfulMessage}`)
      FileLogger.error('vector-repo', 'Token-Index fehlt', {
        libraryKey,
        fieldName,
        error: errorMsg,
        indexStatus: indexStatusInfo,
      })
      
      throw new Error(helpfulMessage)
    }
    
    // Andere Fehler weiterwerfen
    throw error
  }

  return results.map(doc => {
    const score = typeof doc.score === 'number' ? doc.score : 0
    const kind = doc.kind ? String(doc.kind) : 'chunk'
    
    // Basis-Metadaten
    const metadata: Record<string, unknown> = {
      libraryId: String(doc.libraryId || ''),
      user: String(doc.user || ''),
      fileId: String(doc.fileId || ''),
      fileName: doc.fileName ? String(doc.fileName) : undefined,
      kind,
      upsertedAt: doc.upsertedAt ? String(doc.upsertedAt) : undefined,
      // Facetten-Metadaten
      year: typeof doc.year === 'number' ? doc.year : undefined,
      authors: Array.isArray(doc.authors) ? doc.authors.map(String) : undefined,
      region: doc.region ? String(doc.region) : undefined,
      docType: doc.docType ? String(doc.docType) : undefined,
      source: doc.source ? String(doc.source) : undefined,
      tags: Array.isArray(doc.tags) ? doc.tags.map(String) : undefined,
      topics: Array.isArray(doc.topics) ? doc.topics.map(String) : undefined,
      track: doc.track ? String(doc.track) : undefined,
      speakers: Array.isArray(doc.speakers) ? doc.speakers.map(String) : undefined,
      date: doc.date ? String(doc.date) : undefined,
      shortTitle: doc.shortTitle ? String(doc.shortTitle) : undefined,
    }
    
    // Chunk-spezifische Felder (nur für chunks/chapterSummary)
    if (kind === 'chunk' || kind === 'chapterSummary') {
      metadata.chunkIndex = typeof doc.chunkIndex === 'number' ? doc.chunkIndex : undefined
      metadata.text = doc.text ? String(doc.text) : undefined
      metadata.headingContext = doc.headingContext ? String(doc.headingContext) : undefined
      metadata.startChar = typeof doc.startChar === 'number' ? doc.startChar : undefined
      metadata.endChar = typeof doc.endChar === 'number' ? doc.endChar : undefined
    }
    
    // Meta-Dokument-spezifische Felder
    if (kind === 'meta') {
      metadata.title = doc.title ? String(doc.title) : undefined
      metadata.summary = doc.summary ? String(doc.summary) : undefined
      metadata.teaser = doc.teaser ? String(doc.teaser) : undefined
      metadata.chunkCount = typeof doc.chunkCount === 'number' ? doc.chunkCount : undefined
      metadata.chaptersCount = typeof doc.chaptersCount === 'number' ? doc.chaptersCount : undefined
    }
    
    // Entferne undefined-Werte
    Object.keys(metadata).forEach(key => {
      if (metadata[key] === undefined) {
        delete metadata[key]
      }
    })
    
    return {
      id: String(doc._id),
      score,
      metadata,
    }
  })
}

/**
 * Query Documents (Meta-Dokumente) mit Vector Search für globale Dokumentensuche.
 * 
 * @param libraryKey - Collection-Name für die Library
 * @param queryVector - Query-Vektor für Suche
 * @param topK - Anzahl der Ergebnisse
 * @param filter - MongoDB-Filter (libraryId, user, etc.)
 * @param dimension - Embedding-Dimension (optional)
 * @returns Array von Query-Matches (nur Meta-Dokumente)
 */
export async function queryDocuments(
  libraryKey: string,
  queryVector: number[],
  topK: number,
  filter: Record<string, unknown> = {},
  dimension: number,
  library: Library
): Promise<QueryMatch[]> {
  validateDimension(dimension)
  validateLibrary(library)
  
  return queryVectors(
    libraryKey,
    queryVector,
    topK,
    {
      ...filter,
      kind: 'meta', // Nur Meta-Dokumente
    },
    dimension,
    library
  )
}

/**
 * Konvertiert shortTitle-Filter zu File-IDs.
 * Sucht Dokumente mit dem angegebenen shortTitle und gibt deren fileIds zurück.
 * 
 * @param libraryKey Collection-Name für die Library
 * @param libraryId Library-ID
 * @param shortTitle shortTitle-Wert oder Array von Werten
 * @returns Array von File-IDs
 */
export async function convertShortTitleToFileIds(
  libraryKey: string,
  libraryId: string,
  shortTitle: string | string[]
): Promise<string[]> {
  const shortTitleArray = Array.isArray(shortTitle) ? shortTitle : [shortTitle]
  
  if (shortTitleArray.length === 0) {
    return []
  }
  
  const docs = await findDocs(
    libraryKey,
    libraryId,
    { shortTitle: shortTitleArray },
    {
      limit: 1000,
      sort: { upsertedAt: -1 },
    }
  )
  
  return docs.items
    .map(d => d.fileId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

/**
 * Löscht alle Vektoren für eine bestimmte FileID.
 * @param libraryKey Collection-Name
 * @param fileId File-ID
 */
export async function deleteVectorsByFileId(
  libraryKey: string,
  fileId: string
): Promise<void> {
  // Reine Delete-Operation - kein Index-Setup benötigt
  const col = await getCollectionOnly(libraryKey)
  
  await col.deleteMany({
    fileId,
  })
}

/**
 * Findet Meta-Dokumente (für Gallery-Anzeige).
 * @param libraryKey Collection-Name
 * @param libraryId Library-ID
 * @param filter MongoDB-Filter
 * @param options Query-Optionen
 * @returns Array von Meta-Dokumenten
 */
export async function findDocs(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  options: {
    limit?: number
    skip?: number
    sort?: Record<string, 1 | -1>
  } = {}
): Promise<{ items: Array<{
  id: string
  fileId: string
  fileName?: string
  title?: string
  shortTitle?: string
  authors?: string[]
  speakers?: string[]
  speakers_image_url?: string[]
  year?: number | string
  track?: string
  date?: string
  region?: string
  upsertedAt?: string
  docType?: string
  source?: string
  tags?: string[]
  slug?: string
  coverImageUrl?: string
  pages?: number
}>; total: number }> {
  // PERFORMANCE: Nutze direkt getCollection statt getVectorCollection, um Overhead (Dimension-Check, Index-Check) zu vermeiden
  const col = await getCollection<Document>(libraryKey)
  
  // PERFORMANCE: Erstelle Indexe für Gallery-Queries (nur einmal pro Collection)
  if (!ensuredIndexesForCollections.has(libraryKey)) {
    try {
      await Promise.all([
        // Index für kind + libraryId (häufigste Filter-Kombination)
        col.createIndex({ kind: 1, libraryId: 1 }, { name: 'kind_libraryId', background: true }),
        // Index für Sortierung nach year und upsertedAt
        col.createIndex({ year: -1, upsertedAt: -1 }, { name: 'year_upsertedAt_desc', background: true }),
        // Index für upsertedAt allein (für Sortierung ohne year)
        col.createIndex({ upsertedAt: -1 }, { name: 'upsertedAt_desc', background: true }),
      ])
      ensuredIndexesForCollections.add(libraryKey)
    } catch {
      // Indexe könnten bereits existieren, das ist OK
      ensuredIndexesForCollections.add(libraryKey)
    }
  }
  
  const query = {
    kind: 'meta',
    libraryId,
    ...filter,
  }
  
  const cursor = col.find(query, {
    projection: {
      _id: 0,
      fileId: 1,
      fileName: 1,
      title: 1,
      shortTitle: 1,
      year: 1,
      authors: 1,
      speakers: 1,
      speakers_image_url: 1,
      track: 1,
      date: 1,
      region: 1,
      docType: 1,
      source: 1,
      tags: 1,
      slug: 1,
      coverImageUrl: 1,
      upsertedAt: 1,
      // Aus docMetaJson falls vorhanden
      'docMetaJson.title': 1,
      'docMetaJson.shortTitle': 1,
      'docMetaJson.speakers': 1,
      'docMetaJson.track': 1,
      'docMetaJson.date': 1,
      'docMetaJson.speakers_image_url': 1,
      'docMetaJson.slug': 1,
      'docMetaJson.coverImageUrl': 1,
      'docMetaJson.pages': 1,
    },
  })
  
  if (options.sort) {
    cursor.sort(options.sort)
  }
  if (typeof options.skip === 'number') {
    cursor.skip(options.skip)
  }
  if (typeof options.limit === 'number') {
    cursor.limit(options.limit)
  }
  
  // PERFORMANCE: Parallelize countDocuments and find queries
  // Both queries use the same filter, so they can run in parallel
  const [rows, totalCount] = await Promise.all([
    cursor.toArray(),
    col.countDocuments(query)
  ])
  
  // Hilfsfunktion zum Konvertieren von speakers_image_url (kann Array oder String sein)
  const toStrArr = (v: unknown): string[] | undefined => {
    // Direktes Array
    if (Array.isArray(v)) {
      const arr = (v as Array<unknown>).map(x => {
        if (typeof x === 'string' && x.trim().length > 0) return x.trim()
        return ''
      }).filter(Boolean)
      return arr.length > 0 ? arr : undefined
    }
    
    // String der wie ein Array aussieht: "['url1', 'url2']" oder '["url1", "url2"]'
    if (typeof v === 'string' && v.trim().length > 0) {
      const trimmed = v.trim()
      
      // Versuche JSON-Array zu parsen
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
          (trimmed.startsWith("['") && trimmed.endsWith("']"))) {
        try {
          // Ersetze einfache Anführungszeichen durch doppelte für JSON.parse
          const jsonStr = trimmed.replace(/'/g, '"')
          const parsed = JSON.parse(jsonStr)
          if (Array.isArray(parsed)) {
            const arr = parsed.map(x => {
              if (typeof x === 'string' && x.trim().length > 0) return x.trim()
              return ''
            }).filter(Boolean)
            return arr.length > 0 ? arr : undefined
          }
        } catch {
          // Fehler beim Parsen, versuche manuell zu extrahieren
          const matches = trimmed.match(/(['"])((?:(?!\1).)*)\1/g)
          if (matches && matches.length > 0) {
            const arr = matches.map(m => m.slice(1, -1).trim()).filter(Boolean)
            return arr.length > 0 ? arr : undefined
          }
        }
      }
      
      // Einzelner String → als Array mit einem Element
      const singleStr = trimmed.length > 0 ? trimmed : undefined
      return singleStr ? [singleStr] : undefined
    }
    
    return undefined
  }

  return {
    items: rows.map(r => {
      const docMeta = r.docMetaJson && typeof r.docMetaJson === 'object' 
        ? r.docMetaJson as Record<string, unknown> 
        : undefined
      
      // speakers_image_url: Priorität: Top-Level > docMetaJson.speakers_image_url
      // Kann sowohl Array als auch String sein: "['url1', 'url2']" → ['url1', 'url2']
      const speakersImageUrlTopLevel = toStrArr(r.speakers_image_url)
      const speakersImageUrlDocMeta = docMeta ? toStrArr(docMeta.speakers_image_url) : undefined
      const speakersImageUrl = speakersImageUrlTopLevel || speakersImageUrlDocMeta
      
      return {
        id: `${r.fileId}-meta`,
        fileId: r.fileId,
        fileName: r.fileName,
        title: r.title || (docMeta?.title as string | undefined),
        shortTitle: r.shortTitle || (docMeta?.shortTitle as string | undefined),
        authors: Array.isArray(r.authors) ? r.authors : undefined,
        speakers: Array.isArray(r.speakers) 
          ? r.speakers 
          : (Array.isArray(docMeta?.speakers) ? docMeta.speakers as string[] : undefined),
        speakers_image_url: speakersImageUrl || undefined,
        year: (typeof r.year === 'number' || typeof r.year === 'string') ? r.year : undefined,
        track: r.track || (docMeta?.track as string | undefined),
        date: r.date || (docMeta?.date as string | undefined),
        region: typeof r.region === 'string' ? r.region : undefined,
        upsertedAt: typeof r.upsertedAt === 'string' ? r.upsertedAt : undefined,
        docType: typeof r.docType === 'string' ? r.docType : undefined,
        source: typeof r.source === 'string' ? r.source : undefined,
        tags: Array.isArray(r.tags) ? r.tags : undefined,
        slug: r.slug || (docMeta?.slug as string | undefined),
        coverImageUrl: r.coverImageUrl || (docMeta?.coverImageUrl as string | undefined),
        pages: (() => {
          const pagesValue = docMeta?.pages
          if (typeof pagesValue === 'number') return pagesValue
          if (typeof pagesValue === 'string') {
            const parsed = Number(pagesValue)
            return Number.isFinite(parsed) ? parsed : undefined
          }
          return undefined
        })(),
      }
    }),
    total: totalCount
  }
}

/**
 * Aggregiert Facetten-Werte aus Meta-Dokumenten.
 * @param libraryKey Collection-Name
 * @param libraryId Library-ID
 * @param filter MongoDB-Filter
 * @param defs Facetten-Definitionen
 * @returns Aggregierte Facetten-Werte
 */
export async function aggregateFacets(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  defs: Array<{ metaKey: string; type: string; label?: string }>
): Promise<Record<string, Array<{ value: string; count: number }>>> {
  // PERFORMANCE: Nutze direkt getCollection statt getVectorCollection, um Overhead (Dimension-Check, Index-Check) zu vermeiden
  const col = await getCollection<Document>(libraryKey)
  
  const match: Record<string, unknown> = {
    kind: 'meta', // Nur Meta-Dokumente!
    libraryId,
    ...filter,
  }
  
  const facetStages: Record<string, Document[]> = {}
  
  for (const d of defs) {
    const key = d.metaKey
    if (!key) continue
    
    const arr: Document[] = []
    // Null/fehlende ausschließen
    arr.push({ $match: { [key]: { $exists: true, $ne: null } } })
    
    if (d.type === 'string[]') {
      arr.push({ $unwind: `$${key}` })
    }
    
    arr.push({ $group: { _id: `$${key}`, count: { $sum: 1 } } })
    arr.push({ $sort: { _id: 1 } })
    
    facetStages[key] = arr
  }
  
  const pipeline: Document[] = [
    { $match: match },
    { $facet: facetStages },
  ]
  
  const [res] = await col.aggregate(pipeline).toArray()
  
  const out: Record<string, Array<{ value: string; count: number }>> = {}
  
  for (const d of defs) {
    const rows = Array.isArray(res?.[d.metaKey]) 
      ? res[d.metaKey] as Array<{ _id: unknown; count: number }> 
      : []
    
    out[d.metaKey] = rows
      .map(r => ({ value: String(r._id), count: Number(r.count) || 0 }))
      .filter(x => x.value.length > 0)
  }
  
  return out
}

/**
 * Holt Meta-Dokument nach FileID.
 * @param libraryKey Collection-Name
 * @param fileId File-ID
 * @returns Meta-Dokument oder null
 */
export async function getMetaByFileId(
  libraryKey: string,
  fileId: string
): Promise<VectorDocument | null> {
  // Reine Lese-Operation - kein Index-Setup benötigt
  const col = await getCollectionOnly(libraryKey)
  
  const doc = await col.findOne({
    _id: `${fileId}-meta`,
    kind: 'meta',
  } as Partial<Document>)
  
  return doc as VectorDocument | null
}

/**
 * Holt Meta-Dokumente nach FileIDs (für Kompatibilität mit doc-meta-repo).
 * @param libraryKey Collection-Name
 * @param libraryId Library-ID
 * @param fileIds Array von File-IDs
 * @returns Map von FileID zu VectorDocument
 */
export async function getByFileIds(
  libraryKey: string,
  libraryId: string,
  fileIds: string[]
): Promise<Map<string, VectorDocument>> {
  // Reine Lese-Operation - kein Index-Setup benötigt
  const col = await getCollectionOnly(libraryKey)
  
  const rows = await col.find(
    {
      kind: 'meta',
      libraryId,
      fileId: { $in: fileIds },
    },
    { projection: { _id: 0 } }
  ).toArray()
  
  const map = new Map<string, VectorDocument>()
  for (const r of rows) {
    const doc = r as unknown as VectorDocument
    if (doc.fileId) {
      map.set(doc.fileId, doc)
    }
  }
  return map
}

/**
 * Findet Dokument-Summaries (für Summary-Retriever).
 * @param libraryKey Collection-Name
 * @param libraryId Library-ID
 * @param filter MongoDB-Filter
 * @param options Query-Optionen
 * @param skipChapters Ob Chapters übersprungen werden sollen
 * @returns Array von Dokument-Summaries
 */
export async function findDocSummaries(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  options: {
    limit?: number
    skip?: number
    sort?: Record<string, 1 | -1>
  } = {},
  skipChapters: boolean = false
): Promise<Array<{
  fileId: string
  fileName?: string
  chaptersCount?: number
  chapters?: Array<{ title?: string; summary?: string }>
  docSummary?: string  // Für Rückwärtskompatibilität
  summary?: string      // Neues Feld
  teaser?: string       // Neues Feld
}>> {
  // Reine Lese-Operation - kein Index-Setup benötigt
  const col = await getCollectionOnly(libraryKey)
  
  const query: Record<string, unknown> = {
    kind: 'meta',
    libraryId,
    ...filter,
  }
  
  const projection: Record<string, 0 | 1> = {
    _id: 0,
    libraryId: 1,
    fileId: 1,
    fileName: 1,
    summary: 1,
    teaser: 1,
    'docMetaJson.summary': 1,
    'docMetaJson.teaser': 1,
  }
  
  if (!skipChapters) {
    projection.chaptersCount = 1
    projection.chapters = 1
  }
  
  const cursor = col.find(query, { projection })
  
  if (options.sort) {
    cursor.sort(options.sort)
  }
  if (typeof options.skip === 'number') {
    cursor.skip(options.skip)
  }
  if (typeof options.limit === 'number') {
    cursor.limit(options.limit)
  }
  
  const rows = await cursor.toArray()
  
  return rows.map(r => {
    const docMeta = r.docMetaJson && typeof r.docMetaJson === 'object'
      ? r.docMetaJson as Record<string, unknown>
      : undefined
    
    // Summary und Teaser aus Top-Level oder docMetaJson extrahieren
    const summary = r.summary || (docMeta?.summary as string | undefined)
    const teaser = r.teaser || (docMeta?.teaser as string | undefined)
    
    const rawChapters = r.chapters
    const chaptersArr = Array.isArray(rawChapters)
      ? (rawChapters as Array<unknown>).map(c => {
          const o = c && typeof c === 'object' ? c as Record<string, unknown> : {}
          return {
            title: typeof o.title === 'string' ? o.title : undefined,
            summary: typeof o.summary === 'string' ? o.summary : undefined,
          }
        })
      : undefined
    
    return {
      fileId: r.fileId,
      fileName: r.fileName,
      chaptersCount: typeof r.chaptersCount === 'number' ? r.chaptersCount : undefined,
      chapters: chaptersArr,
      docSummary: summary, // Für Rückwärtskompatibilität
      summary, // Neues Feld
      teaser, // Neues Feld
    }
  })
}

/**
 * Summiert die chunkCount aller gefilterten Meta-Dokumente.
 * @param libraryKey Collection-Name
 * @param filter MongoDB-Filter
 * @returns Summe aller chunkCount-Werte und Anzahl der Dokumente
 */
export async function sumChunkCounts(
  libraryKey: string,
  filter: Record<string, unknown>
): Promise<{ totalChunks: number; docCount: number }> {
  // Reine Lese-Operation - kein Index-Setup benötigt
  const col = await getCollectionOnly(libraryKey)
  
  const query: Record<string, unknown> = {
    kind: 'meta',
    ...filter,
  }
  
  const cursor = col.find(query, {
    projection: {
      _id: 0,
      chunkCount: 1,
    },
  })
  
  const rows = await cursor.toArray()
  
  let totalChunks = 0
  let docCount = 0
  
  for (const r of rows) {
    docCount++
    const chunkCount = typeof r.chunkCount === 'number' ? r.chunkCount : 0
    totalChunks += chunkCount
  }
  
  return { totalChunks, docCount }
}

/**
 * Erstellt Facetten-Indizes für Meta-Dokumente.
 * @param libraryKey Collection-Name
 * @param defs Facetten-Definitionen
 */
export async function ensureFacetIndexes(libraryKey: string, defs: FacetDef[]): Promise<void> {
  // Facetten-Indizes erstellen - kein Vector Search Index-Setup benötigt
  const col = await getCollectionOnly(libraryKey)
  const jobs: Array<Promise<string | void>> = []
  
  // Prüfe existierende Indizes einmal (für Performance)
  const existingIndexes = await col.listIndexes().toArray()
  const existingIndexNames = new Set(existingIndexes.map((idx: { name: string }) => idx.name))
  
  for (const d of defs) {
    const key = d.metaKey
    if (!key) continue
    
    const idxName = `facet_${key}`
    const cacheKey = `${libraryKey}::${idxName}`
    
    // Prüfe Cache UND MongoDB
    if (ensuredIndexKeys.has(cacheKey)) continue
    if (existingIndexNames.has(idxName)) {
      ensuredIndexKeys.add(cacheKey) // Index existiert bereits in MongoDB
      continue
    }
    
    // Index nur auf Meta-Dokumente (kind: 'meta')
    jobs.push(
      col.createIndex(
        { kind: 1, [key]: 1 },
        { name: idxName, partialFilterExpression: { kind: 'meta' } }
      )
        .then(() => {
          ensuredIndexKeys.add(cacheKey) // Erst nach erfolgreicher Erstellung
        })
        .catch((error: unknown) => {
          // Wenn Index bereits existiert (z.B. durch Race Condition), Cache trotzdem setzen
          const mongoError = error as { code?: number; codeName?: string }
          if (mongoError.code === 85 || mongoError.codeName === 'IndexOptionsConflict') {
            ensuredIndexKeys.add(cacheKey)
          }
          // Andere Fehler ignorieren (werden beim nächsten Aufruf erneut versucht)
        })
    )
  }
  
  await Promise.all(jobs)
}

/**
 * Findet Vektoren nach Filter (ohne Vector Search, für Validierung/Admin-Zwecke).
 * @param libraryKey Collection-Name
 * @param filter MongoDB-Filter
 * @param limit Maximale Anzahl der Ergebnisse
 * @returns Array von Vector-Dokumenten
 */
export async function findVectorsByFilter(
  libraryKey: string,
  filter: Record<string, unknown>,
  limit: number = 100
): Promise<VectorDocument[]> {
  // Reine Lese-Operation - kein Index-Setup benötigt
  const col = await getCollectionOnly(libraryKey)
  
  const cursor = col.find(filter, {
    limit,
    projection: {
      _id: 1,
      kind: 1,
      libraryId: 1,
      user: 1,
      fileId: 1,
      fileName: 1,
      chunkIndex: 1,
      text: 1,
      embedding: 1,
      headingContext: 1,
      startChar: 1,
      endChar: 1,
      upsertedAt: 1,
      // Facetten-Metadaten
      year: 1,
      authors: 1,
      region: 1,
      docType: 1,
      source: 1,
      tags: 1,
      topics: 1,
      track: 1,
      speakers: 1,
      date: 1,
      shortTitle: 1,
    },
  })
  
  const rows = await cursor.toArray()
  return rows as unknown as VectorDocument[]
}

/**
 * Alias für getVectorCollectionName für Kompatibilität.
 * WICHTIG: Diese Funktion wirft einen Fehler, wenn collectionName nicht in Config vorhanden ist.
 * Für Client-Verwendung mit Fallback siehe getCollectionNameForLibrary() in vector-search-index.ts
 * @param library Die Library mit Config
 * @returns Der Collection-Name
 * @throws Error wenn collectionName nicht in Config vorhanden ist
 */
export function getCollectionNameForLibrary(library: Library): string {
  return getVectorCollectionName(library)
}

