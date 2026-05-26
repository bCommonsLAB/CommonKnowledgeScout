/**
 * @fileoverview API-Route: Liefersystem-Stammdaten zu einer Textur (Stufe 1).
 *
 * @description
 * GET /api/diva-texture/supplier-data?libraryId=X&fileId=Y
 * Laedt die Sidecar-Datei aus dem Texturverzeichnis, matcht den Dateinamen
 * heuristisch gegen die Eintraege und gibt nur den gematchten Eintrag
 * zurueck (Plan Edge-Case #15: nicht das ganze JSON). Clerk-Auth.
 *
 * Hinweis: Statt des im Brief genannten `filePath` wird `fileId` verwendet —
 * die StorageProvider-Abstraktion ist id-basiert (kein Path-Lookup).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { loadSupplierData } from '@/lib/diva-texture/load-supplier-data'
import { matchTextureCode } from '@/lib/diva-texture/match-texture-code'
import { logMatchAttempts } from '@/lib/diva-texture/diva-texture-logger'
import type { SupplierDataApiResponse } from '@/lib/diva-texture/types'
import { FileLogger } from '@/lib/debug/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const libraryId = searchParams.get('libraryId')
    const fileId = searchParams.get('fileId')
    if (!libraryId) return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
    if (!fileId) return NextResponse.json({ error: 'fileId ist erforderlich' }, { status: 400 })

    const provider = await getServerProvider(userEmail, libraryId)
    const item = await provider.getItemById(fileId)
    if (!item) return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })

    const supplier = await loadSupplierData(provider, item.parentId)
    if (!supplier) {
      const empty: SupplierDataApiResponse = { matched: false, attempts: [] }
      return NextResponse.json(empty)
    }

    const result = matchTextureCode(item.metadata.name, supplier.entries)
    logMatchAttempts(item.metadata.name, result)

    const response: SupplierDataApiResponse = result.match
      ? {
          matched: true,
          entry: result.match.entry,
          materialId: result.match.entry.VCodex,
          strategy: result.match.strategy,
          attempts: result.attempts,
        }
      : { matched: false, attempts: result.attempts }

    return NextResponse.json(response)
  } catch (error) {
    FileLogger.error('diva-texture/supplier-data', 'Fehler beim Laden der Liefersystem-Daten', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
