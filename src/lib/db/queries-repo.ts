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
    ])
  } catch {}
  return col
}

export async function insertQueryLog(doc: Omit<QueryLog, 'createdAt' | 'status' | 'queryId'> & Partial<Pick<QueryLog, 'queryId' | 'status'>>): Promise<string> {
  const col = await getQueriesCollection()
  const queryId = doc.queryId || crypto.randomUUID()
  const payload: QueryLog = {
    queryId,
    createdAt: new Date(),
    status: doc.status || 'pending',
    libraryId: doc.libraryId,
    userEmail: doc.userEmail,
    question: doc.question,
    mode: doc.mode,
    answerLength: doc.answerLength,
    retriever: doc.retriever,
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


export async function listRecentQueries(args: { libraryId: string; userEmail: string; limit?: number }): Promise<Array<Pick<QueryLog, 'queryId' | 'createdAt' | 'question' | 'mode' | 'status'>>> {
  const col = await getQueriesCollection()
  const lim = Math.max(1, Math.min(100, Number(args.limit ?? 20)))
  const cursor = col
    .find({ libraryId: args.libraryId, userEmail: args.userEmail }, { projection: { _id: 0, queryId: 1, createdAt: 1, question: 1, mode: 1, status: 1 } })
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
  }))
}




