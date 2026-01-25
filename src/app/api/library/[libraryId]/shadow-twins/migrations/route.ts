/**
 * @fileoverview Shadow-Twin Migration Logs API
 *
 * @description
 * Liefert die letzten Migration-Laeufe fuer eine Library.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { listMigrationRuns } from '@/lib/repositories/shadow-twin-migration-repo'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
  if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

  const { libraryId } = await params
  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined

  const runs = await listMigrationRuns({ libraryId, limit })
  return NextResponse.json({ runs }, { status: 200 })
}
