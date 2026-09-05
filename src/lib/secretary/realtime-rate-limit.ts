/**
 * @fileoverview Realtime-Drosselung - Begrenzt die Ausgabe von Live-Transkriptions-Tickets
 *
 * @description
 * Ein Ticket ist ein kurzlebiger, aber echter Zugang zum KI-Konto des Betreibers. Ohne
 * Begrenzung koennte ein angemeldeter Nutzer (oder ein geteilter Public-Link) beliebig
 * viele Sessions oeffnen. Diese Drosselung begrenzt die Ausgabe pro Schluessel.
 *
 * Bewusste Einschraenkung: Der Zaehler liegt im Prozessspeicher. Bei mehreren
 * App-Instanzen gilt das Limit pro Instanz, nicht global. Das ist als grober Deckel
 * gegen Ausreisser gedacht, nicht als Abrechnungsgrenze.
 *
 * @module secretary
 *
 * @exports
 * - consumeRealtimeTicketQuota: Prueft und verbucht einen Ticket-Bezug
 *
 * @usedIn
 * - src/app/api/secretary/realtime-session/route.ts
 * - src/app/api/public/secretary/realtime-session/route.ts
 */

/** Zeitfenster der Betrachtung. */
const WINDOW_MS = 10 * 60 * 1000

/**
 * Erlaubte Tickets je Fenster. Eine lange Aufnahme braucht mehrere: Die Session beim
 * Anbieter endet nach 60 Minuten, dazu kommen Tickets nach Verbindungsabbruechen.
 * 30 deckt zwei Stunden Diktat mit reichlich Reserve ab.
 */
const MAX_TICKETS_PER_WINDOW = 30

const buckets = new Map<string, number[]>()

export interface QuotaResult {
  allowed: boolean
  /** Sekunden bis zum naechsten freien Versuch (nur wenn `allowed` false ist). */
  retryAfterSeconds: number
}

/**
 * Verbucht einen Ticket-Bezug fuer den angegebenen Schluessel.
 *
 * @param key Stabiler Bezeichner des Anfragenden (Nutzer-ID oder Library+Event).
 */
export function consumeRealtimeTicketQuota(key: string, now: number = Date.now()): QuotaResult {
  const windowStart = now - WINDOW_MS
  const recent = (buckets.get(key) || []).filter((timestamp) => timestamp > windowStart)

  if (recent.length >= MAX_TICKETS_PER_WINDOW) {
    const oldest = recent[0]
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
    buckets.set(key, recent)
    return { allowed: false, retryAfterSeconds }
  }

  recent.push(now)
  buckets.set(key, recent)

  // Aufraeumen, damit die Map bei vielen Einmal-Nutzern (Public-Links) nicht waechst.
  if (buckets.size > 5000) {
    for (const [existingKey, timestamps] of buckets) {
      if (timestamps.every((timestamp) => timestamp <= windowStart)) buckets.delete(existingKey)
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

/** Nur fuer Tests: setzt alle Zaehler zurueck. */
export function resetRealtimeTicketQuota(): void {
  buckets.clear()
}
