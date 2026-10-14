/**
 * @fileoverview OneDrive-Tokens einer Library — gelesen und geschrieben an der
 * Speicher-Verbindung des Besitzers (Plan speicher-verbindungen-und-library-anlage, Teil A).
 *
 * GET liefert dem Browser die Tokens der Verbindung (Bootstrap des
 * localStorage nach einem Login auf der Konto-Seite), PATCH persistiert vom
 * Browser erneuerte Tokens, DELETE meldet ab. Der fruehere POST (temporaere
 * Tokens des Library-Logins) ist entfallen: angemeldet wird an der Verbindung.
 *
 * Nur mit Clerk-Session: die fruehere Umgehung ueber `X-Internal-Request`
 * plus `?email=` ist entfallen (Plan Teil A, „Was mit umgeraeumt wird");
 * serverseitige Provider gehen direkt ueber den Token-Store.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { StorageFactory } from '@/lib/storage/storage-factory'
import { loadLibraryConnection } from '@/lib/storage-connections/library-storage'
import { setOneDriveTokens } from '@/lib/storage-connections/connection-service'
import { FileLogger } from '@/lib/debug/logger'

type Params = { params: Promise<{ id: string }> }

async function resolveEmail(): Promise<string | NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress
  if (!email) return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 400 })
  return email
}

/**
 * Nur der Owner bekommt Tokens in den Browser: ein Mitglied arbeitet auf dem
 * Server mit der Verbindung des Owners, sieht dessen Tokens aber nie
 * (ADR 0005; eigene Verbindungen der Mitglieder kommen mit A4).
 */
async function connectionFor(email: string, libraryId: string) {
  const library = (await LibraryService.getInstance().getUserLibraries(email)).find((l) => l.id === libraryId)
  if (!library) return null
  return loadLibraryConnection(library, email)
}

function fehler(scope: string, e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : String(e)
  FileLogger.error('library-tokens', scope, { error: msg })
  return NextResponse.json({ error: msg }, { status: 500 })
}

// GET - Tokens der Verbindung (Browser-Bootstrap nach dem Login auf der Konto-Seite)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const email = await resolveEmail()
    if (email instanceof NextResponse) return email
    const conn = await connectionFor(email, id)
    if (!conn) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    const data = conn.onedrive
    if (!data?.accessToken || !data.refreshToken) {
      return NextResponse.json({ error: 'Keine Tokens an der Verbindung — bitte unter Mein Konto → Speicher-Verbindungen anmelden.' }, { status: 404 })
    }
    return NextResponse.json({ accessToken: data.accessToken, refreshToken: data.refreshToken, tokenExpiry: Number(data.tokenExpiry ?? 0) })
  } catch (e) {
    return fehler('GET fehlgeschlagen', e)
  }
}

// PATCH - Vom Browser erneuerte Tokens an der Verbindung persistieren
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const email = await resolveEmail()
    if (email instanceof NextResponse) return email
    const { accessToken, refreshToken, tokenExpiry } = (await req.json()) as { accessToken?: string; refreshToken?: string; tokenExpiry?: string | number }
    if (!accessToken || !refreshToken || !tokenExpiry) {
      return NextResponse.json({ error: 'accessToken, refreshToken, tokenExpiry erforderlich' }, { status: 400 })
    }
    const conn = await connectionFor(email, id)
    if (!conn) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    await setOneDriveTokens(conn.ownerEmail, conn.id, { accessToken, refreshToken, tokenExpiry: Number(tokenExpiry) })
    return NextResponse.json({ success: true })
  } catch (e) {
    return fehler('PATCH fehlgeschlagen', e)
  }
}

// DELETE - Abmelden: Tokens an der Verbindung entfernen und Provider-Cache leeren
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const email = await resolveEmail()
    if (email instanceof NextResponse) return email
    const conn = await connectionFor(email, id)
    if (!conn) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    await setOneDriveTokens(conn.ownerEmail, conn.id, null)
    await StorageFactory.getInstance().clearProvider(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return fehler('DELETE fehlgeschlagen', e)
  }
}
