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

const COLLECTION_NAME = 'queries'

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
      
      // Optimierte Indexe für Cache-Abfragen (findQueryByQuestionAndContext)
      // Index für authentifizierte Nutzer mit TOC-Queries
      col.createIndex(
        { 
          libraryId: 1, 
          question: 1, 
          userEmail: 1, 
          queryType: 1, 
          status: 1, 
          targetLanguage: 1,
          character: 1,
          socialContext: 1,
          genderInclusive: 1,
          retriever: 1,
          createdAt: -1 
        }, 
        { 
          name: 'cache_lookup_user_toc',
          partialFilterExpression: { userEmail: { $exists: true } }
        }
      ),
      // Index für anonyme Nutzer mit TOC-Queries
      col.createIndex(
        { 
          libraryId: 1, 
          question: 1, 
          sessionId: 1, 
          queryType: 1, 
          status: 1, 
          targetLanguage: 1,
          character: 1,
          socialContext: 1,
          genderInclusive: 1,
          retriever: 1,
          createdAt: -1 
        }, 
        { 
          name: 'cache_lookup_session_toc',
          partialFilterExpression: { sessionId: { $exists: true } }
        }
      ),
      // Fallback-Indexe für häufig verwendete Kombinationen (ohne alle Parameter)
      col.createIndex(
        { 
          libraryId: 1, 
          question: 1, 
          userEmail: 1, 
          queryType: 1, 
          status: 1,
          createdAt: -1 
        }, 
        { 
          name: 'cache_lookup_user_basic',
          partialFilterExpression: { userEmail: { $exists: true } }
        }
      ),
      col.createIndex(
        { 
          libraryId: 1, 
          question: 1, 
          sessionId: 1, 
          queryType: 1, 
          status: 1,
          createdAt: -1 
        }, 
        { 
          name: 'cache_lookup_session_basic',
          partialFilterExpression: { sessionId: { $exists: true } }
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
  
  const payload: QueryLog = {
    queryId,
    chatId: doc.chatId, // Required: chatId muss angegeben werden
    createdAt: new Date(),
    status: doc.status || 'pending',
    libraryId: doc.libraryId,
    userEmail: doc.userEmail,
    sessionId: doc.sessionId,
    question: doc.question,
    mode: doc.mode,
    queryType: doc.queryType || 'question', // Default: 'question', wenn nicht angegeben
    answerLength: doc.answerLength,
    retriever: doc.retriever,
    targetLanguage: doc.targetLanguage,
    character: doc.character,
    accessPerspective: doc.accessPerspective,
    socialContext: doc.socialContext,
    genderInclusive: doc.genderInclusive,
    facetsSelected: doc.facetsSelected,
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
  
  const cursor = col
    .find(filter, { projection: { _id: 0, queryId: 1, createdAt: 1, question: 1, mode: 1, status: 1, answer: 1, references: 1, suggestedQuestions: 1, answerLength: 1, retriever: 1, targetLanguage: 1, character: 1, socialContext: 1, processingLogs: 1 } })
    .sort({ createdAt: -1 })
    .limit(lim)
  const rows = await cursor.toArray()
  // Erzwinge den erwarteten Teiltyp per Mapping, um Driver-Document zu eliminieren
  return rows.map(r => ({
    queryId: r.queryId,
    createdAt: r.createdAt,
    question: r.question,
    mode: r.mode,
    status: r.status,
    answer: r.answer,
    references: r.references,
    suggestedQuestions: r.suggestedQuestions,
    answerLength: r.answerLength,
    retriever: r.retriever,
    targetLanguage: r.targetLanguage,
    character: r.character,
    socialContext: r.socialContext,
    processingLogs: r.processingLogs,
  }))
}

/**
 * Löscht ein Query-Dokument
 * 
 * @param queryId Query-ID
 * @param userEmail E-Mail-Adresse des Benutzers (für Sicherheit)
 * @returns true, wenn Query gelöscht wurde, false wenn nicht gefunden
 */
export async function deleteQueryLog(queryId: string, userEmail?: string, sessionId?: string): Promise<boolean> {
  const col = await getQueriesCollection()
  const filter: Record<string, unknown> = { queryId }
  
  if (userEmail) {
    filter.userEmail = userEmail
  } else if (sessionId) {
    filter.sessionId = sessionId
  } else {
    throw new Error('Entweder userEmail oder sessionId muss angegeben werden')
  }
  
  const result = await col.deleteOne(filter)
  return result.deletedCount > 0
}

/**
 * Vergleicht zwei facetsSelected-Objekte auf Gleichheit
 * Berücksichtigt Arrays und normalisiert die Werte
 */
function compareFacetsSelected(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined
): boolean {
  // Beide undefined oder leer → gleich
  if ((!a || Object.keys(a).length === 0) && (!b || Object.keys(b).length === 0)) {
    return true
  }
  
  // Eines ist undefined oder leer, das andere nicht → unterschiedlich
  if (!a || Object.keys(a).length === 0 || !b || Object.keys(b).length === 0) {
    return false
  }
  
  // Prüfe, ob alle Keys in beiden Objekten vorhanden sind
  const keysA = new Set(Object.keys(a))
  const keysB = new Set(Object.keys(b))
  
  if (keysA.size !== keysB.size) {
    return false
  }
  
  // Prüfe jeden Key
  for (const key of keysA) {
    if (!keysB.has(key)) {
      return false
    }
    
    const valA = a[key]
    const valB = b[key]
    
    // Normalisiere Arrays
    const arrA = Array.isArray(valA) ? valA.sort() : valA === undefined || valA === null ? [] : [valA]
    const arrB = Array.isArray(valB) ? valB.sort() : valB === undefined || valB === null ? [] : [valB]
    
    // Vergleiche Arrays
    if (arrA.length !== arrB.length) {
      return false
    }
    
    // String-Vergleich für Array-Elemente
    const strA = arrA.map(v => String(v)).sort().join(',')
    const strB = arrB.map(v => String(v)).sort().join(',')
    
    if (strA !== strB) {
      return false
    }
  }
  
  return true
}

/**
 * Sucht nach einer bestehenden Query mit spezifischer Frage und Kontext-Parametern
 * 
 * @param args Parameter für die Suche
 * @returns QueryLog mit Antwort, oder null wenn nicht gefunden
 */
export async function findQueryByQuestionAndContext(args: {
  libraryId: string
  userEmail?: string
  sessionId?: string
  question: string
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
  
  // Filter für die Suche: Frage muss exakt übereinstimmen, Kontext-Parameter müssen übereinstimmen
  const filter: Record<string, unknown> = {
    libraryId: args.libraryId,
    question: args.question.trim(),
    status: { $in: ['ok', 'pending'] }, // Auch pending Queries, falls sie bereits eine Antwort haben
  }
  
  if (args.userEmail) {
    filter.userEmail = args.userEmail
  } else if (args.sessionId) {
    filter.sessionId = args.sessionId
  } else {
    throw new Error('Entweder userEmail oder sessionId muss angegeben werden')
  }
  
  // Füge queryType-Filter hinzu, wenn angegeben
  if (args.queryType !== undefined) {
    filter.queryType = args.queryType
  }
  
  // Füge Kontext-Parameter hinzu, wenn sie angegeben sind
  if (args.targetLanguage !== undefined) {
    filter.targetLanguage = args.targetLanguage
  }
  if (args.character !== undefined) {
    filter.character = args.character
  }
  if (args.accessPerspective !== undefined) {
    filter.accessPerspective = args.accessPerspective
  }
  if (args.socialContext !== undefined) {
    filter.socialContext = args.socialContext
  }
  if (args.genderInclusive !== undefined) {
    filter.genderInclusive = args.genderInclusive
  }
  if (args.retriever !== undefined) {
    filter.retriever = args.retriever
  }
  
  // Suche nach der neuesten passenden Query
  // Hinweis: facetsSelected kann nicht direkt im MongoDB-Filter verwendet werden,
  // da es ein verschachteltes Objekt ist. Wir müssen nach dem Laden filtern.
  // WICHTIG: Verwende limit() um die Anzahl der geladenen Dokumente zu begrenzen
  // und nutze die optimierten Indexe für bessere Performance
  const cursor = col.find(filter, { sort: { createdAt: -1 }, limit: 50 }) // Limit auf 50 für Facetten-Filterung
  const candidates = await cursor.toArray()
  
  // Filtere nach facetsSelected, falls angegeben
  if (args.facetsSelected !== undefined) {
    for (const candidate of candidates) {
      if (compareFacetsSelected(candidate.facetsSelected, args.facetsSelected)) {
        // Prüfe, ob die Query eine Antwort oder storyTopicsData hat
        // (storyTopicsData ist wichtiger für TOC-Queries, auch wenn answer noch null ist)
        if ((candidate.answer && candidate.answer.trim().length > 0) || candidate.storyTopicsData) {
          return candidate
        }
      }
    }
    // Keine passende Query mit Filter gefunden
    return null
  }
  
  // Wenn keine Filter angegeben sind, verwende die erste passende Query
  for (const candidate of candidates) {
    // Wenn keine Filter angegeben sind, prüfe ob facetsSelected leer oder undefined ist
    if (!candidate.facetsSelected || Object.keys(candidate.facetsSelected).length === 0) {
      if ((candidate.answer && candidate.answer.trim().length > 0) || candidate.storyTopicsData) {
        return candidate
      }
    }
  }
  
  // Fallback: Gib die erste passende Query zurück (auch wenn sie Filter hat)
  const firstCandidate = candidates[0]
  if (firstCandidate && ((firstCandidate.answer && firstCandidate.answer.trim().length > 0) || firstCandidate.storyTopicsData)) {
    return firstCandidate
  }
  
  return null
}




