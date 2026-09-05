/**
 * @fileoverview Ticket-Bezug im Browser
 *
 * @description
 * Holt ein Ticket fuer die Live-Transkription bei der eigenen Anwendung. Zwei Wege,
 * passend zu den beiden bestehenden Diktat-Wegen: angemeldet oder oeffentlich mit
 * writeKey.
 *
 * @module live-transcription
 *
 * @exports
 * - AUTHENTICATED_TICKET_ENDPOINT, PUBLIC_TICKET_ENDPOINT
 * - fetchRealtimeTicket: Holt ein Ticket
 *
 * @dependencies
 * - ./types: RealtimeTicket
 */

import type { RealtimeTicket } from './types'

export const AUTHENTICATED_TICKET_ENDPOINT = '/api/secretary/realtime-session'
export const PUBLIC_TICKET_ENDPOINT = '/api/public/secretary/realtime-session'

export interface TicketRequestOptions {
  endpoint?: string
  language?: string
  prompt?: string
  keywords?: string[]
  /** Zusaetzliche Felder des oeffentlichen Wegs (libraryId, eventFileId, writeKey). */
  extraFields?: Record<string, string>
  signal?: AbortSignal
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Holt ein Ticket.
 *
 * @throws Error mit der Meldung der Route. Es gibt bewusst keinen Rueckfall auf die
 *         Aufnahme am Stueck — die Oberflaeche entscheidet sichtbar, was dann geschieht.
 */
export async function fetchRealtimeTicket(
  options: TicketRequestOptions = {}
): Promise<RealtimeTicket> {
  const endpoint = options.endpoint || AUTHENTICATED_TICKET_ENDPOINT

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: options.language || '',
      prompt: options.prompt || '',
      keywords: options.keywords || [],
      ...(options.extraFields || {}),
    }),
    signal: options.signal,
  })

  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${response.status}`
    throw new Error(message)
  }

  const payload = (data || {}) as Record<string, unknown>
  const value = readString(payload.value)
  const websocketUrl = readString(payload.websocketUrl)
  if (!value || !websocketUrl) {
    throw new Error('Die Antwort enthielt kein gueltiges Ticket.')
  }

  return {
    value,
    websocketUrl,
    model: readString(payload.model),
    expiresAt: typeof payload.expiresAt === 'number' ? payload.expiresAt : null,
  }
}
