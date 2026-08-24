/**
 * @fileoverview Geteiltes Auth-/Zugriffs-Gate der Worklist-Routen (F7, W6).
 *
 * @description
 * Clerk-Auth + User-Email + Library-Sichtbarkeit nach
 * `docs/architecture/api-route-conventions.md` — EINMAL fuer beide
 * Routen-Dateien (Sammel- und Einzel-Route), statt es zu duplizieren.
 *
 * @module api/library
 */

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'

export interface WorklistZugriff {
  fehler: NextResponse | null
  userEmail: string
  libraryId: string
}

export async function pruefeWorklistZugriff(
  params: Promise<{ libraryId: string }>,
): Promise<WorklistZugriff> {
  const leer = { userEmail: '', libraryId: '' }
  const { userId } = await auth()
  if (!userId) {
    return { ...leer, fehler: NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 }) }
  }
  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
  if (!userEmail) {
    return { ...leer, fehler: NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 }) }
  }
  const { libraryId } = await params
  if (!libraryId) {
    return { ...leer, fehler: NextResponse.json({ error: 'Library-ID fehlt' }, { status: 400 }) }
  }
  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) {
    return { ...leer, fehler: NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 }) }
  }
  return { fehler: null, userEmail, libraryId }
}
