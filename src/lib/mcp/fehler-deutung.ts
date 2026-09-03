/**
 * @fileoverview Wiederkehrende Fehlschlaege deuten, statt sie durchzureichen (W11).
 *
 * @description
 * Cowork-Befund 02.09.2026: **Sieben Bildschirmaufnahmen** scheiterten
 * reproduzierbar an der Ton-Extraktion — sie haben schlicht keine Tonspur.
 * `job_status` reichte die Meldung des Dienstes durch (seit ST7 immerhin
 * die echte), aber niemand las daraus die Konsequenz: Ein erneuter Versuch
 * scheitert wieder, an derselben Stelle, aus demselben Grund. Der Scan
 * meldete die Quellen weiter als `source_without_twin` — behebbar —, und so
 * wurden sie wieder gestartet.
 *
 * **Der schwerwiegendere Teil desselben Befunds:** Bei zwei dieser Dateien
 * hat eine FRUEHERE Transkription nicht gescheitert, sondern **halluziniert**
 * — chinesische Phantomsaetze, die fuer jeden Scan gueltig aussehen. Ein
 * Transkript ohne Tonquelle ist kein Transkript, aber nichts am Artefakt
 * verraet das. Deshalb sagt die Deutung es ausdruecklich: Wo diese Quelle
 * schon ein Transkript hat, gehoert es angesehen, nicht geglaubt.
 *
 * **Was hier NICHT steht.** Die eigentliche Vorpruefung (`ffprobe` vor der
 * Extraktion, zwei Sekunden statt eines Jobs) gehoert in den Secretary
 * Service — dieses Repository fuehrt weder ffmpeg noch ffprobe aus. Bis es
 * sie gibt, macht diese Deutung den Fehlschlag wenigstens einmal verstaendlich
 * statt siebenmal raetselhaft.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module mcp
 */

/** Was der Fehlschlag bedeutet und was daraus folgt. */
export interface FehlerDeutung {
  /** Kurzname der erkannten Lage — dieselbe Sprache wie die Coverage-Befunde. */
  art: 'quelle_ohne_ton'
  /** Klartext: was los ist. */
  deutung: string
  /** Was zu tun ist — und was ausdruecklich NICHT. */
  empfehlung: string
  /** false = ein erneuter Versuch scheitert wieder. */
  wiederholenSinnvoll: false
}

/**
 * Signaturen einer fehlenden Tonspur.
 *
 * Bewusst eng und woertlich: Ein zu breites Muster wuerde fremde Fehlschlaege
 * mit einer falschen Diagnose versehen, und eine falsche Diagnose ist
 * schlimmer als gar keine — sie beendet die Suche.
 */
const OHNE_TON: readonly RegExp[] = [
  /does not contain any stream/i,
  /matches no streams/i,
  /\bno audio stream(s)? (found|detected|present)\b/i,
  /\bkeine? (audio|ton)spur\b/i,
  /stream map .*matches no streams/i,
]

/**
 * Deutet die gesammelten Fehlermeldungen eines Jobs.
 *
 * `null` heisst „nicht erkannt" — dann bleibt es bei den Rohdetails aus dem
 * Trace. Es wird nichts geraten: Lieber keine Deutung als eine, die in die
 * falsche Richtung schickt.
 */
export function deuteFehler(meldungen: readonly (string | null)[]): FehlerDeutung | null {
  const text = meldungen.filter((meldung): meldung is string => typeof meldung === 'string').join('\n')
  if (text === '') return null

  if (OHNE_TON.some((muster) => muster.test(text))) {
    return {
      art: 'quelle_ohne_ton',
      deutung:
        'Die Datei enthaelt keine Tonspur — die Ton-Extraktion findet nichts zum Transkribieren. ' +
        'Typisch fuer Bildschirmaufnahmen, die ohne Mikrofon aufgezeichnet wurden.',
      empfehlung:
        'NICHT erneut erschliessen: Der Job scheitert wieder an derselben Stelle. Entweder die ' +
        'Aufnahme mit Ton ersetzen, oder die Quelle mit quelle_verwerfen aus dem Bestand nehmen. ' +
        'WICHTIG: Falls diese Quelle bereits ein Transkript hat, ist es verdaechtig — eine ' +
        'Transkription ohne Tonquelle liefert erfundenen Text, der fuer jeden Scan gueltig ' +
        'aussieht. Vor dem Weiterverwenden ansehen.',
      wiederholenSinnvoll: false,
    }
  }

  return null
}
