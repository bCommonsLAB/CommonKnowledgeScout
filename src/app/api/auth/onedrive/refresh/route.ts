/**
 * @fileoverview OneDrive-Token-Refresh fuer eine Library — mit der Azure-App der
 * Speicher-Verbindung des Besitzers (Plan Teil A). Antwort wie bisher
 * (`accessToken`, `refreshToken`, `expiresIn`), bei Fehlern `code` aus dem
 * OAuth-Fehler: NUR `invalid_grant` heisst, das Refresh-Token ist tot.
 *
 * Nur mit Clerk-Session (Browser); serverseitige Provider erneuern direkt ueber
 * den Token-Store, die fruehere `X-Internal-Request`-Umgehung ist entfallen.
 * Keine Geheimnisse im Log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { loadLibraryConnection } from '@/lib/storage-connections/library-storage'
import { OneDriveTokenError, refreshOneDriveTokens } from '@/lib/storage-connections/onedrive-login'
import { FileLogger } from '@/lib/debug/logger'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress
    if (!email) return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 400 })

    const { libraryId, refreshToken } = (await req.json()) as { libraryId?: string; refreshToken?: string }
    if (!libraryId || !refreshToken) {
      return NextResponse.json({ error: 'libraryId und refreshToken erforderlich' }, { status: 400 })
    }

    // Nur der Owner (wie bisher): Mitglieder sehen die Tokens des Owners nie.
    const library = (await LibraryService.getInstance().getUserLibraries(email)).find((l) => l.id === libraryId)
    if (!library) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    const conn = await loadLibraryConnection(library, email)
    if (!conn.onedrive) return NextResponse.json({ error: 'Keine OneDrive-Verbindung an dieser Library' }, { status: 400 })

    try {
      const tokens = await refreshOneDriveTokens({ ...conn.onedrive, refreshToken })
      return NextResponse.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: Math.max(0, tokens.tokenExpiry - Math.floor(Date.now() / 1000)),
        tokenType: 'Bearer',
      })
    } catch (refreshError) {
      const details = refreshError instanceof Error ? refreshError.message : String(refreshError)
      const code = refreshError instanceof OneDriveTokenError ? refreshError.code : null
      FileLogger.error('onedrive-refresh', 'Token-Refresh fehlgeschlagen', { libraryId, code, details })
      return NextResponse.json({ error: 'Token-Refresh fehlgeschlagen', details, code }, { status: 502 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    FileLogger.error('onedrive-refresh', 'Unerwarteter Fehler', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
