/**
 * @fileoverview Zentraler Shadow-Twin Sync (bidirektional + Bilder)
 *
 * @description
 * Synchronisiert ALLE Shadow-Twin-Artefakte einer Bibliothek zwischen
 * Cache (MongoDB) und Storage. Unterstuetzt Richtungswahl und dryRun.
 *
 * Richtungen:
 * - to-storage: Cache → Dateisystem (Export/Backup)
 * - to-cache: Dateisystem → Cache (Import/Rebuild)
 * - both: Bidirektional (Default)
 *
 * Artefakt-Typen:
 * - Markdown (Transcript, Transformation): Text-basierter Sync
 * - Bilder (binaryFragments): Azure-URL → Storage Download
 *
 * dryRun: Scannt und zaehlt, ohne etwas zu schreiben.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import {
  getShadowTwinsBySourceIds,
  updateShadowTwinArtifactMarkdown,
  type ShadowTwinDocument,
  type ShadowTwinArtifactRecord,
  type MongoBinaryFragment,
} from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { findShadowTwinFolder, generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

// ─── Typen ───────────────────────────────────────────────────────────

type SyncDirection = 'to-storage' | 'to-cache' | 'both'

interface SyncAllRequest {
  folderId: string
  recursive?: boolean
  dryRun?: boolean
  direction?: SyncDirection
}

interface ArtifactSyncResult {
  sourceId: string
  sourceName: string
  kind: 'transcript' | 'transformation' | 'image'
  targetLanguage: string
  templateName?: string
  fileName: string
  action: 'synced-to-mongo' | 'written-to-storage' | 'already-synced' | 'source-newer' | 'error'
  error?: string
}

interface SyncAllReport {
  scanned: number
  withShadowTwin: number
  // Markdown-Artefakte nach Richtung
  markdownToCache: number
  markdownToStorage: number
  // Bilder (Azure → Storage)
  imagesWritten: number
  imagesSkipped: number
  // Sonstige
  alreadySynced: number
  sourceNewer: number
  errors: number
  details: ArtifactSyncResult[]
  detailsTruncated: boolean
}

// ─── Folder-Content-Cache ────────────────────────────────────────────
// Vermeidet redundante listItemsById-Aufrufe – jeder Ordner wird nur einmal gelistet.

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

// ─── Hilfsfunktionen ─────────────────────────────────────────────────

/** Rekursives Listen aller Dateien */
async function listFilesRecursively(
  cache: FolderCache,
  folderId: string,
  recursive: boolean,
): Promise<StorageItem[]> {
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
    }
  }
  return files
}

/** Artefakt-Datei im Storage suchen (mit Cache) */
async function findArtifactInStorage(
  cache: FolderCache,
  provider: StorageProvider,
  parentId: string,
  shadowTwinFolderId: string | null | undefined,
  sourceName: string,
  expectedFileName: string,
): Promise<StorageItem | null> {
  if (shadowTwinFolderId) {
    try {
      const items = await cache.list(shadowTwinFolderId)
      const found = items.find(
        (item) => item.type === 'file' && item.metadata.name === expectedFileName
      )
      if (found) return found
    } catch { /* weiter */ }
  }

  if (parentId && sourceName) {
    try {
      const folder = await findShadowTwinFolder(parentId, sourceName, provider)
      if (folder) {
        const items = await cache.list(folder.id)
        const found = items.find(
          (item) => item.type === 'file' && item.metadata.name === expectedFileName
        )
        if (found) return found
      }
    } catch { /* weiter */ }
  }

  try {
    const items = await cache.list(parentId)
    const found = items.find(
      (item) => item.type === 'file' && item.metadata.name === expectedFileName
    )
    if (found) return found
  } catch { /* weiter */ }

  return null
}

/** Shadow-Twin-Ordner finden oder erstellen */
async function ensureShadowTwinFolder(
  provider: StorageProvider,
  parentId: string,
  sourceName: string,
): Promise<StorageItem> {
  const existing = await findShadowTwinFolder(parentId, sourceName, provider)
  if (existing) return existing
  const folderName = generateShadowTwinFolderName(sourceName)
  return provider.createFolder(parentId, folderName)
}

/** Datei existiert im Ordner? (mit Cache) */
async function fileExistsInFolder(
  cache: FolderCache,
  folderId: string,
  fileName: string,
): Promise<boolean> {
  try {
    const items = await cache.list(folderId)
    return items.some((item) => item.type === 'file' && item.metadata.name === fileName)
  } catch {
    return false
  }
}

function toDate(val: unknown): Date | null {
  if (val instanceof Date) return val
  if (typeof val === 'string') {
    const d = new Date(val)
    return Number.isFinite(d.getTime()) ? d : null
  }
  return null
}

const TOLERANCE_MS = 5_000

// ─── Sync-Logik pro Markdown-Artefakt ────────────────────────────────

async function syncArtifact(
  cache: FolderCache,
  provider: StorageProvider,
  libraryId: string,
  doc: ShadowTwinDocument,
  sourceModifiedAt: Date | null,
  kind: 'transcript' | 'transformation',
  targetLanguage: string,
  record: ShadowTwinArtifactRecord,
  templateName: string | undefined,
  storageExpected: boolean,
  direction: SyncDirection,
  dryRun: boolean,
): Promise<ArtifactSyncResult> {
  const sourceId = doc.sourceId
  const sourceName = doc.sourceName || ''
  const parentId = doc.parentId || ''
  const shadowTwinFolderId = doc.filesystemSync?.shadowTwinFolderId || null

  const artifactKey: ArtifactKey = { sourceId, kind, targetLanguage, templateName }
  const fileName = buildArtifactName(artifactKey, sourceName)
  const mongoDate = toDate(record.updatedAt)

  // Source-newer pruefen (braucht Pipeline, nicht auto-syncbar)
  if (sourceModifiedAt && mongoDate && sourceModifiedAt.getTime() > mongoDate.getTime()) {
    return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'source-newer' }
  }

  // Bei explizitem Export (to-storage) ist storageExpected irrelevant –
  // der Benutzer will Daten ins Dateisystem schreiben, unabhaengig von der Config.
  if (!storageExpected && direction !== 'to-storage') {
    return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'already-synced' }
  }

  // Storage-Datei suchen
  const storageItem = await findArtifactInStorage(cache, provider, parentId, shadowTwinFolderId, sourceName, fileName)

  // storage-missing → Cache → Storage schreiben
  if (!storageItem) {
    if (direction === 'to-cache') {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'already-synced' }
    }
    if (!record.markdown?.trim()) {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'error', error: 'Leeres Markdown im Cache' }
    }
    if (dryRun) {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'written-to-storage' }
    }
    try {
      const folder = await ensureShadowTwinFolder(provider, parentId, sourceName)
      if (await fileExistsInFolder(cache, folder.id, fileName)) {
        return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'already-synced' }
      }
      await provider.uploadFile(folder.id, new File([record.markdown], fileName, { type: 'text/markdown' }))
      cache.invalidate(folder.id)
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'written-to-storage' }
    } catch (err) {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'error', error: err instanceof Error ? err.message : String(err) }
    }
  }

  // Timestamps vergleichen
  const storageMod = toDate(storageItem.metadata.modifiedAt)
  if (!mongoDate || !storageMod) {
    return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'already-synced' }
  }

  const diffMs = storageMod.getTime() - mongoDate.getTime()

  // storage-newer → Storage → Cache (nur bei to-cache oder both)
  if (diffMs > TOLERANCE_MS) {
    if (direction === 'to-storage') {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'already-synced' }
    }
    if (dryRun) {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'synced-to-mongo' }
    }
    try {
      const { blob } = await provider.getBinary(storageItem.id)
      const markdown = await blob.text()
      if (!markdown.trim()) {
        return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'error', error: 'Leeres Markdown in Storage-Datei' }
      }
      await updateShadowTwinArtifactMarkdown({ libraryId, sourceId, artifactKey, markdown })
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'synced-to-mongo' }
    } catch (err) {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'error', error: err instanceof Error ? err.message : String(err) }
    }
  }

  // mongo-newer → Cache → Storage ueberschreiben (nur bei to-storage oder both)
  if (diffMs < -TOLERANCE_MS) {
    if (direction === 'to-cache') {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'already-synced' }
    }
    if (!record.markdown?.trim()) {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'error', error: 'Leeres Markdown im Cache' }
    }
    if (dryRun) {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'written-to-storage' }
    }
    try {
      // Bestehende Datei loeschen und neu hochladen (Ueberschreiben)
      await provider.deleteItem(storageItem.id)
      const folder = await ensureShadowTwinFolder(provider, parentId, sourceName)
      await provider.uploadFile(folder.id, new File([record.markdown], fileName, { type: 'text/markdown' }))
      cache.invalidate(folder.id)
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'written-to-storage' }
    } catch (err) {
      return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'error', error: err instanceof Error ? err.message : String(err) }
    }
  }

  return { sourceId, sourceName, kind, targetLanguage, templateName, fileName, action: 'already-synced' }
}

// ─── Binary Fragments Sync (Cache → Storage) ────────────────────────

/**
 * Synchronisiert binaryFragments (Bilder, Medien) aus dem Cache (Azure-URLs)
 * ins Dateisystem. Laedt Bilder von Azure herunter und schreibt sie in den
 * Shadow-Twin-Ordner im Storage.
 */
async function syncBinaryFragments(
  cache: FolderCache,
  provider: StorageProvider,
  doc: ShadowTwinDocument,
  dryRun: boolean,
  report: SyncAllReport,
  maxDetails: number,
): Promise<void> {
  const fragments = doc.binaryFragments as MongoBinaryFragment[] | undefined
  if (!fragments || fragments.length === 0) return

  const parentId = doc.parentId || ''
  const sourceName = doc.sourceName || ''
  if (!parentId || !sourceName) return

  // Shadow-Twin-Ordner nur erstellen wenn wirklich geschrieben wird
  let folder: StorageItem | null = null

  for (const fragment of fragments) {
    // Nur Fragmente mit Azure-URL und einem Dateinamen verarbeiten
    if (!fragment.url || !fragment.name) continue

    // Pruefen ob die Datei bereits im Storage existiert
    if (!folder) {
      try {
        folder = await findShadowTwinFolder(parentId, sourceName, provider) ?? null
      } catch { /* weiter */ }
    }

    if (folder) {
      const exists = await fileExistsInFolder(cache, folder.id, fragment.name)
      if (exists) {
        report.imagesSkipped++
        continue
      }
    }

    // Bild muss geschrieben werden
    if (dryRun) {
      report.imagesWritten++
      if (report.details.length < maxDetails) {
        report.details.push({
          sourceId: doc.sourceId,
          sourceName,
          kind: 'image',
          targetLanguage: '',
          fileName: fragment.name,
          action: 'written-to-storage',
        })
      } else {
        report.detailsTruncated = true
      }
      continue
    }

    // Ordner sicherstellen (nur beim ersten tatsaechlichen Schreibvorgang)
    if (!folder) {
      try {
        folder = await ensureShadowTwinFolder(provider, parentId, sourceName)
      } catch {
        report.errors++
        continue
      }
    }

    try {
      // Bild von Azure-URL herunterladen
      const response = await fetch(fragment.url)
      if (!response.ok) {
        report.errors++
        continue
      }
      const buffer = await response.arrayBuffer()
      const mimeType = fragment.mimeType || 'application/octet-stream'
      const file = new File([buffer], fragment.name, { type: mimeType })
      await provider.uploadFile(folder.id, file)
      cache.invalidate(folder.id)
      report.imagesWritten++

      if (report.details.length < maxDetails) {
        report.details.push({
          sourceId: doc.sourceId,
          sourceName,
          kind: 'image',
          targetLanguage: '',
          fileName: fragment.name,
          action: 'written-to-storage',
        })
      } else {
        report.detailsTruncated = true
      }
    } catch {
      report.errors++
    }
  }
}

// ─── API-Route ───────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  const MAX_DETAILS = 500
  const report: SyncAllReport = {
    scanned: 0, withShadowTwin: 0,
    markdownToCache: 0, markdownToStorage: 0,
    imagesWritten: 0, imagesSkipped: 0,
    alreadySynced: 0, sourceNewer: 0, errors: 0,
    details: [], detailsTruncated: false,
  }

  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const body = (await request.json()) as SyncAllRequest

    if (!body?.folderId) {
      return NextResponse.json({ error: 'folderId ist erforderlich' }, { status: 400 })
    }

    const dryRun = body.dryRun === true
    const direction: SyncDirection = body.direction || 'both'

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const config = getShadowTwinConfig(library)
    const storageExpected = config.primaryStore === 'filesystem' || config.persistToFilesystem

    const provider = await getServerProvider(userEmail, libraryId)
    if (!provider) {
      return NextResponse.json({ error: 'Storage-Provider nicht verfügbar' }, { status: 500 })
    }

    FileLogger.info('shadow-twins/sync-all', 'Starte Sync', {
      folderId: body.folderId, recursive: body.recursive, dryRun, direction,
    })

    const cache = new FolderCache(provider)
    const files = await listFilesRecursively(cache, body.folderId, body.recursive !== false)
    report.scanned = files.length

    // Batch-weise MongoDB-Dokumente laden
    const BATCH_SIZE = 100
    const allDocs = new Map<string, ShadowTwinDocument>()
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      const docs = await getShadowTwinsBySourceIds({
        libraryId,
        sourceIds: batch.map((f) => f.id),
      })
      for (const [id, doc] of docs) allDocs.set(id, doc)
    }

    // Pro Datei mit Shadow-Twin: Artefakte synchronisieren
    for (const file of files) {
      const doc = allDocs.get(file.id)
      if (!doc) continue

      report.withShadowTwin++
      const sourceModifiedAt = toDate(file.metadata.modifiedAt)

      // Transcript-Artefakte
      if (doc.artifacts?.transcript) {
        for (const [lang, record] of Object.entries(doc.artifacts.transcript)) {
          const result = await syncArtifact(
            cache, provider, libraryId, doc, sourceModifiedAt,
            'transcript', lang, record, undefined, storageExpected, direction, dryRun,
          )
          if (result.action === 'synced-to-mongo') report.markdownToCache++
          else if (result.action === 'written-to-storage') report.markdownToStorage++
          else if (result.action === 'already-synced') report.alreadySynced++
          else if (result.action === 'source-newer') report.sourceNewer++
          else if (result.action === 'error') report.errors++

          if (report.details.length < MAX_DETAILS) {
            report.details.push(result)
          } else {
            report.detailsTruncated = true
          }
        }
      }

      // Transformation-Artefakte
      if (doc.artifacts?.transformation) {
        for (const [tmpl, langRecords] of Object.entries(doc.artifacts.transformation)) {
          for (const [lang, record] of Object.entries(langRecords)) {
            const result = await syncArtifact(
              cache, provider, libraryId, doc, sourceModifiedAt,
              'transformation', lang, record, tmpl, storageExpected, direction, dryRun,
            )
            if (result.action === 'synced-to-mongo') report.markdownToCache++
            else if (result.action === 'written-to-storage') report.markdownToStorage++
            else if (result.action === 'already-synced') report.alreadySynced++
            else if (result.action === 'source-newer') report.sourceNewer++
            else if (result.action === 'error') report.errors++

            if (report.details.length < MAX_DETAILS) {
              report.details.push(result)
            } else {
              report.detailsTruncated = true
            }
          }
        }
      }

      // Binary Fragments (Bilder) → nur bei to-storage oder both
      // Bei explizitem Export (to-storage) ist storageExpected irrelevant
      if (direction !== 'to-cache' && (storageExpected || direction === 'to-storage')) {
        await syncBinaryFragments(cache, provider, doc, dryRun, report, MAX_DETAILS)
      }
    }

    FileLogger.info('shadow-twins/sync-all', 'Sync abgeschlossen', {
      dryRun, direction, scanned: report.scanned, withShadowTwin: report.withShadowTwin,
      markdownToCache: report.markdownToCache, markdownToStorage: report.markdownToStorage,
      imagesWritten: report.imagesWritten, errors: report.errors,
    })

    return NextResponse.json({ success: report.errors === 0, report }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/sync-all', 'Sync fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg, report }, { status: 500 })
  }
}
