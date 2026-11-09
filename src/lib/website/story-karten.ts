/**
 * Karten-Darstellungen der zitierten Dokumente in der Story-Sektion (Owner
 * 09.11.2026, Figma Klickmodell D0 S2-A/S2-B): reine Helfer ohne React.
 *
 * - `kartenEintraege`: welche Dokumente eine Antwort zitiert, mit ihrer
 *   Dokumentnummer (dieselbe Nummer wie die Marke im Text, `dokumentNummern`),
 *   nach Nummer sortiert, ohne Obergrenze (Owner-Entscheid 2).
 * - `antwortBloecke`: der rohe Markdown der Antwort in Blöcke — Absätze an
 *   Leerzeilen, Listenpunkte (`- `, `* `, `1. `) je einzeln.
 * - `bloeckeMitNummern`: je Block die erste Dokumentnummer, die noch kein
 *   Block davor bekommen hat (Variante `inline`: Karte links, Absatz rechts).
 */

import type { DocCardMeta, DocReference } from '@ks/contracts'
import { dokumentNummern } from '@ks/util'

export interface KartenEintrag {
  /** Dokumentnummer k — die Marke im Text. */
  nummer: number
  doc: DocCardMeta
}

/**
 * Zitierte Dokumente mit Karte, nach erster Zitatnummer. Ein Dokument, zu dem
 * noch keine `DocCardMeta` geladen ist, fehlt hier (die Karten laden nach);
 * es wird nicht durch einen Platzhalter ersetzt.
 */
export function kartenEintraege(belege: DocReference[], docs: DocCardMeta[]): KartenEintrag[] {
  const nummern = dokumentNummern(belege)
  const fileIdJeNummer = new Map<number, string>()
  for (const b of [...belege].sort((a, c) => a.number - c.number)) {
    const k = nummern.get(b.number)
    if (k !== undefined && !fileIdJeNummer.has(k)) fileIdJeNummer.set(k, b.fileId)
  }
  const ergebnis: KartenEintrag[] = []
  for (const [k, fileId] of [...fileIdJeNummer.entries()].sort((a, c) => a[0] - c[0])) {
    const doc = docs.find((d) => d.fileId === fileId)
    if (doc) ergebnis.push({ nummer: k, doc })
  }
  return ergebnis
}

/** Beginn eines Listenpunkts: `- `, `* `, `+ `, `1. `, `1) ` (mit Einrückung). */
const LISTENPUNKT_RE = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/

/**
 * Markdown in Blöcke: Leerzeilen trennen Absätze; ein Absatz, der aus
 * Listenpunkten besteht, zerfällt in einen Block je Punkt (Folgezeilen ohne
 * Punktzeichen hängen am Punkt davor). Leere Blöcke fallen weg.
 */
export function antwortBloecke(markdown: string): string[] {
  const bloecke: string[] = []
  for (const absatz of markdown.replace(/\r\n/g, '\n').split(/\n[ \t]*\n+/)) {
    const zeilen = absatz.split('\n')
    const istListe = zeilen.some((z) => LISTENPUNKT_RE.test(z)) && zeilen.every((z) => z.trim() === '' || LISTENPUNKT_RE.test(z) || /^\s+\S/.test(z))
    if (!istListe) {
      if (absatz.trim()) bloecke.push(absatz.trim())
      continue
    }
    let aktuell: string[] = []
    for (const z of zeilen) {
      if (LISTENPUNKT_RE.test(z) && aktuell.length > 0) {
        bloecke.push(aktuell.join('\n'))
        aktuell = []
      }
      if (z.trim()) aktuell.push(z)
    }
    if (aktuell.length > 0) bloecke.push(aktuell.join('\n'))
  }
  return bloecke
}

export interface AntwortBlock {
  text: string
  /** Dokumentnummer, deren Karte neben diesem Block steht; null = volle Breite. */
  nummer: number | null
}

/** Marken `[n]` im Text — nicht `[n](…)`, das wäre ein Markdown-Link. */
const MARKE_RE = /\[(\d{1,3})\](?!\()/g

/**
 * Je Block die erste Dokumentnummer, die noch kein Block davor bekommen hat.
 * Zitiert ein Block nur Dokumente, die schon eine Karte haben, bekommt er
 * keine (volle Breite) — jede Karte steht genau einmal.
 */
export function bloeckeMitNummern(bloecke: string[], belege: DocReference[]): AntwortBlock[] {
  const nummern = dokumentNummern(belege)
  const vergeben = new Set<number>()
  return bloecke.map((text) => {
    let nummer: number | null = null
    for (const m of text.matchAll(MARKE_RE)) {
      const k = nummern.get(Number(m[1]))
      if (k !== undefined && !vergeben.has(k)) {
        nummer = k
        vergeben.add(k)
        break
      }
    }
    return { text, nummer }
  })
}
