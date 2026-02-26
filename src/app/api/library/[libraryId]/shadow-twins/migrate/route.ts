/**
 * @fileoverview Shadow-Twin Migration API (Filesystem -> Mongo)
 *
 * @description
 * Migriert Shadow-Twins aus dem Filesystem nach MongoDB.
 * Optional werden die Filesystem-Artefakte anschliessend geloescht.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import path from 'path'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { getServerProvider } from '@/lib/storage/server-provider'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { generateShadowTwinFolderNameVariants } from '@/lib/storage/shadow-twin'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { persistShadowTwinFilesToMongo } from '@/lib/shadow-twin/shadow-twin-migration-writer'
import { FileLogger } from '@/lib/debug/logger'
import { startMigrationRun, appendMigrationStep, finishMigrationRun } from '@/lib/repositories/shadow-twin-migration-repo'
import { randomUUID } from 'crypto'

interface MigrationRequestBody {
  folderId: string
  recursive?: boolean
  cleanupFilesystem?: boolean
  dryRun?: boolean
  limit?: number
}

interface MigrationReport {
  sourcesScanned: number
  artifactsFound: number
  artifactsUpserted: number
  artifactsDeleted: number
  foldersDeleted: number
  errors: Array<{ sourceId: string; message: string }>
  upsertedArtifacts?: Array<{
    sourceId: string
    sourceName: string
    parentName?: string
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

/**
 * In-Memory-Cache fuer listItemsById-Ergebnisse.
 * Vermeidet redundante OneDrive/Storage-API-Aufrufe fuer denselben Ordner.
 */
class FolderCache {
  private cache = new Map<string, StorageItem[]>()

  constructor(private provider: StorageProvider) {}

  async list(folderId: string): Promise<StorageItem[]> {
    const cached = this.cache.get(folderId)
    if (cached) return cached
    const items = await this.provider.listItemsById(folderId)
    this.cache.set(folderId, items)
    return items
  }

  /** Cache fuer einen Ordner invalidieren (nach Schreib-/Loeschvorgang) */
  invalidate(folderId: string): void {
    this.cache.delete(folderId)
  }
}

async function listFilesRecursively(cache: FolderCache, folderId: string, recursive: boolean, limit?: number): Promise<StorageItem[]> {
  const files: StorageItem[] = []
  const queue: string[] = [folderId]

  while (queue.length > 0) {
    const current = queue.shift() as string
    const items = await cache.list(current)

    for (const item of items) {
      if (item.type === 'folder') {
        if (recursive) queue.push(item.id)
        continue
      }
      files.push(item)
      if (limit && files.length >= limit) return files
    }
  }
  return files
}

/**
 * Sammelt alle Dateien in einem Ordner rekursiv (fuer Cleanup).
 * Nutzt den FolderCache fuer konsistente Ergebnisse.
 */
async function collectAllFilesInFolder(
  cache: FolderCache,
  folderId: string
): Promise<StorageItem[]> {
  const files: StorageItem[] = []
  const queue: string[] = [folderId]

  while (queue.length > 0) {
    const current = queue.shift() as string
    const items = await cache.list(current)

    for (const item of items) {
      if (item.type === 'folder') {
        queue.push(item.id)
      } else if (item.type === 'file') {
        files.push(item)
      }
    }
  }

  return files
}

function collectArtifactsForSource(args: {
  source: StorageItem
  parentItems: StorageItem[]
  shadowTwinFolderItems: StorageItem[]
}): Array<{ item: StorageItem; key: { sourceId: string; kind: 'transcript' | 'transformation'; targetLanguage: string; templateName?: string } }> {
  const { source, parentItems, shadowTwinFolderItems } = args
  const sourceBaseName = path.parse(source.metadata.name).name
  const seen = new Set<string>()
  const artifacts: Array<{ item: StorageItem; key: { sourceId: string; kind: 'transcript' | 'transformation'; targetLanguage: string; templateName?: string } }> = []

  const consider = (item: StorageItem) => {
    if (item.type !== 'file') return
    if (seen.has(item.id)) return
    const parsed = parseArtifactName(item.metadata.name, sourceBaseName)
    if (!parsed.kind || !parsed.targetLanguage) return
    // Nur 'transcript' und 'transformation' Artefakte migrieren, 'raw' überspringen
    if (parsed.kind !== 'transcript' && parsed.kind !== 'transformation') return
    seen.add(item.id)
    artifacts.push({
      item,
      key: {
        sourceId: source.id,
        kind: parsed.kind,
        targetLanguage: parsed.targetLanguage,
        templateName: parsed.templateName || undefined,
      },
    })
  }

  for (const item of shadowTwinFolderItems) consider(item)
  for (const item of parentItems) consider(item)

  return artifacts
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  const report: MigrationReport = {
    sourcesScanned: 0,
    artifactsFound: 0,
    artifactsUpserted: 0,
    artifactsDeleted: 0,
    foldersDeleted: 0,
    errors: [],
    upsertedArtifacts: [],
    upsertedArtifactsTruncated: false,
  }

  let runId: string | null = null
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const body = await request.json() as MigrationRequestBody
    if (!body?.folderId) {
      return NextResponse.json({ error: 'folderId ist erforderlich' }, { status: 400 })
    }

    // Debug: Log die übergebenen Parameter
    FileLogger.info('shadow-twins/migrate', 'Migration-Parameter erhalten', {
      folderId: body.folderId,
      recursive: body.recursive,
      dryRun: body.dryRun,
      cleanupFilesystem: body.cleanupFilesystem,
      limit: body.limit,
    })

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const shadowTwinConfig = getShadowTwinConfig(library)
    if (shadowTwinConfig.primaryStore !== 'mongo') {
      return NextResponse.json({ error: 'Mongo ist nicht aktiv' }, { status: 400 })
    }

    runId = randomUUID()
    const startedAt = new Date().toISOString()
    // Stelle sicher, dass alle Parameter explizit gesetzt werden
    const migrationParams = {
      folderId: body.folderId,
      recursive: body.recursive === true,
      dryRun: body.dryRun === true,
      cleanupFilesystem: body.cleanupFilesystem === true,
      limit: body.limit,
    }
    FileLogger.info('shadow-twins/migrate', 'Speichere Migration-Run mit Parametern', {
      runId,
      params: migrationParams,
    })
    await startMigrationRun({
      runId,
      libraryId,
      userEmail,
      status: 'running',
      params: migrationParams,
      startedAt,
      steps: [{ name: 'start', at: startedAt }],
    })

    const provider = await getServerProvider(userEmail, libraryId)
    const cache = new FolderCache(provider)
    const files = await listFilesRecursively(cache, body.folderId, !!body.recursive, body.limit)
    await appendMigrationStep(runId, {
      name: 'scan_done',
      at: new Date().toISOString(),
      meta: { files: files.length },
    })

    const MAX_UPSERT_DETAILS = 500

    // Cache fuer Ordnernamen (parentId -> name), um redundante API-Aufrufe zu vermeiden
    const parentNameCache = new Map<string, string>()
    async function resolveParentName(parentId: string): Promise<string> {
      if (!parentId) return ''
      const cached = parentNameCache.get(parentId)
      if (cached !== undefined) return cached
      try {
        const parentItem = await provider.getItemById(parentId)
        const name = parentItem?.metadata?.name || ''
        parentNameCache.set(parentId, name)
        return name
      } catch {
        parentNameCache.set(parentId, '')
        return ''
      }
    }

    for (const source of files) {
      report.sourcesScanned += 1
      try {
        // parentItems ueber Cache laden (vermeidet redundante API-Aufrufe bei Dateien im selben Ordner)
        const parentItems = await cache.list(source.parentId)

        // Shadow-Twin-Ordner direkt aus den gecachten parentItems finden (vermeidet redundanten listItemsById)
        const variants = generateShadowTwinFolderNameVariants(source.metadata.name)
        const shadowTwinFolder = parentItems.find(
          (item) => item.type === 'folder' && variants.includes(item.metadata.name)
        ) ?? null

        const shadowTwinFolderItems = shadowTwinFolder ? await cache.list(shadowTwinFolder.id) : []

        const artifacts = collectArtifactsForSource({
          source,
          parentItems,
          shadowTwinFolderItems,
        })
        report.artifactsFound += artifacts.length

        // Verarbeite jedes Artefakt (jedes wird zu einem eigenen MongoDB-Dokument)
        for (const artifact of artifacts) {
          if (!body.dryRun) {
            // Neue Migration: Scant alle Dateien im Shadow-Twin-Ordner ohne Markdown-Analyse
            const mongoResult = await persistShadowTwinFilesToMongo({
              libraryId,
              userEmail,
              sourceItem: source,
              provider,
              artifactKey: artifact.key,
              shadowTwinFolderId: shadowTwinFolder?.id,
            })
            report.artifactsUpserted += 1
            if (report.upsertedArtifacts && report.upsertedArtifacts.length < MAX_UPSERT_DETAILS) {
              const parentName = await resolveParentName(source.parentId)
              report.upsertedArtifacts.push({
                sourceId: source.id,
                sourceName: source.metadata.name,
                parentName: parentName || undefined,
                artifactFileName: artifact.item.metadata.name,
                kind: artifact.key.kind,
                targetLanguage: artifact.key.targetLanguage,
                templateName: artifact.key.templateName,
                mongoUpserted: true,
                blobImages: mongoResult.imageFiles,
                blobErrors: 0,
                filesystemDeleted: !!body.cleanupFilesystem,
              })
            } else if (report.upsertedArtifacts && report.upsertedArtifacts.length >= MAX_UPSERT_DETAILS) {
              report.upsertedArtifactsTruncated = true
            }
            if (body.cleanupFilesystem) {
              await provider.deleteItem(artifact.item.id)
              report.artifactsDeleted += 1
            }
          }
        }

        // Cleanup: Loesche alle Dateien im Shadow-Twin-Ordner (nicht nur Markdown)
        if (body.cleanupFilesystem && shadowTwinFolder && !body.dryRun) {
          const allFilesInFolder = await collectAllFilesInFolder(cache, shadowTwinFolder.id)
          for (const file of allFilesInFolder) {
            try {
              await provider.deleteItem(file.id)
              report.artifactsDeleted += 1
            } catch (error) {
              FileLogger.warn('shadow-twins/migrate', 'Fehler beim Löschen einer Datei', {
                fileId: file.id,
                fileName: file.metadata.name,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }
          // Cache invalidieren nach Loeschungen
          cache.invalidate(shadowTwinFolder.id)
          const remaining = await cache.list(shadowTwinFolder.id)
          if (remaining.length === 0) {
            await provider.deleteItem(shadowTwinFolder.id)
            cache.invalidate(source.parentId)
            report.foldersDeleted += 1
          }
        }
      } catch (error) {
        report.errors.push({
          sourceId: source.id,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    await appendMigrationStep(runId, { name: 'completed', at: new Date().toISOString() })
    await finishMigrationRun(runId, { status: 'completed', report })
    return NextResponse.json({ report, runId }, { status: 200 })
  } catch (error) {
    FileLogger.error('shadow-twins/migrate', 'Migration fehlgeschlagen', { error })
    // Best effort: schreibe Failure, falls Run bereits gestartet wurde.
    try {
      if (runId) {
        await appendMigrationStep(runId, {
          name: 'failed',
          at: new Date().toISOString(),
          meta: { error: error instanceof Error ? error.message : String(error) },
        })
        await finishMigrationRun(runId, { status: 'failed', report })
      }
    } catch {
      // Logging failure is non-critical.
    }
    return NextResponse.json({ error: 'Migration fehlgeschlagen', report }, { status: 500 })
  }
}
