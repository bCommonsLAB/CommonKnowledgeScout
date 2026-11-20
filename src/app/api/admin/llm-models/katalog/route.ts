/**
 * @fileoverview Suche im OpenRouter-Katalog fuer „Modell hinzufuegen".
 *
 * @description
 * GET `?q=deepseek flash` — bis zu 30 Treffer, die noch nicht in der Liste
 * stehen, mit Preis je 1 Mio. Token und Kontextfenster.
 *
 * @route GET /api/admin/llm-models/katalog
 */

import { NextResponse, type NextRequest } from 'next/server'
import { fehlerAntwort } from '@/lib/admin/fehler-antwort'
import { pruefeKsAdmin } from '@/lib/admin/require-ks-admin'
import { sucheKatalog } from '@/lib/llm-models/verwaltung'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await pruefeKsAdmin()
    if (!admin.ok) return admin.antwort
    const frage = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100)
    if (frage.length < 2) return NextResponse.json({ treffer: [] })
    return NextResponse.json({ treffer: await sucheKatalog(frage) })
  } catch (error) {
    return fehlerAntwort('admin-llm-models-katalog', 'Katalog-Suche', error)
  }
}
