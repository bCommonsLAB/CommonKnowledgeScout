/**
 * GET /api/chat/[libraryId]/verbrauch?month=JJJJ-MM&scope=all|session
 *
 * Verbrauch der Fragen einer Library (Konzept 10.11.2026): Summen des Monats
 * und die juengsten Fragen als Zahlenzeilen — Zeit, Tokens, Kosten in Euro,
 * Energie (obere Grenze). Anonym lesbar, sobald die Library oeffentlich ist;
 * es kommen KEINE Fragetexte, Kennungen oder Personen.
 *
 * `scope=session` beschraenkt auf die eigene Sitzung (angemeldet: die eigene
 * E-Mail, anonym: `X-Session-ID`).
 */

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { explorerGate } from '@ks/module-explorer'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { listVerbrauchZeilen } from '@/lib/db/queries-verbrauch'
import { aktuellerMonat, monatsGrenzen, usdEurKurs, verbrauchAuswerten, WH_PRO_1000_TOKENS } from '@/lib/verbrauch/rechnen'

const LISTE_MAX = 200
const SCOPES = new Set(['all', 'session'])

export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  const gated = explorerGate(req)
  if (gated) return gated
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const url = new URL(req.url)
    const monat = url.searchParams.get('month') ?? aktuellerMonat()
    const scope = url.searchParams.get('scope') ?? 'all'
    let grenzen: { von: Date; bis: Date }
    try {
      grenzen = monatsGrenzen(monat)
      if (!SCOPES.has(scope)) throw new Error(`scope muss "all" oder "session" sein (hier: "${scope}")`)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
    }

    const sessionId = req.headers.get('x-session-id') || undefined
    const betrachter = userEmail ? { userEmail } : { sessionId }
    // Fehlt der Kurs, zeigt die Seite keine Kosten — sichtbar im Protokoll, nicht still 0.
    const kurs = usdEurKurs()
    if (kurs === null) console.warn('[api/chat/verbrauch] VERBRAUCH_USD_EUR_KURS ist nicht gesetzt — Kosten werden nicht ausgewiesen')

    const { zeilen, abgeschnitten } = await listVerbrauchZeilen({ libraryId, ...grenzen })
    const auswertung = verbrauchAuswerten(zeilen, { kurs, betrachter, nurEigen: scope === 'session', limit: LISTE_MAX })
    return NextResponse.json({
      month: monat,
      scope,
      kostenVerfuegbar: kurs !== null,
      whPro1000Tokens: WH_PRO_1000_TOKENS,
      abgeschnitten,
      ...auswertung,
    })
  } catch (error) {
    console.error('[api/chat/verbrauch]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
