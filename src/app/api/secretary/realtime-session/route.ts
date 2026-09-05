/**
 * @fileoverview Secretary Realtime Session API Route - Ticket fuer die Live-Transkription
 *
 * @description
 * Gibt einem angemeldeten Nutzer ein kurzlebiges Ticket, mit dem sein Browser die
 * Live-Transkription direkt beim KI-Anbieter oeffnet. Der Anbieter-Schluessel bleibt im
 * Secretary Service; hier laufen nur Anmeldepruefung und Drosselung.
 *
 * @module secretary
 *
 * @exports
 * - POST: Stellt ein Ticket fuer eine Live-Transkriptions-Session aus
 *
 * @usedIn
 * - src/lib/live-transcription: Der Live-Hook holt hier sein Ticket
 *
 * @dependencies
 * - @clerk/nextjs/server: Authentifizierung
 * - @/lib/secretary/realtime-ticket: Ticket-Bezug beim Secretary Service
 * - @/lib/secretary/realtime-rate-limit: Begrenzung der Ticket-Ausgabe
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { RealtimeTicketError, requestRealtimeTicket } from '@/lib/secretary/realtime-ticket'
import { consumeRealtimeTicketQuota } from '@/lib/secretary/realtime-rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RealtimeSessionBody {
  language?: unknown
  prompt?: unknown
  keywords?: unknown
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

/**
 * POST /api/secretary/realtime-session
 *
 * Body (JSON, alle Felder optional):
 * - language: ISO-639-1-Code des Sprechers; leer oder 'auto' laesst den Anbieter erkennen
 * - prompt: Freitext zur Fuehrung der Erkennung
 * - keywords: Begriffe, die haeufig vorkommen (Namen, Fachwoerter)
 */
export async function POST(request: NextRequest) {
  const { userId } = getAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const quota = consumeRealtimeTicketQuota(`user:${userId}`)
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Live-Sessions in kurzer Zeit. Bitte kurz warten.' },
      { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } }
    )
  }

  const body = ((await request.json().catch(() => null)) || {}) as RealtimeSessionBody

  try {
    const ticket = await requestRealtimeTicket({
      language: readString(body.language),
      prompt: readString(body.prompt),
      keywords: readStringList(body.keywords),
    })
    return NextResponse.json(ticket)
  } catch (error) {
    if (error instanceof RealtimeTicketError) {
      // Status des Secretary durchreichen: 503 (kein Modell zugeordnet) und 502
      // (Anbieter lehnt ab) sagen dem Nutzer Unterschiedliches.
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: `Verbindung zum Secretary Service fehlgeschlagen: ${message}` },
      { status: 502 }
    )
  }
}
