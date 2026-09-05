/**
 * @fileoverview Public Realtime Session API Route - writeKey-geschuetztes Ticket
 *
 * @description
 * Ticket fuer die Live-Transkription ohne Login (z.B. Testimonial per QR-Link).
 * Geschuetzt durch dieselbe writeKey-Kette wie die Batch-Variante
 * (`/api/public/secretary/process-audio`).
 *
 * @module public
 *
 * @exports
 * - POST: Stellt ein Ticket fuer eine Live-Transkriptions-Session aus
 *
 * @usedIn
 * - src/components/public/testimonial-recorder.tsx: Public-Flow der Live-Transkription
 *
 * @dependencies
 * - @/lib/public/testimonial-write-access: Zugriffspruefung
 * - @/lib/secretary/realtime-ticket: Ticket-Bezug beim Secretary Service
 * - @/lib/secretary/realtime-rate-limit: Begrenzung der Ticket-Ausgabe
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  TestimonialAccessError,
  assertTestimonialWriteAccess,
} from '@/lib/public/testimonial-write-access'
import { RealtimeTicketError, requestRealtimeTicket } from '@/lib/secretary/realtime-ticket'
import { consumeRealtimeTicketQuota } from '@/lib/secretary/realtime-rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PublicRealtimeSessionBody {
  libraryId?: unknown
  eventFileId?: unknown
  writeKey?: unknown
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
 * POST /api/public/secretary/realtime-session
 *
 * Body (JSON):
 * - libraryId: string (erforderlich)
 * - eventFileId: string (erforderlich)
 * - writeKey: string (erforderlich fuer private Libraries)
 * - language, prompt, keywords: optional, wie bei der angemeldeten Variante
 */
export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => null)) || {}) as PublicRealtimeSessionBody

  const libraryId = readString(body.libraryId)
  const eventFileId = readString(body.eventFileId)
  const writeKey = readString(body.writeKey)

  try {
    await assertTestimonialWriteAccess({ libraryId, eventFileId, writeKey })
  } catch (error) {
    if (error instanceof TestimonialAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Zugriff konnte nicht geprüft werden'
    return NextResponse.json({ error: message }, { status: 403 })
  }

  // Erst nach bestandener Pruefung drosseln, damit fehlgeschlagene Versuche das
  // Kontingent eines berechtigten Aufnehmenden nicht aufbrauchen.
  const quota = consumeRealtimeTicketQuota(`event:${libraryId}:${eventFileId}`)
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Live-Sessions in kurzer Zeit. Bitte kurz warten.' },
      { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } }
    )
  }

  try {
    const ticket = await requestRealtimeTicket({
      language: readString(body.language),
      prompt: readString(body.prompt),
      keywords: readStringList(body.keywords),
    })
    return NextResponse.json(ticket)
  } catch (error) {
    if (error instanceof RealtimeTicketError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: `Verbindung zum Secretary Service fehlgeschlagen: ${message}` },
      { status: 502 }
    )
  }
}
