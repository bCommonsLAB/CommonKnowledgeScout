/**
 * @fileoverview API-Route: juengster Coverage-Report der Agentensicht.
 *
 * @description
 * GET /api/library/[libraryId]/agent-view/coverage
 * → `{ report, generatedAt, gapsTruncated, totalGaps }`
 * → 404, wenn die Library noch nie gescannt wurde (eigener Zustand der UI,
 *   kein leerer Ersatz-Report — `no-silent-fallbacks.mdc`).
 *
 * Liefert AUSSCHLIESSLICH den Report-Cache (`agent-view-coverage-repo`);
 * gerechnet wird nur im expliziten Scan (POST ../scan). Nachzug zu Welle 1:
 * Der Client-Hook (`use-coverage-report.ts`) ruft diese Route seit Welle 2 —
 * ohne sie galt jede Library faelschlich als „noch nie gescannt".
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { FileLogger } from '@/lib/debug/logger'
import { getCoverageReport } from '@/lib/repositories/agent-view-coverage-repo'
import { LibraryService } from '@/lib/services/library-service'

export async function GET(
  _request: NextRequest,
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

    // Zugriffspruefung: Library muss fuer diesen User sichtbar sein.
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const stored = await getCoverageReport(libraryId)
    if (!stored) {
      return NextResponse.json({ error: 'Noch kein Coverage-Report — zuerst scannen' }, { status: 404 })
    }

    return NextResponse.json({
      report: stored.report,
      generatedAt: stored.generatedAt,
      gapsTruncated: stored.gapsTruncated,
      totalGaps: stored.totalGaps,
      // D1: Fortschritt seit dem letzten Scan (null = deltaHinweis sagt warum).
      delta: stored.delta ?? null,
      deltaHinweis: stored.deltaHinweis ?? null,
    })
  } catch (error) {
    FileLogger.error('agent-view-coverage', 'GET fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
