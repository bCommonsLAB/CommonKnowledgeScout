/**
 * @fileoverview API-Route: Aktions-Protokoll eines Vorhabens lesen.
 *
 * @description
 * GET /api/library/[libraryId]/agent-view/protokoll?folderId=…&limit=…
 * → `{ eintraege, anzahl }`
 *
 * Gegenstueck zur Begruendungs-Pflicht der MCP-Bruecke: Was Agenten beim
 * Schreiben als WARUM hinterlassen, wird hier fuer die Werkbank lesbar —
 * damit das Protokoll nicht nur ueber die Bruecke sichtbar ist (Rueckfrage
 * 27.08.2026: „wo kann ich das Protokoll lesen?").
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { FileLogger } from '@/lib/debug/logger'
import { leseAktionsProtokoll } from '@/lib/repositories/aktions-protokoll-repo'
import { LibraryService } from '@/lib/services/library-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    if (!libraryId) return NextResponse.json({ error: 'Library-ID fehlt' }, { status: 400 })

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const folderId = request.nextUrl.searchParams.get('folderId') ?? undefined
    const rohesLimit = request.nextUrl.searchParams.get('limit')
    const limit = rohesLimit === null ? undefined : Number(rohesLimit)
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
      return NextResponse.json({ error: 'limit muss eine positive Zahl sein' }, { status: 400 })
    }

    const eintraege = await leseAktionsProtokoll({ libraryId, folderId, limit })
    return NextResponse.json({ eintraege, anzahl: eintraege.length })
  } catch (error) {
    FileLogger.error('agent-view-protokoll', 'GET fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
