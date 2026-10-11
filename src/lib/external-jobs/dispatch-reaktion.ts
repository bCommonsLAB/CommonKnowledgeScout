/**
 * @fileoverview Wie der Worker auf das Ergebnis seines `/start`-Aufrufs reagiert.
 *
 * @description
 * Reine Entscheidung, damit sie testbar ist. Befund 11.10.2026: Ein Timeout
 * des eigenen `fetch()` heisst NICHT, dass der Job nicht laeuft — die
 * Start-Route arbeitet synchron weiter. Darum: loslassen, nicht neu einreihen.
 * Neu eingereiht wird nur, wenn die Route gar nicht erreicht wurde (DNS,
 * Verbindung abgelehnt, Reset). Ein 409 heisst: die Route hat den Job schon
 * — der Aufruf war ein Doppelstart und bleibt folgenlos.
 *
 * @module external-jobs
 */

export type DispatchReaktion =
  /** Route hat angenommen und abgearbeitet. */
  | 'erledigt'
  /** Route meldet: Job laeuft dort bereits — nichts tun. */
  | 'laeuft_schon'
  /** Route hat den Job mit einem Fehler beendet — Job ist failed. */
  | 'fehlgeschlagen'
  /** Unser Warten ist abgelaufen; die Route arbeitet weiter — nichts tun. */
  | 'losgelassen'
  /** Route nicht erreicht — neu einreihen (mit Versuchszaehler). */
  | 'neu_einreihen'

export const DOPPELSTART_STATUS = 409

export function reaktionAufAntwort(httpStatus: number): DispatchReaktion {
  if (httpStatus === DOPPELSTART_STATUS) return 'laeuft_schon'
  if (httpStatus >= 200 && httpStatus < 300) return 'erledigt'
  return 'fehlgeschlagen'
}

export function reaktionAufFehler(fehler: unknown): DispatchReaktion {
  const name = fehler instanceof Error ? fehler.name : ''
  return name === 'AbortError' ? 'losgelassen' : 'neu_einreihen'
}
