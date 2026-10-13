/**
 * @fileoverview Account-API: OneDrive-Anmeldung einer Verbindung.
 *
 * GET liefert die Microsoft-Anmelde-URL (der Browser navigiert dorthin; der
 * Callback `/api/auth/onedrive/callback` erkennt die Verbindung am `state`).
 * DELETE meldet ab (Tokens an der Verbindung entfernen).
 *
 * @module api/account
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireStorageConnection, setOneDriveTokens } from '@/lib/storage-connections/connection-service'
import { buildOneDriveAuthUrl } from '@/lib/storage-connections/onedrive-login'
import { STORAGE_CONNECTIONS_PATH } from '@/lib/storage-connections/onedrive-callback'
import { fehlerAntwort, requireUserEmail } from '@/lib/storage-connections/route-helpers'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const { id } = await params
    const conn = await requireStorageConnection(userEmail, id)
    if (!conn.onedrive) return NextResponse.json({ error: 'Keine OneDrive-Verbindung.' }, { status: 400 })
    const state = JSON.stringify({ connectionId: id, redirect: STORAGE_CONNECTIONS_PATH })
    return NextResponse.json({ url: buildOneDriveAuthUrl(conn.onedrive, state) })
  } catch (error) {
    return fehlerAntwort('Anmelde-URL fehlgeschlagen', error)
  }
}

export async function DELETE(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const { id } = await params
    return NextResponse.json(await setOneDriveTokens(userEmail, id, null))
  } catch (error) {
    return fehlerAntwort('Abmelden fehlgeschlagen', error)
  }
}
