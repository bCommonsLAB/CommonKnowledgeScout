/**
 * @fileoverview API: GET /api/library/[libraryId]/media-storage-strategy
 *
 * @description
 * Liefert die effektive Media-Storage-Strategie fuer eine Library, abgeleitet aus deren
 * Konfiguration und der Laufzeit-Verfuegbarkeit von Azure Storage. Wird vom Library-
 * Settings-UI konsumiert, um dem Benutzer transparent zu zeigen, wo Bilder gespeichert
 * und gelesen werden.
 *
 * Read-only. Kein Schreibzugriff. Keine Persistenz.
 *
 * @module storage
 *
 * @exports
 * - GET: { mode, writeToAzure, writeToFilesystem, readPreferredSource,
 *          allowFilesystemFallbackOnRead, rationale, azureConfigured }
 *
 * @usedIn
 * - src/components/settings/library-form.tsx (Anzeige)
 *
 * @dependencies
 * - @/lib/services/library-service
 * - @/lib/config/azure-storage
 * - @/lib/shadow-twin/media-storage-strategy
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { resolveAzureStorageConfig } from '@/lib/config/azure-storage'
import { getMediaStorageStrategy } from '@/lib/shadow-twin/media-storage-strategy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ libraryId: string }> },
) {
  const { libraryId } = await context.params

  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId fehlt' }, { status: 400 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    const user = await currentUser()
    if (!user?.emailAddresses?.length) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse' }, { status: 401 })
    }

    const library = await LibraryService.getInstance().getLibraryById(libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    }

    const azureConfigured = resolveAzureStorageConfig(library.config) !== null
    const strategy = getMediaStorageStrategy(library, azureConfigured)

    return NextResponse.json({
      ...strategy,
      azureConfigured,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 },
    )
  }
}
