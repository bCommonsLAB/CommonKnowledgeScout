/**
 * @fileoverview Account-API: eine Speicher-Verbindung aendern oder loeschen.
 *
 * PATCH nimmt dieselbe Eingabe wie das Anlegen; leere Geheimnisse heissen
 * „beibehalten". DELETE verweigert (409), solange eine Library der Person auf
 * die Verbindung zeigt.
 *
 * @module api/account
 */

import { NextRequest, NextResponse } from 'next/server'
import { deleteStorageConnection, updateStorageConnection } from '@/lib/storage-connections/connection-service'
import { fehlerAntwort, requireUserEmail } from '@/lib/storage-connections/route-helpers'
import type { StorageConnectionInput } from '@/types/storage-connection'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const { id } = await params
    const input = (await request.json().catch(() => null)) as StorageConnectionInput | null
    if (!input || typeof input !== 'object') {
      return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 })
    }
    return NextResponse.json(await updateStorageConnection(userEmail, id, input))
  } catch (error) {
    return fehlerAntwort('Aendern fehlgeschlagen', error)
  }
}

export async function DELETE(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const { id } = await params
    await deleteStorageConnection(userEmail, id)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return fehlerAntwort('Loeschen fehlgeschlagen', error)
  }
}
