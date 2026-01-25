/**
 * @fileoverview Shadow-Twin Migration Repository
 *
 * @description
 * Speichert Migration-Laeufe (Dry-Run / Upsert) zentral in MongoDB.
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'

export interface ShadowTwinMigrationRun {
  _id?: string
  runId: string
  libraryId: string
  userEmail: string
  status: 'running' | 'completed' | 'failed'
  params: {
    folderId: string
    recursive: boolean
    dryRun: boolean
    cleanupFilesystem: boolean
    limit?: number
  }
  report?: {
    sourcesScanned: number
    artifactsFound: number
    artifactsUpserted: number
    artifactsDeleted: number
    foldersDeleted: number
    errors: Array<{ sourceId: string; message: string }>
    upsertedArtifacts?: Array<{
      sourceId: string
      sourceName: string
      artifactFileName: string
      kind: 'transcript' | 'transformation'
      targetLanguage: string
      templateName?: string
      mongoUpserted: boolean
      blobImages: number
      blobErrors: number
      filesystemDeleted: boolean
    }>
    upsertedArtifactsTruncated?: boolean
  }
  startedAt: string
  finishedAt?: string
  steps?: Array<{ name: string; at: string; meta?: Record<string, unknown> }>
}

const collectionCache = new Map<string, Collection<ShadowTwinMigrationRun>>()
const ensuredIndexes = new Set<string>()

function getCollectionName(): string {
  return 'shadow_twin_migrations'
}

async function getMigrationCollection(): Promise<Collection<ShadowTwinMigrationRun>> {
  const name = getCollectionName()
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<ShadowTwinMigrationRun>(name)
  collectionCache.set(name, col)
  return col
}

async function ensureIndexes(): Promise<void> {
  const name = getCollectionName()
  if (ensuredIndexes.has(name)) return
  const col = await getMigrationCollection()
  await col.createIndex({ libraryId: 1, startedAt: -1 })
  await col.createIndex({ runId: 1 }, { unique: true })
  ensuredIndexes.add(name)
}

export async function startMigrationRun(run: ShadowTwinMigrationRun): Promise<void> {
  await ensureIndexes()
  const col = await getMigrationCollection()
  await col.insertOne(run)
}

export async function appendMigrationStep(runId: string, step: { name: string; at: string; meta?: Record<string, unknown> }): Promise<void> {
  const col = await getMigrationCollection()
  await col.updateOne(
    { runId },
    { $push: { steps: step } }
  )
}

export async function finishMigrationRun(runId: string, update: { status: ShadowTwinMigrationRun['status']; report?: ShadowTwinMigrationRun['report'] }): Promise<void> {
  const col = await getMigrationCollection()
  await col.updateOne(
    { runId },
    {
      $set: {
        status: update.status,
        report: update.report,
        finishedAt: new Date().toISOString(),
      },
    }
  )
}

export async function listMigrationRuns(args: { libraryId: string; limit?: number }): Promise<ShadowTwinMigrationRun[]> {
  const col = await getMigrationCollection()
  const limit = args.limit && args.limit > 0 ? args.limit : 20
  return col.find({ libraryId: args.libraryId }).sort({ startedAt: -1 }).limit(limit).toArray()
}
