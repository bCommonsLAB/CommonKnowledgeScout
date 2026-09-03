/**
 * @fileoverview Einfuege-Modi fuer `datei_patchen` (Wellen W1/W2).
 *
 * @description
 * `datei_patchen` wurde fuer KORREKTUREN gebaut („eine Zahl aendert sich") —
 * benutzt wird es zum FORTSCHREIBEN („eine Woche kommt dazu"). Anhaengen ist
 * etwas anderes als Ersetzen, und bis hierher kannte das Werkzeug nur
 * Ersetzen.
 *
 * Cowork-Befund 02.09.2026 aus drei Wochendurchgaengen: Jeder neue
 * Wochenabschnitt lief als `ersetze` auf `"## Verweise"` — die Ueberschrift
 * wanderte als `altText` hin und als Teil von `neuText` zurueck, nur damit
 * sie stehen blieb. Das funktioniert, ist aber ein Ritual, und es verschiebt
 * die Eindeutigkeitspruefung auf einen Text, den niemand aendern wollte. Eine
 * Chronologie-Zeile kostete gleich das Neuschreiben der ganzen Tabelle.
 *
 * Beide Modi behalten den Schutz, der die Schicht traegt: Die Marke muss
 * EINDEUTIG treffen. Ein mehrdeutiger Einfuegepunkt wird nicht geraten,
 * sondern abgelehnt.
 *
 * Reine Funktionen — der Storage-Teil liegt im Werkzeug.
 *
 * @module mcp/storage
 */

import { findeAbschnitt } from './bereich'

/** Wohin relativ zur genannten Ueberschrift. */
export type AbschnittPosition = 'vor' | 'nach'

/** Wohin innerhalb der Tabelle. */
export type TabellenPosition = 'anfang' | 'ende'

interface Ergebnis {
  inhalt: string
  beschreibung: string
}

/**
 * Fuegt einen Block vor oder nach einem Abschnitt ein.
 *
 * `nach` heisst: hinter dem GANZEN Abschnitt, also vor der naechsten gleich-
 * oder hoeherrangigen Ueberschrift — nicht hinter der Ueberschriftszeile.
 * Die andere Lesart wuerde den neuen Block IN den bestehenden Abschnitt
 * setzen; wer einen Abschnitt einfuegt, meint keinen Unterabschnitt.
 *
 * Die Abschnittsgrenzen kommen aus derselben Funktion wie beim Lesen und
 * beim Ersetzen — sonst schriebe ein Agent an eine andere Stelle, als er
 * gelesen hat.
 */
export function fuegeAbschnittEin(
  text: string,
  modus: { ueberschrift: string; position: AbschnittPosition; inhalt: string },
): Ergebnis {
  if (modus.inhalt === '') throw new Error('`inhalt` darf nicht leer sein — sonst aendert der Patch nichts')

  const { start, ende, zeilen } = findeAbschnitt(text, modus.ueberschrift)
  const stelle = modus.position === 'vor' ? start : ende
  const neu = [...zeilen.slice(0, stelle), ...modus.inhalt.split('\n'), ...zeilen.slice(stelle)]

  return {
    inhalt: neu.join('\n'),
    beschreibung:
      `${modus.inhalt.split('\n').length} Zeilen ${modus.position === 'vor' ? 'vor' : 'nach'} ` +
      `dem Abschnitt "${zeilen[start].trim()}" eingefuegt (Zeile ${stelle + 1})`,
  }
}

/** Zeilenbereich einer Markdown-Tabelle (`ende` exklusiv). */
interface TabellenBlock {
  start: number
  ende: number
}

function istTabellenZeile(zeile: string): boolean {
  return zeile.trim().startsWith('|')
}

/** Trennzeile einer Markdown-Tabelle: `|---|:--:|` und Verwandte. */
function istTrennZeile(zeile: string): boolean {
  return /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/.test(zeile)
}

function findeTabellen(zeilen: string[], von: number, bis: number): TabellenBlock[] {
  const bloecke: TabellenBlock[] = []
  let start = -1
  for (let i = von; i < bis; i++) {
    if (istTabellenZeile(zeilen[i])) {
      if (start === -1) start = i
    } else if (start !== -1) {
      bloecke.push({ start, ende: i })
      start = -1
    }
  }
  if (start !== -1) bloecke.push({ start, ende: bis })
  return bloecke
}

/**
 * Fuegt eine Zeile in eine Markdown-Tabelle ein.
 *
 * Ohne `ueberschrift` wird die ganze Datei durchsucht; dann muss es genau
 * EINE Tabelle geben. Mit `ueberschrift` gilt dasselbe innerhalb des
 * Abschnitts. Mehrere Tabellen sind kein Grund zu raten — die Fehlermeldung
 * sagt, wie viele es sind und wo sie anfangen, damit der naechste Aufruf
 * eindeutig ist.
 */
export function fuegeTabellenZeileEin(
  text: string,
  modus: { zeile: string; ueberschrift?: string; position: TabellenPosition },
): Ergebnis {
  if (!istTabellenZeile(modus.zeile)) {
    throw new Error(`\`zeile\` muss eine Markdown-Tabellenzeile sein (mit "|" beginnen) — war: "${modus.zeile}"`)
  }

  const zeilen = text.split('\n')
  const bereich = modus.ueberschrift
    ? (() => {
        const { start, ende } = findeAbschnitt(text, modus.ueberschrift)
        return { von: start, bis: ende }
      })()
    : { von: 0, bis: zeilen.length }

  const bloecke = findeTabellen(zeilen, bereich.von, bereich.bis)
  const wo = modus.ueberschrift ? `im Abschnitt "${modus.ueberschrift}"` : 'in der Datei'
  if (bloecke.length === 0) throw new Error(`Keine Markdown-Tabelle ${wo} gefunden — nichts geaendert.`)
  if (bloecke.length > 1) {
    const anfaenge = bloecke.map((b) => `Zeile ${b.start + 1}: ${zeilen[b.start].trim().slice(0, 60)}`)
    throw new Error(
      `${bloecke.length} Tabellen ${wo} — nicht eindeutig, nichts geaendert. ` +
      `Mit \`ueberschrift\` eingrenzen. Gefunden: ${anfaenge.join(' | ')}`,
    )
  }

  const block = bloecke[0]
  let stelle: number
  if (modus.position === 'ende') {
    stelle = block.ende
  } else {
    // „anfang" heisst hinter Kopf UND Trennzeile — davor waere die neue Zeile
    // die Kopfzeile, und die Tabelle saehe danach anders aus, als sie meint.
    if (block.ende - block.start < 2 || !istTrennZeile(zeilen[block.start + 1])) {
      throw new Error(
        `Die Tabelle ab Zeile ${block.start + 1} hat keine Trennzeile (|---|) — ` +
        'bei position="anfang" waere nicht bestimmt, wo der Kopf endet. ' +
        'Entweder position="ende" verwenden oder die Tabelle vervollstaendigen.',
      )
    }
    stelle = block.start + 2
  }

  const neu = [...zeilen.slice(0, stelle), modus.zeile, ...zeilen.slice(stelle)]
  return {
    inhalt: neu.join('\n'),
    beschreibung: `Tabellenzeile ${modus.position === 'anfang' ? 'nach dem Kopf' : 'am Ende'} eingefuegt (Zeile ${stelle + 1})`,
  }
}
