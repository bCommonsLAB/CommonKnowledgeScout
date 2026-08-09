/**
 * @fileoverview Shadow-Twin aus Storage uebernehmen (API-Route, Welle 5b: Engine)
 *
 * @description
 * "Alle Artefakte aus Storage uebernehmen" (per Datei) laeuft ueber die
 * konsolidierte Sync-Engine: EIN repair-Lauf im sourceIds-Scope. Quellen ohne
 * Mongo-Dokument adoptiert die Engine (adopt-storage-only-source), Quellen mit
 * Dokument bekommen den regulaeren Reparatur-Plan (Transkript/Transformationen/
 * Bild-Registrierung). Die Response behaelt die Legacy-Form der UI-Aufrufer
 * (reconstructed/failed/artifacts).
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import { FileLogger } from '@/lib/debug/logger'

// Uebernahme laedt Seiten-Renderings/Previews nach Azure – das kann bei vielen
// Bildern dauern. Zeitlimit grosszuegig setzen.
export const maxDuration = 300

interface ReconstructRequest {
  sourceId: string
  /** Vom UI weiterhin gesendet; die Engine loest den Parent selbst auf. */
  parentId?: string
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

    if (!body?.sourceId) {
      return NextResponse.json({ error: 'sourceId ist erforderlich' }, { status: 400 })
    }

    const report = await runLibrarySync({
      libraryId, userEmail, mode: 'repair', preset: 'repair',
      scope: { sourceIds: [body.sourceId] },
    })

    const row = report.sources[0]
    if (!row) {
      // Weder Mongo-Dokument noch adoptierbare Artefakte im Storage.
      return NextResponse.json({
        success: false, reconstructed: 0, failed: 0, artifacts: [],
        message: 'Keine Artefakte im Storage gefunden',
      })
    }
    if (row.error) {
      // Quell-Ebene-Fehler (z.B. Twin-Ordner nicht lesbar) — wie frueher als 500.
      return NextResponse.json({ error: row.error }, { status: 500 })
    }

    const selected = row.operations.filter((op) => op.selected)
    const executedOps = selected.filter((op) => op.executed === true)
    const failedOps = selected.filter((op) => op.executed === false)
    // Toast-Zaehlung wie frueher: Markdown-Artefakte, keine Bilder. Die
    // Adoptions-Operation zaehlt mit ihrer Artefakt-Anzahl (op.count).
    const reconstructed = executedOps
      .filter((op) => op.kind !== 'image')
      .reduce((sum, op) => sum + (op.count ?? 1), 0)

    FileLogger.info('shadow-twins/reconstruct', 'Engine-Repair (per Datei) abgeschlossen', {
      sourceId: row.sourceId, executed: executedOps.length, failed: failedOps.length,
    })

    return NextResponse.json({
      success: failedOps.length === 0 && executedOps.length > 0,
      reconstructed,
      failed: failedOps.length,
      artifacts: row.operations,
      notes: row.notes,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/reconstruct', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
