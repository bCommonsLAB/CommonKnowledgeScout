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
import type { StorageItem } from '@/lib/storage/types'
import { getServerProvider } from '@/lib/storage/server-provider'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
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

async function listFilesRecursively(provider: Awaited<ReturnType<typeof getServerProvider>>, folderId: string, recursive: boolean, limit?: number): Promise<StorageItem[]> {
  const files: StorageItem[] = []
  const queue: string[] = [folderId]

  while (queue.length > 0) {
    const current = queue.shift() as string
    const items = await provider.listItemsById(current)

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
 * Sammelt alle Dateien in einem Ordner rekursiv (für Cleanup)
 */
async function collectAllFilesInFolder(
  provider: Awaited<ReturnType<typeof getServerProvider>>,
  folderId: string
): Promise<StorageItem[]> {
  const files: StorageItem[] = []
  const queue: string[] = [folderId]

  while (queue.length > 0) {
    const current = queue.shift() as string
    const items = await provider.listItemsById(current)

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
    const files = await listFilesRecursively(provider, body.folderId, !!body.recursive, body.limit)
    await appendMigrationStep(runId, {
      name: 'scan_done',
      at: new Date().toISOString(),
      meta: { files: files.length },
    })

    const MAX_UPSERT_DETAILS = 500

    for (const source of files) {
      report.sourcesScanned += 1
      try {
        const parentItems = await provider.listItemsById(source.parentId)
        const shadowTwinFolder = await findShadowTwinFolder(source.parentId, source.metadata.name, provider)
        const shadowTwinFolderItems = shadowTwinFolder ? await provider.listItemsById(shadowTwinFolder.id) : []

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
              report.upsertedArtifacts.push({
                sourceId: source.id,
                sourceName: source.metadata.name,
                artifactFileName: artifact.item.metadata.name,
                kind: artifact.key.kind,
                targetLanguage: artifact.key.targetLanguage,
                templateName: artifact.key.templateName,
                mongoUpserted: true,
                // Konvertiere detaillierte Statistiken zu vereinfachtem Format
                blobImages: mongoResult.imageFiles,
                blobErrors: 0, // Keine Fehler während der Migration
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

        // Cleanup: Lösche alle Dateien im Shadow-Twin-Ordner (nicht nur Markdown)
        if (body.cleanupFilesystem && shadowTwinFolder && !body.dryRun) {
          // Lösche alle Dateien im Shadow-Twin-Ordner rekursiv
          const allFilesInFolder = await collectAllFilesInFolder(provider, shadowTwinFolder.id)
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
          // Lösche den Ordner selbst, wenn er leer ist
          const remaining = await provider.listItemsById(shadowTwinFolder.id)
          if (remaining.length === 0) {
            await provider.deleteItem(shadowTwinFolder.id)
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
