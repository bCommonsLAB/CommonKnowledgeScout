/**
 * @fileoverview Shadow-Twin Config API
 *
 * @description
 * Liefert die effektive Shadow-Twin-Konfiguration fuer eine Library.
 */

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'

export async function GET(
  _request: Request,
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

  return NextResponse.json({ config: getShadowTwinConfig(library) }, { status: 200 })
}
