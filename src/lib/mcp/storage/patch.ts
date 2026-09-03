/**
 * @fileoverview Teiländerungen an Textdateien (Welle ST3).
 *
 * @description
 * Das wirtschaftlich wichtigste Werkzeug der Schicht. Der Beleg aus der
 * Cowork-Sitzung: `BERICHT.md` (10,7 kB) und `_INDEX.md` (8,6 kB) wurden an
 * einem Tag ACHTMAL komplett neu geschrieben, meist weil sich eine einzige
 * Zahl geaendert hatte — rund 80 kB Uebertragung fuer vielleicht 400 Bytes
 * echte Aenderung. Das ist der Grund, warum es „ewig dauerte".
 *
 * Drei Modi, ein gemeinsamer Schutz: Jeder von ihnen muss EINDEUTIG treffen.
 * Ein Patch, der mehrdeutig ist, wird nicht geraten, sondern abgelehnt.
 *
 * Reine Funktionen — der Storage-Teil liegt im Werkzeug.
 *
 * @module mcp/storage
 */

import { findeAbschnitt } from './bereich'
import { ergaenzeFrontmatterListen, setzeFrontmatterFelder } from './frontmatter-felder'
import {
  type AbschnittPosition,
  type TabellenPosition,
  fuegeAbschnittEin,
  fuegeTabellenZeileEin,
} from './patch-einfuegen'

export type PatchModus =
  | { art: 'ersetze'; altText: string; neuText: string }
  | { art: 'abschnitt_ersetzen'; ueberschrift: string; neuerInhalt: string }
  | { art: 'frontmatter_setzen'; felder: Record<string, unknown> }
  | { art: 'abschnitt_einfuegen'; ueberschrift: string; position: AbschnittPosition; inhalt: string }
  | { art: 'tabelle_zeile_einfuegen'; zeile: string; ueberschrift?: string; position: TabellenPosition }
  | { art: 'frontmatter_ergaenzen'; felder: Record<string, string[]> }

/** Was der Patch tatsaechlich bewirkt hat — fuer die Antwort an den Agenten. */
export interface PatchErgebnis {
  inhalt: string
  /** Kurze Beschreibung dessen, was ersetzt wurde. */
  beschreibung: string
}

/**
 * Zaehlt Vorkommen von `nadel` in `heu` — ohne Regex, damit Sonderzeichen
 * im Suchtext (`.`, `*`, `(`) woertlich gemeint sind.
 */
export function zaehleVorkommen(heu: string, nadel: string): number {
  if (nadel === '') return 0
  let anzahl = 0
  let von = 0
  for (;;) {
    const treffer = heu.indexOf(nadel, von)
    if (treffer === -1) return anzahl
    anzahl += 1
    von = treffer + nadel.length
  }
}

/** Wendet den Patch an und liefert den neuen Volltext. */
export function wendePatchAn(text: string, modus: PatchModus): PatchErgebnis {
  switch (modus.art) {
    case 'ersetze': {
      if (modus.altText === '') throw new Error('`altText` darf nicht leer sein')
      const anzahl = zaehleVorkommen(text, modus.altText)
      // Die Eindeutigkeit IST der Schutz: bei mehreren Treffern waere nicht
      // bestimmt, welcher gemeint ist, und bei keinem hat der Aufrufer eine
      // andere Fassung der Datei vor sich, als er glaubt.
      if (anzahl === 0) {
        throw new Error(
          '`altText` kommt in der Datei nicht vor — nichts geaendert. ' +
          'Vermutlich ist die gelesene Fassung nicht mehr aktuell: neu lesen und erneut patchen.',
        )
      }
      if (anzahl > 1) {
        throw new Error(
          `\`altText\` kommt ${anzahl}-mal vor — nichts geaendert. ` +
          'Mehr Kontext in `altText` aufnehmen, bis er genau einmal passt.',
        )
      }
      return {
        inhalt: text.replace(modus.altText, () => modus.neuText),
        beschreibung: `${modus.altText.length} Zeichen ersetzt durch ${modus.neuText.length}`,
      }
    }

    case 'abschnitt_ersetzen': {
      // Dieselbe Grenze wie beim Lesen (`bereich.ts`) — sonst schriebe ein
      // Agent ueber etwas anderes, als er gelesen hat.
      const { start, ende, zeilen } = findeAbschnitt(text, modus.ueberschrift)
      const neu = [...zeilen.slice(0, start), ...modus.neuerInhalt.split('\n'), ...zeilen.slice(ende)]
      return {
        inhalt: neu.join('\n'),
        beschreibung: `Abschnitt "${zeilen[start].trim()}" (${ende - start} Zeilen) ersetzt durch ${modus.neuerInhalt.split('\n').length} Zeilen`,
      }
    }

    case 'frontmatter_setzen': {
      const felder = Object.keys(modus.felder)
      return {
        inhalt: setzeFrontmatterFelder(text, modus.felder),
        beschreibung: `Frontmatter-Felder gesetzt: ${felder.join(', ')} (Body unveraendert)`,
      }
    }

    case 'abschnitt_einfuegen':
      return fuegeAbschnittEin(text, modus)

    case 'tabelle_zeile_einfuegen':
      return fuegeTabellenZeileEin(text, modus)

    case 'frontmatter_ergaenzen':
      return ergaenzeFrontmatterListen(text, modus.felder)
  }
}

/**
 * Wendet MEHRERE Teilaenderungen nacheinander an — alles oder nichts (W4).
 *
 * Beleg: Ein Bericht braucht heute drei Aufrufe fuer eine logische Aenderung,
 * ueber zwanzig je Woche. Der Stapel spart aber nicht nur Aufrufe, er ist der
 * bessere SCHUTZ: Einzeln kann Aenderung 1 sitzen und Aenderung 3 scheitern,
 * und die Datei steht halb fortgeschrieben da. Hier scheitert entweder alles
 * oder nichts — geschrieben wird erst der Text nach dem letzten Schritt.
 *
 * Jeder Schritt sieht das Ergebnis des vorigen. Das ist Absicht: Ein Patch,
 * der einen gerade eingefuegten Abschnitt fuellt, muss ihn finden koennen.
 * Es heisst aber auch, dass die Reihenfolge zaehlt — deshalb nennt der Fehler
 * die NUMMER des Schritts, sonst waere nicht zu sehen, welcher gemeint ist.
 */
export function wendePatchesAn(text: string, modi: readonly PatchModus[]): PatchErgebnis {
  if (modi.length === 0) throw new Error('`modi` darf nicht leer sein')

  let inhalt = text
  const beschreibungen: string[] = []
  for (const [index, modus] of modi.entries()) {
    try {
      const ergebnis = wendePatchAn(inhalt, modus)
      inhalt = ergebnis.inhalt
      beschreibungen.push(`${index + 1}. ${ergebnis.beschreibung}`)
    } catch (fehler) {
      const meldung = fehler instanceof Error ? fehler.message : String(fehler)
      throw new Error(
        `Schritt ${index + 1} von ${modi.length} (art="${modus.art}") scheiterte: ${meldung} ` +
        '— NICHTS geschrieben, auch nicht die vorherigen Schritte.',
      )
    }
  }
  return { inhalt, beschreibung: beschreibungen.join(' · ') }
}
