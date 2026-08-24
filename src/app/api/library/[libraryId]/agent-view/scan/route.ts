/**
 * @fileoverview API-Route: expliziter Coverage-Scan der Agentensicht.
 *
 * @description
 * POST /api/library/[libraryId]/agent-view/scan
 * Body (optional): `{ scope?: { folderId?: string } }`
 * → `{ report, generatedAt, gapsTruncated, totalGaps }`
 *
 * Der Scan ist ein EXPLIZITER Vorgang (Knopf „Neu scannen"), kein Watcher
 * (Projektauftrag §4). Er berechnet die Coverage und legt den — abgeleiteten,
 * wegwerfbaren — Report als Cache ab. Geschrieben wird NUR dieser Report:
 * keine Datei im Bestand, kein erklaerter `bearbeitungsstand`
 * (Leitprinzip 6, doppelte Buchhaltung).
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { mergeTeilbaumReport } from '@/lib/agent-view/report-merge'
import { scanLibraryCoverage } from '@/lib/agent-view/run-coverage-scan'
import type { CoverageReport } from '@/lib/agent-view/types'
import { FileLogger } from '@/lib/debug/logger'
import { getCoverageReport, saveCoverageReport } from '@/lib/repositories/agent-view-coverage-repo'

/** Grosszuegig: Library-weite Scans laufen ueber Engine-Check UND Archiv-Walk. */
export const maxDuration = 600

interface ScanBody {
  scope?: { folderId?: string }
}

function readFolderId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const folderId = (body as ScanBody).scope?.folderId
  if (typeof folderId !== 'string') return null
  const trimmed = folderId.trim()
  return trimmed === '' ? null : trimmed
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

    // Leerer Body ist erlaubt (ganze Library); kaputtes JSON ist ein Fehler.
    let body: unknown = null
    const raw = await request.text()
    if (raw.trim() !== '') {
      try {
        body = JSON.parse(raw)
      } catch {
        return NextResponse.json({ error: 'Ungueltiger JSON-Body' }, { status: 400 })
      }
    }

    const folderId = readFolderId(body)
    const report = await scanLibraryCoverage({ libraryId, userEmail, folderId })

    // W8 (F10): Ein Teilbaum-Scan MERGED in den gespeicherten Voll-Report,
    // statt ihn zu ersetzen — die Werkbank-Liste bleibt vollstaendig. Nicht
    // mergebare Lagen sind benannte Fallbacks: dann ersetzt der Teil-Report
    // wie vor W8 (Scope-Banner zeigt das an).
    let zuSpeichern: CoverageReport = report
    let merged = false
    let mergeHinweis: string | null = null
    if (folderId !== null) {
      const gespeichert = await getCoverageReport(libraryId)
      if (gespeichert === null) {
        mergeHinweis = 'Kein gespeicherter Report vorhanden — der Teilbaum-Report wird direkt gespeichert.'
      } else if (gespeichert.gapsTruncated) {
        mergeHinweis =
          'Die gespeicherte Befundliste ist gekappt — Merge nicht beweisbar, der Teilbaum-Report ersetzt sie (einmal voll scannen).'
      } else {
        const ergebnis = mergeTeilbaumReport({ voll: gespeichert.report, teil: report })
        if (ergebnis.merged) {
          zuSpeichern = ergebnis.report
          merged = true
        } else {
          mergeHinweis = ergebnis.erklaerung
          FileLogger.info('agent-view-scan', 'Teilbaum-Merge fiel zurueck', {
            libraryId, folderId, grund: ergebnis.grund,
          })
        }
      }
    }
    const stored = await saveCoverageReport(zuSpeichern)

    return NextResponse.json({
      report: stored.report,
      generatedAt: stored.generatedAt,
      gapsTruncated: stored.gapsTruncated,
      totalGaps: stored.totalGaps,
      merged,
      mergeHinweis,
    })
  } catch (error) {
    FileLogger.error('agent-view-scan', 'POST fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
