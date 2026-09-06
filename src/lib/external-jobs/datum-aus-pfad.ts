/**
 * @fileoverview `date` aus dem Ablagepfad ableiten (Welle W10, erweitert W1b).
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
 * Jahres. Deshalb braucht die TAGES-Form Tag, Monat UND vierstelliges Jahr.
 * Aus demselben Grund gibt es kein blankes `JJJJMMTT`: Eine achtstellige
 * Ziffernfolge ist im Zweifel eine Nummer, kein Datum.
 *
 * **Nachtrag W1b (Wunschliste 4).** Gemessen am 06.09.2026: 371 der 487
 * offenen `date`-Felder (76,2 %) liegen unter einem Ordner, dessen Name mit
 * `JJJJ-MM` oder `JJJJ-MM-TT` beginnt — beim direkten Elternordner sind es
 * nur 194 (39,8 %), der Rest steht weiter oben im Pfad und ist damit nur
 * MONATSSCHARF. Zwei Erweiterungen holen den Rest:
 *
 *  1. Die deutsche Form auch ein-/zweistellig (`Villa Berta 8.10.2024`) —
 *     das vierstellige Jahr bleibt Pflicht, also bleibt sie eindeutig.
 *  2. `JJJJ-MM` als Monats-Treffer, ausgewiesen mit
 *     {@link DatumAusPfad.genauigkeit} `'monat'`. Der Tag ist dann NICHT
 *     bekannt; der Wert traegt den Monatsersten, und die Genauigkeit reist
 *     mit, damit niemand ihn spaeter fuer taggenau haelt.
 *
 * Tagesgenauigkeit schlaegt Monatsgenauigkeit IMMER — auch wenn sie weiter
 * aussen im Pfad steht. Ein bekannter Tag wird nicht gegen einen unbekannten
 * eingetauscht, nur weil das gröbere Segment naeher an der Datei liegt.
 *
 * **Was bewusst NICHT gelesen wird:** die dreiteilige Form mit zweistelligem
 * Jahr (`25.06.11 Verwaltungsrat Sitzung`). Sie ist nicht aufloesbar: Nach
 * Archiv-Konvention (`JJ.MM` = Vorhabensnummer) waere das der 11.06.2025,
 * als deutsches Datum gelesen der 25.06.2011 — vierzehn Jahre Unterschied.
 * „Ein falsches Datum ist schlechter als ein leeres Feld, weil es als Beleg
 * gelesen wird" (Wunschliste 4). Also bleibt das Feld leer.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module external-jobs
 */

/** Plausibler Jahresbereich — davor/danach ist es eher eine Nummer als ein Datum. */
const JAHR_MIN = 1980
const JAHR_MAX = 2099

/** ISO-artig, taggenau: 2025-07-16, 2025_07_16, 2025.07.16 */
const ISO = /(?<![0-9])(?<jahr>[0-9]{4})[-_.](?<monat>[0-9]{2})[-_.](?<tag>[0-9]{2})(?![0-9])/

/**
 * Deutsch, taggenau: 16.07.2025, 8.10.2024, 16-07-2025.
 * Das vierstellige Jahr ist Pflicht — ohne es waere `24.09` ein Datum.
 */
const DEUTSCH = /(?<![0-9])(?<tag>[0-9]{1,2})[-_.](?<monat>[0-9]{1,2})[-_.](?<jahr>[0-9]{4})(?![0-9])/

/**
 * ISO, monatsgenau: `2025-07 Rueckblick`. Der Nachbar-Guard schliesst aus,
 * dass hier der Kopf eines taggenauen Treffers abgeschnitten wird.
 */
const ISO_MONAT = /(?<![0-9])(?<jahr>[0-9]{4})[-_.](?<monat>[0-9]{2})(?![-_.]?[0-9])/

/** Wie genau ist das gefundene Datum wirklich? */
export type DatumGenauigkeit = 'tag' | 'monat'

/** Ein Treffer in EINEM Segment. */
export interface DatumFund {
  /** ISO-Datum `JJJJ-MM-TT`; bei `genauigkeit: 'monat'` der Monatserste. */
  datum: string
  genauigkeit: DatumGenauigkeit
}

export interface DatumAusPfad extends DatumFund {
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

function iso(jahr: number, monat: number, tag: number): string {
  return `${String(jahr).padStart(4, '0')}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

function ausTreffer(gruppen: Record<string, string> | undefined): string | null {
  if (!gruppen) return null
  const jahr = Number(gruppen.jahr)
  const monat = Number(gruppen.monat)
  const tag = Number(gruppen.tag)
  if (!istEchterTag(jahr, monat, tag)) return null
  return iso(jahr, monat, tag)
}

/** Taggenauer Treffer in EINEM Segment (Ordner- oder Dateiname). */
export function tagAusSegment(segment: string): string | null {
  return ausTreffer(segment.match(ISO)?.groups) ?? ausTreffer(segment.match(DEUTSCH)?.groups)
}

/**
 * Monatsgenauer Treffer in EINEM Segment. Liefert den Monatsersten — der Tag
 * ist NICHT bekannt, das sagt die Genauigkeit des Aufrufers.
 */
export function monatAusSegment(segment: string): string | null {
  const gruppen = segment.match(ISO_MONAT)?.groups
  if (!gruppen) return null
  const jahr = Number(gruppen.jahr)
  const monat = Number(gruppen.monat)
  if (!istEchterTag(jahr, monat, 1)) return null
  return iso(jahr, monat, 1)
}

/** Findet ein Datum in EINEM Segment — taggenau vor monatsgenau. */
export function datumAusSegment(segment: string): DatumFund | null {
  const tag = tagAusSegment(segment)
  if (tag) return { datum: tag, genauigkeit: 'tag' }
  const monat = monatAusSegment(segment)
  if (monat) return { datum: monat, genauigkeit: 'monat' }
  return null
}

/**
 * Sucht das Datum im Pfad — vom spezifischsten Segment nach aussen.
 *
 * Der Dateiname schlaegt seinen Ordner, der Ordner schlaegt den Elternordner:
 * Wer eine Datei `2025-07-16 Protokoll.md` in einen Jahresordner `2025-01-02
 * Auftakt` legt, meint den 16. Juli. Die aeussere Angabe ist die groebere.
 *
 * ZWEI Durchgaenge, nicht einer: Erst wird der ganze Pfad nach einem TAG
 * abgesucht, dann erst nach einem MONAT. Sonst wuerde ein monatsscharfer
 * Unterordner einen taggenauen Elternordner verdraengen — und Genauigkeit
 * verschenkt man nicht fuer Naehe.
 */
export function datumAusPfad(pfad: string): DatumAusPfad | null {
  const segmente = pfad.split('/').filter((teil) => teil.trim() !== '')
  for (let i = segmente.length - 1; i >= 0; i--) {
    const datum = tagAusSegment(segmente[i])
    if (datum) return { datum, segment: segmente[i], genauigkeit: 'tag' }
  }
  for (let i = segmente.length - 1; i >= 0; i--) {
    const datum = monatAusSegment(segmente[i])
    if (datum) return { datum, segment: segmente[i], genauigkeit: 'monat' }
  }
  return null
}

/** Gilt ein vorhandener `date`-Wert als gesetzt? */
export function dateFehlt(wert: unknown): boolean {
  if (wert === undefined || wert === null) return true
  if (typeof wert === 'string') return wert.trim() === ''
  return false
}
