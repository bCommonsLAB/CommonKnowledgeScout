/**
 * @fileoverview Queries Repository - MongoDB Repository for Query Logging
 * 
 * @description
 * Repository for managing query logs in MongoDB. Handles CRUD operations for query logs,
 * supports retrieval step appending, partial updates, and query listing. Provides optimized
 * indexes for query retrieval by library, user, session, and chat. Supports both
 * authenticated and anonymous users.
 * 
 * @module chat
 * 
 * @exports
 * - insertQueryLog: Creates a new query log entry
 * - appendRetrievalStep: Appends a retrieval step to a query log
 * - updateQueryLogPartial: Updates query log fields partially
 * - getQueryLogById: Retrieves a query log by ID
 * - listRecentQueries: Lists recent queries with filtering
 * 
 * @usedIn
 * - src/app/api/chat: Chat API routes use repository
 * - src/lib/chat: Chat modules use repository for logging
 * - src/lib/logging/query-logger.ts: Query logger uses repository
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB connection and collection access
 * - @/types/query-log: QueryLog type definitions
 * - mongodb: MongoDB driver types
 * - crypto: UUID generation
 */

import { getCollection } from '@/lib/mongodb-service'
import crypto from 'crypto'
import type { Collection, UpdateFilter } from 'mongodb'
import type { QueryLog, QueryRetrievalStep } from '@/types/query-log'
import { createCacheHash } from '@/lib/chat/utils/cache-key-utils'
import { facetsSelectedToMongoFilter } from '@/lib/chat/common/filters'
import { computeDocMetaCollectionName, getDocMetaCollection } from '@/lib/repositories/doc-meta-repo'
import { findLibraryOwnerEmail } from '@/lib/chat/loader'

const COLLECTION_NAME = 'queries'

/**
 * Ermittelt die Anzahl der Dokumente in einer Library (GESAMT, ohne Filter)
 * 
 * @param libraryId - ID der Library
 * @param userEmail - E-Mail des Benutzers (optional, wird für Collection-Key benötigt)
 * @returns Anzahl aller Dokumente in der Library (ohne Filter)
 */
export async function getDocumentCount(libraryId: string, userEmail?: string): Promise<number> {
  try {
    // Wenn keine userEmail vorhanden ist, versuche die Owner-Email zu finden
    let effectiveUserEmail = userEmail
    if (!effectiveUserEmail) {
      effectiveUserEmail = await findLibraryOwnerEmail(libraryId) || undefined
    }
    
    // Wenn immer noch keine Email vorhanden ist, verwende leeren String (für öffentliche Libraries)
    const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
    const libraryKey = computeDocMetaCollectionName(effectiveUserEmail || '', libraryId, strategy)
    const col = await getDocMetaCollection(libraryKey)
    
    // Zähle alle Dokumente in der Collection (ohne Filter)
    return await col.countDocuments({})
  } catch (error) {
    // Bei Fehler: Logge und verwende 0 (Cache wird dann nicht invalidiert)
    console.error('[queries-repo] Fehler beim Ermitteln der Dokumentenanzahl:', error)
    return 0
  }
}

/**
 * Ermittelt die Anzahl der gefilterten Dokumente in einer Library
 * 
 * WICHTIG: Diese Funktion zählt nur die Dokumente, die den angegebenen Filtern entsprechen.
 * Sie wird für den Cache-Hash verwendet, um sicherzustellen, dass der Cache invalidiert wird,
 * wenn neue Dokumente hinzugefügt werden, die zu den Filtern passen.
 * 
 * @param libraryId - ID der Library
 * @param filter - MongoDB-Filter für Dokumente (z.B. { track: { $in: ['Community track'] } })
 * @param userEmail - E-Mail des Benutzers (optional, wird für Collection-Key benötigt)
 * @returns Anzahl der gefilterten Dokumente
 */
export async function getFilteredDocumentCount(
  libraryId: string,
  filter: Record<string, unknown>,
  userEmail?: string
): Promise<number> {
  try {
    // Wenn keine userEmail vorhanden ist, versuche die Owner-Email zu finden
    let effectiveUserEmail = userEmail
    if (!effectiveUserEmail) {
      effectiveUserEmail = await findLibraryOwnerEmail(libraryId) || undefined
    }
    
    // Wenn immer noch keine Email vorhanden ist, verwende leeren String (für öffentliche Libraries)
    const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
    const libraryKey = computeDocMetaCollectionName(effectiveUserEmail || '', libraryId, strategy)
    const col = await getDocMetaCollection(libraryKey)
    
    // Zähle gefilterte Dokumente
    // Wenn kein Filter vorhanden ist, zähle alle Dokumente
    const filterQuery = Object.keys(filter).length > 0 ? filter : {}
    return await col.countDocuments(filterQuery)
  } catch (error) {
    // Bei Fehler: Logge und verwende 0 (Cache wird dann nicht invalidiert)
    console.error('[queries-repo] Fehler beim Ermitteln der gefilterten Dokumentenanzahl:', error)
    return 0
  }
}

async function getQueriesCollection(): Promise<Collection<QueryLog>> {
  const col = await getCollection<QueryLog>(COLLECTION_NAME)
  try {
    await Promise.all([
      // Basis-Indexe
      col.createIndex({ queryId: 1 }, { unique: true, name: 'queryId_unique' }),
      col.createIndex({ libraryId: 1, createdAt: -1 }, { name: 'library_createdAt_desc' }),
      col.createIndex({ userEmail: 1, createdAt: -1 }, { name: 'user_createdAt_desc' }),
      col.createIndex({ sessionId: 1, createdAt: -1 }, { name: 'sessionId_createdAt_desc' }),
      col.createIndex({ chatId: 1, createdAt: -1 }, { name: 'chatId_createdAt_desc' }),
      
      // Hash-basierte Indexe für schnelle Cache-Lookups
      // Diese werden von findQueryByQuestionAndContext verwendet
      col.createIndex(
        { cacheHash: 1, libraryId: 1, userEmail: 1 },
        { 
          name: 'cache_hash_user',
          partialFilterExpression: { userEmail: { $exists: true }, cacheHash: { $exists: true } }
        }
      ),
      col.createIndex(
        { cacheHash: 1, libraryId: 1, sessionId: 1 },
        { 
          name: 'cache_hash_session',
          partialFilterExpression: { sessionId: { $exists: true }, cacheHash: { $exists: true } }
        }
      ),
    ])
  } catch {}
  return col
}

export async function insertQueryLog(doc: Omit<QueryLog, 'createdAt' | 'status' | 'queryId'> & Partial<Pick<QueryLog, 'queryId' | 'status'>>): Promise<string> {
  const col = await getQueriesCollection()
  const queryId = doc.queryId || crypto.randomUUID()
  
  // Validierung: Entweder userEmail ODER sessionId muss vorhanden sein
  if (!doc.userEmail && !doc.sessionId) {
    throw new Error('Entweder userEmail oder sessionId muss angegeben werden')
  }
  
  // Ermittle gefilterte Dokumentenanzahl für Cache-Hash
  // WICHTIG: Verwende gefilterte Anzahl, da die Filter Teil des Cache-Kontexts sind
  // Die gefilterte Anzahl wird verwendet, um den Cache zu invalidierten, wenn neue Dokumente hinzugefügt werden,
  // die zu den Filtern passen
  // Konvertiere facetsSelected zu MongoDB-Filter-Format (mappt shortTitle zu docMetaJson.shortTitle)
  const mongoFilter = facetsSelectedToMongoFilter(doc.facetsSelected)
  const documentCount = await getFilteredDocumentCount(doc.libraryId, mongoFilter, doc.userEmail)
  
  // Normalisiere Retriever für Cache-Hash: chunkSummary → chunk (konsistent mit Suchen)
  // Beim Suchen wird chunkSummary zu 'chunk' konvertiert, daher müssen wir das auch beim Speichern tun
  const retrieverForCache = doc.retriever === 'chunkSummary' ? 'chunk' : doc.retriever
  
  // Erstelle cacheParams-Objekt für einfaches Debugging (kann einfach kopiert werden)
  const cacheParams: import('@/types/query-log').CacheParams = {
    libraryId: doc.libraryId,
    question: doc.question,
    queryType: doc.queryType || 'question',
    answerLength: doc.answerLength, // Antwortlänge-Parameter (Teil des Cache-Hashes)
    targetLanguage: doc.targetLanguage,
    character: doc.character,
    accessPerspective: doc.accessPerspective,
    socialContext: doc.socialContext,
    genderInclusive: doc.genderInclusive,
    retriever: retrieverForCache,
    facetsSelected: doc.facetsSelected,
    documentCount,
  }
  
  // Berechne cacheHash für schnelle Cache-Lookups
  const cacheHash = createCacheHash(cacheParams)
  
  // Debug-Logging: Zeige berechneten Hash beim Speichern
  console.log('[insertQueryLog] Cache-Hash berechnet:', {
    cacheHash,
    libraryId: doc.libraryId,
    question: doc.question.substring(0, 50),
    queryType: doc.queryType || 'question',
    documentCount,
    userEmail: doc.userEmail?.substring(0, 20),
  })
  
  const payload: QueryLog = {
    queryId,
    chatId: doc.chatId, // Required: chatId muss angegeben werden
    createdAt: new Date(),
    status: doc.status || 'pending',
    libraryId: doc.libraryId, // Bleibt in Root, da für Datenbank-Queries benötigt
    userEmail: doc.userEmail,
    sessionId: doc.sessionId,
    question: doc.question, // Bleibt in Root, da für Datenbank-Queries benötigt
    mode: doc.mode,
    // Cache-relevante Felder werden NICHT mehr in Root gespeichert (nur in cacheParams):
    // queryType, answerLength, retriever, targetLanguage, character, accessPerspective, socialContext, genderInclusive, facetsSelected
    filtersNormalized: doc.filtersNormalized,
    filtersPinecone: doc.filtersPinecone,
    retrieval: Array.isArray(doc.retrieval) ? doc.retrieval : [],
    prompt: doc.prompt,
    answer: doc.answer,
    references: doc.references,
    suggestedQuestions: doc.suggestedQuestions,
    sources: doc.sources,
    timing: doc.timing,
    tokenUsage: doc.tokenUsage,
    error: doc.error,
    questionAnalysis: doc.questionAnalysis,
    storyTopicsData: doc.storyTopicsData, // Strukturierte Themenübersicht für TOC-Queries
    processingLogs: Array.isArray(doc.processingLogs) ? doc.processingLogs : undefined,
    cacheHash, // SHA-256 Hash für schnelle Cache-Lookups
    cacheParams, // Cache-Parameter zusammengefasst (für einfaches Debugging)
  }
  await col.insertOne(payload)
  return queryId
}

export async function appendRetrievalStep(queryId: string, step: QueryRetrievalStep): Promise<void> {
  const col = await getQueriesCollection()
  const update: UpdateFilter<QueryLog> = { $push: { retrieval: step } }
  await col.updateOne({ queryId }, update)
}

export async function updateQueryLogPartial(queryId: string, updateFields: Partial<QueryLog>): Promise<void> {
  const col = await getQueriesCollection()
  // queryId/createdAt nie überschreiben
  const rest: Partial<QueryLog> = { ...updateFields }
  delete (rest as Record<string, unknown>)['queryId']
  delete (rest as Record<string, unknown>)['createdAt']
  const update: UpdateFilter<QueryLog> = { $set: rest as Record<string, unknown> }
  await col.updateOne({ queryId }, update)
}

export async function getQueryLogById(args: { libraryId: string; queryId: string; userEmail?: string; sessionId?: string }): Promise<QueryLog | null> {
  const col = await getQueriesCollection()
  const filter: Record<string, unknown> = { queryId: args.queryId, libraryId: args.libraryId }
  
  if (args.userEmail) {
    filter.userEmail = args.userEmail
  } else if (args.sessionId) {
    filter.sessionId = args.sessionId
  } else {
    throw new Error('Entweder userEmail oder sessionId muss angegeben werden')
  }
  
  return await col.findOne(filter)
}


export async function listRecentQueries(args: { libraryId: string; userEmail?: string; sessionId?: string; chatId?: string; limit?: number }): Promise<Array<Pick<QueryLog, 'queryId' | 'createdAt' | 'question' | 'mode' | 'status' | 'answer' | 'references' | 'suggestedQuestions' | 'answerLength' | 'retriever' | 'targetLanguage' | 'character' | 'socialContext' | 'processingLogs'>>> {
  const col = await getQueriesCollection()
  const lim = Math.max(1, Math.min(100, Number(args.limit ?? 20)))
  
  // Filter: Wenn chatId angegeben, filtere danach; sonst filtere nach libraryId
  const filter: Record<string, unknown> = {}
  
  if (args.userEmail) {
    filter.userEmail = args.userEmail
  } else if (args.sessionId) {
    filter.sessionId = args.sessionId
  } else {
    throw new Error('Entweder userEmail oder sessionId muss angegeben werden')
  }
  
  if (args.chatId) {
    filter.chatId = args.chatId
  } else {
    filter.libraryId = args.libraryId
  }
  
  // Lade auch cacheParams, um Felder zu extrahieren
  const cursor = col
    .find(filter, { projection: { _id: 0, queryId: 1, createdAt: 1, question: 1, mode: 1, status: 1, answer: 1, references: 1, suggestedQuestions: 1, answerLength: 1, retriever: 1, targetLanguage: 1, character: 1, socialContext: 1, processingLogs: 1, cacheParams: 1 } })
    .sort({ createdAt: -1 })
    .limit(lim)
  const rows = await cursor.toArray()
  // Erzwinge den erwarteten Teiltyp per Mapping, um Driver-Document zu eliminieren
  // Extrahiere Felder aus cacheParams, falls vorhanden (für neue Einträge)
  return rows.map(r => ({
    queryId: r.queryId,
    createdAt: r.createdAt,
    question: r.question,
    mode: r.mode,
    status: r.status,
    answer: r.answer,
    references: r.references,
    suggestedQuestions: r.suggestedQuestions,
    // Verwende cacheParams, falls vorhanden (neue Einträge), sonst Root-Felder (alte Einträge für Rückwärtskompatibilität)
    answerLength: r.cacheParams?.answerLength ?? r.answerLength,
    retriever: r.cacheParams?.retriever ?? r.retriever,
    targetLanguage: r.cacheParams?.targetLanguage ?? r.targetLanguage,
    character: r.cacheParams?.character ?? r.character,
    socialContext: r.cacheParams?.socialContext ?? r.socialContext,
    processingLogs: r.processingLogs,
  }))
}

/**
 * Löscht ein Query-Dokument
 * 
 * @param queryId Query-ID
 * @param userEmail E-Mail-Adresse des Benutzers (für Sicherheit)
 * @param sessionId Session-ID für anonyme Nutzer
 * @param libraryId Optional: Library-ID für Owner-Berechtigung (wenn gesetzt, wird nur libraryId geprüft, nicht userEmail/sessionId)
 * @returns true, wenn Query gelöscht wurde, false wenn nicht gefunden
 */
export async function deleteQueryLog(queryId: string, userEmail?: string, sessionId?: string, libraryId?: string): Promise<boolean> {
  const col = await getQueriesCollection()
  const filter: Record<string, unknown> = { queryId }
  
  // Wenn libraryId gesetzt ist (für Owner-Berechtigung), prüfe nur libraryId
  if (libraryId) {
    filter.libraryId = libraryId
  } else {
    // Normale Löschung: Prüfe userEmail oder sessionId
    if (userEmail) {
      filter.userEmail = userEmail
    } else if (sessionId) {
      filter.sessionId = sessionId
    } else {
      throw new Error('Entweder userEmail oder sessionId muss angegeben werden (oder libraryId für Owner-Berechtigung)')
    }
  }
  
  const result = await col.deleteOne(filter)
  return result.deletedCount > 0
}


/**
 * Sucht nach einer bestehenden Query mit spezifischer Frage und Kontext-Parametern
 * 
 * Verwendet Hash-basierte Suche für optimale Performance. Berechnet einen Hash aus
 * allen Cache-relevanten Parametern und sucht direkt nach diesem Hash in der Datenbank.
 * 
 * @param args Parameter für die Suche
 * @returns QueryLog mit Antwort, oder null wenn nicht gefunden
 */
export async function findQueryByQuestionAndContext(args: {
  libraryId: string
  userEmail?: string
  sessionId?: string
  question: string
  answerLength?: string // Optional: Antwortlänge-Parameter (Teil des Cache-Hashes)
  targetLanguage?: string
  character?: import('@/lib/chat/constants').Character[] // Array (kann leer sein)
  accessPerspective?: import('@/lib/chat/constants').AccessPerspective[] // Array (kann leer sein)
  socialContext?: string
  genderInclusive?: boolean
  retriever?: string
  queryType?: 'toc' | 'question' // Optional: Filter nach Query-Typ
  facetsSelected?: Record<string, unknown> // Optional: Filter nach Facetten
}): Promise<QueryLog | null> {
  const col = await getQueriesCollection()
  
  // Validierung: Entweder userEmail ODER sessionId muss vorhanden sein
  if (!args.userEmail && !args.sessionId) {
    throw new Error('Entweder userEmail oder sessionId muss angegeben werden')
  }
  
  // Ermittle gefilterte Dokumentenanzahl für Cache-Hash
  // WICHTIG: Verwende gefilterte Anzahl, da die Filter Teil des Cache-Kontexts sind
  // Die gefilterte Anzahl wird verwendet, um den Cache zu invalidierten, wenn neue Dokumente hinzugefügt werden,
  // die zu den Filtern passen
  // Konvertiere facetsSelected zu MongoDB-Filter-Format (mappt shortTitle zu docMetaJson.shortTitle)
  const mongoFilter = facetsSelectedToMongoFilter(args.facetsSelected)
  const documentCount = await getFilteredDocumentCount(args.libraryId, mongoFilter, args.userEmail)
  
  // Berechne Hash aus allen Cache-relevanten Parametern
  // WICHTIG: queryType muss konsistent sein - wenn undefined, verwende 'question' als Default
  const cacheHash = createCacheHash({
    libraryId: args.libraryId,
    question: args.question,
    queryType: args.queryType || 'question', // Default: 'question', konsistent mit insertQueryLog
    answerLength: args.answerLength, // Antwortlänge-Parameter (Teil des Cache-Hashes)
    targetLanguage: args.targetLanguage,
    character: args.character,
    accessPerspective: args.accessPerspective,
    socialContext: args.socialContext,
    genderInclusive: args.genderInclusive,
    retriever: args.retriever,
    facetsSelected: args.facetsSelected,
    documentCount,
  })
  
  // Debug-Logging: Zeige berechneten Hash und Parameter
  console.log('[findQueryByQuestionAndContext] Cache-Suche:', {
    cacheHash,
    libraryId: args.libraryId,
    question: args.question.substring(0, 50),
    queryType: args.queryType || 'question',
    documentCount,
    userEmail: args.userEmail?.substring(0, 20),
    sessionId: args.sessionId?.substring(0, 20),
  })
  
  // Suche direkt nach Hash + libraryId + userEmail/sessionId
  // Prüfe, ob answer oder storyTopicsData vorhanden ist
  const filter: Record<string, unknown> = {
    cacheHash,
    libraryId: args.libraryId,
    status: { $in: ['ok', 'pending'] }, // Auch pending Queries, falls sie bereits eine Antwort haben
    $or: [
      { answer: { $exists: true, $nin: ['', null] } },
      { storyTopicsData: { $exists: true, $ne: null } }
    ],
  }
  
  if (args.userEmail) {
    filter.userEmail = args.userEmail
  } else {
    filter.sessionId = args.sessionId
  }
  
  // Suche nach der neuesten passenden Query (sortiert nach createdAt)
  const cachedQuery = await col.findOne(filter, { sort: { createdAt: -1 } })
  
  // Debug-Logging: Zeige Ergebnis
  if (cachedQuery) {
    console.log('[findQueryByQuestionAndContext] Cache gefunden:', {
      queryId: cachedQuery.queryId,
      cachedHash: cachedQuery.cacheHash,
      hasAnswer: !!cachedQuery.answer,
      hasStoryTopicsData: !!cachedQuery.storyTopicsData,
    })
  } else {
    console.log('[findQueryByQuestionAndContext] Cache NICHT gefunden')
    // Suche auch ohne Hash, um zu sehen, ob es andere Queries gibt
    const alternativeFilter: Record<string, unknown> = {
      libraryId: args.libraryId,
      question: args.question.trim(),
      status: { $in: ['ok', 'pending'] },
      $or: [
        { answer: { $exists: true, $nin: ['', null] } },
        { storyTopicsData: { $exists: true, $ne: null } }
      ],
    }
    if (args.userEmail) {
      alternativeFilter.userEmail = args.userEmail
    } else {
      alternativeFilter.sessionId = args.sessionId
    }
    const alternativeQuery = await col.findOne(alternativeFilter, { sort: { createdAt: -1 } })
    if (alternativeQuery) {
      console.log('[findQueryByQuestionAndContext] Alternative Query gefunden (ohne Hash):', {
        queryId: alternativeQuery.queryId,
        cachedHash: alternativeQuery.cacheHash,
        calculatedHash: cacheHash,
        hashMatch: alternativeQuery.cacheHash === cacheHash,
      })
    }
  }
  
  return cachedQuery || null
}




