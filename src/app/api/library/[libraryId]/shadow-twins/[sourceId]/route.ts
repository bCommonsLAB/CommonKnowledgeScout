/**
 * @fileoverview API Route fuer Shadow-Twin-Artefakte einer Quelldatei
 *
 * GET /api/library/[libraryId]/shadow-twins/[sourceId]
 *   Gibt alle Artefakte (alle Sprachen, alle Templates) als flache Liste zurueck.
 *
 * DELETE /api/library/[libraryId]/shadow-twins/[sourceId]
 *   Ohne Query-Parameter: Loescht ALLE Artefakte fuer diese Quelldatei.
 *   Mit ?kind=transcript&lang=de: Loescht nur das spezifische Artefakt.
 *     Loescht sowohl aus MongoDB als auch aus dem Storage (Filesystem/Nextdrive).
 */

import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import {
  deleteShadowTwinBySourceId,
  deleteShadowTwinArtifact,
  getAllArtifacts,
  getShadowTwinsBySourceIds,
} from '@/lib/repositories/shadow-twin-repo'
import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { getServerProvider } from '@/lib/storage/server-provider'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { FileLogger } from '@/lib/debug/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    libraryId: string
    sourceId: string
  }>
}

/**
 * GET: Gibt alle Artefakte (alle Sprachen, alle Templates) fuer eine Quelldatei zurueck.
 */
export async function GET(
  _request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const user = await currentUser()
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { libraryId, sourceId } = await context.params
    if (!libraryId || !sourceId) {
      return NextResponse.json({ error: 'libraryId und sourceId sind erforderlich' }, { status: 400 })
    }

    const decodedSourceId = decodeURIComponent(sourceId)
    const artifacts = await getAllArtifacts({ libraryId, sourceId: decodedSourceId })

    return NextResponse.json({ artifacts })
  } catch (error) {
    console.error('Fehler beim Laden der Shadow-Twin-Artefakte:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}

/**
 * Versucht eine Artefakt-Datei im Storage zu loeschen.
 * Sucht das Shadow-Twin-Verzeichnis, findet die Datei per Name und loescht sie.
 * Fehler werden geloggt, aber nicht geworfen (best-effort).
 */
async function deleteArtifactFromStorage(args: {
  userEmail: string
  libraryId: string
  parentId: string
  sourceName: string
  kind: ArtifactKind
  targetLanguage: string
  templateName?: string
}): Promise<boolean> {
  try {
    const provider = await getServerProvider(args.userEmail, args.libraryId)
    const folder = await findShadowTwinFolder(args.parentId, args.sourceName, provider)
    if (!folder) return false

    const expectedFileName = buildArtifactName(
      {
        sourceId: '', // wird fuer den Dateinamen nicht benoetigt
        kind: args.kind,
        targetLanguage: args.targetLanguage,
        templateName: args.templateName,
      },
      args.sourceName
    )

    const items = await provider.listItemsById(folder.id)
    const file = items.find(
      (item) => item.type === 'file' && item.metadata.name === expectedFileName
    )
    if (!file) return false

    await provider.deleteItem(file.id)
    FileLogger.info('shadow-twin-delete', 'Storage-Datei geloescht', {
      fileName: expectedFileName,
      folderId: folder.id,
    })
    return true
  } catch (error) {
    FileLogger.warn('shadow-twin-delete', 'Storage-Loeschung fehlgeschlagen (best-effort)', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * DELETE: Loescht Shadow-Twin-Artefakte fuer eine Quelldatei.
 * Ohne Query-Parameter werden ALLE Artefakte geloescht.
 * Mit kind+lang wird nur ein einzelnes Artefakt entfernt (MongoDB + Storage).
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { libraryId, sourceId } = await context.params

    if (!libraryId || !sourceId) {
      return NextResponse.json(
        { error: 'libraryId und sourceId sind erforderlich' },
        { status: 400 }
      )
    }

    const decodedSourceId = decodeURIComponent(sourceId)

    // Query-Parameter auslesen: kind, lang, template (optional)
    const kind = request.nextUrl.searchParams.get('kind') as ArtifactKind | null
    const lang = request.nextUrl.searchParams.get('lang')

    // Wenn kind+lang angegeben: Nur ein einzelnes Artefakt loeschen
    if (kind && lang) {
      const template = request.nextUrl.searchParams.get('template') || undefined

      // 1. MongoDB: Artefakt entfernen
      const deleted = await deleteShadowTwinArtifact({
        libraryId,
        sourceId: decodedSourceId,
        artifactKey: {
          sourceId: decodedSourceId,
          kind,
          targetLanguage: lang,
          templateName: template,
        },
      })

      // 2. Storage: Datei loeschen (best-effort)
      let storageDeleted = false
      const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [decodedSourceId] })
      const doc = docs.get(decodedSourceId)
      if (doc?.parentId && doc?.sourceName) {
        storageDeleted = await deleteArtifactFromStorage({
          userEmail,
          libraryId,
          parentId: doc.parentId,
          sourceName: doc.sourceName,
          kind,
          targetLanguage: lang,
          templateName: template,
        })
      }

      return NextResponse.json({
        success: deleted,
        storageDeleted,
        message: deleted
          ? `Artefakt ${kind}/${lang}${template ? `/${template}` : ''} wurde geloescht`
          : 'Artefakt nicht gefunden oder bereits geloescht',
        libraryId,
        sourceId: decodedSourceId,
        artifact: { kind, lang, template },
      })
    }

    // Kein kind/lang: Gesamtes Shadow-Twin-Dokument loeschen
    await deleteShadowTwinBySourceId(libraryId, decodedSourceId)

    return NextResponse.json({
      success: true,
      message: 'Alle Shadow-Twin-Artefakte wurden geloescht',
      libraryId,
      sourceId: decodedSourceId,
    })
  } catch (error) {
    console.error('Fehler beim Loeschen der Shadow-Twins:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
