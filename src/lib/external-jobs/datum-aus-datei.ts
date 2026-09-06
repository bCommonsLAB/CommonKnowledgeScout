/**
 * @fileoverview `date` aus dem Zeitstempel der Quelldatei (Wunschliste 4, W1 Stufe 3).
 *
 * @description
 * Die Rangfolge der Datumsherkunft hat vier Stufen: **Inhalt** (Transkript,
 * Dokumenttext) gilt als Beleg, **Pfad** liefert `date_quelle: pfad`
 * (`datum-aus-pfad.ts`), **Zeitstempel** liefert `date_quelle: datei` — und
 * sonst bleibt das Feld leer. Dieses Modul ist Stufe 3.
 *
 * **Warum nur Ton und Video.** Gemessen am 06.09.2026 an allen 23 vom
 * Menschen verifizierten Familien in `26.01 Klimamassnahmen Suedtirol` — die
 * verifizierten Daten sind belegte Wahrheit, also die richtige Messlatte:
 *
 * | Typ  | n | exakt | ≤ 3 Tage | > 7 Tage | Median   | Max |
 * |------|---|-------|----------|----------|----------|-----|
 * | m4a  | 9 | 5     | 7        | 1        | 0 Tage   | 23  |
 * | docx | 9 | 2     | 4        | 4        | 4 Tage   | 183 |
 * | pdf  | 5 | 1     | 1        | 4        | 148 Tage | 183 |
 *
 * Bei Tonaufnahmen traegt der Zeitstempel: Median null Tage, sieben von neun
 * innerhalb von drei Tagen. Der Grund ist der Arbeitsweg — am Smartphone
 * aufnehmen, direkt in OneDrive ablegen, nie wieder anfassen. Bei PDFs ist
 * der Median 148 Tage; dort sagt der Stempel nichts ueber die Entstehung.
 * Deshalb ist ein Rueckfall auf den Dateizeitstempel bei PDFs und Dokumenten
 * AUSDRUECKLICH nicht gewuenscht: „Ein falsches Datum ist schlechter als ein
 * leeres Feld, weil es als Beleg gelesen wird und der Report es nicht mehr
 * als Luecke zeigt."
 *
 * **Warum `erstelltAm` vorgeht.** Bei einer Sprachaufnahme ist das
 * Erstellungsdatum der Aufnahmezeitpunkt; es ueberlebt spaetere
 * Bearbeitungen, `geaendertAm` wandert bei jedem Speichern (A1). Fuehrt das
 * Backend kein Erstellungsdatum (Nextcloud), bleibt `geaendertAm` — aber NUR
 * fuer Ton und Video, also genau dort, wo es nachgemessen wurde. Welcher der
 * beiden Stempel es war, steht im Ergebnis und im Job-Trace.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module external-jobs
 */

import type { MediaKind } from '@/lib/media-types'

/** Plausibler Jahresbereich — wie in `datum-aus-pfad.ts`. */
const JAHR_MIN = 1980
const JAHR_MAX = 2099

/**
 * Medienarten, deren Dateizeitstempel eine Aussage ueber die Entstehung
 * traegt. Bewusst ein Set und keine Negativliste: Eine neue Medienart faellt
 * damit HERAUS statt still hinein (`no-silent-fallbacks`).
 */
const ZEITSTEMPEL_MEDIEN: ReadonlySet<MediaKind> = new Set<MediaKind>(['audio', 'video'])

/** Traegt der Dateizeitstempel bei dieser Medienart eine Aussage? */
export function zeitstempelTraegt(kind: MediaKind): boolean {
  return ZEITSTEMPEL_MEDIEN.has(kind)
}

/** Welcher Stempel den Ausschlag gab — der Beleg neben dem Datum. */
export type Zeitstempelfeld = 'erstelltAm' | 'geaendertAm'

export interface DatumAusDatei {
  /** ISO-Datum `JJJJ-MM-TT` (UTC-Kalendertag des Zeitstempels). */
  datum: string
  /** Welches Feld es lieferte. */
  feld: Zeitstempelfeld
  /** Der volle Zeitstempel als ISO — der Beleg. */
  zeitstempel: string
}

function istBrauchbar(wert: Date | undefined, jetzt: Date): boolean {
  if (!(wert instanceof Date)) return false
  const zeit = wert.getTime()
  if (Number.isNaN(zeit)) return false
  // Ein Zeitstempel in der Zukunft ist eine kaputte Uhr, kein Ereignis.
  if (zeit > jetzt.getTime()) return false
  const jahr = wert.getUTCFullYear()
  return jahr >= JAHR_MIN && jahr <= JAHR_MAX
}

/**
 * Leitet `date` aus dem Zeitstempel der Quelldatei ab — oder gibt `null`
 * zurueck, statt zu raten.
 *
 * Der Kalendertag wird in UTC gebildet, damit dasselbe Item immer dasselbe
 * Datum ergibt, egal auf welchem Server der Job laeuft. Bei einer Aufnahme
 * kurz nach Mitternacht Ortszeit kann das einen Tag danebenliegen — genau
 * dafuer reist `date_quelle: datei` mit: Der Wert ist abgeleitet, nicht
 * belegt, und der naechste Mensch sieht das.
 */
export function datumAusZeitstempel(args: {
  mediaKind: MediaKind
  erstelltAm?: Date
  geaendertAm?: Date
  /** Gegenwart (testbar); Vorgabe: jetzt. */
  jetzt?: Date
}): DatumAusDatei | null {
  if (!zeitstempelTraegt(args.mediaKind)) return null
  const jetzt = args.jetzt ?? new Date()

  const kandidaten: ReadonlyArray<[Zeitstempelfeld, Date | undefined]> = [
    ['erstelltAm', args.erstelltAm],
    ['geaendertAm', args.geaendertAm],
  ]
  for (const [feld, wert] of kandidaten) {
    if (!istBrauchbar(wert, jetzt)) continue
    const stempel = wert as Date
    return {
      datum: stempel.toISOString().slice(0, 10),
      feld,
      zeitstempel: stempel.toISOString(),
    }
  }
  return null
}
