/**
 * @fileoverview Account-API: Verbindungstest. Prueft die Zugangsdaten gegen
 * den Dienst und speichert das Ergebnis am Datensatz; Antwort ist die
 * Zusammenfassung mit `lastTest`.
 *
 * @module api/account
 */

import { NextRequest, NextResponse } from 'next/server'
import { testStorageConnection } from '@/lib/storage-connections/connection-service'
import { fehlerAntwort, requireUserEmail } from '@/lib/storage-connections/route-helpers'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const { id } = await params
    return NextResponse.json(await testStorageConnection(userEmail, id))
  } catch (error) {
    return fehlerAntwort('Test fehlgeschlagen', error)
  }
}
