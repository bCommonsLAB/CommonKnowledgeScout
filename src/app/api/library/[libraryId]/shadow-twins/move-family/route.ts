/**
 * @fileoverview Familien-Umzug-API (Welle 0e)
 *
 * @description
 * POST: Verschiebt/benennt eine Quelle MIT ihrer Twin-Familie um
 * (Import → Siblings → Quelle → Mongo → alter Spiegel weg → Export).
 * Aufrufer: Archiv-Baumansicht (Umbenennen, Ausschneiden/Einfuegen,
 * Drag & Drop); spaeter das MCP-Werkzeug `familie_umziehen`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { moveFamily } from '@/lib/shadow-twin/move-family'
import { FileLogger } from '@/lib/debug/logger'

export const maxDuration = 300

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
      newName?: string
      newParentId?: string
    }
    if (!body?.sourceId || (!body.newName && !body.newParentId)) {
      return NextResponse.json(
        { error: 'sourceId und newName oder newParentId sind erforderlich' },
        { status: 400 }
      )
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const provider = await getServerProvider(userEmail, libraryId)
    const result = await moveFamily({
      library, libraryId, userEmail, provider,
      sourceId: body.sourceId, newName: body.newName, newParentId: body.newParentId,
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    FileLogger.error('api/shadow-twins/move-family', 'Familien-Umzug fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}
