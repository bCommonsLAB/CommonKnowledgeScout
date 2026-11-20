/**
 * @fileoverview Probefrage ueber den Secretary an ein Modell der Liste.
 *
 * @description
 * POST `{ modelId }` — schickt eine Mini-Frage ohne Secretary-Cache und
 * speichert das Ergebnis am Eintrag. Auch eine gescheiterte Probe ist eine
 * gueltige Antwort (200, `probe.ok: false` mit Fehlertext).
 *
 * @route POST /api/admin/llm-models/probe
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fehlerAntwort, leseJson } from '@/lib/admin/fehler-antwort'
import { pruefeKsAdmin } from '@/lib/admin/require-ks-admin'
import { SprachmodellFehler } from '@/lib/llm-models/regeln'
import { ladeListe, probiere } from '@/lib/llm-models/verwaltung'

const PROBE = z.object({ modelId: z.string().trim().min(3) })

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const admin = await pruefeKsAdmin()
    if (!admin.ok) return admin.antwort
    const ergebnis = PROBE.safeParse(await leseJson(request))
    if (!ergebnis.success) throw new SprachmodellFehler('Ungueltige Anfrage: modelId erwartet')
    const probe = await probiere(ergebnis.data.modelId, admin.email)
    return NextResponse.json({ probe, liste: await ladeListe() })
  } catch (error) {
    return fehlerAntwort('admin-llm-models-probe', 'Probe', error)
  }
}
