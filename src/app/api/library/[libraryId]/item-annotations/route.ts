/**
 * @fileoverview API-Route: Item-Annotationen eines Ordners (DIVA Live-Match).
 *
 * @description
 * Liefert pro Ordner die Dateien mit Sidecar-Treffer (Live-Match gegen
 * optionvalues.json im Grosseltern-Ordner) inkl. flacher Attribute — Quelle
 * fuer den Dateilisten-Filter „mit/ohne DIVA-Info" und Gruppierung.
 *
 * Bewusst Live (kein MongoDB-Preprocess noetig): Sidecar laden → Dateien
 * listen → matchTextureCode. Storage nur ueber getServerProvider.
 *
 * - GET /api/library/[libraryId]/item-annotations?parentId=X
 *   -> { parentId, annotations: [{ fileName, fileId, itemKey, attributes, entry }] }
 *
 * Clerk-Auth + awaited params (Next.js 13+).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { loadSupplierData } from '@/lib/diva-texture/load-supplier-data'
import { buildLiveFolderAnnotations } from '@/lib/diva-texture/folder-annotations'
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

    const provider = await getServerProvider(access.email, libraryId)
    const supplier = await loadSupplierData(provider, parentId)
    if (!supplier) {
      const empty: ItemAnnotationsResponse = { parentId, annotations: [] }
      return NextResponse.json(empty)
    }

    const items = await provider.listItemsById(parentId)
    const files = items
      .filter((it) => it.type === 'file')
      .map((it) => ({ id: it.id, name: it.metadata.name }))

    const annotations = buildLiveFolderAnnotations(files, supplier.entries)
    const response: ItemAnnotationsResponse = { parentId, annotations }
    return NextResponse.json(response)
  } catch (error) {
    FileLogger.error('item-annotations', 'GET fehlgeschlagen', error)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
