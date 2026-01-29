/**
 * @fileoverview Shadow-Twin Binary Fragment URL Resolver API
 *
 * @description
 * Löst die URL eines Binary-Fragments auf.
 * Verwendet den ShadowTwinService zur Storage-Abstraktion:
 * - Wenn Azure-URL vorhanden → direkt verwenden
 * - Wenn nur fileId vorhanden → Storage-API-URL generieren
 * 
 * Das Frontend muss sich nicht um die Storage-Details kümmern.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { FileLogger } from '@/lib/debug/logger'

interface RequestBody {
  /** ID der Quelldatei */
  sourceId: string
  /** Name der Quelldatei */
  sourceName: string
  /** Parent-ID der Quelldatei */
  parentId: string
  /** Name des Binary-Fragments (z.B. "cover_generated_2026-01-20_12-20-43.png") */
  fragmentName: string
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
    const body = await request.json() as RequestBody

    if (!body?.sourceId || !body?.fragmentName) {
      return NextResponse.json({ error: 'sourceId und fragmentName sind erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // Erstelle ShadowTwinService
    const service = await ShadowTwinService.create({
      library,
      userEmail,
      sourceId: body.sourceId,
      sourceName: body.sourceName || '',
      parentId: body.parentId || '',
    })

    // Debug: Lade alle Fragmente für Diagnose
    const allFragments = await service.getBinaryFragments()
    
    FileLogger.info('shadow-twins/resolve-binary-url', 'Debug: Fragmente geladen', {
      sourceId: body.sourceId,
      fragmentName: body.fragmentName,
      fragmentCount: allFragments?.length ?? 0,
      fragmentNames: allFragments?.map(f => f.name) ?? [],
      fragmentsWithUrl: allFragments?.filter(f => f.url).length ?? 0,
      fragmentsWithFileId: allFragments?.filter(f => f.fileId).length ?? 0,
    })

    // Löse Binary-Fragment-URL auf
    const resolvedUrl = await service.resolveBinaryFragmentUrl(body.fragmentName)

    if (!resolvedUrl) {
      FileLogger.warn('shadow-twins/resolve-binary-url', 'Fragment nicht gefunden', {
        fragmentName: body.fragmentName,
        sourceId: body.sourceId,
        availableFragments: allFragments?.map(f => ({ name: f.name, hasUrl: !!f.url, hasFileId: !!f.fileId })) ?? [],
      })
      return NextResponse.json({ 
        error: 'Fragment nicht gefunden',
        fragmentName: body.fragmentName,
        sourceId: body.sourceId,
        availableFragments: allFragments?.map(f => f.name) ?? [],
      }, { status: 404 })
    }

    return NextResponse.json({ 
      resolvedUrl,
      fragmentName: body.fragmentName,
    }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/resolve-binary-url', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
