/**
 * @fileoverview Reconcile-Endpoint: DIE Route der konsolidierten Sync-Engine.
 *
 * @description
 * Body (Welle 4, Design §7): `{ "mode": "check"|"repair", "preset"?, "scope"? }`
 * — EIN Plan, zwei Modi. `check` liefert den Report ohne Schreib-/Loesch-
 * Operationen, `repair` fuehrt DENSELBEN Plan aus (nur vom Preset erlaubte
 * Operationen). `scope` = `{ sourceIds }` | `{ folderId, recursive }` | leer
 * (ganze Library, Mongo-getrieben).
 *
 * Das Legacy-Format `{ apply, sourceIds }` (altes reconcileLibrary) ist mit
 * PR D entfernt — fehlender `mode` ist jetzt ein 400.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { runLibrarySync, type LibrarySyncScope } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import type { SyncMode } from '@/lib/shadow-twin/sync-engine/report-types'
import type { SyncPreset } from '@/lib/shadow-twin/sync-plan/allowed-ops'
import { FileLogger } from '@/lib/debug/logger'

// Library-weite Laeufe (Scan + Inhalt-Vergleich) koennen lange dauern.
export const maxDuration = 600

interface ReconcileRequest {
  mode?: SyncMode
  preset?: SyncPreset
  scope?: LibrarySyncScope
}

const VALID_MODES: ReadonlySet<string> = new Set(['check', 'repair'])
const VALID_PRESETS: ReadonlySet<string> = new Set(['repair', 'export', 'auto-sync'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const body = (await request.json().catch(() => ({}))) as ReconcileRequest

    if (typeof body?.mode !== 'string' || !VALID_MODES.has(body.mode)) {
      return NextResponse.json(
        { error: `mode ist erforderlich ('check' | 'repair'), erhalten: ${String(body?.mode)}` },
        { status: 400 },
      )
    }
    if (body.preset !== undefined && !VALID_PRESETS.has(body.preset)) {
      return NextResponse.json({ error: `Ungueltiges preset: ${body.preset}` }, { status: 400 })
    }
    const scope: LibrarySyncScope = {
      sourceIds: Array.isArray(body.scope?.sourceIds) ? body.scope.sourceIds : undefined,
      folderId: typeof body.scope?.folderId === 'string' ? body.scope.folderId : undefined,
      recursive: body.scope?.recursive,
    }
    const report = await runLibrarySync({
      libraryId, userEmail, mode: body.mode, preset: body.preset, scope,
    })
    FileLogger.info('shadow-twins/reconcile', `Sync-Engine ${body.mode} abgeschlossen`, {
      libraryId, preset: report.preset, totalSources: report.totalSources,
      changed: report.changed, conflicts: report.conflicts,
      needsPipeline: report.needsPipeline, errors: report.errors,
    })
    return NextResponse.json(report)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/reconcile', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
