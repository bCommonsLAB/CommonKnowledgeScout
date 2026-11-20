/**
 * @fileoverview Ist die angemeldete Person Admin dieser Plattform (`KS_ADMIN_EMAIL`)?
 *
 * @description
 * Fuer die Einstellungen: nur Admins sehen den Eintrag „Sprachmodelle".
 * Liefert nur `{ istAdmin }`, keine Adressen. Fehlt `KS_ADMIN_EMAIL`, steht
 * das im Server-Log (kein stilles „niemand ist Admin").
 *
 * @route GET /api/admin/status
 */

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { adminStatus } from '@/lib/admin/ks-admin'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { FileLogger } from '@/lib/debug/logger'

export async function GET(): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const email = getPreferredUserEmail(await currentUser())
    if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
    const status = adminStatus(email)
    if (!status.konfiguriert) console.warn('[api/admin/status] KS_ADMIN_EMAIL ist nicht gesetzt — niemand ist Admin')
    return NextResponse.json({ istAdmin: status.istAdmin })
  } catch (error) {
    FileLogger.error('admin-status', 'Status fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
