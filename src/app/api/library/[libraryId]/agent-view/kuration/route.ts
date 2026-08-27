/**
 * @fileoverview API-Route: Kurationszustand je Vorhaben nachladen (K1).
 *
 * @description
 * POST /api/library/[libraryId]/agent-view/kuration
 * Body `{ sourceIds: string[] }` → `{ eintraege: KurationsEintrag[] }`.
 *
 * K1 der Testsession 25.08.2026: Verifikationen leben in den Mongo-Twins —
 * der gespeicherte Coverage-Report weiss nichts von ihnen, bis ein Voll-Scan
 * (~8 Minuten) laeuft. Diese Route laedt den Kurationszustand der Familien
 * eines Vorhabens in EINER Mongo-Abfrage (`getShadowTwinsBySourceIds`) und
 * antwortet in Millisekunden; die Werkbank ueberlagert damit den Report.
 * KEIN Storage-/Graph-Aufruf, KEIN Scan. Die Artefakt-Auswahl ist exakt die
 * des Scans (`baueKurationsEintraege` → `buildFamilySummaries`).
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { MAX_FAMILY_SUMMARIES } from '@/lib/agent-view/family-summaries'
import { baueKurationsEintraege } from '@/lib/agent-view/kuration-nachladen'
import { readConventions } from '@/lib/agent-view/run-coverage-scan'
import { FileLogger } from '@/lib/debug/logger'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { LibraryService } from '@/lib/services/library-service'

/** Body-Form pruefen — unbrauchbare Requests scheitern benannt mit 400. */
function parseSourceIds(body: unknown): string[] | { fehler: string } {
  const kandidat = body as { sourceIds?: unknown } | null
  if (!Array.isArray(kandidat?.sourceIds)) return { fehler: 'sourceIds muss eine Liste von Strings sein' }
  const sourceIds = kandidat.sourceIds
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
  if (sourceIds.length === 0) return { fehler: 'sourceIds ist leer' }
  if (sourceIds.some((id) => id === '')) return { fehler: 'sourceIds enthaelt leere Eintraege' }
  if (sourceIds.length > MAX_FAMILY_SUMMARIES) {
    return { fehler: `Mehr als ${MAX_FAMILY_SUMMARIES} sourceIds — bitte je Vorhaben nachladen` }
  }
  return sourceIds
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

    const sourceIds = parseSourceIds(await request.json().catch(() => null))
    if (!Array.isArray(sourceIds)) {
      return NextResponse.json({ error: sourceIds.fehler }, { status: 400 })
    }

    // Zugriffspruefung: Library muss fuer diesen User sichtbar sein.
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // EINE Mongo-Abfrage — Familien ohne Twin-Dokument fehlen in der Antwort
    // (dort gilt weiter der Report; der Client ueberlagert nur Vorhandenes).
    const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds })
    const eintraege = baueKurationsEintraege(
      [...docs.values()],
      readConventions(library).standardTemplate,
    )

    FileLogger.info('agent-view-kuration', 'Kurationszustand nachgeladen', {
      libraryId, angefragt: sourceIds.length, gefunden: eintraege.length,
    })
    return NextResponse.json({ eintraege })
  } catch (error) {
    FileLogger.error('agent-view-kuration', 'POST fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
