/**
 * @fileoverview Sync Shadow-Twin von Storage nach MongoDB
 *
 * @description
 * Liest Artefakt-Dateien aus dem Storage (Filesystem/OneDrive/Nextcloud) und
 * aktualisiert die entsprechenden MongoDB-Einträge. Wird ausgelöst, wenn
 * "Storage neuer" erkannt wird – statt Pipeline-Dialog einfach Datei-Sync.
 *
 * Ablauf:
 * 1. Freshness berechnen (welche Artefakte sind storage-newer?)
 * 2. Betroffene Dateien aus dem Storage lesen (getBinary → text)
 * 3. Markdown in MongoDB aktualisieren (updateShadowTwinArtifactMarkdown)
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getShadowTwinsBySourceIds, readTranscriptRecord, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { updateShadowTwinArtifactMarkdown } from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'
import { buildArtifactName, parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { selectFullestStorageVariant } from '@/lib/shadow-twin/select-fullest-storage-variant'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

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
 * Sucht Artefakt-Datei im Storage (gleiche Logik wie freshness/route.ts).
 */
async function findArtifactInStorage(
  provider: StorageProvider,
  parentId: string,
  shadowTwinFolderId: string | null | undefined,
  sourceName: string,
  expectedFileName: string,
): Promise<StorageItem | null> {
  if (shadowTwinFolderId) {
    try {
      const items = await provider.listItemsById(shadowTwinFolderId)
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
        const items = await provider.listItemsById(folder.id)
        const found = items.find(
          (item) => item.type === 'file' && item.metadata.name === expectedFileName
        )
        if (found) return found
      }
    } catch { /* weiter */ }
  }

  try {
    const siblings = await provider.listItemsById(parentId)
    const found = siblings.find(
      (item) => item.type === 'file' && item.metadata.name === expectedFileName
    )
    if (found) return found
  } catch { /* weiter */ }

  return null
}

/**
 * Listet ALLE Transkript-Varianten der Quelle im Storage ({base}.md + {base}.{lang}.md).
 * Sucht — wie findArtifactInStorage — im Shadow-Twin-Ordner, dann Sibling-Ordner, dann Geschwister.
 * Gibt die erste Fundstelle mit Kandidaten zurueck (die maßgebliche Ablage der Quelle).
 */
async function listTranscriptCandidates(
  provider: StorageProvider,
  parentId: string,
  shadowTwinFolderId: string | null | undefined,
  sourceName: string,
  sourceBaseName: string,
): Promise<StorageItem[]> {
  const collect = (items: StorageItem[]): StorageItem[] =>
    items.filter(
      (it) =>
        it.type === 'file' &&
        it.metadata.name.toLowerCase().endsWith('.md') &&
        parseArtifactName(it.metadata.name, sourceBaseName).kind === 'transcript',
    )

  if (shadowTwinFolderId) {
    try {
      const found = collect(await provider.listItemsById(shadowTwinFolderId))
      if (found.length) return found
    } catch { /* weiter */ }
  }
  if (parentId && sourceName) {
    try {
      const folder = await findShadowTwinFolder(parentId, sourceName, provider)
      if (folder) {
        const found = collect(await provider.listItemsById(folder.id))
        if (found.length) return found
      }
    } catch { /* weiter */ }
  }
  try {
    return collect(await provider.listItemsById(parentId))
  } catch {
    return []
  }
}

/**
 * Prüft ob Storage-Datei neuer als MongoDB ist.
 * Toleranz: 5 Sekunden.
 */
function isStorageNewer(mongoUpdatedAt: Date, storageModifiedAt: Date): boolean {
  return storageModifiedAt.getTime() - mongoUpdatedAt.getTime() > 5000
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
      return NextResponse.json({ error: 'Kein Shadow-Twin-Dokument gefunden' }, { status: 404 })
    }

    const shadowTwinFolderId = doc.filesystemSync?.shadowTwinFolderId || null
    const parentId = body.parentId || doc.parentId || ''
    const sourceName = doc.sourceName || ''
    const sourceBaseName = sourceName.replace(/\.[^.]+$/, '')
    const storageExpected =
      config.primaryStore === 'filesystem' || config.persistToFilesystem

    if (!storageExpected) {
      return NextResponse.json(
        { error: 'Filesystem-Sync ist für diese Bibliothek nicht aktiviert' },
        { status: 400 }
      )
    }

    const results: SyncResult[] = []

    // Transcript ist sprach-neutral (max. ein Record). Mehrere Storage-Varianten?
    // VOLLSTAENDIGSTER gewinnt (nicht suffixlos/neuer) – konsistent mit resolve/reconstruct.
    {
      const transcriptRecord = readTranscriptRecord(doc)
      const canonicalName = buildArtifactName(
        { sourceId: body.sourceId, kind: 'transcript', targetLanguage: '' },
        sourceName,
      )
      const mongoDate = transcriptRecord?.updatedAt ? new Date(transcriptRecord.updatedAt) : null
      const candidates = await listTranscriptCandidates(provider, parentId, shadowTwinFolderId, sourceName, sourceBaseName)
      const sel = candidates.length > 0
        ? await selectFullestStorageVariant(provider, candidates, canonicalName)
        : null

      if (!sel || !sel.best || !mongoDate) {
        results.push({ kind: 'transcript', targetLanguage: '', fileName: canonicalName, success: false, error: 'Datei nicht gefunden oder Mongo-Datum fehlt' })
      } else if (sel.conflict) {
        results.push({ kind: 'transcript', targetLanguage: '', fileName: canonicalName, success: false, error: 'Konflikt: mehrere gleich vollstaendige Varianten – manuell pruefen' })
      } else {
        const winner = sel.best.ref
        const storageMod = winner.metadata.modifiedAt instanceof Date
          ? winner.metadata.modifiedAt
          : new Date(winner.metadata.modifiedAt)

        if (!isStorageNewer(mongoDate, storageMod)) {
          results.push({ kind: 'transcript', targetLanguage: '', fileName: winner.metadata.name, success: true, error: 'Bereits synchron' })
        } else {
          try {
            const { blob } = await provider.getBinary(winner.id)
            const markdown = await blob.text()
            if (!markdown.trim()) {
              results.push({ kind: 'transcript', targetLanguage: '', fileName: winner.metadata.name, success: false, error: 'Leeres Markdown in Storage-Datei' })
            } else {
              const artifactKey: ArtifactKey = { sourceId: body.sourceId, kind: 'transcript', targetLanguage: '' }
              await updateShadowTwinArtifactMarkdown({ libraryId, sourceId: body.sourceId, artifactKey, markdown })
              results.push({ kind: 'transcript', targetLanguage: '', fileName: winner.metadata.name, success: true })
              FileLogger.info('shadow-twins/sync', 'Transcript (vollstaendigste Variante) synchronisiert', { sourceId: body.sourceId, fileName: winner.metadata.name })
            }
          } catch (err) {
            results.push({ kind: 'transcript', targetLanguage: '', fileName: winner.metadata.name, success: false, error: err instanceof Error ? err.message : String(err) })
          }
        }
      }
    }

    // Transformation-Artefakte synchronisieren
    if (doc.artifacts?.transformation) {
      for (const [templateName, langRecords] of Object.entries(doc.artifacts.transformation)) {
        for (const [lang, record] of Object.entries(langRecords)) {
          const fileName = buildArtifactName(
            { sourceId: body.sourceId, kind: 'transformation', targetLanguage: lang, templateName },
            sourceName,
          )
          const mongoDate = record.updatedAt ? new Date(record.updatedAt) : null

          const storageItem = await findArtifactInStorage(
            provider, parentId, shadowTwinFolderId, sourceName, fileName,
          )

          if (!storageItem || !mongoDate) {
            results.push({ kind: 'transformation', targetLanguage: lang, templateName, fileName, success: false, error: 'Datei nicht gefunden oder Mongo-Datum fehlt' })
            continue
          }

          const storageMod = storageItem.metadata.modifiedAt instanceof Date
            ? storageItem.metadata.modifiedAt
            : new Date(storageItem.metadata.modifiedAt)

          if (!isStorageNewer(mongoDate, storageMod)) {
            results.push({ kind: 'transformation', targetLanguage: lang, templateName, fileName, success: true, error: 'Bereits synchron' })
            continue
          }

          try {
            const { blob } = await provider.getBinary(storageItem.id)
            const markdown = await blob.text()

            if (!markdown.trim()) {
              results.push({ kind: 'transformation', targetLanguage: lang, templateName, fileName, success: false, error: 'Leeres Markdown in Storage-Datei' })
              continue
            }

            const artifactKey: ArtifactKey = {
              sourceId: body.sourceId,
              kind: 'transformation',
              targetLanguage: lang,
              templateName,
            }
            await updateShadowTwinArtifactMarkdown({ libraryId, sourceId: body.sourceId, artifactKey, markdown })

            results.push({ kind: 'transformation', targetLanguage: lang, templateName, fileName, success: true })
            FileLogger.info('shadow-twins/sync', `Transformation ${templateName}/${lang} von Storage nach MongoDB synchronisiert`, { sourceId: body.sourceId, fileName })
          } catch (err) {
            results.push({ kind: 'transformation', targetLanguage: lang, templateName, fileName, success: false, error: err instanceof Error ? err.message : String(err) })
          }
        }
      }
    }

    const synced = results.filter((r) => r.success && !r.error?.includes('Bereits synchron')).length
    const skipped = results.filter((r) => r.error?.includes('Bereits synchron')).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: failed === 0,
      synced,
      skipped,
      failed,
      results,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/sync', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
