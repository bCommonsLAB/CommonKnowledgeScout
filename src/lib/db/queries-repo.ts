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
import { buildCacheHashParams } from '@/lib/chat/utils/cache-hash-builder'
import type { Library } from '@/types/library'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import { loadLibraryChatContext } from '@/lib/chat/loader'

const COLLECTION_NAME = 'queries'

/**
 * Input-Typ für insertQueryLog
 *
 * NOTE:
 * - `llmModel` gehört NICHT in den Root von QueryLog (Sicherheits-/Konsistenz-Regel),
 *   muss aber für die Cache-Hash-Berechnung bekannt sein und wird ausschließlich in `cacheParams` persistiert.
 */
interface InsertQueryLogInput
  extends Omit<QueryLog, 'createdAt' | 'status' | 'queryId' | 'cacheParams'>,
    Partial<Pick<QueryLog, 'queryId' | 'status'>> {
  llmModel?: string
}

/**
 * Ermittelt die Anzahl der Dokumente in einer Library (GESAMT, ohne Filter)
 * 
 * @param library - Die Library (mit Config)
 * @returns Anzahl aller Dokumente in der Library (ohne Filter)
 */
export async function getDocumentCount(library: Library): Promise<number> {
  try {
    const libraryKey = getCollectionNameForLibrary(library)
    const col = await getCollectionOnly(libraryKey)
    
    // Zähle nur Meta-Dokumente (kind: 'meta') in der Collection
    return await col.countDocuments({ kind: 'meta' })
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
 * @param library - Die Library (mit Config)
 * @param filter - MongoDB-Filter für Dokumente (z.B. { track: { $in: ['Community track'] } })
 * @returns Anzahl der gefilterten Dokumente
 */
export async function getFilteredDocumentCount(
  libraryOrId: Library | string,
  filter: Record<string, unknown>
): Promise<number> {
  try {
    let libraryKey: string;
    if (typeof libraryOrId === 'string') {
      // Wenn libraryId übergeben wurde, verwende sie direkt als Collection-Name
      // (getCollectionNameForLibrary verwendet nur library.id und library.config?.chat?.vectorStore?.collectionName)
      libraryKey = libraryOrId;
    } else {
      libraryKey = getCollectionNameForLibrary(libraryOrId);
    }
    const col = await getCollectionOnly(libraryKey)
    
    // Zähle gefilterte Meta-Dokumente (kind: 'meta')
    // Wenn kein Filter vorhanden ist, zähle alle Meta-Dokumente
    const filterQuery: Record<string, unknown> = { kind: 'meta' }
    if (Object.keys(filter).length > 0) {
      Object.assign(filterQuery, filter)
    }
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

export async function insertQueryLog(doc: InsertQueryLogInput): Promise<string> {
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
  // Ermittle Library für korrekte Collection-Name-Konvertierung (falls documentCount nicht vorhanden)
  // Wenn documentCount bereits übergeben wurde (z.B. aus stream/route.ts), verwende diesen
  // Ansonsten lade Library und berechne documentCount (für korrekte Collection-Name-Konvertierung)
  let libraryForCache: Library | undefined = undefined
  const providedDocumentCount = (doc as { documentCount?: number }).documentCount
  
  if (providedDocumentCount === undefined) {
    // Lade Library für korrekte Collection-Name-Konvertierung
    const userEmail = doc.userEmail || doc.sessionId || ''
    const libraryContext = await loadLibraryChatContext(userEmail, doc.libraryId)
    if (libraryContext) {
      libraryForCache = libraryContext.library
    }
  }
  
  // Verwende zentrale Funktion für Cache-Hash-Berechnung
  const cacheHashParams = await buildCacheHashParams({
    libraryId: doc.libraryId,
    question: doc.question,
    queryType: doc.queryType,
    answerLength: doc.answerLength,
    targetLanguage: doc.targetLanguage,
    character: doc.character,
    accessPerspective: doc.accessPerspective,
    socialContext: doc.socialContext,
    genderInclusive: doc.genderInclusive,
    retriever: doc.retriever,
    facetsSelected: doc.facetsSelected,
    documentCount: providedDocumentCount,
    library: libraryForCache, // Verwende Library-Objekt für DocumentCount-Berechnung (falls documentCount nicht vorhanden)
    // WICHTIG: llmModel ist Teil des Cache-Kontexts (wird NICHT als Root-Feld gespeichert).
    // Damit Cache-Hash und Cache-Parameter konsistent sind, muss es bei der Berechnung hier bekannt sein.
    llmModel: doc.llmModel,
  })
  
  // Erstelle cacheParams-Objekt für einfaches Debugging (kann einfach kopiert werden)
  const cacheParams: import('@/types/query-log').CacheParams = {
    libraryId: cacheHashParams.libraryId,
    question: cacheHashParams.question,
    queryType: cacheHashParams.queryType || 'question',
    answerLength: cacheHashParams.answerLength as import('@/lib/chat/constants').AnswerLength | undefined,
    targetLanguage: cacheHashParams.targetLanguage as import('@/lib/chat/constants').TargetLanguage | undefined,
    character: cacheHashParams.character,
    accessPerspective: cacheHashParams.accessPerspective,
    socialContext: cacheHashParams.socialContext as import('@/lib/chat/constants').SocialContext | undefined,
    genderInclusive: cacheHashParams.genderInclusive,
    retriever: cacheHashParams.retriever as import('@/lib/chat/constants').Retriever | undefined,
    facetsSelected: cacheHashParams.facetsSelected,
    documentCount: cacheHashParams.documentCount,
    // Speichere llmModel nur als string; vermeide null/'' für saubere Debug-Ausgaben.
    llmModel: cacheHashParams.llmModel || undefined,
  }
  
  // Berechne cacheHash für schnelle Cache-Lookups
  const cacheHash = createCacheHash(cacheHashParams)
  
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
  llmModel?: string // Optional: LLM-Modell-ID (Teil des Cache-Hashes)
}): Promise<QueryLog | null> {
  const col = await getQueriesCollection()
  
  // NOTE: userEmail und sessionId werden nicht mehr für Cache-Suche verwendet
  // Cache ist benutzerübergreifend und basiert nur auf cacheHash + libraryId
  
  // Ermittle gefilterte Dokumentenanzahl für Cache-Hash
  // WICHTIG: Verwende gefilterte Anzahl, da die Filter Teil des Cache-Kontexts sind
  // Die gefilterte Anzahl wird verwendet, um den Cache zu invalidierten, wenn neue Dokumente hinzugefügt werden,
  // die zu den Filtern passen
  // WICHTIG: Lade Library, um korrekten Collection-Namen zu verwenden (konsistent mit Speichern)
  // Verwende userEmail oder sessionId für Library-Loading (falls vorhanden), sonst leere String
  const libraryContext = await loadLibraryChatContext(args.userEmail || args.sessionId || '', args.libraryId)
  if (!libraryContext) {
    console.error('[findQueryByQuestionAndContext] Library nicht gefunden:', args.libraryId)
    return null
  }
  
  // Verwende zentrale Funktion für Cache-Hash-Berechnung
  const cacheHashParams = await buildCacheHashParams({
    libraryId: args.libraryId,
    question: args.question,
    queryType: args.queryType,
    answerLength: args.answerLength,
    targetLanguage: args.targetLanguage,
    character: args.character,
    accessPerspective: args.accessPerspective,
    socialContext: args.socialContext,
    genderInclusive: args.genderInclusive,
    retriever: args.retriever,
    facetsSelected: args.facetsSelected,
    llmModel: args.llmModel,
    library: libraryContext.library, // Verwende Library-Objekt für DocumentCount-Berechnung
  })
  
  const cacheHash = createCacheHash(cacheHashParams)
  
  // Cache-Suche: Nur nach cacheHash + libraryId (benutzerübergreifend)
  // userEmail und sessionId werden nicht mehr für Cache-Suche verwendet
  // WICHTIG: Suche nur nach Einträgen mit answer oder storyTopicsData (unabhängig vom Status)
  const filter: Record<string, unknown> = {
    cacheHash,
    libraryId: args.libraryId,
    $or: [
      { answer: { $exists: true, $nin: [''] } },
      { storyTopicsData: { $exists: true, $ne: null as unknown as import('@/types/story-topics').StoryTopicsData } }
    ],
  }
  
  // Suche nach der neuesten passenden Query (sortiert nach createdAt)
  const cachedQuery = await col.findOne(filter, { sort: { createdAt: -1 } })
  
  return cachedQuery || null
}




