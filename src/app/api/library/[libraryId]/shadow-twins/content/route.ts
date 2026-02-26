/**
 * @fileoverview Shadow-Twin Content API (Mongo)
 *
 * @description
 * Liefert und aktualisiert Shadow-Twin-Markdown aus MongoDB.
 * Bei aktiviertem persistToFilesystem wird die Aenderung auch
 * ins Storage geschrieben (Shadow-Twin-Ordner).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getShadowTwinArtifact, getShadowTwinsBySourceIds, toArtifactKey, updateShadowTwinArtifactMarkdown } from '@/lib/repositories/shadow-twin-repo'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { getServerProvider } from '@/lib/storage/server-provider'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { FileLogger } from '@/lib/debug/logger'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

function getQueryParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key)
  return value && value.trim().length > 0 ? value : null
}

export async function GET(
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
    const { searchParams } = new URL(request.url)
    const sourceId = getQueryParam(searchParams, 'sourceId')
    const kind = getQueryParam(searchParams, 'kind')
    const targetLanguage = getQueryParam(searchParams, 'targetLanguage') || 'de'
    const templateName = getQueryParam(searchParams, 'templateName') || undefined

    if (!sourceId || !kind) {
      return NextResponse.json({ error: 'sourceId und kind sind erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const shadowTwinConfig = getShadowTwinConfig(library)
    if (shadowTwinConfig.primaryStore !== 'mongo') {
      return NextResponse.json({ error: 'Mongo ist nicht aktiv' }, { status: 400 })
    }

    const record = await getShadowTwinArtifact({
      libraryId,
      sourceId,
      artifactKey: toArtifactKey({
        sourceId,
        kind: kind as 'transcript' | 'transformation',
        targetLanguage,
        templateName,
      }),
    })

    if (!record) {
      return NextResponse.json({ error: 'Artefakt nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ markdown: record.markdown }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/content', 'GET fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
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
    const body = await request.json() as {
      sourceId?: string
      kind?: 'transcript' | 'transformation'
      targetLanguage?: string
      templateName?: string
      markdown?: string
    }

    if (!body?.sourceId || !body?.kind || typeof body?.markdown !== 'string') {
      return NextResponse.json({ error: 'sourceId, kind und markdown sind erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const shadowTwinConfig = getShadowTwinConfig(library)
    if (shadowTwinConfig.primaryStore !== 'mongo') {
      return NextResponse.json({ error: 'Mongo ist nicht aktiv' }, { status: 400 })
    }

    const artifactKey: ArtifactKey = toArtifactKey({
      sourceId: body.sourceId,
      kind: body.kind,
      targetLanguage: body.targetLanguage || 'de',
      templateName: body.templateName,
    })

    // 1. MongoDB aktualisieren
    await updateShadowTwinArtifactMarkdown({
      libraryId,
      sourceId: body.sourceId,
      artifactKey,
      markdown: body.markdown,
    })

    // 2. Bei persistToFilesystem: Aenderung auch ins Storage schreiben
    let storagePersisted = false
    if (shadowTwinConfig.persistToFilesystem) {
      try {
        const provider = await getServerProvider(userEmail, libraryId)
        if (provider) {
          // Shadow-Twin-Dokument laden fuer parentId und sourceName
          const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [body.sourceId] })
          const doc = docs.get(body.sourceId)
          const parentId = doc?.parentId
          const sourceName = doc?.sourceName || ''

          if (parentId && sourceName) {
            // Shadow-Twin-Ordner finden
            const shadowTwinFolder = await findShadowTwinFolder(parentId, sourceName, provider)
            if (shadowTwinFolder) {
              const fileName = buildArtifactName(artifactKey, sourceName)
              // Bestehende Datei im Ordner suchen
              const folderItems = await provider.listItemsById(shadowTwinFolder.id)
              const existingFile = folderItems.find(
                (item) => item.type === 'file' && item.metadata.name === fileName
              )

              // Alte Version loeschen und neu hochladen
              if (existingFile) {
                await provider.deleteItem(existingFile.id)
              }

              const blob = new Blob([body.markdown], { type: 'text/markdown' })
              const file = new File([blob], fileName, { type: 'text/markdown' })
              await provider.uploadFile(shadowTwinFolder.id, file)
              storagePersisted = true

              FileLogger.info('shadow-twins/content', 'Markdown auch im Storage aktualisiert', {
                sourceId: body.sourceId, fileName, shadowTwinFolder: shadowTwinFolder.metadata.name,
              })
            } else {
              FileLogger.warn('shadow-twins/content', 'Shadow-Twin-Ordner nicht gefunden fuer Storage-Persistierung', {
                sourceId: body.sourceId, parentId, sourceName,
              })
            }
          }
        }
      } catch (storageErr) {
        // Storage-Fehler ist nicht kritisch – MongoDB wurde bereits aktualisiert
        const storageMsg = storageErr instanceof Error ? storageErr.message : String(storageErr)
        FileLogger.warn('shadow-twins/content', 'Storage-Persistierung fehlgeschlagen (MongoDB OK)', {
          sourceId: body.sourceId, error: storageMsg,
        })
      }
    }

    return NextResponse.json({ ok: true, storagePersisted }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/content', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
