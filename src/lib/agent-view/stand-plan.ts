/**
 * @fileoverview Stand-Plan (F8, Werkbank W7): Entscheidungslogik der Stand-Route.
 *
 * @description
 * Reines Modul der Route `POST /agent-view/stand` (Aufbau wie die
 * Kurations-Route: Logik hier, duenne Route aussen). Der Klick ist eine
 * menschliche Selbstauskunft ins Soll-Buch — die Maschine setzt `abgenommen`
 * nie selbst, sie weigert sich nur, eine Selbstauskunft zu beurkunden, die
 * ihr frisches Ist-Buch widerlegt („nie blind beurkunden", §F8). Die vier
 * Schutzstufen sind benannte Fehler (bei Befund wird NICHTS geschrieben):
 * {@link KeinIndexError} · {@link StandGeaendertError} ·
 * {@link ReportVeraltetError} · {@link NichtBereitError} — Stufe 4 urteilt
 * ueber den FRISCHEN Teilbaum-Scan und ist bewusst strenger als die Ampel
 * (`istBereitZurAbnahme` beschreibt den gespeicherten Report), zaehlt aber
 * nur `error`/`warning`. Reine Funktionen + typisierte Fehler, kein I/O.
 *
 * @module agent-view
 */

import { BEARBEITUNGSSTAND_VALUES, type Bearbeitungsstand, type CoverageGap } from './types'

/** Eingabefehler des Aufrufers (Route antwortet 400). */
export class StandValidationError extends Error {
  readonly code = 'invalid_request' as const
}

/** Stufe 1: Ordner ohne `_INDEX.md` — Index-Autorenschaft ist Cowork-Arbeit (Route: 409). */
export class KeinIndexError extends Error {
  readonly code = 'kein_index' as const
  constructor(folderName: string) {
    super(
      `Ordner „${folderName}" hat kein _INDEX.md — die Stand-Route legt nie eines an. ` +
        'Index-Autorenschaft ist Cowork-Inhaltsarbeit: Auftrag erteilen statt Datei erzeugen.',
    )
  }
}

/** Stufe 2: Storage erklaert einen anderen Stand als erwartet (Route: 409). */
export class StandGeaendertError extends Error {
  readonly code = 'stand_geaendert' as const
  constructor(readonly aktuellerStand: Bearbeitungsstand | null, erwartet: Bearbeitungsstand | null) {
    super(
      `Der erklaerte Stand ist inzwischen „${aktuellerStand ?? 'keiner'}", erwartet war ` +
        `„${erwartet ?? 'keiner'}" — jemand war schneller. Erst neu laden, dann urteilen.`,
    )
  }
}

/** Stufe 3: Client urteilt auf veralteter Report-Sicht (Route: 409). */
export class ReportVeraltetError extends Error {
  readonly code = 'report_veraltet' as const
}

/** Maschineller Befund, der eine Abnahme JETZT blockiert (Precheck-Sicht). */
export interface BlockierenderBefund {
  type: CoverageGap['type']
  actor: CoverageGap['actor']
  severity: CoverageGap['severity']
  path: string
  message: string
}

/** Kappung der Befundliste in der 409-Antwort — benannt, nicht still. */
export const MAX_BEFUNDE_IN_ANTWORT = 20

/** Stufe 4: Der frische Teilbaum-Scan widerlegt die Abnahme (Route: 409). */
export class NichtBereitError extends Error {
  readonly code = 'nicht_bereit' as const
  constructor(
    /** Erste {@link MAX_BEFUNDE_IN_ANTWORT} blockierende Befunde. */
    readonly befunde: readonly BlockierenderBefund[],
    /** Gesamtzahl blockierender Befunde (kann groesser sein als die Liste). */
    readonly gesamt: number,
  ) {
    super(
      `Nicht bereit zur Abnahme: ${gesamt} maschinelle${gesamt === 1 ? 'r' : ''} Befund${gesamt === 1 ? '' : 'e'} ` +
        '(error/warning) im frischen Teilbaum-Scan offen. Nichts wurde geschrieben.',
    )
  }
}

export interface StandRequest {
  folderId: string
  stand: Bearbeitungsstand
  /** Stand, den der Client aktuell sieht; null = Ordner deklariert keinen. */
  erwarteterStand: Bearbeitungsstand | null
  /** `generatedAt` des Reports, auf dem der Client urteilt. */
  reportGeneratedAt: string
  /** „Stand bestaetigen": gleicher Stand, nur `_seit` neu — ueberspringt Stufe 4. */
  bestaetigen: boolean
}

const VALID_STAENDE: ReadonlySet<string> = new Set(BEARBEITUNGSSTAND_VALUES)

function parseStand(value: unknown, feld: string): Bearbeitungsstand {
  if (typeof value === 'string' && VALID_STAENDE.has(value)) return value as Bearbeitungsstand
  throw new StandValidationError(
    `Ungueltiger ${feld}: ${JSON.stringify(value)} — erlaubt: ${BEARBEITUNGSSTAND_VALUES.join(', ')}`,
  )
}

/**
 * Validiert den Request-Body. `erwarteterStand` ist PFLICHT (explizites
 * `null` heisst „Ordner deklariert keinen Stand") — ein fehlender Schluessel
 * waere ein stiller Default und verdeckte Client-Fehler.
 */
export function parseStandRequest(value: unknown): StandRequest {
  if (!value || typeof value !== 'object') {
    throw new StandValidationError(
      'Body fehlt: { folderId, stand, erwarteterStand, reportGeneratedAt, bestaetigen? } erwartet',
    )
  }
  const raw = value as Record<string, unknown>

  const folderId = typeof raw.folderId === 'string' ? raw.folderId.trim() : ''
  if (folderId === '') throw new StandValidationError('folderId ist erforderlich')

  const stand = parseStand(raw.stand, 'stand')

  if (!('erwarteterStand' in raw)) {
    throw new StandValidationError(
      'erwarteterStand ist Pflicht — explizit null senden, wenn der Ordner keinen Stand deklariert',
    )
  }
  const erwarteterStand = raw.erwarteterStand === null ? null : parseStand(raw.erwarteterStand, 'erwarteterStand')

  const reportGeneratedAt = typeof raw.reportGeneratedAt === 'string' ? raw.reportGeneratedAt.trim() : ''
  if (reportGeneratedAt === '') throw new StandValidationError('reportGeneratedAt ist erforderlich')

  if (raw.bestaetigen !== undefined && typeof raw.bestaetigen !== 'boolean') {
    throw new StandValidationError('bestaetigen muss ein Boolean sein')
  }
  const bestaetigen = raw.bestaetigen === true
  if (bestaetigen && stand !== erwarteterStand) {
    throw new StandValidationError(
      '„Stand bestaetigen" heisst: gleicher Stand, nur bearbeitungsstand_seit neu — stand und erwarteterStand muessen uebereinstimmen',
    )
  }

  return { folderId, stand, erwarteterStand, reportGeneratedAt, bestaetigen }
}

/** Stufe 2: wirft, wenn der Storage-Stand nicht der erwartete ist. */
export function pruefeStandGeaendert(
  aktuell: Bearbeitungsstand | null,
  erwartet: Bearbeitungsstand | null,
): void {
  if (aktuell !== erwartet) throw new StandGeaendertError(aktuell, erwartet)
}

/** Stufe 3: wirft, wenn der Client auf einem anderen Report urteilt als dem gespeicherten. */
export function pruefeReportVeraltet(clientGeneratedAt: string, gespeichertGeneratedAt: string | null): void {
  if (gespeichertGeneratedAt === null) {
    throw new ReportVeraltetError('Kein gespeicherter Report — erst scannen, dann Stand setzen.')
  }
  if (clientGeneratedAt !== gespeichertGeneratedAt) {
    throw new ReportVeraltetError(
      `Der Report wurde inzwischen neu gerechnet (${gespeichertGeneratedAt}) — erst neu laden, dann urteilen.`,
    )
  }
}

/** Stufe-4-Regel: Precheck nur bei `abgenommen` ohne `bestaetigen` (§F8). */
export function brauchtPrecheck(request: Pick<StandRequest, 'stand' | 'bestaetigen'>): boolean {
  return request.stand === 'abgenommen' && !request.bestaetigen
}

/**
 * Precheck-Filter — bewusst strenger UND enger als die Ampel: nur maschinelle
 * Befunde (Akteur ≠ mensch) mit Severity `error`/`warning` blockieren die
 * Beurkundung; `info` bleibt Orientierung.
 */
export function blockierendeBefunde(gaps: readonly CoverageGap[]): BlockierenderBefund[] {
  return gaps
    .filter((gap) => gap.actor !== 'mensch' && (gap.severity === 'error' || gap.severity === 'warning'))
    .map(({ type, actor, severity, path, message }) => ({ type, actor, severity, path, message }))
}

/** Stufe 4: wirft {@link NichtBereitError}, wenn der frische Scan Blocker findet. */
export function pruefeBereitschaft(gaps: readonly CoverageGap[]): void {
  const blocker = blockierendeBefunde(gaps)
  if (blocker.length > 0) {
    throw new NichtBereitError(blocker.slice(0, MAX_BEFUNDE_IN_ANTWORT), blocker.length)
  }
}

/**
 * Frontmatter-Patch der Stand-Route: NUR die zwei Stand-Felder, flach und
 * snake_case. `bearbeitungsstand_seit` ist ein DATUM (Zyklus §4) — der Reader
 * liest es als Tagesende, damit der Schreibvorgang selbst (neue mtime des
 * `_INDEX.md`) den frisch gesetzten Stand nicht sofort widerlegt.
 */
export function baueStandPatch(stand: Bearbeitungsstand, nowIso: string): Record<string, string> {
  const datum = nowIso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    throw new StandValidationError(`Unlesbare Zeitquelle fuer bearbeitungsstand_seit: "${nowIso}"`)
  }
  return { bearbeitungsstand: stand, bearbeitungsstand_seit: datum }
}
