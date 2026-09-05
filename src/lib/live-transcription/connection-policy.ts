/**
 * @fileoverview Regeln fuer Verbindung und Sessionwechsel
 *
 * @description
 * Die Zeit- und Wiederholungsregeln der Live-Transkription als reine Funktionen —
 * damit sie ohne Browser und ohne Netz pruefbar sind.
 *
 * Hintergrund Sessionwechsel: Eine Live-Session endet beim Anbieter nach 60 Minuten,
 * gleich was der Client tut. Wer eine Stunde am Stueck spricht, braucht also einen
 * Wechsel — und zwar bevor der Anbieter abschaltet, sonst faellt die Naht mitten ins
 * Wort. Deshalb wird ab Minute 50 auf die naechste Sprechpause gewartet und
 * spaetestens in Minute 55 hart gewechselt.
 *
 * @module live-transcription
 *
 * @exports
 * - SESSION_LIMIT_MS, SOFT_ROTATE_AFTER_MS, HARD_ROTATE_AFTER_MS
 * - shouldRotateSession: Entscheidet ueber den Sessionwechsel
 * - reconnectDelayMs: Wartezeit vor dem naechsten Verbindungsversuch
 */

/** Harte Obergrenze des Anbieters fuer eine Live-Session. */
export const SESSION_LIMIT_MS = 60 * 60 * 1000

/** Ab hier wird bei der naechsten Sprechpause gewechselt. */
export const SOFT_ROTATE_AFTER_MS = 50 * 60 * 1000

/** Spaetestens hier wird gewechselt, auch mitten im Sprechen. */
export const HARD_ROTATE_AFTER_MS = 55 * 60 * 1000

/** Erste Wartezeit nach einem Abbruch. */
export const INITIAL_RECONNECT_DELAY_MS = 500

/** Obergrenze der Wartezeit, damit eine lange Stoerung nicht zu Minutenpausen fuehrt. */
export const MAX_RECONNECT_DELAY_MS = 10000

export interface RotationInput {
  /** Laufzeit der aktuellen Session in Millisekunden. */
  sessionAgeMs: number
  /** Ob gerade gesprochen wird (Sprechpausen-Erkennung des Anbieters). */
  isSpeaking: boolean
}

/**
 * Entscheidet, ob die Session gewechselt werden soll.
 *
 * Bewusst zwei Schwellen: Der Wechsel in einer Sprechpause kostet niemanden ein Wort,
 * der harte Wechsel kostet hoechstens den Bruchteil eines Satzes — und der wird als
 * Luecke aus dem Mitschnitt nachgearbeitet.
 */
export function shouldRotateSession(input: RotationInput): boolean {
  if (input.sessionAgeMs >= HARD_ROTATE_AFTER_MS) return true
  return input.sessionAgeMs >= SOFT_ROTATE_AFTER_MS && !input.isSpeaking
}

/**
 * Wartezeit vor dem naechsten Verbindungsversuch: verdoppelt sich je Versuch bis zur
 * Obergrenze. Der erste Versuch startet sofort nach einer halben Sekunde, damit ein
 * kurzer Aussetzer kaum auffaellt.
 *
 * @param attempt Nummer des bevorstehenden Versuchs, beginnend bei 1.
 */
export function reconnectDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, Math.floor(attempt))
  const delay = INITIAL_RECONNECT_DELAY_MS * 2 ** (safeAttempt - 1)
  return Math.min(delay, MAX_RECONNECT_DELAY_MS)
}
