/**
 * @fileoverview Nextcloud Storage API Route - Server-seitige WebDAV-Operationen
 *
 * @description
 * API-Route fuer Nextcloud/WebDAV-Storage-Operationen. Delegiert alle Datei- und
 * Ordner-Operationen an den NextcloudProvider. Authentifizierung ueber Clerk,
 * WebDAV-Credentials werden aus der Library-Konfiguration geladen.
 *
 * @module storage
 *
 * @exports
 * - GET:    list, get, binary, path, download
 * - POST:   createFolder, upload
 * - DELETE: Item loeschen
 * - PATCH:  move, rename
 *
 * @usedIn
 * - Next.js Route-Handler unter /api/storage/nextcloud
 * - StorageFactory (client-seitiger Proxy-Provider)
 *
 * @dependencies
 * - @clerk/nextjs/server: Authentifizierung
 * - @/lib/services/library-service: Library-Lookup
 * - @/lib/storage/nextcloud-provider: WebDAV-Provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { NextcloudProvider } from '@/lib/storage/nextcloud-provider'
import type { Library as LibraryType } from '@/types/library'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Normalisiert Query-Parameter ("undefined"/"null" → 'root'). */
function norm(value: string | null | undefined): string {
  const v = (value ?? '').trim()
  if (!v || v === 'undefined' || v === 'null') return 'root'
  return v
}

/**
 * Erstellt eine passende Fehler-Response.
 * Erkennt Rate-Limiting (429) und gibt den korrekten Status weiter,
 * statt pauschal 500 zu antworten.
 */
function errorResponse(method: string, error: unknown): NextResponse {
  const status = (error as { status?: number }).status
  const message = error instanceof Error ? error.message : 'Unbekannter Fehler'

  if (status === 429) {
    console.warn(`[nextcloud] ${method}: Rate-Limit erreicht (429)`)
    return NextResponse.json(
      { error: 'Nextcloud Rate-Limit erreicht. Bitte kurz warten und erneut versuchen.', retryable: true },
      { status: 429 },
    )
  }

  console.error(`[nextcloud] ${method} Fehler:`, error)
  return NextResponse.json({ error: message }, { status: status || 500 })
}

/** Ermittelt die E-Mail des authentifizierten Benutzers. */
async function getUserEmail(): Promise<string | undefined> {
  try {
    const { userId } = await auth()
    if (!userId) return undefined
    const user = await currentUser()
    return user?.emailAddresses?.[0]?.emailAddress
  } catch {
    return undefined
  }
}

/** Laedt eine aktivierte Library und prueft den Typ. */
async function getNextcloudLibrary(
  libraryId: string,
  email: string,
): Promise<LibraryType | undefined> {
  const svc = LibraryService.getInstance()
  const libs = await svc.getUserLibraries(email)
  return libs.find(
    (l) => l.id === libraryId && l.isEnabled && l.type === 'nextcloud',
  )
}

/**
 * Erstellt einen NextcloudProvider aus der Library-Config.
 * Gibt einen klaren 400-Fehler zurueck, wenn die Config unvollstaendig ist.
 */
function tryCreateProvider(library: LibraryType): NextcloudProvider | NextResponse {
  const nc = (library.config as Record<string, unknown>)?.nextcloud as
    | { webdavUrl?: string; username?: string; appPassword?: string }
    | undefined

  // Debug: Gespeicherte Credentials prüfen (Passwort nur Länge + Masken-Check)
  console.log('[nextcloud] tryCreateProvider – Credentials:', {
    webdavUrl: nc?.webdavUrl || '(leer)',
    username: nc?.username || '(leer)',
    appPasswordLength: nc?.appPassword?.length ?? 0,
    appPasswordIsMasked: nc?.appPassword === '********',
    appPasswordPrefix: nc?.appPassword ? nc.appPassword.substring(0, 3) + '...' : '(leer)',
  })

  const missing: string[] = []
  if (!nc?.webdavUrl) missing.push('webdavUrl')
  if (!nc?.username) missing.push('username')
  if (!nc?.appPassword) missing.push('appPassword')

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Nextcloud-Konfiguration unvollständig. Fehlende Felder: ${missing.join(', ')}. Bitte in den Storage-Einstellungen konfigurieren.`,
        errorCode: 'NEXTCLOUD_CONFIG_INCOMPLETE',
        missingFields: missing,
      },
      { status: 400 },
    )
  }

  return new NextcloudProvider(nc!.webdavUrl!, nc!.username!, nc!.appPassword!, library.id)
}

/** Typ-Guard: prueft ob das Ergebnis ein Fehler-Response ist */
function isErrorResponse(result: NextcloudProvider | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}

// ---------------------------------------------------------------------------
// GET – list | get | binary | path | download
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const action = sp.get('action')
  const fileId = norm(sp.get('fileId'))
  const libraryId = sp.get('libraryId')

  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
  }

  const email = await getUserEmail()
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const library = await getNextcloudLibrary(libraryId, email)
  if (!library) {
    return NextResponse.json({ error: 'Nextcloud-Library nicht gefunden' }, { status: 404 })
  }

  const result = tryCreateProvider(library)
  if (isErrorResponse(result)) return result
  const provider = result

  try {
    switch (action) {
      case 'list': {
        const items = await provider.listItemsById(fileId)
        return NextResponse.json(items)
      }

      case 'get': {
        const item = await provider.getItemById(fileId)
        return NextResponse.json(item)
      }

      case 'binary': {
        if (!fileId || fileId === 'root') {
          return NextResponse.json({ error: 'Ungueltige Datei-ID' }, { status: 400 })
        }
        const { blob, mimeType } = await provider.getBinary(fileId)
        const buffer = Buffer.from(await blob.arrayBuffer())
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'no-store',
          },
        })
      }

      case 'path': {
        const p = await provider.getPathById(fileId)
        return new NextResponse(p, { headers: { 'Content-Type': 'text/plain' } })
      }

      case 'download': {
        const url = await provider.getDownloadUrl(fileId)
        return NextResponse.json({ url })
      }

      default:
        return NextResponse.json({ error: 'Ungueltige Aktion' }, { status: 400 })
    }
  } catch (error) {
    return errorResponse('GET', error)
  }
}

// ---------------------------------------------------------------------------
// POST – createFolder | upload
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const action = sp.get('action')
  const fileId = norm(sp.get('fileId'))
  const libraryId = sp.get('libraryId') || ''

  const email = await getUserEmail()
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const library = await getNextcloudLibrary(libraryId, email)
  if (!library) {
    return NextResponse.json({ error: 'Nextcloud-Library nicht gefunden' }, { status: 404 })
  }

  const result = tryCreateProvider(library)
  if (isErrorResponse(result)) return result
  const provider = result

  try {
    switch (action) {
      case 'createFolder': {
        const { name } = await request.json()
        const item = await provider.createFolder(fileId, name)
        return NextResponse.json(item)
      }

      case 'upload': {
        const formData = await request.formData()
        const file = formData.get('file')
        if (!file || !(file instanceof File)) {
          return NextResponse.json({ error: 'Keine gueltige Datei' }, { status: 400 })
        }
        const item = await provider.uploadFile(fileId, file)
        return NextResponse.json(item)
      }

      default:
        return NextResponse.json({ error: 'Ungueltige Aktion' }, { status: 400 })
    }
  } catch (error) {
    return errorResponse('POST', error)
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const fileId = norm(sp.get('fileId'))
  const libraryId = sp.get('libraryId') || ''

  if (!fileId || fileId === 'root') {
    return NextResponse.json({ error: 'Ungueltige Datei-ID' }, { status: 400 })
  }

  const email = await getUserEmail()
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const library = await getNextcloudLibrary(libraryId, email)
  if (!library) {
    return NextResponse.json({ error: 'Nextcloud-Library nicht gefunden' }, { status: 404 })
  }

  const result = tryCreateProvider(library)
  if (isErrorResponse(result)) return result
  const provider = result

  try {
    await provider.deleteItem(fileId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse('DELETE', error)
  }
}

// ---------------------------------------------------------------------------
// PATCH – move | rename
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const action = sp.get('action')
  const fileId = norm(sp.get('fileId'))
  const libraryId = sp.get('libraryId') || ''

  if (!fileId || fileId === 'root') {
    return NextResponse.json({ error: 'Ungueltige Datei-ID' }, { status: 400 })
  }

  const email = await getUserEmail()
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const library = await getNextcloudLibrary(libraryId, email)
  if (!library) {
    return NextResponse.json({ error: 'Nextcloud-Library nicht gefunden' }, { status: 404 })
  }

  const result = tryCreateProvider(library)
  if (isErrorResponse(result)) return result
  const provider = result

  try {
    if (action === 'rename') {
      const body = (await request.json().catch(() => ({}))) as { name?: string }
      if (!body.name) {
        return NextResponse.json({ error: 'Neuer Name fehlt' }, { status: 400 })
      }
      const item = await provider.renameItem(fileId, body.name)
      return NextResponse.json(item)
    }

    // Default: move
    const newParentId = sp.get('newParentId')
    if (!newParentId) {
      return NextResponse.json({ error: 'newParentId fehlt' }, { status: 400 })
    }
    await provider.moveItem(fileId, newParentId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse('PATCH', error)
  }
}
