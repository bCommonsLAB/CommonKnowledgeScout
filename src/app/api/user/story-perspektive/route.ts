/**
 * Die Story-Perspektive im Profil der angemeldeten Person (09.10.2026).
 *
 * GET liefert `{ perspektive }` (oder `null`, wenn noch keine gespeichert ist),
 * PUT legt sie ab. Nur die eigene — Schluessel ist die E-Mail aus Clerk.
 * Anonyme Besucher (auch das Embed) speichern weiter nur im Browser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { alsProfilPerspektive } from '@ks/contracts'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { FileLogger } from '@/lib/debug/logger'
import { getProfilPerspektive, setProfilPerspektive } from '@/lib/repositories/user-story-perspektive-repo'

async function angemeldeteEmail(): Promise<string | NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const user = await currentUser()
  const userEmail = user ? getPreferredUserEmail(user) : ''
  if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
  return userEmail
}

export async function GET(): Promise<NextResponse> {
  try {
    const email = await angemeldeteEmail()
    if (email instanceof NextResponse) return email
    return NextResponse.json({ perspektive: await getProfilPerspektive(email) })
  } catch (error) {
    FileLogger.error('user-story-perspektive', 'Lesen fehlgeschlagen', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const email = await angemeldeteEmail()
    if (email instanceof NextResponse) return email
    let roh: unknown
    try {
      roh = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body ist kein JSON' }, { status: 400 })
    }
    const perspektive = alsProfilPerspektive(roh)
    if ('fehler' in perspektive) return NextResponse.json({ error: perspektive.fehler }, { status: 400 })
    await setProfilPerspektive(email, perspektive)
    return NextResponse.json({ perspektive })
  } catch (error) {
    FileLogger.error('user-story-perspektive', 'Speichern fehlgeschlagen', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
