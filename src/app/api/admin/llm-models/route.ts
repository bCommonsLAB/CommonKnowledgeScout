/**
 * @fileoverview Admin-API der globalen Modell-Liste (`llm_models`).
 *
 * @description
 * GET   alle Eintraege (auch abgeschaltete) mit Preisen aus dem OpenRouter-Katalog.
 * POST  `{ modelId }` legt ein Modell aus dem Katalog an (abgeschaltet).
 * PATCH `{ modelId, name?, strengths?, isActive? }` aendert einen Eintrag;
 *       aktiv nur nach erfolgreicher Probe (`./probe`).
 * Nur fuer E-Mails aus `KS_ADMIN_EMAIL`. Die Liste gilt fuer alle Libraries.
 *
 * @route /api/admin/llm-models
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fehlerAntwort, leseJson } from '@/lib/admin/fehler-antwort'
import { pruefeKsAdmin } from '@/lib/admin/require-ks-admin'
import { SprachmodellFehler } from '@/lib/llm-models/regeln'
import { aendere, fuegeHinzu, ladeListe } from '@/lib/llm-models/verwaltung'

const SCOPE = 'admin-llm-models'

const NEU = z.object({ modelId: z.string().trim().min(3) })
const AENDERUNG = z.object({
  modelId: z.string().trim().min(3),
  name: z.string().max(80).optional(),
  strengths: z.string().max(300).optional(),
  isActive: z.boolean().optional(),
})

function pruefe<T>(schema: z.ZodType<T>, roh: unknown): T {
  const ergebnis = schema.safeParse(roh)
  if (!ergebnis.success) throw new SprachmodellFehler(`Ungueltige Anfrage: ${ergebnis.error.issues.map((i) => i.message).join('; ')}`)
  return ergebnis.data
}

export async function GET(): Promise<NextResponse> {
  try {
    const admin = await pruefeKsAdmin()
    if (!admin.ok) return admin.antwort
    return NextResponse.json(await ladeListe())
  } catch (error) {
    return fehlerAntwort(SCOPE, 'Liste laden', error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const admin = await pruefeKsAdmin()
    if (!admin.ok) return admin.antwort
    const { modelId } = pruefe(NEU, await leseJson(request))
    await fuegeHinzu(modelId, admin.email)
    return NextResponse.json(await ladeListe(), { status: 201 })
  } catch (error) {
    return fehlerAntwort(SCOPE, 'Modell anlegen', error)
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const admin = await pruefeKsAdmin()
    if (!admin.ok) return admin.antwort
    const { modelId, ...aenderung } = pruefe(AENDERUNG, await leseJson(request))
    await aendere(modelId, aenderung, admin.email)
    return NextResponse.json(await ladeListe())
  } catch (error) {
    return fehlerAntwort(SCOPE, 'Modell aendern', error)
  }
}
