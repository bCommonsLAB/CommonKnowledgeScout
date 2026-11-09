/**
 * GET /api/chat/[libraryId]/popular-questions?limit=5&days=30
 *
 * Meistgestellte Fragen der Library aus dem Fragen-Log — fuer den Block
 * `<!-- popular -->` der Story-Sektion (Owner 09.11.2026). Anonym lesbar,
 * sobald die Library oeffentlich ist (wie Facetten und Dokumentliste); es
 * kommen nur Fragetexte und Zaehler, keine Antworten, keine Sitzungen.
 */

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { explorerGate } from '@ks/module-explorer'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { listPopularQuestions } from '@/lib/db/queries-popular'

const LIMIT_MAX = 12
const TAGE_MAX = 365

function zahl(roh: string | null, vorgabe: number, max: number, name: string): number {
  if (roh === null || roh.trim() === '') return vorgabe
  const n = Number(roh)
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`${name} muss eine ganze Zahl von 1 bis ${max} sein (hier: "${roh}")`)
  return n
}

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
    let limit: number
    let tage: number
    try {
      limit = zahl(url.searchParams.get('limit'), 5, LIMIT_MAX, 'limit')
      tage = zahl(url.searchParams.get('days'), 30, TAGE_MAX, 'days')
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
    }
    const items = await listPopularQuestions({ libraryId, tage, limit })
    return NextResponse.json({ items, days: tage })
  } catch (error) {
    console.error('[api/chat/popular-questions]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
