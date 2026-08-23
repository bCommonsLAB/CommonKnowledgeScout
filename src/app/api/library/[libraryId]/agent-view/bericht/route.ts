/**
 * @fileoverview API-Route: BERICHT.md eines Vorhabens lesen (F9, Werkbank W2).
 *
 * @description
 * GET /api/library/[libraryId]/agent-view/bericht?folderId=…
 * → `{ bericht: { fileId, name, modifiedAt, sizeBytes, body, kopf } | null,
 *      grund?: 'kein_bericht' | 'zu_gross' }`
 *
 * Der Bericht-Body wird on demand aus dem Storage gelesen und NIE persistiert
 * (Projektauftrag v2 §5); `kopf` kommt serverseitig aus `bericht-laden.ts`.
 * Semantik: unbekannte Library/unbekannter Ordner → 404; Ordner ohne Bericht
 * → 200 mit `grund: 'kein_bericht'` (legitimer Domaenenzustand, kein Fehler);
 * Body ueber dem Budget → 200 mit Metadaten und `grund: 'zu_gross'`.
 *
 * Die UI bleibt API-only — Provider-Wissen wohnt hier (v1-Kriterium 5,
 * `storage-abstraction.mdc`). Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ladeBericht, OrdnerNichtGefundenError } from '@/lib/agent-view/bericht-laden'
import { FileLogger } from '@/lib/debug/logger'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'

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

    const folderId = request.nextUrl.searchParams.get('folderId')?.trim() ?? ''
    if (folderId === '') {
      return NextResponse.json({ error: 'folderId ist erforderlich' }, { status: 400 })
    }

    // Zugriffspruefung: Library muss fuer diesen User sichtbar sein.
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const provider = await getServerProvider(userEmail, libraryId)
    const antwort = await ladeBericht(folderId, {
      listFolder: (id) => provider.listItemsById(id),
      readText: async (id) => (await provider.getBinary(id)).blob.text(),
    })

    return NextResponse.json(antwort)
  } catch (error) {
    if (error instanceof OrdnerNichtGefundenError) {
      return NextResponse.json({ error: 'Ordner nicht gefunden' }, { status: 404 })
    }
    FileLogger.error('agent-view-bericht', 'GET fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
