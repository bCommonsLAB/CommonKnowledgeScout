/**
 * @fileoverview Reihenfolge der globalen Modell-Liste setzen.
 *
 * @description
 * PUT `{ modelIds: [...] }` — die ganze Liste in der neuen Reihenfolge (auch
 * abgeschaltete Eintraege); Positionen werden 1..n neu vergeben. Das erste
 * aktive Modell ist die Vorgabe fuer neue Besucher im Story-Modus.
 *
 * @route PUT /api/admin/llm-models/reihenfolge
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fehlerAntwort, leseJson } from '@/lib/admin/fehler-antwort'
import { pruefeKsAdmin } from '@/lib/admin/require-ks-admin'
import { SprachmodellFehler } from '@/lib/llm-models/regeln'
import { ladeListe, ordneNeu } from '@/lib/llm-models/verwaltung'

const REIHENFOLGE = z.object({ modelIds: z.array(z.string().trim().min(3)).min(1).max(200) })

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const admin = await pruefeKsAdmin()
    if (!admin.ok) return admin.antwort
    const ergebnis = REIHENFOLGE.safeParse(await leseJson(request))
    if (!ergebnis.success) throw new SprachmodellFehler('Ungueltige Anfrage: modelIds (Liste) erwartet')
    await ordneNeu(ergebnis.data.modelIds, admin.email)
    return NextResponse.json(await ladeListe())
  } catch (error) {
    return fehlerAntwort('admin-llm-models-reihenfolge', 'Reihenfolge setzen', error)
  }
}
