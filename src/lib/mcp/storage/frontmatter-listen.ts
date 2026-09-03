/**
 * @fileoverview Listen-Felder im Frontmatter ergaenzen (Welle W3).
 *
 * @description
 * Cowork-Befund 02.09.2026: `korrespondenz:` ist das Feld, das eine
 * woechentliche Auswertung pflegt — und `frontmatter_setzen` kann es nicht.
 * Der Ausweg lief ueber `ersetze` auf den exakten Zeilenwortlaut, und der
 * PRUEFT NICHTS auf Dubletten: Zwei Wochen mit demselben Ansprechpartner
 * erzeugen zwei Eintraege, und niemand merkt es.
 *
 * **Was beim Nachmessen herauskam und den Zuschnitt bestimmt:** Der Parser
 * dieses Repositories (`parseFrontmatter`) kennt gar keine YAML-Listen.
 *
 * - Blockform (`feld:` + `  - a`) liest er als **leeren String** zurueck —
 *   die Eintraege sind fuer KnowledgeScout schlicht weg.
 * - Flow-Form (`feld: [a, b]`) liest er als **Rohstring** `"[a, b]"`.
 *
 * Deshalb schreibt dieses Modul ausschliesslich die **Flow-Form**. Sie ist
 * die einzige, die durch die Rueckprobe kommt: geschrieben und
 * zurueckgelesen sind derselbe String. Obsidian liest sie als Liste, KS als
 * Zeichenkette — genau der Zustand, den das Archiv heute schon hat, nur ohne
 * Zeilenrekonstruktion von Hand.
 *
 * Ein Feld in Blockform wird NICHT angefasst, sondern gemeldet. Es
 * stillschweigend in Flow-Form umzuschreiben waere eine Aenderung an Zeilen,
 * die niemand angefasst hat — und der Grund, aus dem es diese Chirurgie
 * ueberhaupt gibt.
 *
 * @module mcp/storage
 */

import { extractFrontmatterBlock } from '@/lib/markdown/frontmatter'

/**
 * Vergleichsform eines Eintrags: fuer die Dubletten-Pruefung, nie zum
 * Schreiben. Geschrieben wird immer die Schreibweise, die schon dasteht —
 * ein „Anna Bauer" wird nicht zu „anna bauer", nur weil jemand es klein
 * geschrieben hat.
 */
export function normalisiere(wert: string): string {
  return wert.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('de')
}

/** Zeichen, die die Flow-Form zerlegen wuerden — dafuer gibt es kein Escaping. */
const VERBOTEN = /[[\],\r\n]/

/** Liest `[a, b]` als `['a', 'b']`. Kein Flow-Wert → `null`. */
export function leseFlowListe(rohWert: string): string[] | null {
  const roh = rohWert.trim()
  if (!roh.startsWith('[') || !roh.endsWith(']')) return null
  const inhalt = roh.slice(1, -1).trim()
  if (inhalt === '') return []
  return inhalt.split(',').map((teil) => teil.trim().replace(/^["']|["']$/g, '')).filter((teil) => teil !== '')
}

/** Schreibt `['a', 'b']` als `[a, b]`. */
export function formatiereFlowListe(werte: readonly string[]): string {
  return `[${werte.join(', ')}]`
}

/** Rohwert eines Feldes aus dem Frontmatter-Block, `null` wenn es fehlt. */
function leseRohwert(markdown: string, key: string): { rohWert: string; blockform: boolean } | null {
  const block = extractFrontmatterBlock(markdown)
  if (block === null) return null

  const zeilen = block.split(/\r?\n/)
  const index = zeilen.findIndex((zeile) => zeile.startsWith(`${key}:`))
  if (index === -1) return null

  const rohWert = zeilen[index].slice(key.length + 1).trim()
  // Blockform erkennt man daran, dass der Wert leer ist und die naechste
  // Zeile eingerueckt mit "-" beginnt.
  const blockform = rohWert === '' && /^\s+-\s/.test(zeilen[index + 1] ?? '')
  return { rohWert, blockform }
}

export interface ErgaenzungsErgebnis {
  /** Der neue Rohwert je Feld, wie er in die Zeile geschrieben wird. */
  neueWerte: Record<string, string>
  /** Was tatsaechlich dazukam. */
  ergaenzt: Record<string, string[]>
  /** Was schon dastand (normalisiert gleich) und deshalb nicht dazukam. */
  uebersprungen: Record<string, string[]>
}

/**
 * Berechnet die neuen Zeilenwerte fuer Listen-Felder — ohne zu schreiben.
 *
 * Dubletten werden am normalisierten Vergleich erkannt (Rand-Leerzeichen,
 * Mehrfach-Leerzeichen, Anfuehrungszeichen, Gross-/Kleinschreibung). Auch
 * innerhalb EINES Aufrufs: Wer denselben Namen zweimal mitgibt, bekommt ihn
 * einmal.
 */
export function berechneErgaenzung(
  markdown: string,
  felder: Record<string, readonly string[]>,
): ErgaenzungsErgebnis {
  const neueWerte: Record<string, string> = {}
  const ergaenzt: Record<string, string[]> = {}
  const uebersprungen: Record<string, string[]> = {}

  for (const [key, werte] of Object.entries(felder)) {
    if (werte.length === 0) throw new Error(`Feld "${key}": keine Werte angegeben`)
    for (const wert of werte) {
      if (wert.trim() === '') throw new Error(`Feld "${key}": leerer Wert`)
      if (VERBOTEN.test(wert)) {
        throw new Error(
          `Feld "${key}": Der Wert "${wert}" enthaelt "[", "]", "," oder einen Zeilenumbruch. ` +
          'Die Flow-Form kennt dafuer kein Escaping — solche Werte gehoeren ueber ' +
          'datei_schreiben gesetzt, nicht hier.',
        )
      }
    }

    const vorhanden = leseRohwert(markdown, key)
    if (vorhanden?.blockform) {
      throw new Error(
        `Feld "${key}" steht in YAML-Blockform ("- " je Zeile). Diese Form liest der Parser ` +
        'dieses Systems als LEEREN Wert zurueck — die Eintraege waeren fuer KnowledgeScout weg. ' +
        'Das Feld muss erst auf die Flow-Form ([a, b]) umgestellt werden (datei_schreiben), ' +
        'dann kann hier ergaenzt werden. Nichts geaendert.',
      )
    }

    let liste: string[] = []
    if (vorhanden) {
      const gelesen = leseFlowListe(vorhanden.rohWert)
      if (gelesen === null) {
        throw new Error(
          `Feld "${key}" ist heute ein einfacher Wert (${JSON.stringify(vorhanden.rohWert)}), ` +
          'keine Liste. Ergaenzen wuerde seine Form aendern — dafuer frontmatter_setzen ' +
          'verwenden, wenn das gewollt ist. Nichts geaendert.',
        )
      }
      liste = gelesen
    }

    const bekannt = new Set(liste.map(normalisiere))
    const dazu: string[] = []
    const schon: string[] = []
    for (const wert of werte) {
      const schluessel = normalisiere(wert)
      if (bekannt.has(schluessel)) { schon.push(wert); continue }
      bekannt.add(schluessel)
      dazu.push(wert.trim())
    }

    neueWerte[key] = formatiereFlowListe([...liste, ...dazu])
    ergaenzt[key] = dazu
    uebersprungen[key] = schon
  }

  return { neueWerte, ergaenzt, uebersprungen }
}
