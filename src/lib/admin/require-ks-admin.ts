/**
 * @fileoverview Gate fuer Admin-Routen: Clerk-Anmeldung + `KS_ADMIN_EMAIL`.
 *
 * @module admin
 */

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { adminStatus } from './ks-admin'

export type AdminPruefung =
  | { ok: true; email: string }
  | { ok: false; antwort: NextResponse }

const nein = (status: number, error: string): AdminPruefung => ({
  ok: false,
  antwort: NextResponse.json({ error }, { status }),
})

/** Liefert die E-Mail des angemeldeten Admins oder die passende Fehlerantwort. */
export async function pruefeKsAdmin(): Promise<AdminPruefung> {
  const { userId } = await auth()
  if (!userId) return nein(401, 'Nicht authentifiziert')
  const email = getPreferredUserEmail(await currentUser())
  if (!email) return nein(400, 'User-Email unbekannt')
  const status = adminStatus(email)
  if (!status.konfiguriert) {
    return nein(403, 'KS_ADMIN_EMAIL ist auf diesem Server nicht gesetzt — niemand darf Plattform-Einstellungen aendern')
  }
  if (!status.istAdmin) return nein(403, 'Nur der Admin dieser Plattform (KS_ADMIN_EMAIL) darf das')
  return { ok: true, email }
}
