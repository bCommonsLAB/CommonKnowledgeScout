/**
 * @fileoverview API-Route: Item-Annotationen eines Ordners (Performance-Welle).
 *
 * @description
 * Liefert pro Ordner die annotierten Items (aktuell DIVA-Texturen) mit ihren
 * flachen, gruppier-/filterbaren Attributen — die Laufzeit-Quelle fuer den
 * Dateilisten-Filter „mit/ohne DIVA-Info" + die Gruppierung nach `stoffgruppe`.
 *
 * Storage-unabhaengig: liest ausschliesslich aus MongoDB (archive_item_properties),
 * nicht aus dem Storage-Backend.
 *
 * - GET /api/library/[libraryId]/item-annotations?parentId=X
 *   -> { parentId, annotations: [{ fileName, fileId, itemKey, attributes }] }
 *
 * Clerk-Auth + awaited params (Next.js 13+). Zugriffspruefung ueber
 * LibraryService.getLibrary (kein Zugriff => 404).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getDivaTexturesByParent } from '@/lib/diva-texture/supplier-properties'
import type { ItemAnnotationsResponse } from '@/lib/diva-texture/types'
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
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const parentId = request.nextUrl.searchParams.get('parentId')
    if (!parentId) {
      return NextResponse.json({ error: 'parentId ist erforderlich' }, { status: 400 })
    }

    const records = await getDivaTexturesByParent(libraryId, parentId)
    const response: ItemAnnotationsResponse = {
      parentId,
      annotations: records.map((r) => ({
        fileName: r.fileName,
        fileId: r.fileId,
        itemKey: r.vcodex,
        attributes: r.attributes,
        // Snapshot-Entry mitsenden, damit das Frontend Sidecar-Felder
        // (Material, TextureName, Image, …) als Zusatzspalten in der
        // Dateiliste rendern kann (Stufe 1+).
        entry: r.snapshot?.entry,
      })),
    }
    return NextResponse.json(response)
  } catch (error) {
    FileLogger.error('item-annotations', 'GET fehlgeschlagen', error)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
