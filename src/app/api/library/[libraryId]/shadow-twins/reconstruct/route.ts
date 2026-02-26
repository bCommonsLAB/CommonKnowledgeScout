/**
 * @fileoverview Shadow-Twin aus Storage rekonstruieren (API-Route)
 *
 * @description
 * API-Route fuer manuelle Rekonstruktion via Banner-Button.
 * Die eigentliche Logik liegt in reconstruct-from-storage.ts.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { reconstructFromFolder } from '@/lib/shadow-twin/reconstruct-from-storage'
import { FileLogger } from '@/lib/debug/logger'

interface ReconstructRequest {
  sourceId: string
  parentId: string
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
    const body = (await request.json()) as ReconstructRequest

    if (!body?.sourceId || !body?.parentId) {
      return NextResponse.json(
        { error: 'sourceId und parentId sind erforderlich' },
        { status: 400 },
      )
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const provider = await getServerProvider(userEmail, libraryId)
    if (!provider) {
      return NextResponse.json({ error: 'Storage-Provider nicht verfügbar' }, { status: 500 })
    }

    // Quelldatei-Informationen laden (Name fuer parseArtifactName)
    let sourceName = ''
    try {
      const sourceItem = await provider.getItemById(body.sourceId)
      sourceName = sourceItem?.metadata?.name || ''
    } catch {
      FileLogger.warn('shadow-twins/reconstruct', 'Quelldatei konnte nicht geladen werden', {
        sourceId: body.sourceId,
      })
    }

    if (!sourceName) {
      return NextResponse.json(
        { error: 'Quelldatei nicht im Storage gefunden' },
        { status: 404 },
      )
    }

    // Shadow-Twin-Ordner suchen
    const shadowTwinFolder = await findShadowTwinFolder(body.parentId, sourceName, provider)

    if (!shadowTwinFolder) {
      return NextResponse.json({
        success: false,
        message: 'Kein Shadow-Twin-Ordner im Storage gefunden',
        artifacts: [],
      })
    }

    // Artefakte rekonstruieren
    const artifacts = await reconstructFromFolder({
      provider,
      libraryId,
      userEmail,
      sourceId: body.sourceId,
      sourceName,
      parentId: body.parentId,
      shadowTwinFolderId: shadowTwinFolder.id,
    })

    const succeeded = artifacts.filter((a) => a.success).length
    const failed = artifacts.filter((a) => !a.success).length

    return NextResponse.json({
      success: failed === 0 && succeeded > 0,
      reconstructed: succeeded,
      failed,
      shadowTwinFolder: shadowTwinFolder.metadata.name,
      artifacts,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/reconstruct', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
