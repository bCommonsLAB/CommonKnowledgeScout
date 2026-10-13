/**
 * Gemeinsame Bausteine der Routen unter `/api/account/storage-connections`:
 * Clerk-Gate mit User-E-Mail (projektweite Konvention) und die Fehlerantwort
 * mit Status aus der Fehlerklasse. Antworten enthalten nie Geheimnisse.
 */

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { FileLogger } from '@/lib/debug/logger'
import { storageConnectionErrorStatus } from './errors'

export async function requireUserEmail(): Promise<string | NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
  if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
  return userEmail
}

export function fehlerAntwort(scope: string, error: unknown): NextResponse {
  const status = storageConnectionErrorStatus(error)
  const message = error instanceof Error ? error.message : 'Interner Fehler'
  if (status === 500) FileLogger.error('storage-connections', scope, { error: message })
  return NextResponse.json({ error: message }, { status })
}
