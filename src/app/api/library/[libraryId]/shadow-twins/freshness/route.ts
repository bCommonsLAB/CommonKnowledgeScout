/**
 * @fileoverview Shadow-Twin Freshness API
 *
 * @description
 * Liefert pro Artefakt einen Timestamp-Vergleich zwischen MongoDB und Storage.
 * Storage-Provider-unabhängig – funktioniert mit Filesystem, OneDrive, Nextcloud.
 *
 * Vergleicht:
 * 1. Source-Datei modifiedAt vs. Artefakt MongoDB updatedAt
 * 2. Artefakt MongoDB updatedAt vs. Artefakt-Datei im Storage modifiedAt
 *    (nur wenn persistToFilesystem aktiv oder primaryStore=filesystem)
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getShadowTwinsBySourceIds, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'

/** Freshness-Status pro Artefakt */
export type ArtifactFreshnessStatus =
  | 'synced'           // Alles konsistent
  | 'source-newer'     // Quelldatei wurde nach dem Artefakt geändert
  | 'storage-newer'    // Datei im Storage ist neuer als MongoDB
  | 'mongo-newer'      // MongoDB ist neuer als Datei im Storage
  | 'storage-missing'  // Datei existiert nicht im Storage (obwohl erwartet)
  | 'mongo-missing'    // Kein Eintrag in MongoDB

/** Ergebnis pro Artefakt */
interface ArtifactFreshness {
  kind: 'transcript' | 'transformation'
  targetLanguage: string
  templateName?: string
  fileName: string
  status: ArtifactFreshnessStatus
  mongo: { updatedAt: string; createdAt: string } | null
  storage: { modifiedAt: string; fileId: string } | null
}

/** API-Response */
interface FreshnessResponse {
  sourceFile: {
    id: string
    name: string
    modifiedAt: string | null
  }
  documentUpdatedAt: string | null
  artifacts: ArtifactFreshness[]
  config: {
    primaryStore: string
    persistToFilesystem: boolean
    allowFilesystemFallback: boolean
  }
}

/**
 * Sucht eine Artefakt-Datei im Storage anhand des erwarteten Namens.
 *
 * Suchreihenfolge:
 * 1. shadowTwinFolderId (aus MongoDB, wenn explizit gesetzt)
 * 2. Unterstrich-/Dot-Folder via findShadowTwinFolder() (z.B. _document.pdf/)
 * 3. Sibling-Datei neben der Quelle
 */
async function findArtifactInStorage(
  provider: StorageProvider,
  parentId: string,
  shadowTwinFolderId: string | null | undefined,
  sourceName: string,
  expectedFileName: string,
): Promise<StorageItem | null> {
  // 1. Im explizit gesetzten Shadow-Twin-Ordner suchen
  if (shadowTwinFolderId) {
    try {
      const items = await provider.listItemsById(shadowTwinFolderId)
      const found = items.find(
        (item) => item.type === 'file' && item.metadata.name === expectedFileName
      )
      if (found) return found
    } catch {
      // Ordner existiert nicht oder Fehler → weiter
    }
  }

  // 2. Unterstrich-/Dot-Folder über Namenskonvention suchen (_sourceName/)
  if (parentId && sourceName) {
    try {
      const folder = await findShadowTwinFolder(parentId, sourceName, provider)
      if (folder) {
        const items = await provider.listItemsById(folder.id)
        const found = items.find(
          (item) => item.type === 'file' && item.metadata.name === expectedFileName
        )
        if (found) return found
      }
    } catch {
      // Ordner nicht gefunden → weiter
    }
  }

  // 3. Als Sibling-Datei neben der Quelle suchen
  try {
    const siblings = await provider.listItemsById(parentId)
    const found = siblings.find(
      (item) => item.type === 'file' && item.metadata.name === expectedFileName
    )
    if (found) return found
  } catch {
    // Fehler beim Lesen → null
  }

  return null
}

/**
 * Bestimmt den Freshness-Status eines einzelnen Artefakts.
 */
function computeStatus(
  sourceModifiedAt: Date | null,
  mongoUpdatedAt: Date | null,
  storageModifiedAt: Date | null,
  storageExpected: boolean,
): ArtifactFreshnessStatus {
  if (!mongoUpdatedAt) return 'mongo-missing'
  if (storageExpected && !storageModifiedAt) return 'storage-missing'

  // Vergleich 1: Source vs. MongoDB
  if (sourceModifiedAt && mongoUpdatedAt && sourceModifiedAt.getTime() > mongoUpdatedAt.getTime()) {
    return 'source-newer'
  }

  // Vergleich 2: MongoDB vs. Storage (nur wenn Datei existiert)
  if (storageModifiedAt && mongoUpdatedAt) {
    const diffMs = storageModifiedAt.getTime() - mongoUpdatedAt.getTime()
    // Toleranz: 5 Sekunden (Schreibvorgänge können leicht asynchron sein)
    if (diffMs > 5000) return 'storage-newer'
    if (diffMs < -5000) return 'mongo-newer'
  }

  return 'synced'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const body = (await request.json()) as { sourceId: string; parentId?: string }

    if (!body?.sourceId) {
      return NextResponse.json({ error: 'sourceId ist erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const shadowTwinConfig = getShadowTwinConfig(library)

    // Provider laden (für Storage-Datei-Lookup)
    let provider: StorageProvider | null = null
    try {
      provider = await getServerProvider(userEmail, libraryId)
    } catch (err) {
      FileLogger.warn('shadow-twins/freshness', 'Provider nicht verfügbar', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // Quelldatei-Metadaten aus Storage laden
    let sourceModifiedAt: Date | null = null
    let sourceName = ''
    if (provider) {
      try {
        const sourceItem = await provider.getItemById(body.sourceId)
        sourceModifiedAt = sourceItem.metadata.modifiedAt instanceof Date
          ? sourceItem.metadata.modifiedAt
          : new Date(sourceItem.metadata.modifiedAt)
        sourceName = sourceItem.metadata.name
      } catch {
        FileLogger.warn('shadow-twins/freshness', 'Quelldatei nicht im Storage gefunden', {
          sourceId: body.sourceId,
        })
      }
    }

    // Shadow-Twin-Dokument aus MongoDB laden
    const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [body.sourceId] })
    const doc: ShadowTwinDocument | undefined = docs.get(body.sourceId)

    const artifacts: ArtifactFreshness[] = []

    // Ob wir eine Storage-Datei erwarten (persistToFilesystem oder primaryStore=filesystem)
    const storageExpected =
      shadowTwinConfig.primaryStore === 'filesystem' || shadowTwinConfig.persistToFilesystem

    // Shadow-Twin-Ordner-ID (aus dem Dokument oder parentId)
    const shadowTwinFolderId = doc?.filesystemSync?.shadowTwinFolderId || null
    const parentId = body.parentId || doc?.parentId || ''

    if (doc) {
      // Transcript-Artefakte verarbeiten
      if (doc.artifacts?.transcript) {
        for (const [lang, record] of Object.entries(doc.artifacts.transcript)) {
          const fileName = buildArtifactName(
            { sourceId: body.sourceId, kind: 'transcript', targetLanguage: lang },
            doc.sourceName || sourceName
          )

          const mongoUpdatedAt = record.updatedAt ? new Date(record.updatedAt) : null

          // Storage-Datei suchen (wenn erwartet)
          let storageItem: StorageItem | null = null
          if (storageExpected && provider && parentId) {
            storageItem = await findArtifactInStorage(
              provider, parentId, shadowTwinFolderId, doc.sourceName || sourceName, fileName
            )
          }

          const storageModifiedAt = storageItem?.metadata?.modifiedAt
            ? (storageItem.metadata.modifiedAt instanceof Date
              ? storageItem.metadata.modifiedAt
              : new Date(storageItem.metadata.modifiedAt))
            : null

          artifacts.push({
            kind: 'transcript',
            targetLanguage: lang,
            fileName,
            status: computeStatus(sourceModifiedAt, mongoUpdatedAt, storageModifiedAt, storageExpected),
            mongo: record
              ? { updatedAt: record.updatedAt, createdAt: record.createdAt }
              : null,
            storage: storageItem
              ? { modifiedAt: storageModifiedAt!.toISOString(), fileId: storageItem.id }
              : null,
          })
        }
      }

      // Transformation-Artefakte verarbeiten
      if (doc.artifacts?.transformation) {
        for (const [templateName, langRecords] of Object.entries(doc.artifacts.transformation)) {
          for (const [lang, record] of Object.entries(langRecords)) {
            const fileName = buildArtifactName(
              { sourceId: body.sourceId, kind: 'transformation', targetLanguage: lang, templateName },
              doc.sourceName || sourceName
            )

            const mongoUpdatedAt = record.updatedAt ? new Date(record.updatedAt) : null

            let storageItem: StorageItem | null = null
            if (storageExpected && provider && parentId) {
              storageItem = await findArtifactInStorage(
                provider, parentId, shadowTwinFolderId, doc.sourceName || sourceName, fileName
              )
            }

            const storageModifiedAt = storageItem?.metadata?.modifiedAt
              ? (storageItem.metadata.modifiedAt instanceof Date
                ? storageItem.metadata.modifiedAt
                : new Date(storageItem.metadata.modifiedAt))
              : null

            artifacts.push({
              kind: 'transformation',
              targetLanguage: lang,
              templateName,
              fileName,
              status: computeStatus(sourceModifiedAt, mongoUpdatedAt, storageModifiedAt, storageExpected),
              mongo: record
                ? { updatedAt: record.updatedAt, createdAt: record.createdAt }
                : null,
              storage: storageItem
                ? { modifiedAt: storageModifiedAt!.toISOString(), fileId: storageItem.id }
                : null,
            })
          }
        }
      }
    }

    const response: FreshnessResponse = {
      sourceFile: {
        id: body.sourceId,
        name: sourceName,
        modifiedAt: sourceModifiedAt?.toISOString() || null,
      },
      documentUpdatedAt: doc?.updatedAt || null,
      artifacts,
      config: {
        primaryStore: shadowTwinConfig.primaryStore,
        persistToFilesystem: shadowTwinConfig.persistToFilesystem,
        allowFilesystemFallback: shadowTwinConfig.allowFilesystemFallback,
      },
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/freshness', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
