import { getCollection } from '@/lib/mongodb-service'
import crypto from 'crypto'
import type { Collection, UpdateFilter } from 'mongodb'
import type { QueryLog, QueryRetrievalStep } from '@/types/query-log'

const COLLECTION_NAME = 'queries'

async function getQueriesCollection(): Promise<Collection<QueryLog>> {
  const col = await getCollection<QueryLog>(COLLECTION_NAME)
  try {
    await Promise.all([
      col.createIndex({ queryId: 1 }, { unique: true, name: 'queryId_unique' }),
      col.createIndex({ libraryId: 1, createdAt: -1 }, { name: 'library_createdAt_desc' }),
      col.createIndex({ userEmail: 1, createdAt: -1 }, { name: 'user_createdAt_desc' }),
      col.createIndex({ chatId: 1, createdAt: -1 }, { name: 'chatId_createdAt_desc' }),
    ])
  } catch {}
  return col
}

export async function insertQueryLog(doc: Omit<QueryLog, 'createdAt' | 'status' | 'queryId'> & Partial<Pick<QueryLog, 'queryId' | 'status'>>): Promise<string> {
  const col = await getQueriesCollection()
  const queryId = doc.queryId || crypto.randomUUID()
  const payload: QueryLog = {
    queryId,
    chatId: doc.chatId, // Required: chatId muss angegeben werden
    createdAt: new Date(),
    status: doc.status || 'pending',
    libraryId: doc.libraryId,
    userEmail: doc.userEmail,
    question: doc.question,
    mode: doc.mode,
    queryType: doc.queryType || 'question', // Default: 'question', wenn nicht angegeben
    answerLength: doc.answerLength,
    retriever: doc.retriever,
    targetLanguage: doc.targetLanguage,
    character: doc.character,
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

export async function getQueryLogById(args: { libraryId: string; queryId: string; userEmail: string }): Promise<QueryLog | null> {
  const col = await getQueriesCollection()
  return await col.findOne({ queryId: args.queryId, libraryId: args.libraryId, userEmail: args.userEmail })
}


export async function listRecentQueries(args: { libraryId: string; userEmail: string; chatId?: string; limit?: number }): Promise<Array<Pick<QueryLog, 'queryId' | 'createdAt' | 'question' | 'mode' | 'status' | 'answer' | 'references' | 'suggestedQuestions' | 'answerLength' | 'retriever' | 'targetLanguage' | 'character' | 'socialContext' | 'processingLogs'>>> {
  const col = await getQueriesCollection()
  const lim = Math.max(1, Math.min(100, Number(args.limit ?? 20)))
  
  // Filter: Wenn chatId angegeben, filtere danach; sonst filtere nach libraryId
  const filter: Record<string, unknown> = {
    userEmail: args.userEmail,
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
export async function deleteQueryLog(queryId: string, userEmail: string): Promise<boolean> {
  const col = await getQueriesCollection()
  const result = await col.deleteOne({ queryId, userEmail })
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
  userEmail: string
  question: string
  targetLanguage?: string
  character?: string
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
    userEmail: args.userEmail,
    question: args.question.trim(),
    status: 'ok', // Nur erfolgreiche Queries
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
  const cursor = col.find(filter, { sort: { createdAt: -1 } })
  const candidates = await cursor.toArray()
  
  // Filtere nach facetsSelected, falls angegeben
  if (args.facetsSelected !== undefined) {
    for (const candidate of candidates) {
      if (compareFacetsSelected(candidate.facetsSelected, args.facetsSelected)) {
        // Prüfe, ob die Query eine Antwort hat
        if (candidate.answer && candidate.answer.trim().length > 0) {
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
      if (candidate.answer && candidate.answer.trim().length > 0) {
        return candidate
      }
    }
  }
  
  // Fallback: Gib die erste passende Query zurück (auch wenn sie Filter hat)
  const firstCandidate = candidates[0]
  if (firstCandidate && firstCandidate.answer && firstCandidate.answer.trim().length > 0) {
    return firstCandidate
  }
  
  return null
}




