/**
 * @fileoverview `date` aus dem Ablagepfad ableiten (Welle W10).
 *
 * @description
 * Gemessen am 02.09.2026: **rund 360 von 1.440 Befunden** bibliotheksweit sind
 * fehlende `date`-Felder; in einem Vorhabensordner 54 von 66. Und in fast
 * allen Faellen steht das Datum im Ordnernamen — `2025-07-16 Besprechung mit
 * Jonas`. Die Pipeline gibt den Pfad als CONTEXT mit, das Template ignoriert
 * ihn, und der A0-Contract verbietet zu Recht, ein Datum zu erfinden.
 *
 * Ein Datum aus dem Ordnernamen ist aber keine Erfindung, sondern eine
 * Ableitung MIT BELEG. Deshalb wird sie ausgewiesen (`date_quelle: pfad`) —
 * ein stillschweigend gefuelltes Feld waere ununterscheidbar von einem, das
 * jemand geprueft hat.
 *
 * **Die Falle, an der eine naive Fassung scheitert:** Die Vorhabensordner
 * dieses Archivs heissen `26.01 Klimamassnahmen Suedtirol`, `24.09`, `23.12`.
 * Als deutsches Datum gelesen waere `24.09` der 24. September — irgendeines
 * Jahres. Deshalb wird NUR erkannt, was Tag, Monat UND vierstelliges Jahr
 * traegt. Aus demselben Grund gibt es kein blankes `JJJJMMTT`: Eine
 * achtstellige Ziffernfolge ist im Zweifel eine Nummer, kein Datum.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module external-jobs
 */

/** Plausibler Jahresbereich — davor/danach ist es eher eine Nummer als ein Datum. */
const JAHR_MIN = 1980
const JAHR_MAX = 2099

/** ISO-artig: 2025-07-16, 2025_07_16, 2025.07.16 */
const ISO = /(?<![0-9])(?<jahr>[0-9]{4})[-_.](?<monat>[0-9]{2})[-_.](?<tag>[0-9]{2})(?![0-9])/

/** Deutsch: 16.07.2025, 16-07-2025 — das vierstellige Jahr ist Pflicht. */
const DEUTSCH = /(?<![0-9])(?<tag>[0-9]{2})[-_.](?<monat>[0-9]{2})[-_.](?<jahr>[0-9]{4})(?![0-9])/

export interface DatumAusPfad {
  /** ISO-Datum `JJJJ-MM-TT`. */
  datum: string
  /** Das Pfadsegment, aus dem es stammt — der Beleg. */
  segment: string
}

/** Existiert dieser Kalendertag wirklich? (Kein 31. Februar.) */
function istEchterTag(jahr: number, monat: number, tag: number): boolean {
  if (jahr < JAHR_MIN || jahr > JAHR_MAX) return false
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return false
  const datum = new Date(Date.UTC(jahr, monat - 1, tag))
  return datum.getUTCFullYear() === jahr && datum.getUTCMonth() === monat - 1 && datum.getUTCDate() === tag
}

function ausTreffer(gruppen: Record<string, string> | undefined): string | null {
  if (!gruppen) return null
  const jahr = Number(gruppen.jahr)
  const monat = Number(gruppen.monat)
  const tag = Number(gruppen.tag)
  if (!istEchterTag(jahr, monat, tag)) return null
  return `${String(jahr).padStart(4, '0')}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

/** Findet ein Datum in EINEM Segment (Ordner- oder Dateiname). */
export function datumAusSegment(segment: string): string | null {
  return ausTreffer(segment.match(ISO)?.groups) ?? ausTreffer(segment.match(DEUTSCH)?.groups)
}

/**
 * Sucht das Datum im Pfad — vom spezifischsten Segment nach aussen.
 *
 * Der Dateiname schlaegt seinen Ordner, der Ordner schlaegt den Elternordner:
 * Wer eine Datei `2025-07-16 Protokoll.md` in einen Jahresordner `2025-01-02
 * Auftakt` legt, meint den 16. Juli. Die aeussere Angabe ist die groebere.
 */
export function datumAusPfad(pfad: string): DatumAusPfad | null {
  const segmente = pfad.split('/').filter((teil) => teil.trim() !== '')
  for (let i = segmente.length - 1; i >= 0; i--) {
    const datum = datumAusSegment(segmente[i])
    if (datum) return { datum, segment: segmente[i] }
  }
  return null
}

/** Gilt ein vorhandener `date`-Wert als gesetzt? */
export function dateFehlt(wert: unknown): boolean {
  if (wert === undefined || wert === null) return true
  if (typeof wert === 'string') return wert.trim() === ''
  return false
}
