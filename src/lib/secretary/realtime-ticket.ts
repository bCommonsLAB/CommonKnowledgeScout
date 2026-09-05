/**
 * @fileoverview Realtime-Ticket - Server-seitiger Bezug kurzlebiger Live-Transkriptions-Tickets
 *
 * @description
 * Holt beim Secretary Service ein kurzlebiges Ticket, mit dem sich der Browser direkt
 * mit dem Realtime-Endpunkt des KI-Anbieters verbindet. Der Anbieter-Schluessel bleibt
 * dabei im Secretary; hier laeuft nur der Ticket-Bezug.
 *
 * Der Audiostrom laeuft bewusst NICHT ueber diese Anwendung: Ein Relay durch Next.js
 * und den Secretary (WSGI, kein WebSocket) wuerde Latenz und Ausfallflaechen addieren,
 * ohne dass ein anderer Empfaenger entstuende.
 *
 * @module secretary
 *
 * @exports
 * - RealtimeTicket: Interface - Ticket samt Verbindungsdaten
 * - RealtimeTicketError: Fehlerklasse mit HTTP-Status fuer die Weitergabe an den Client
 * - RealtimeTicketOptions: Interface - Eingabe fuer den Ticket-Bezug
 * - requestRealtimeTicket: Holt ein Ticket beim Secretary Service
 *
 * @usedIn
 * - src/app/api/secretary/realtime-session/route.ts
 * - src/app/api/public/secretary/realtime-session/route.ts
 *
 * @dependencies
 * - @/lib/env: Secretary-Konfiguration
 * - @/lib/utils/fetch-with-timeout: Zeitueberschreitung fuer den Aufruf
 */

import { buildSecretaryServiceApiUrl, getSecretaryConfig } from '@/lib/env'
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'
import { SecretaryServiceError } from '@/lib/secretary/client'

/**
 * Fehler beim Ticket-Bezug. Erbt von `SecretaryServiceError` (kanonische Fehler-Hierarchie
 * des Secretary-Wrappers) und traegt zusaetzlich den HTTP-Status, damit die Route dem
 * Client denselben Status zeigen kann statt pauschal 500.
 */
export class RealtimeTicketError extends SecretaryServiceError {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'RealtimeTicketError'
    this.status = status
  }
}

/** Relativer Pfad des Ticket-Endpunkts am Secretary Service. */
const TICKET_PATH = 'realtime/transcription-session'

/** Der Ticket-Bezug ist ein kurzer Steuer-Aufruf, keine Verarbeitung. */
const TICKET_TIMEOUT_MS = 15000

export interface RealtimeTicket {
  /** Das kurzlebige Geheimnis fuer den Verbindungsaufbau. */
  value: string
  /** Ablaufzeitpunkt als Unix-Sekunden, falls der Anbieter einen nennt. */
  expiresAt: number | null
  /** Das vom Secretary zugeordnete Modell (aus der LLM-Konfigurationsmaske). */
  model: string
  /** Adresse des Realtime-Endpunkts. */
  websocketUrl: string
}

export interface RealtimeTicketOptions {
  /** Sprache des Sprechers (ISO 639-1) oder leer fuer automatische Erkennung. */
  language?: string
  /** Freitext, der die Erkennung fuehrt (z.B. Themengebiet). */
  prompt?: string
  /** Begriffe, die haeufig vorkommen (Namen, Fachwoerter). */
  keywords?: string[]
  /** Gueltigkeit des Tickets in Sekunden. */
  ticketSeconds?: number
}

interface SecretaryTicketResponse {
  status?: string
  data?: {
    value?: unknown
    expires_at?: unknown
    model?: unknown
    websocket_url?: unknown
  }
  error?: { code?: unknown; message?: unknown }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Holt ein Ticket beim Secretary Service.
 *
 * @throws RealtimeTicketError wenn der Dienst nicht konfiguriert ist, ablehnt oder
 *         eine Antwort ohne Ticket liefert. Es gibt bewusst keinen Rueckfall auf die
 *         Batch-Transkription — der Aufrufer entscheidet sichtbar, was dann passiert.
 */
export async function requestRealtimeTicket(
  options: RealtimeTicketOptions = {}
): Promise<RealtimeTicket> {
  const { baseUrl, apiKey } = getSecretaryConfig()
  if (!baseUrl) {
    throw new RealtimeTicketError('SECRETARY_SERVICE_URL ist nicht konfiguriert', 500)
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
    headers['X-Secretary-Api-Key'] = apiKey
  }

  const response = await fetchWithTimeout(buildSecretaryServiceApiUrl(baseUrl, TICKET_PATH), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      language: options.language || '',
      prompt: options.prompt || '',
      keywords: options.keywords || [],
      ...(typeof options.ticketSeconds === 'number' ? { ticket_seconds: options.ticketSeconds } : {}),
    }),
    timeoutMs: TICKET_TIMEOUT_MS,
  })

  const payload = (await response.json().catch(() => null)) as SecretaryTicketResponse | null

  if (!response.ok) {
    const message = readString(payload?.error?.message) || `HTTP ${response.status}`
    throw new RealtimeTicketError(`Live-Transkription nicht verfuegbar: ${message}`, response.status)
  }

  const value = readString(payload?.data?.value)
  const websocketUrl = readString(payload?.data?.websocket_url)
  const model = readString(payload?.data?.model)

  if (!value || !websocketUrl) {
    throw new RealtimeTicketError('Antwort des Secretary Service enthaelt kein Ticket', 502)
  }

  const expiresAtRaw = payload?.data?.expires_at
  return {
    value,
    expiresAt: typeof expiresAtRaw === 'number' ? expiresAtRaw : null,
    model,
    websocketUrl,
  }
}
