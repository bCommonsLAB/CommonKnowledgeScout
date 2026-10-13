/**
 * @fileoverview Account-API: Speicher-Verbindungen der Person (Plan Teil A, A1).
 *
 * GET listet Zusammenfassungen (nie Geheimnisse), POST legt eine Verbindung
 * an. Account-Domaene: Auth via Clerk, Wirkung haengt an der User-Email.
 *
 * @module api/account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createStorageConnection, listStorageConnectionSummaries } from '@/lib/storage-connections/connection-service'
import { fehlerAntwort, requireUserEmail } from '@/lib/storage-connections/route-helpers'
import type { StorageConnectionInput } from '@/types/storage-connection'

export async function GET(): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const connections = await listStorageConnectionSummaries(userEmail)
    return NextResponse.json({ connections })
  } catch (error) {
    return fehlerAntwort('Liste fehlgeschlagen', error)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userEmail = await requireUserEmail()
    if (userEmail instanceof NextResponse) return userEmail
    const input = (await request.json().catch(() => null)) as StorageConnectionInput | null
    if (!input || typeof input !== 'object') {
      return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 })
    }
    const summary = await createStorageConnection(userEmail, input)
    return NextResponse.json(summary, { status: 201 })
  } catch (error) {
    return fehlerAntwort('Anlegen fehlgeschlagen', error)
  }
}
