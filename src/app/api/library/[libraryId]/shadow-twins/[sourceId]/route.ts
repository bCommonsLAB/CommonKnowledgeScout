/**
 * @fileoverview API Route zum Loeschen von Shadow-Twin-Artefakten
 *
 * DELETE /api/library/[libraryId]/shadow-twins/[sourceId]
 * Loescht alle Shadow-Twin-Artefakte (Transcript, Transformation) fuer eine Quelldatei.
 */

import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { deleteShadowTwinBySourceId } from '@/lib/repositories/shadow-twin-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    libraryId: string
    sourceId: string
  }>
}

/**
 * DELETE: Loescht alle Shadow-Twin-Artefakte fuer eine Quelldatei
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    // Authentifizierung pruefen
    const user = await currentUser()
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { libraryId, sourceId } = await context.params

    if (!libraryId || !sourceId) {
      return NextResponse.json(
        { error: 'libraryId und sourceId sind erforderlich' },
        { status: 400 }
      )
    }

    // SourceId dekodieren (Base64)
    const decodedSourceId = decodeURIComponent(sourceId)

    // Shadow-Twin-Dokument loeschen
    await deleteShadowTwinBySourceId(libraryId, decodedSourceId)

    return NextResponse.json({
      success: true,
      message: 'Shadow-Twin-Artefakte wurden geloescht',
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
