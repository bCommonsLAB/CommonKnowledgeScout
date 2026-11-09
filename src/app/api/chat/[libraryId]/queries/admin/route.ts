/**
 * GET /api/chat/[libraryId]/queries/admin?seite&proSeite&suche&nurTreffer&nurVeraltete
 *
 * Verwaltungssicht „Fragen & Antworten" (Owner/Moderator): gespeicherte
 * Antworten der Library als Hash-Gruppen — Frage, Kurztitel, Datum, Sprache,
 * Modell, Anzahl Quellen, Facetten, `cacheInvalidatedAt` und ob der Hash
 * noch zur aktuellen Konfiguration passt (`aktualitaet`). Keine Antworttexte
 * (auf Abruf: GET queries/[queryId]), keine Erstellerdaten. Dazu
 * `gesamtTreffer`: wie viele Antworten der Library noch als Treffer gelten
 * (Zahl für die Rückfrage „Alle verwerfen").
 */

import { NextRequest, NextResponse } from 'next/server'
import { explorerGate } from '@ks/module-explorer'
import { pruefeVerwaltungsZugang } from '@/lib/chat/verwaltung/zugang'
import { listeFragenLogGruppen, zaehleGueltigeAntworten } from '@/lib/db/queries-verwaltung'
import { baueAktualitaetsPruefer } from '@/lib/chat/utils/cache-aktualitaet'
import {
  PRO_SEITE_MAX,
  PRO_SEITE_VORGABE,
  baueFragenLogSeite,
  leseSchalter,
  leseZahl,
  type SeitenWahl,
} from '@/lib/chat/verwaltung/fragen-log-sicht'

const SEITE_MAX = 10000

export async function GET(request: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  // Site-Gate (Modul-Landkarte §3): ohne aktives Modul `explorer` antwortet die Route mit 404.
  const gated = explorerGate(request)
  if (gated) return gated
  const { libraryId } = await params
  try {
    const zugang = await pruefeVerwaltungsZugang(libraryId)
    if (!zugang.ok) return zugang.response

    const q = request.nextUrl.searchParams
    let wahl: SeitenWahl
    let suche: string | undefined
    let nurTreffer: boolean
    try {
      wahl = {
        seite: leseZahl(q.get('seite'), 1, SEITE_MAX, 'seite'),
        proSeite: leseZahl(q.get('proSeite'), PRO_SEITE_VORGABE, PRO_SEITE_MAX, 'proSeite'),
        nurVeraltete: leseSchalter(q.get('nurVeraltete'), 'nurVeraltete'),
      }
      nurTreffer = leseSchalter(q.get('nurTreffer'), 'nurTreffer')
      suche = q.get('suche')?.trim() || undefined
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
    }

    const [gruppen, gesamtTreffer] = await Promise.all([
      listeFragenLogGruppen({ libraryId, suche, nurTreffer }),
      zaehleGueltigeAntworten(libraryId),
    ])
    const pruefer = baueAktualitaetsPruefer(zugang.library, zugang.chat)
    const seite = await baueFragenLogSeite(gruppen, pruefer, wahl)
    return NextResponse.json({ ...seite, gesamtTreffer })
  } catch (error) {
    console.error('[api/chat/queries/admin] GET', { libraryId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
