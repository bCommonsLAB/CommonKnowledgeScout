/**
 * @fileoverview Account-API: Status/Widerruf des MCP-Account-Keys (Stufe 2).
 *
 * @description
 * GET liefert NUR Status (konfiguriert + Zeitpunkt) — nie Key-Material; der
 * Klartext existiert ausschliesslich im Download der Erweiterung
 * (`../mcp-extension`). DELETE widerruft den Key (Erweiterung verliert den
 * Zugang beim naechsten Aufruf). Account-Domaene: Auth via Clerk, Wirkung
 * haengt an der User-Email (projektweite Konvention).
 *
 * @module api/account
 */

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { FileLogger } from '@/lib/debug/logger'
import { getMcpAccountKeyStatus, revokeMcpAccountKey } from '@/lib/mcp/account-key-service'

async function requireUserEmail(): Promise<string | NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
  if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
  return userEmail
}

export async function GET(): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const status = await getMcpAccountKeyStatus(userEmail)
    return NextResponse.json(status)
  } catch (error) {
    FileLogger.error('account-mcp-key', 'Status fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const revoked = await revokeMcpAccountKey(userEmail)
    if (!revoked) return NextResponse.json({ error: 'Kein Key vorhanden' }, { status: 404 })
    return NextResponse.json({ revoked: true })
  } catch (error) {
    FileLogger.error('account-mcp-key', 'Widerruf fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
