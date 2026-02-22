/**
 * @fileoverview Sync Shadow-Twin von MongoDB nach Storage
 *
 * @description
 * Liest Artefakt-Markdown aus MongoDB und schreibt es als Datei in den
 * Storage (Filesystem/OneDrive/Nextcloud). Wird ausgelöst, wenn
 * "Storage fehlt" erkannt wird – Datei existiert in MongoDB, aber nicht im Storage.
 *
 * Ablauf:
 * 1. Shadow-Twin-Dokument aus MongoDB laden
 * 2. Shadow-Twin-Ordner im Storage finden oder erstellen
 * 3. Für jedes Artefakt ohne Storage-Datei: Markdown als .md-Datei hochladen
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
import { findShadowTwinFolder, generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'

/** Request-Body */
interface SyncRequest {
  sourceId: string
  parentId?: string
}

/** Ergebnis pro Artefakt */
interface SyncResult {
  kind: 'transcript' | 'transformation'
  targetLanguage: string
  templateName?: string
  fileName: string
  success: boolean
  error?: string
}

/**
 * Shadow-Twin-Ordner finden oder erstellen.
 * Sucht bestehenden Ordner (_name/ oder .name/), erstellt bei Bedarf neuen.
 */
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

/**
 * Prüft ob eine Datei bereits im Shadow-Twin-Ordner existiert.
 */
async function fileExistsInFolder(
  provider: StorageProvider,
  folderId: string,
  fileName: string,
): Promise<boolean> {
  try {
    const items = await provider.listItemsById(folderId)
    return items.some((item) => item.type === 'file' && item.metadata.name === fileName)
  } catch {
    return false
  }
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
    const body = (await request.json()) as SyncRequest

    if (!body?.sourceId) {
      return NextResponse.json({ error: 'sourceId ist erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const config = getShadowTwinConfig(library)

    // Provider laden
    const provider = await getServerProvider(userEmail, libraryId)
    if (!provider) {
      return NextResponse.json({ error: 'Storage-Provider nicht verfügbar' }, { status: 500 })
    }

    // Shadow-Twin-Dokument aus MongoDB laden
    const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [body.sourceId] })
    const doc: ShadowTwinDocument | undefined = docs.get(body.sourceId)

    if (!doc) {
      return NextResponse.json({ error: 'Kein Shadow-Twin-Dokument in MongoDB gefunden' }, { status: 404 })
    }

    const parentId = body.parentId || doc.parentId || ''
    const sourceName = doc.sourceName || ''

    if (!parentId) {
      return NextResponse.json({ error: 'parentId konnte nicht ermittelt werden' }, { status: 400 })
    }

    // Shadow-Twin-Ordner finden oder erstellen
    let folder: StorageItem
    try {
      folder = await ensureShadowTwinFolder(provider, parentId, sourceName)
    } catch (err) {
      return NextResponse.json({
        error: `Shadow-Twin-Ordner konnte nicht erstellt werden: ${err instanceof Error ? err.message : String(err)}`,
      }, { status: 500 })
    }

    const results: SyncResult[] = []

    // Transcript-Artefakte in Storage schreiben
    if (doc.artifacts?.transcript) {
      for (const [lang, record] of Object.entries(doc.artifacts.transcript)) {
        const fileName = buildArtifactName(
          { sourceId: body.sourceId, kind: 'transcript', targetLanguage: lang },
          sourceName,
        )

        // Nur schreiben, wenn Datei noch nicht existiert
        const exists = await fileExistsInFolder(provider, folder.id, fileName)
        if (exists) {
          results.push({ kind: 'transcript', targetLanguage: lang, fileName, success: true, error: 'Datei existiert bereits' })
          continue
        }

        if (!record.markdown?.trim()) {
          results.push({ kind: 'transcript', targetLanguage: lang, fileName, success: false, error: 'Leeres Markdown in MongoDB' })
          continue
        }

        try {
          await provider.uploadFile(
            folder.id,
            new File([record.markdown], fileName, { type: 'text/markdown' })
          )
          results.push({ kind: 'transcript', targetLanguage: lang, fileName, success: true })
          FileLogger.info('shadow-twins/sync-to-storage', `Transcript ${lang} von MongoDB nach Storage geschrieben`, {
            sourceId: body.sourceId, fileName, folderId: folder.id,
          })
        } catch (err) {
          results.push({ kind: 'transcript', targetLanguage: lang, fileName, success: false, error: err instanceof Error ? err.message : String(err) })
        }
      }
    }

    // Transformation-Artefakte in Storage schreiben
    if (doc.artifacts?.transformation) {
      for (const [templateName, langRecords] of Object.entries(doc.artifacts.transformation)) {
        for (const [lang, record] of Object.entries(langRecords)) {
          const fileName = buildArtifactName(
            { sourceId: body.sourceId, kind: 'transformation', targetLanguage: lang, templateName },
            sourceName,
          )

          const exists = await fileExistsInFolder(provider, folder.id, fileName)
          if (exists) {
            results.push({ kind: 'transformation', targetLanguage: lang, templateName, fileName, success: true, error: 'Datei existiert bereits' })
            continue
          }

          if (!record.markdown?.trim()) {
            results.push({ kind: 'transformation', targetLanguage: lang, templateName, fileName, success: false, error: 'Leeres Markdown in MongoDB' })
            continue
          }

          try {
            await provider.uploadFile(
              folder.id,
              new File([record.markdown], fileName, { type: 'text/markdown' })
            )
            results.push({ kind: 'transformation', targetLanguage: lang, templateName, fileName, success: true })
            FileLogger.info('shadow-twins/sync-to-storage', `Transformation ${templateName}/${lang} von MongoDB nach Storage geschrieben`, {
              sourceId: body.sourceId, fileName, folderId: folder.id,
            })
          } catch (err) {
            results.push({ kind: 'transformation', targetLanguage: lang, templateName, fileName, success: false, error: err instanceof Error ? err.message : String(err) })
          }
        }
      }
    }

    const written = results.filter((r) => r.success && !r.error?.includes('existiert bereits')).length
    const skipped = results.filter((r) => r.error?.includes('existiert bereits')).length
    const failed = results.filter((r) => !r.success).length

    // Wenn persistToFilesystem nicht aktiv ist, warnen
    if (!config.persistToFilesystem && config.primaryStore !== 'filesystem') {
      FileLogger.warn('shadow-twins/sync-to-storage', 'persistToFilesystem ist deaktiviert – manueller Sync ausgeführt', {
        sourceId: body.sourceId,
      })
    }

    return NextResponse.json({
      success: failed === 0,
      written,
      skipped,
      failed,
      folderId: folder.id,
      folderName: folder.metadata.name,
      results,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/sync-to-storage', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
