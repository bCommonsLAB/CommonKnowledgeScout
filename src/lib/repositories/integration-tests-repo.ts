/**
 * @fileoverview Integration Test Runs Repository (MongoDB)
 *
 * @description
 * Persistiert Integrationstest-Läufe (Runs) inkl. Notes in einer MongoDB Collection.
 * Das ersetzt den bisherigen In-Memory Store, damit Runs nach Server-Restarts
 * weiterhin abrufbar sind und der Agent/CLI-Modus stabil funktioniert.
 *
 * Collection: `integration_tests`
 *
 * Design-Entscheidungen (bewusst einfach gehalten):
 * - Ein Dokument pro Run (`runId` unique)
 * - Notes werden als Array im Run-Dokument gespeichert (kleine Mengen, einfache Abfragen)
 * - createdAt wird als Date gespeichert (saubere Sortierung, optional TTL später möglich)
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import type { IntegrationTestRunResult } from '@/lib/integration-tests/orchestrator'

export interface IntegrationTestRunNoteDoc {
  noteId: string
  createdAt: Date
  authorType: 'auto' | 'agent' | 'user'
  authorEmail?: string
  title?: string
  analysisMarkdown: string
  nextStepsMarkdown: string
}

export interface IntegrationTestRunDoc {
  _id?: string
  runId: string
  createdAt: Date
  userEmail: string
  libraryId: string
  folderId: string
  testCaseIds: string[]
  fileIds?: string[]
  jobTimeoutMs?: number
  templateName?: string
  result: IntegrationTestRunResult
  notes?: IntegrationTestRunNoteDoc[]
}

const collectionCache = new Map<string, Collection<IntegrationTestRunDoc>>()
const ensuredIndexes = new Set<string>()

function getCollectionName(): string {
  // Vom User explizit gewünscht
  return 'integration_tests'
}

async function getRunsCollection(): Promise<Collection<IntegrationTestRunDoc>> {
  const name = getCollectionName()
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<IntegrationTestRunDoc>(name)
  collectionCache.set(name, col)
  return col
}

async function ensureIndexes(): Promise<void> {
  const name = getCollectionName()
  if (ensuredIndexes.has(name)) return

  const col = await getRunsCollection()

  // Lookup/Ownership
  await col.createIndex({ runId: 1 }, { unique: true })

  // History-Ansicht (Library/Folder)
  await col.createIndex({ libraryId: 1, folderId: 1, createdAt: -1 })
  await col.createIndex({ libraryId: 1, createdAt: -1 })

  // Optional: Runs pro User (z.B. für Ownership/Debug)
  await col.createIndex({ userEmail: 1, createdAt: -1 })

  ensuredIndexes.add(name)
}

export async function upsertIntegrationTestRun(doc: IntegrationTestRunDoc): Promise<void> {
  await ensureIndexes()
  const col = await getRunsCollection()

  // Idempotent: falls runId versehentlich doppelt kommt, aktualisieren wir.
  //
  // WICHTIG:
  // - `notes` werden NICHT per Upsert überschrieben.
  //   Notes werden ausschließlich über `appendIntegrationTestRunNote()` ergänzt.
  // - Sonst riskieren wir Konflikte ($set vs $setOnInsert) und Datenverlust bei Notes.
  // Zusätzlich: `notes` wird hier *gar nicht* angefasst. `$push` kann das Feld später anlegen.
  // Das macht den Upsert robust gegen Mongo "path conflict" Fehler.
  const { _id, ...rest } = doc
  await col.updateOne(
    { runId: doc.runId },
    {
      $set: {
        runId: rest.runId,
        createdAt: rest.createdAt,
        userEmail: rest.userEmail,
        libraryId: rest.libraryId,
        folderId: rest.folderId,
        testCaseIds: rest.testCaseIds,
        fileIds: rest.fileIds,
        jobTimeoutMs: rest.jobTimeoutMs,
        templateName: rest.templateName,
        result: rest.result,
      },
    },
    { upsert: true }
  )
}

export async function getIntegrationTestRunById(runId: string): Promise<IntegrationTestRunDoc | null> {
  const col = await getRunsCollection()
  return col.findOne({ runId })
}

export async function listIntegrationTestRunsFromDb(args?: {
  limit?: number
  libraryId?: string
  folderId?: string
}): Promise<IntegrationTestRunDoc[]> {
  const col = await getRunsCollection()

  const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : 20
  const libraryId = typeof args?.libraryId === 'string' && args.libraryId.trim() ? args.libraryId.trim() : null
  const folderId = typeof args?.folderId === 'string' && args.folderId.trim() ? args.folderId.trim() : null

  const query: Record<string, unknown> = {}
  if (libraryId) query.libraryId = libraryId
  if (folderId) query.folderId = folderId

  return col.find(query).sort({ createdAt: -1 }).limit(limit).toArray()
}

export async function appendIntegrationTestRunNote(args: {
  runId: string
  note: IntegrationTestRunNoteDoc
}): Promise<IntegrationTestRunDoc | null> {
  const col = await getRunsCollection()
  await col.updateOne(
    { runId: args.runId },
    { $push: { notes: args.note } }
  )
  return col.findOne({ runId: args.runId })
}

