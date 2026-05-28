/**
 * @fileoverview API-Route: Sidecar-Status pro Ordner (DIVA-Texture).
 *
 * @description
 * GET /api/diva-texture/sidecar-status?libraryId=X&parentId=Y
 * Antwort: { found: boolean, entryCount?: number, sourceFileName?: string }
 *
 * Wird vom Archiv-Frontend genutzt, um den DIVA-Toolbar-Button visuell zu
 * markieren, wenn im aktuellen Verzeichnis tatsaechlich eine
 * `api2_GetJsonOptionValues.json` liegt. Kein silent fallback: bei Fehlern
 * wird HTTP 500 mit klarer Fehlermeldung zurueckgegeben.
 *
 * Clerk-Auth + Library-Access-Check (LibraryService).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { loadSupplierData } from '@/lib/diva-texture/load-supplier-data'
import { FileLogger } from '@/lib/debug/logger'

interface SidecarStatusResponse {
  found: boolean
  entryCount?: number
  sourceFileName?: string
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const libraryId = searchParams.get('libraryId')
    const parentId = searchParams.get('parentId')
    if (!libraryId) return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
    if (!parentId) return NextResponse.json({ error: 'parentId ist erforderlich' }, { status: 400 })

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Library nicht gefunden oder kein Zugriff' }, { status: 404 })
    }

    const provider = await getServerProvider(userEmail, libraryId)
    const supplier = await loadSupplierData(provider, parentId)
    const response: SidecarStatusResponse = supplier
      ? {
          found: true,
          entryCount: supplier.entries.length,
          sourceFileName: supplier.sourceFileName,
        }
      : { found: false }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler'
    FileLogger.error('diva-texture/sidecar-status', 'GET fehlgeschlagen', { error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
