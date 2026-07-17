/**
 * @fileoverview Reconcile-Endpoint: per-Library Shadow-Twin-Reparatur.
 *
 * @description
 * Bringt Storage + Mongo pro Quelle in den deterministischen Zustand
 * (kanonische `{base}.md` = vollstaendigstes Transkript).
 *
 * - **Dry-Run (Default):** `POST` ohne Body bzw. `{ "apply": false }` → nur Report,
 *   keine Schreib-/Loesch-Operationen.
 * - **Apply:** `{ "apply": true }` → schreibt kanonische Datei + Mongo, loescht
 *   strikt unterlegene Varianten + tote `page_NNN.md`. Vorher mongodump empfohlen.
 * - Optional `{ "sourceIds": [...] }` schraenkt auf eine Teilmenge ein.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { reconcileLibrary } from '@/lib/shadow-twin/reconcile-library'
import { FileLogger } from '@/lib/debug/logger'

interface ReconcileRequest {
  apply?: boolean
  sourceIds?: string[]
}

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
    const apply = body?.apply === true

    const report = await reconcileLibrary({
      libraryId,
      userEmail,
      apply,
      sourceIds: Array.isArray(body?.sourceIds) ? body.sourceIds : undefined,
    })

    FileLogger.info('shadow-twins/reconcile', `Reconcile ${apply ? 'APPLY' : 'dry-run'} abgeschlossen`, {
      libraryId,
      totalSources: report.totalSources,
      changed: report.changed,
      conflicts: report.conflicts,
      needsReextract: report.needsReextract,
      images: report.images,
    })

    return NextResponse.json(report)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/reconcile', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
