/**
 * Ergebnis der deterministischen Nachprüfung einer Antwort
 * (Plan `story-status-modalitaet`, m4). Wird im Query-Log abgelegt und vom
 * Orchestrator zurückgegeben; die Logik liegt in `src/lib/chat/nachpruefung.ts`.
 */

/** Wie oft welcher Wert einer Facette unter den zitierten Dokumenten vorkommt. */
export interface NachpruefungVerteilung {
  metaKey: string
  /** Label der Facette (für die Fußnote). */
  label: string
  /** Anzahl zitierter Dokumente, die diese Facette tragen. */
  dokumente: number
  werte: Array<{
    wert: string
    /** Label aus dem Wörterbuch; ohne Eintrag der Rohwert (sichtbar, nicht versteckt). */
    label: string
    anzahl: number
  }>
}

/** Eine verbotene Formulierung, die trotz des Status eines zitierten Dokuments in der Antwort steht. */
export interface NachpruefungVerstoss {
  metaKey: string
  wert: string
  wertLabel: string
  formulierung: string
  /** Dokument-Nummern [n], deren Wert diese Formulierung verbietet. */
  nummern: number[]
}

export interface NachpruefungErgebnis {
  verteilung: NachpruefungVerteilung[]
  verstoesse: NachpruefungVerstoss[]
  /** Dokument-Nummern, die geprüft wurden (zitierte; leer zitiert = alle). */
  geprueft: number[]
}
