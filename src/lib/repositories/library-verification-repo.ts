/**
 * @fileoverview Library-Verifikations-Repository (MongoDB, Welle A1)
 *
 * @description
 * Persistiert Verifikations-/Reparatur-Laeufe pro Library als Audit-Trail.
 * Vorbild: `integration-tests-repo.ts` (ein Dokument pro Lauf, `createdAt` als
 * Date, idempotenter Upsert auf `runId`, Indizes fuer History je Library).
 *
 * Der aktuelle Library-Status wird NICHT separat gehalten, sondern aus dem
 * JUENGSTEN Lauf abgeleitet (`getLatestLibraryVerificationRun`). Gibt es keinen
 * Lauf, ist die Library `unchecked` (kein stiller Default — die Abwesenheit IST
 * der Status). So bleibt eine Quelle der Wahrheit.
 *
 * Collection: `library_verifications`
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import type {
  LibraryVerificationStatus,
  VerificationMode,
  VerificationSummary,
  DocumentVerificationResult,
} from '@/lib/library-verification/types'

/** Obergrenze gespeicherter Detailbefunde pro Lauf (Audit bleibt schlank). */
const MAX_STORED_DOCUMENTS = 100

export interface LibraryVerificationRunDoc {
  _id?: string
  runId: string
  libraryId: string
  createdAt: Date
  triggeredBy: string
  mode: VerificationMode
  status: LibraryVerificationStatus
  summary: VerificationSummary
  /** Problematische Dokumente (gekappt auf MAX_STORED_DOCUMENTS). */
  documents: DocumentVerificationResult[]
  /** Laufzeit in ms (Diagnose). */
  durationMs?: number
}

const collectionCache = new Map<string, Collection<LibraryVerificationRunDoc>>()
const ensuredIndexes = new Set<string>()
const COLLECTION_NAME = 'library_verifications'

async function getRunsCollection(): Promise<Collection<LibraryVerificationRunDoc>> {
  const cached = collectionCache.get(COLLECTION_NAME)
  if (cached) return cached
  const col = await getCollection<LibraryVerificationRunDoc>(COLLECTION_NAME)
  collectionCache.set(COLLECTION_NAME, col)
  return col
}

async function ensureIndexes(): Promise<void> {
  if (ensuredIndexes.has(COLLECTION_NAME)) return
  const col = await getRunsCollection()
  await col.createIndex({ runId: 1 }, { unique: true })
  await col.createIndex({ libraryId: 1, createdAt: -1 })
  ensuredIndexes.add(COLLECTION_NAME)
}

/** Speichert einen Lauf (idempotent auf `runId`). */
export async function saveLibraryVerificationRun(doc: LibraryVerificationRunDoc): Promise<void> {
  await ensureIndexes()
  const col = await getRunsCollection()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id: _removedId, ...rest } = doc
  const documents = rest.documents.slice(0, MAX_STORED_DOCUMENTS)
  await col.updateOne(
    { runId: rest.runId },
    { $set: { ...rest, documents } },
    { upsert: true }
  )
}

/** Juengster Lauf einer Library — Quelle des aktuellen Status. */
export async function getLatestLibraryVerificationRun(
  libraryId: string
): Promise<LibraryVerificationRunDoc | null> {
  const col = await getRunsCollection()
  const rows = await col
    .find({ libraryId })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()
  return rows[0] ?? null
}

/** History der Laeufe einer Library (neueste zuerst). */
export async function listLibraryVerificationRuns(
  libraryId: string,
  limit = 20
): Promise<LibraryVerificationRunDoc[]> {
  const col = await getRunsCollection()
  const capped = limit > 0 ? Math.floor(limit) : 20
  return col.find({ libraryId }).sort({ createdAt: -1 }).limit(capped).toArray()
}
