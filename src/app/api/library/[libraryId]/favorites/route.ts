/**
 * @fileoverview Favoriten API-Route - Ordner-Lesezeichen pro Library
 *
 * @description
 * Serverseitige Route zum Laden und Umschalten von Favoriten (Ordner-Lesezeichen).
 * Favoriten werden direkt im Library-Dokument in MongoDB gespeichert.
 *
 * @module api/library
 *
 * @exports
 * - GET:  Favoriten einer Library laden
 * - POST: Favorit hinzufuegen oder entfernen (Toggle)
 *
 * @usedIn
 * - src/lib/library/favorites.ts: Client-seitige Fetch-Funktionen
 * - src/components/library/breadcrumb.tsx: Favoriten-Dropdown
 *
 * @dependencies
 * - @clerk/nextjs/server: Authentifizierung
 * - @/lib/services/library-service: MongoDB-Zugriff
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import type { FavoriteEntry } from '@/types/library'

type RouteParams = { params: Promise<{ libraryId: string }> }

/** Authentifizierten Benutzer ermitteln und E-Mail zurueckgeben. */
async function getAuthEmail(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress || null
}

/**
 * GET /api/library/[libraryId]/favorites
 *
 * Gibt die Favoriten der Library als JSON zurueck.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const email = await getAuthEmail()
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { libraryId } = await params
  const svc = LibraryService.getInstance()
  const favorites = await svc.getLibraryFavorites(email, libraryId)

  return NextResponse.json({ libraryId, favorites })
}

/**
 * POST /api/library/[libraryId]/favorites
 *
 * Toggle: Fuegt einen Favorit hinzu oder entfernt ihn.
 *
 * Body: { folderId: string, folderName: string, pathLabels?: string[] }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  const email = await getAuthEmail()
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { libraryId } = await params
  const body = (await request.json().catch(() => ({}))) as {
    folderId?: string
    folderName?: string
    pathLabels?: string[]
  }

  if (!body.folderId || !body.folderName) {
    return NextResponse.json(
      { error: 'folderId und folderName sind erforderlich' },
      { status: 400 },
    )
  }

  const svc = LibraryService.getInstance()
  const existing = await svc.getLibraryFavorites(email, libraryId)

  const alreadyExists = existing.some(f => f.id === body.folderId)
  let updated: FavoriteEntry[]

  if (alreadyExists) {
    // Entfernen
    updated = existing.filter(f => f.id !== body.folderId)
  } else {
    // Hinzufuegen
    const entry: FavoriteEntry = {
      id: body.folderId,
      name: body.folderName,
      path: body.pathLabels,
      addedAt: new Date().toISOString(),
    }
    updated = [...existing, entry]
  }

  const ok = await svc.updateLibraryFavorites(email, libraryId, updated)
  if (!ok) {
    return NextResponse.json(
      { error: 'Favoriten konnten nicht gespeichert werden' },
      { status: 500 },
    )
  }

  return NextResponse.json({ libraryId, favorites: updated })
}
