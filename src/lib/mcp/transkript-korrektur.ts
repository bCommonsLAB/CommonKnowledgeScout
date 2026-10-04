/**
 * @fileoverview Wortlaut-Ersetzungen im Transkript-Body (Wunschliste 7, B1).
 *
 * @description
 * Reine Funktionen hinter `transkript_korrigieren`: Ersetzungen nacheinander
 * anwenden — alles oder nichts —, jeden Treffer mit Zeile und Kontext belegen
 * und mehrdeutige oder fehlende Treffer ABLEHNEN statt zu raten. Dieselbe
 * Schutzidee wie bei `datei_patchen` („die Eindeutigkeit ist der Schutz"),
 * nur mit dem ausdruecklichen `alle: true` fuer wiederkehrende Hoerfehler.
 *
 * Kein I/O. Der Storage-/Mongo-Teil liegt in `transkript-korrektur-schreiben.ts`.
 *
 * @module mcp
 */

export interface Ersetzung {
  alt: string
  neu: string
  /** true = jedes Vorkommen ersetzen; sonst muss `alt` GENAU EINMAL vorkommen. */
  alle?: boolean
}

/** Beleg eines angewandten Eintrags — fuer die Antwort an den Agenten. */
export interface ErsetzungBeleg {
  alt: string
  neu: string
  /** Wie viele Stellen ersetzt wurden (1, ausser bei `alle: true`). */
  treffer: number
  /** Zeile (1-basiert) des ersten Treffers im Body. */
  zeile: number
  kontextVorher: string
  kontextNachher: string
}

export interface TrefferStelle {
  zeile: number
  kontext: string
}

/** `alt` kommt im Body nicht vor — der Aufrufer sieht eine andere Fassung. */
export class ErsetzungNichtGefundenError extends Error {
  readonly code = 'nicht_gefunden' as const
  constructor(readonly ersetzung: Ersetzung, readonly index: number) {
    super(
      `Ersetzung ${index + 1}: "${ersetzung.alt}" kommt im Transkript nicht vor — NICHTS geschrieben. ` +
        'Entweder ist die Stelle schon korrigiert, oder die gelesene Fassung ist nicht die aktuelle.',
    )
    this.name = 'ErsetzungNichtGefundenError'
  }
}

/** `alt` kommt mehrfach vor und `alle` ist nicht gesetzt — nicht raten. */
export class ErsetzungNichtEindeutigError extends Error {
  readonly code = 'nicht_eindeutig' as const
  constructor(
    readonly ersetzung: Ersetzung,
    readonly index: number,
    readonly anzahl: number,
    readonly treffer: TrefferStelle[],
  ) {
    super(
      `Ersetzung ${index + 1}: "${ersetzung.alt}" kommt ${anzahl}-mal vor — NICHTS geschrieben. ` +
        'Mehr Kontext in `alt` aufnehmen, bis es genau einmal passt, oder `alle: true` setzen, ' +
        'wenn wirklich jede Stelle gemeint ist.',
    )
    this.name = 'ErsetzungNichtEindeutigError'
  }
}

/** Zeichen links und rechts eines Treffers, die als Kontext mitgegeben werden. */
const KONTEXT_ZEICHEN = 40

/** Alle Startpositionen von `nadel` in `heu` (ohne Ueberlappung, ohne Regex). */
function finde(heu: string, nadel: string): number[] {
  const positionen: number[] = []
  let von = 0
  for (;;) {
    const treffer = heu.indexOf(nadel, von)
    if (treffer === -1) return positionen
    positionen.push(treffer)
    von = treffer + nadel.length
  }
}

/** 1-basierte Zeile einer Zeichenposition. */
export function zeileVon(text: string, position: number): number {
  let zeile = 1
  for (let i = 0; i < position && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) zeile += 1
  }
  return zeile
}

/**
 * Ausschnitt um eine Stelle — auf EINER Zeile gehalten, damit die Antwort
 * lesbar bleibt (Zeilenumbrueche werden zu „⏎").
 */
export function kontextUm(text: string, position: number, laenge: number): string {
  const von = Math.max(0, position - KONTEXT_ZEICHEN)
  const bis = Math.min(text.length, position + laenge + KONTEXT_ZEICHEN)
  const kern = text.slice(von, bis).replace(/\r?\n/g, '⏎')
  return `${von > 0 ? '…' : ''}${kern}${bis < text.length ? '…' : ''}`
}

/**
 * Wendet die Ersetzungen in Reihenfolge an. Jeder Eintrag sieht das Ergebnis
 * des vorigen (wie der Stapel von `datei_patchen`); scheitert einer, wird
 * nichts zurueckgegeben, sondern geworfen — der Aufrufer schreibt dann nichts.
 */
export function wendeErsetzungenAn(
  body: string,
  ersetzungen: readonly Ersetzung[],
): { body: string; belege: ErsetzungBeleg[] } {
  if (ersetzungen.length === 0) throw new Error('`ersetzungen` darf nicht leer sein')

  let text = body
  const belege: ErsetzungBeleg[] = []

  for (const [index, ersetzung] of ersetzungen.entries()) {
    if (ersetzung.alt === '') throw new Error(`Ersetzung ${index + 1}: \`alt\` darf nicht leer sein`)
    if (ersetzung.alt === ersetzung.neu) {
      throw new Error(`Ersetzung ${index + 1}: \`alt\` und \`neu\` sind gleich — nichts zu tun`)
    }

    const positionen = finde(text, ersetzung.alt)
    if (positionen.length === 0) throw new ErsetzungNichtGefundenError(ersetzung, index)
    if (positionen.length > 1 && ersetzung.alle !== true) {
      throw new ErsetzungNichtEindeutigError(
        ersetzung,
        index,
        positionen.length,
        positionen.map((position) => ({
          zeile: zeileVon(text, position),
          kontext: kontextUm(text, position, ersetzung.alt.length),
        })),
      )
    }

    const erste = positionen[0]
    const kontextVorher = kontextUm(text, erste, ersetzung.alt.length)
    text = ersetzung.alle === true
      ? text.split(ersetzung.alt).join(ersetzung.neu)
      : text.replace(ersetzung.alt, () => ersetzung.neu)
    belege.push({
      alt: ersetzung.alt,
      neu: ersetzung.neu,
      treffer: positionen.length,
      zeile: zeileVon(text, erste),
      kontextVorher,
      kontextNachher: kontextUm(text, erste, ersetzung.neu.length),
    })
  }

  return { body: text, belege }
}
