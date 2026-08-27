/**
 * @fileoverview Ausschnitte aus Textdateien + harte Antwortgrenzen (Welle ST2).
 *
 * @description
 * Zwei Anforderungen aus der Cowork-Sitzung, die dieselbe Wurzel haben —
 * es wurde regelmaessig ein Vielfaches dessen uebertragen, was gebraucht war:
 *
 * - **`bereich`**: Um im Bericht EIN Frontmatter-Feld zu pruefen, wurden
 *   10 kB gelesen. `frontmatter` braucht ~300 Bytes.
 * - **Q2**: Keine Leseoperation ohne `maxBytes`/`offset`, und jede
 *   Kuerzung wird gemeldet. Der Fehler, den `abdeckung_scannen` gemacht hat
 *   (~180.000 Zeichen fuer sieben relevante Zeilen), darf sich hier nicht
 *   wiederholen.
 *
 * Reine Funktionen, kein Storage — deshalb hier und nicht im Werkzeug.
 *
 * @module mcp/storage
 */

/** Welcher Ausschnitt gelesen werden soll. */
export type Bereich =
  | { art: 'ganz' }
  | { art: 'frontmatter' }
  | { art: 'abschnitt'; ueberschrift: string }
  | { art: 'zeilen'; von: number; bis: number }

/** Vorgabe fuer `maxBytes` — grosszuegig fuer Text, klein genug fuer eine Antwort. */
export const MAX_BYTES_VORGABE = 256 * 1024

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/

/**
 * Schneidet den angeforderten Ausschnitt heraus.
 *
 * Findet der Ausschnitt nicht statt (kein Frontmatter, Ueberschrift nicht da,
 * Zeilenbereich ausserhalb), wirft die Funktion. Ein leerer String waere die
 * gefaehrlichere Antwort: Der Aufrufer koennte ihn fuer „das Feld ist leer"
 * halten, statt fuer „ich habe an der falschen Stelle gesucht".
 */
export function schneideBereich(text: string, bereich: Bereich): string {
  switch (bereich.art) {
    case 'ganz':
      return text

    case 'frontmatter': {
      const treffer = text.match(FRONTMATTER)
      if (!treffer) throw new Error('Datei hat keinen Frontmatter-Block (--- am Dateianfang)')
      return treffer[0].trimEnd()
    }

    case 'abschnitt':
      return schneideAbschnitt(text, bereich.ueberschrift)

    case 'zeilen': {
      const zeilen = text.split('\n')
      if (bereich.von < 1) throw new Error(`Zeilen zaehlen ab 1 — "von" war ${bereich.von}`)
      if (bereich.bis < bereich.von) throw new Error(`"bis" (${bereich.bis}) liegt vor "von" (${bereich.von})`)
      if (bereich.von > zeilen.length) {
        throw new Error(`Datei hat nur ${zeilen.length} Zeilen — "von" war ${bereich.von}`)
      }
      return zeilen.slice(bereich.von - 1, bereich.bis).join('\n')
    }
  }
}

/** Ueberschriftsebene einer Markdown-Zeile, oder 0. */
function ebene(zeile: string): number {
  const treffer = zeile.match(/^(#{1,6})\s/)
  return treffer ? treffer[1].length : 0
}

/** Zeilengrenzen eines Markdown-Abschnitts (`ende` exklusiv). */
export interface AbschnittGrenzen {
  start: number
  ende: number
  zeilen: string[]
}

/**
 * Findet den Abschnitt zu einer Ueberschrift: von ihr bis zur naechsten
 * gleich- ODER hoeherrangigen Ueberschrift. Eine tiefere Unterueberschrift
 * gehoert zum Abschnitt — sonst waere „## Befunde" ohne seine „### Details"
 * nur ein Fragment.
 *
 * Geteilt von Lesen (`schneideBereich`) und Ersetzen (`patch.ts`): Beide
 * MUESSEN dieselbe Grenze sehen, sonst schreibt ein Agent ueber etwas
 * anderes, als er gelesen hat.
 */
export function findeAbschnitt(text: string, ueberschrift: string): AbschnittGrenzen {
  const gesucht = ueberschrift.replace(/^#+\s*/, '').trim().toLowerCase()
  const zeilen = text.split('\n')

  const start = zeilen.findIndex((zeile) => {
    const stufe = ebene(zeile)
    return stufe > 0 && zeile.slice(stufe).trim().toLowerCase() === gesucht
  })
  if (start === -1) {
    const vorhanden = zeilen.filter((z) => ebene(z) > 0).slice(0, 20).map((z) => z.trim())
    throw new Error(
      `Ueberschrift "${ueberschrift}" nicht gefunden. Vorhanden: ${vorhanden.join(' | ') || '(keine)'}`,
    )
  }

  const startEbene = ebene(zeilen[start])
  let ende = zeilen.length
  for (let i = start + 1; i < zeilen.length; i++) {
    const stufe = ebene(zeilen[i])
    if (stufe > 0 && stufe <= startEbene) { ende = i; break }
  }
  return { start, ende, zeilen }
}

function schneideAbschnitt(text: string, ueberschrift: string): string {
  const { start, ende, zeilen } = findeAbschnitt(text, ueberschrift)
  return zeilen.slice(start, ende).join('\n').trimEnd()
}

/** Ergebnis einer begrenzten Leseoperation (Q2). */
export interface Ausschnitt {
  inhalt: string
  /** true = es gibt mehr, als hier steht. */
  gekuerzt: boolean
  /** Groesse des VOLLEN Ausschnitts in Bytes (nicht des gelieferten). */
  gesamtBytes: number
  /** Als `offset` des naechsten Aufrufs zu verwenden; null = fertig. */
  naechsterOffset: number | null
}

/**
 * Begrenzt einen Text auf `maxBytes` ab `offset` — UTF-8-treu.
 *
 * Gezaehlt wird in Bytes, nicht in Zeichen, weil die Antwortgroesse in Bytes
 * begrenzt ist. Ein Schnitt mitten in einem Mehrbyte-Zeichen ergaebe kaputte
 * Umlaute — und Umlaute stehen in diesem Archiv in jedem zweiten Pfad.
 * Deshalb wird auf Byte-Ebene geschnitten und anschliessend das angebrochene
 * Zeichen am Ende verworfen.
 */
export function begrenze(inhalt: string, maxBytes: number, offset = 0): Ausschnitt {
  if (maxBytes < 1) throw new Error(`maxBytes muss mindestens 1 sein — war ${maxBytes}`)
  if (offset < 0) throw new Error(`offset darf nicht negativ sein — war ${offset}`)

  const bytes = Buffer.from(inhalt, 'utf-8')
  if (offset >= bytes.length) {
    return { inhalt: '', gekuerzt: false, gesamtBytes: bytes.length, naechsterOffset: null }
  }

  const ende = Math.min(offset + maxBytes, bytes.length)
  // `fatal: false` ersetzt ein angebrochenes Zeichen am Rand durch U+FFFD;
  // dieses wird unten entfernt, statt es an den Aufrufer zu geben.
  let stueck = bytes.subarray(offset, ende).toString('utf-8')
  const angebrochen = ende < bytes.length && stueck.endsWith('�')
  if (angebrochen) stueck = stueck.slice(0, -1)

  const gelieferteBytes = Buffer.from(stueck, 'utf-8').length
  const naechster = offset + gelieferteBytes
  return {
    inhalt: stueck,
    gekuerzt: naechster < bytes.length,
    gesamtBytes: bytes.length,
    naechsterOffset: naechster < bytes.length ? naechster : null,
  }
}
