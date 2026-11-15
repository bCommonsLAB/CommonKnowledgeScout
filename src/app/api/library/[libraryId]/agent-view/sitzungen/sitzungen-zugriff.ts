/**
 * @fileoverview Auth-/Zugriffs-Gate der Sitzungs-Routen (Register, Welle R3).
 *
 * @description
 * Clerk-Auth + User-Email + Library-Sichtbarkeit wie `worklists-zugriff.ts`,
 * dazu die Archivpflege: Das Register gibt es nur in Libraries mit
 * freigegebener Agentensicht (dieselbe Sperre wie die Brueckenwerkzeuge).
 * Eine nicht freigegebene Library wird laut abgewiesen (409), nicht mit
 * einer leeren Liste beantwortet.
 *
 * @module api/library
 */

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { archivpflegeAktiv } from '@/lib/mcp/archivpflege'
import { LibraryService } from '@/lib/services/library-service'

export interface SitzungenZugriff {
  fehler: NextResponse | null
  userEmail: string
  libraryId: string
}

export async function pruefeSitzungenZugriff(libraryId: string): Promise<SitzungenZugriff> {
  const leer = { userEmail: '', libraryId: '' }
  const { userId } = await auth()
  if (!userId) return { ...leer, fehler: NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 }) }
  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
  if (!userEmail) return { ...leer, fehler: NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 }) }
  if (!libraryId) return { ...leer, fehler: NextResponse.json({ error: 'Library-ID fehlt' }, { status: 400 }) }
  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) return { ...leer, fehler: NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 }) }
  if (!archivpflegeAktiv(library)) {
    return {
      ...leer,
      fehler: NextResponse.json(
        { error: 'Das Sitzungs-Register gibt es nur in Libraries mit aktivierter Agentensicht', code: 'archivpflege_aus' },
        { status: 409 },
      ),
    }
  }
  return { fehler: null, userEmail, libraryId: library.id }
}
