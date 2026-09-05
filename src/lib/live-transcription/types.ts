/**
 * @fileoverview Live-Transkription - gemeinsame Typen
 *
 * @description
 * Begriffe der Live-Transkription: das Ticket fuer den Verbindungsaufbau, die
 * Abschnitte des Transkripts (mit Sprecher-Label, wenn das Modell eines liefert)
 * und der nach aussen sichtbare Zustand einer Aufnahme.
 *
 * @module live-transcription
 *
 * @exports
 * - RealtimeTicket, LiveSegment, LiveStatus, LiveConnectionState, LiveGap
 */

/** Ticket, wie es die Ticket-Route liefert. */
export interface RealtimeTicket {
  value: string
  expiresAt: number | null
  model: string
  websocketUrl: string
}

/**
 * Ein fertiger Abschnitt des Transkripts.
 *
 * `speaker` fuellt nur ein Modell mit Sprecher-Erkennung; sonst bleibt das Feld leer.
 * `source` haelt fest, wie der Text entstanden ist — live waehrend des Sprechens oder
 * nachtraeglich aus dem Mitschnitt einer Stoerung.
 */
export interface LiveSegment {
  id: string
  text: string
  speaker: string | null
  /** Beginn relativ zum Aufnahmestart, in Millisekunden. */
  startMs: number
  /** Ende relativ zum Aufnahmestart, in Millisekunden. */
  endMs: number
  source: 'live' | 'recovered'
}

/** Eine Zeitspanne, deren Text noch fehlt (Verbindungsabbruch, Sessionwechsel). */
export interface LiveGap {
  id: string
  startMs: number
  endMs: number | null
  /**
   * offen: die Stoerung dauert an; wartet: Mitschnitt liegt vor, Nacharbeit steht aus;
   * laeuft: Nachtranskription unterwegs; geschlossen: Text eingefuegt;
   * gescheitert: Nacharbeit fehlgeschlagen, der Mitschnitt bleibt erhalten.
   */
  state: 'offen' | 'wartet' | 'laeuft' | 'geschlossen' | 'gescheitert'
  /** Mitschnitt der Stoerung, sobald sie vorbei ist. */
  audio: Blob | null
  /** Grund der Stoerung, fuer die Anzeige. */
  reason: string
}

/** Zustand der Verbindung zum Anbieter. */
export type LiveConnectionState =
  | 'getrennt'
  | 'verbindet'
  | 'verbunden'
  | 'puffert'
  | 'wechselt-session'

/** Zustand der Aufnahme insgesamt. */
export type LiveStatus = 'bereit' | 'nimmt-auf' | 'arbeitet-nach' | 'fehler'

/** Was der Hook nach aussen zeigt. */
export interface LiveTranscriptionSnapshot {
  status: LiveStatus
  connection: LiveConnectionState
  /** Bereits feststehende Abschnitte, in zeitlicher Reihenfolge. */
  segments: LiveSegment[]
  /** Noch nicht abgeschlossener Text des laufenden Abschnitts. */
  pendingText: string
  /** Offene oder in Nacharbeit befindliche Luecken. */
  gaps: LiveGap[]
  /** Sekunden Audio, die gerade gepuffert auf Versand warten. */
  bufferedSeconds: number
  /** Laufzeit der Aufnahme in Millisekunden. */
  elapsedMs: number
  error: string | null
}
