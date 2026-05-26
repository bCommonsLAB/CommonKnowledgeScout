/**
 * @fileoverview API-Route: generische Archiv-Item-Properties (Stufe 1).
 *
 * @description
 * Generischer Schluessel-Wert-Speicher pro Library + stabiler Item-ID.
 * Erste Nutzung: Bildwahl `analysisSourceImage` der DIVA-Texture-Welle.
 *
 * - GET  /api/library/[libraryId]/archive-item-properties?itemKey=X
 *        -> { itemKey, properties }
 * - PATCH /api/library/[libraryId]/archive-item-properties
 *        body { itemKey, properties } -> merged { itemKey, properties }
 *
 * Clerk-Auth + awaited params (Next.js 13+). Zugriffspruefung ueber
 * LibraryService.getLibrary (kein Zugriff => 404).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import {
  getArchiveItemProperties,
  mergeArchiveItemProperties,
} from '@/lib/repositories/archive-item-properties-repo'
import { FileLogger } from '@/lib/debug/logger'

type AccessResult = { email: string } | { error: string; status: number }

async function resolveAccess(libraryId: string): Promise<AccessResult> {
  const { userId } = await auth()
  if (!userId) return { error: 'Nicht authentifiziert', status: 401 }
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress || ''
  if (!email) return { error: 'User-Email unbekannt', status: 400 }
  const lib = await LibraryService.getInstance().getLibrary(email, libraryId)
  if (!lib) return { error: 'Library nicht gefunden oder kein Zugriff', status: 404 }
  return { email }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const { libraryId } = await params
    const access = await resolveAccess(libraryId)
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

    const itemKey = new URL(request.url).searchParams.get('itemKey')
    if (!itemKey) return NextResponse.json({ error: 'itemKey ist erforderlich' }, { status: 400 })

    const properties = await getArchiveItemProperties(libraryId, itemKey)
    return NextResponse.json({ itemKey, properties })
  } catch (error) {
    FileLogger.error('archive-item-properties', 'GET fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const { libraryId } = await params
    const access = await resolveAccess(libraryId)
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

    const body = (await request.json()) as { itemKey?: string; properties?: Record<string, unknown> }
    if (!body.itemKey || typeof body.itemKey !== 'string') {
      return NextResponse.json({ error: 'itemKey ist erforderlich' }, { status: 400 })
    }
    if (!body.properties || typeof body.properties !== 'object' || Array.isArray(body.properties)) {
      return NextResponse.json({ error: 'properties (Objekt) ist erforderlich' }, { status: 400 })
    }

    const properties = await mergeArchiveItemProperties(libraryId, body.itemKey, body.properties)
    return NextResponse.json({ itemKey: body.itemKey, properties })
  } catch (error) {
    FileLogger.error('archive-item-properties', 'PATCH fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
