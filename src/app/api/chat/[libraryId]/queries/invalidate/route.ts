/**
 * POST /api/chat/[libraryId]/queries/invalidate
 * Body: { queryIds: string[] } ODER { alle: true }
 *
 * Verwirft gespeicherte Antworten (Owner/Moderator): setzt `cacheInvalidatedAt`
 * auf jeden Eintrag mit demselben Cache-Hash wie die genannten Kennungen bzw.
 * auf alle noch gültigen Einträge der Library. Es wird NICHTS gelöscht —
 * Chronik, Sitzungen und populäre Fragen bleiben vollständig; nur die
 * nächste gleiche Frage bekommt eine neue Antwort.
 */

import { NextRequest, NextResponse } from 'next/server'
import { explorerGate } from '@ks/module-explorer'
import { z } from 'zod'
import { pruefeVerwaltungsZugang } from '@/lib/chat/verwaltung/zugang'
import { verwerfeAntworten } from '@/lib/db/queries-verwaltung'

const AUFTRAG = z
  .object({
    queryIds: z.array(z.string().min(1)).min(1).max(500).optional(),
    alle: z.literal(true).optional(),
  })
  .refine((b) => (b.alle === true) !== (Array.isArray(b.queryIds) && b.queryIds.length > 0), {
    message: 'Genau eines angeben: queryIds (1 bis 500 Kennungen) ODER alle: true',
  })

export async function POST(request: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  // Site-Gate (Modul-Landkarte §3): ohne aktives Modul `explorer` antwortet die Route mit 404.
  const gated = explorerGate(request)
  if (gated) return gated
  const { libraryId } = await params
  try {
    const zugang = await pruefeVerwaltungsZugang(libraryId)
    if (!zugang.ok) return zugang.response

    let roh: unknown
    try {
      roh = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger Request-Body (JSON erwartet)' }, { status: 400 })
    }
    const auftrag = AUFTRAG.safeParse(roh)
    if (!auftrag.success) {
      return NextResponse.json({ error: auftrag.error.issues.map((i) => i.message).join('; ') }, { status: 400 })
    }

    const ergebnis = await verwerfeAntworten({ libraryId, queryIds: auftrag.data.queryIds, alle: auftrag.data.alle })
    return NextResponse.json({ ...ergebnis, zeitpunkt: ergebnis.zeitpunkt.toISOString() })
  } catch (error) {
    console.error('[api/chat/queries/invalidate] POST', { libraryId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
