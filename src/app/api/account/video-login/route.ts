/**
 * @fileoverview Account-API: Video-Anmeldung (Cookie-Datei fuer yt-dlp) am Konto (Welle C2).
 *
 * @description
 * GET liefert NUR Status (hinterlegt, Domains, Ablauf, Zeitpunkt) — nie den
 * Inhalt. PUT nimmt `{ cookies }` (Text der Netscape-Datei), prueft das
 * Format und speichert verschluesselt. DELETE entfernt die Anmeldung.
 * Account-Domaene: Auth via Clerk, Wirkung haengt an der User-Email.
 *
 * @module api/account
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { FileLogger } from '@/lib/debug/logger'
import { MAX_COOKIES_BYTES } from '@/lib/video-login/cookies-datei'
import { leseVideoAnmeldungStatus, loescheVideoAnmeldung, setzeVideoAnmeldung } from '@/lib/video-login/video-login-service'

async function requireUserEmail(): Promise<string | NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
  if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
  return userEmail
}

function fehler(kontext: string, error: unknown, status = 500): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  FileLogger.error('account-video-login', kontext, { error: message })
  return NextResponse.json({ error: message }, { status })
}

export async function GET(): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    return NextResponse.json(await leseVideoAnmeldungStatus(userEmail))
  } catch (error) {
    return fehler('Status fehlgeschlagen', error)
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const body = (await request.json().catch(() => null)) as { cookies?: unknown } | null
    const cookies = typeof body?.cookies === 'string' ? body.cookies : ''
    if (!cookies.trim()) return NextResponse.json({ error: 'Feld "cookies" (Text der cookies.txt) fehlt' }, { status: 400 })
    if (Buffer.byteLength(cookies, 'utf8') > MAX_COOKIES_BYTES) {
      return NextResponse.json({ error: `Cookie-Datei zu gross (Grenze ${MAX_COOKIES_BYTES / 1024} kB)` }, { status: 413 })
    }
    try {
      return NextResponse.json(await setzeVideoAnmeldung(userEmail, cookies))
    } catch (error) {
      // Formatfehler sind Eingabefehler der Person, kein Serverfehler.
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
    }
  } catch (error) {
    return fehler('Setzen fehlgeschlagen', error)
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const geloescht = await loescheVideoAnmeldung(userEmail)
    if (!geloescht) return NextResponse.json({ error: 'Keine Video-Anmeldung hinterlegt' }, { status: 404 })
    return NextResponse.json({ geloescht: true })
  } catch (error) {
    return fehler('Loeschen fehlgeschlagen', error)
  }
}
