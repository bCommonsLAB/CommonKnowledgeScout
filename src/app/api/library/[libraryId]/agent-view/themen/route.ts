/**
 * @fileoverview API-Route: gepflegte Themen eines Vorhabens setzen (Welle A6).
 *
 * @description
 * POST /api/library/[libraryId]/agent-view/themen
 * Body `{ folderId, themen: string[] }` → `{ themen: string[] }`.
 *
 * Schreibt das von Hand gepflegte Feld `themen:` (flache Flow-Liste) in das
 * `_INDEX.md` des Vorhabens — zeilen-chirurgisch mit Ruecklese-Pruefung und
 * Wiederherstellung, DIESELBEN Ports wie die Stand-Route
 * (`baueIndexPorts`). Fehlerbild: ungueltige Themen → 400 (benannt),
 * unbekannter Ordner → 404, fehlendes `_INDEX.md` → 409 (`kein_index`).
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { OrdnerNichtGefundenError } from '@/lib/agent-view/bericht-laden'
import { baueIndexPorts } from '@/lib/agent-view/stand-ausfuehren'
import { KeinIndexError } from '@/lib/agent-view/stand-plan'
import { setzeThemen, ThemaUngueltigError } from '@/lib/agent-view/themen-schreiben'
import { FileLogger } from '@/lib/debug/logger'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'

/** Body-Form pruefen — unbrauchbare Requests scheitern benannt mit 400. */
function parseBody(body: unknown): { folderId: string; themen: string[] } {
  const kandidat = body as { folderId?: unknown; themen?: unknown } | null
  const folderId = typeof kandidat?.folderId === 'string' ? kandidat.folderId.trim() : ''
  if (folderId === '') throw new ThemaUngueltigError('folderId ist erforderlich')
  if (!Array.isArray(kandidat?.themen) || kandidat.themen.some((thema) => typeof thema !== 'string')) {
    throw new ThemaUngueltigError('themen muss eine Liste von Strings sein')
  }
  return { folderId, themen: kandidat.themen as string[] }
}

export async function POST(
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

    const { folderId, themen } = parseBody(await request.json().catch(() => null))

    // Zugriffspruefung: Library muss fuer diesen User sichtbar sein.
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const provider = await getServerProvider(userEmail, libraryId)
    const ergebnis = await setzeThemen(folderId, themen, baueIndexPorts(provider, folderId))

    FileLogger.info('agent-view-themen', 'Themen gesetzt', { libraryId, folderId, anzahl: ergebnis.themen.length })
    return NextResponse.json(ergebnis)
  } catch (error) {
    if (error instanceof ThemaUngueltigError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    if (error instanceof OrdnerNichtGefundenError) {
      return NextResponse.json({ error: 'Ordner nicht gefunden' }, { status: 404 })
    }
    if (error instanceof KeinIndexError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 })
    }
    FileLogger.error('agent-view-themen', 'POST fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
