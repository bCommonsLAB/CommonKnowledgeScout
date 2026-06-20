/**
 * @fileoverview Shadow-Twin Migration – einzelner Lauf (Status + Abbruch)
 *
 * @description
 * - GET: liefert einen Migrations-Lauf inkl. `steps` (für Live-Fortschritt x/y im UI).
 * - DELETE: fordert den kooperativen Abbruch des laufenden Laufs an (setzt cancelRequested).
 *   Die Migrations-Schleife prüft das Flag und beendet sauber mit Teil-Report.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getMigrationRun, requestMigrationCancel } from '@/lib/repositories/shadow-twin-migration-repo'

/**
 * Gemeinsame Vorprüfung: Auth + Library-Besitz + Run gehört zu dieser Library/User.
 * Gibt entweder eine Fehler-Response oder den geladenen Run zurück.
 */
async function loadOwnedRun(
  libraryId: string,
  runId: string
): Promise<{ error: NextResponse } | { run: Awaited<ReturnType<typeof getMigrationRun>> }> {
  const { userId } = await auth()
  if (!userId) return { error: NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 }) }

  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
  if (!userEmail) return { error: NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 }) }

  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) return { error: NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 }) }

  const run = await getMigrationRun(runId)
  // Kein Silent-Fallback: fremder/falscher Run wird als 404 abgewiesen.
  if (!run || run.libraryId !== libraryId || run.userEmail !== userEmail) {
    return { error: NextResponse.json({ error: 'Lauf nicht gefunden' }, { status: 404 }) }
  }
  return { run }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; runId: string }> }
) {
  const { libraryId, runId } = await params
  const result = await loadOwnedRun(libraryId, runId)
  if ('error' in result) return result.error
  return NextResponse.json({ run: result.run }, { status: 200 })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; runId: string }> }
) {
  const { libraryId, runId } = await params
  const result = await loadOwnedRun(libraryId, runId)
  if ('error' in result) return result.error

  // Abbruch nur sinnvoll, solange der Lauf läuft.
  const requested = await requestMigrationCancel(runId)
  if (!requested) {
    return NextResponse.json(
      { error: 'Lauf läuft nicht mehr – Abbruch nicht möglich' },
      { status: 409 }
    )
  }
  return NextResponse.json({ cancelRequested: true, runId }, { status: 200 })
}
