/**
 * @fileoverview Fehlerdetails aus dem Job-Trace lesen (Welle ST7, I3).
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
 * Welle I3 (Befund 11.10.2026): Es kamen die ERSTEN fuenf Ereignisse — bei
 * einem Job mit Neustarts also die aeltesten, nicht der Fehlschlag, um den es
 * ging. Jetzt die juengsten fuenf, in zeitlicher Reihenfolge. Und
 * `step_failed` aus `updateStep` traegt `error` als OBJEKT (`{ message,
 * details }`); das fiel frueher als „aussagelos" durchs Raster.
 *
 * Der Trace ist in `ExternalJob` nicht typisiert (er wird direkt nach Mongo
 * geschrieben) — deshalb hier `unknown` plus Type-Guards statt eines Casts.
 *
 * @module mcp
 */

import { deuteFehler } from './fehler-deutung'

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
 * `error` eines Ereignisses lesbar machen: ein String bleibt, ein Objekt
 * (`{ code, message, details }`) wird zu einem Satz — Code voran, Details
 * als kompaktes JSON dahinter, damit `reason` aus dem Ingest nicht verloren geht.
 */
export function fehlerAlsText(wert: unknown): { meldung: string | null; code: string | null } {
  if (typeof wert === 'string') return { meldung: text(wert), code: null }
  const o = alsObjekt(wert)
  if (!o) return { meldung: null, code: null }
  const code = typeof o['code'] === 'string' && o['code'].trim() ? o['code'].trim() : null
  const message = typeof o['message'] === 'string' && o['message'].trim() ? o['message'].trim() : null
  let details: string | null = null
  if (o['details'] !== undefined && o['details'] !== null) {
    try { details = JSON.stringify(o['details']) } catch { details = String(o['details']) }
  }
  if (!message && !code && !details) return { meldung: null, code: null }
  const satz = [code ? `[${code}]` : null, message, details ? `Details: ${details}` : null]
    .filter((t): t is string => !!t).join(' ')
  return { meldung: text(satz), code }
}

/**
 * Liest die Fehlschlaege aus dem Trace eines Jobs — die juengsten fuenf, in
 * zeitlicher Reihenfolge (das letzte Element ist der letzte Fehlschlag).
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
  for (let i = roh.length - 1; i >= 0 && details.length < MAX_DETAILS; i -= 1) {
    const ereignis = alsObjekt(roh[i])
    if (!ereignis) continue
    const name = ereignis['name']
    const istFehlschlag = name === 'step_failed' || name === 'job_error'
    if (!istFehlschlag) continue

    const attribute = alsObjekt(ereignis['attributes']) ?? {}
    // `job_error` traegt die Meldung oben, `step_failed` in den Attributen —
    // dort als String (phase-template) oder als Objekt (updateStep).
    const fehler = fehlerAlsText(attribute['error'])
    const meldung = fehler.meldung ?? text(ereignis['message'])
    const code = text(attribute['errorCode']) ?? fehler.code
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
  }
  return details.reverse()
}

/**
 * Fehlerblock fuer `job_status`: Details plus Deutung — oder die ehrliche
 * Auskunft, dass der Trace nichts hergibt (alte Jobs ohne Trace). Welle W11:
 * Die Rohmeldung benennt den Fehlschlag, die Deutung zieht die Konsequenz
 * (Quelle ohne Tonspur: jeder Neustart trifft dieselbe Wand). Welle I3: auch
 * `job.error` deuten — text_feed_failed steht nur dort. Aus `tools-jobs.ts`
 * hierher (200-Zeilen-Regel, Welle K).
 */
export function fehlerBlock(job: { error?: { code?: string; message?: string } | null }): Record<string, unknown> {
  const details = fehlerDetailsAusTrace(job)
  const deutung = deuteFehler([
    job.error?.code,
    job.error?.message,
    ...details.map((detail) => detail.meldung),
    ...details.map((detail) => detail.antwortAuszug),
  ])
  if (details.length === 0) {
    return {
      fehlerDetails: [],
      fehlerHinweis:
        'Der Job ist gescheitert, sein Trace enthaelt aber keine Fehlerereignisse — ' +
        'entweder ein alter Job ohne Trace oder der Fehlschlag lag ausserhalb der Schritte.',
      ...(deutung ? { fehlerDeutung: deutung } : {}),
    }
  }
  return { fehlerDetails: details, ...(deutung ? { fehlerDeutung: deutung } : {}) }
}
