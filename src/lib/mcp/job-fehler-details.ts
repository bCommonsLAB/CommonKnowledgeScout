/**
 * @fileoverview Fehlerdetails aus dem Job-Trace lesen (Welle ST7).
 *
 * @description
 * Live-Befund 28.08.2026: Vierzehn Transformationen scheiterten, und
 * `job_status` sagte dazu nur `job.error.message` — „Template-Transformation
 * fehlgeschlagen". Das ist der Satz, der das Scheitern benennt, aber nichts
 * erklaert. Die eigentliche Auskunft steht im Trace, in den Attributen der
 * `step_failed`- und `job_error`-Ereignisse:
 *
 *   „Transformer lieferte kein gueltiges structured_data. …"
 *
 * Kein Werkzeug reichte sie durch. Der Nutzer musste in die Datenbank, um
 * einen Fehler zu verstehen, den die Bruecke selbst kannte.
 *
 * Der Trace ist in `ExternalJob` nicht typisiert (er wird direkt nach Mongo
 * geschrieben) — deshalb hier `unknown` plus Type-Guards statt eines Casts.
 *
 * @module mcp
 */

/** Was zum Scheitern eines Schritts bekannt ist. */
export interface FehlerDetail {
  /** Betroffener Schritt, z. B. `transform_template`. */
  schritt: string | null
  zeitpunkt: string | null
  /** Fehlercode der Pipeline, z. B. `template_failed`. */
  code: string | null
  /** Die eigentliche Meldung — das, was bisher nur in der Datenbank stand. */
  meldung: string | null
  httpStatus: number | null
  url: string | null
  /** Auszug der Dienst-Antwort, soweit die Pipeline ihn festgehalten hat. */
  antwortAuszug: string | null
}

/** Obergrenze je Textfeld (Q2: Antwortgroessen sind begrenzt, immer). */
const MAX_TEXT = 1500
/** Mehr als so viele Fehlschlaege sagen nichts Neues. */
const MAX_DETAILS = 5

function alsObjekt(wert: unknown): Record<string, unknown> | null {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert)
    ? (wert as Record<string, unknown>)
    : null
}

function text(wert: unknown): string | null {
  if (typeof wert === 'string') return wert.length > MAX_TEXT ? `${wert.slice(0, MAX_TEXT)}…` : wert
  return null
}

function zahl(wert: unknown): number | null {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : null
}

/** Zeitpunkt als ISO-String — Mongo liefert Date, JSON einen String. */
function zeit(wert: unknown): string | null {
  if (wert instanceof Date) return wert.toISOString()
  return typeof wert === 'string' ? wert : null
}

/**
 * Liest die Fehlschlaege aus dem Trace eines Jobs.
 *
 * Leeres Array heisst „nichts gefunden" — das ist bei einem gelungenen Job
 * die richtige Antwort und bei einem gescheiterten ein Hinweis darauf, dass
 * der Trace fehlt (alte Jobs) statt dass alles in Ordnung waere. Der
 * Aufrufer sagt das ausdruecklich, statt Schweigen fuer Erfolg zu halten.
 */
export function fehlerDetailsAusTrace(job: unknown): FehlerDetail[] {
  const wurzel = alsObjekt(job)
  const trace = alsObjekt(wurzel?.['trace'])
  const roh = trace?.['events']
  if (!Array.isArray(roh)) return []

  const details: FehlerDetail[] = []
  for (const eintrag of roh) {
    const ereignis = alsObjekt(eintrag)
    if (!ereignis) continue
    const name = ereignis['name']
    const istFehlschlag = name === 'step_failed' || name === 'job_error'
    if (!istFehlschlag) continue

    const attribute = alsObjekt(ereignis['attributes']) ?? {}
    // `job_error` traegt die Meldung oben, `step_failed` in den Attributen.
    const meldung = text(attribute['error']) ?? text(ereignis['message'])
    const code = text(attribute['errorCode'])
    // Ereignisse ohne jede Aussage weglassen — der Worker schreibt bei
    // einem Fehlschlag mehrere, teils mit `error: null`.
    if (meldung === null && code === null) continue

    details.push({
      schritt: text(attribute['step']),
      zeitpunkt: zeit(ereignis['ts']),
      code,
      meldung,
      httpStatus: zahl(attribute['status']),
      url: text(attribute['url']),
      antwortAuszug: text(attribute['responseDataPreview']),
    })
    if (details.length >= MAX_DETAILS) break
  }
  return details
}
