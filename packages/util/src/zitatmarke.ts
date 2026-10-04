/**
 * Zitatmarken (D7, D12k; Plan `story-dreiteilung-fragenchronik`): dieselbe
 * Nummer im Antworttext und an der Belegkarte. Reine Zeichenketten-Arbeit.
 *
 * D12k: Nummeriert wird je DOKUMENT — auch bei alten Antworten (vor D7), die
 * je Textstelle eine Nummer tragen. `dokumentNummern` bildet die Nummer einer
 * Referenz auf die Position ihres Dokuments ab (Reihenfolge der ersten
 * Nennung); `zitatmarkenImText` schreibt die Marken mit dieser Nummer und
 * laesst von mehreren Marken desselben Dokuments direkt hintereinander
 * (`[14] [15]`) eine stehen. Die Marke selbst ist die Zahl; Form und Groesse
 * gibt die Oberflaeche (`Zitatmarke` in `@ks/ui`), nicht ein Schriftzeichen.
 */

const KREISZAHLEN = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

/** Kreiszahl fuer 1–20, darueber „(n)" — fuer reinen Text (Vorlesetext, Alt-Chat). */
export function zitatmarke(nummer: number): string {
  if (Number.isInteger(nummer) && nummer >= 1 && nummer <= KREISZAHLEN.length) {
    return Array.from(KREISZAHLEN)[nummer - 1]
  }
  return `(${nummer})`
}

/** Das, was eine Referenz fuer die Nummerierung braucht. */
export interface ReferenzNummer {
  number: number
  fileId: string
}

/**
 * Nummer der Referenz → Nummer des Dokuments (1-basiert, Reihenfolge der
 * ersten Nennung nach aufsteigender Referenznummer). Bei Antworten seit D7
 * ist das die Identitaet; bei aelteren faellt jede Textstelle auf ihr Dokument.
 */
export function dokumentNummern(referenzen: ReferenzNummer[]): Map<number, number> {
  const sortiert = [...referenzen].sort((a, b) => a.number - b.number)
  const position = new Map<string, number>()
  const nummern = new Map<number, number>()
  for (const r of sortiert) {
    let p = position.get(r.fileId)
    if (p === undefined) {
      p = position.size + 1
      position.set(r.fileId, p)
    }
    if (!nummern.has(r.number)) nummern.set(r.number, p)
  }
  return nummern
}

export type NummerFuerMarke = (nummer: number) => number | undefined

/** Ein Lauf von Marken: `[1]`, `[1] [2]`, `[1], [2]` — ohne folgende Klammer (das waere ein Markdown-Link). */
const MARKEN_LAUF = /\[\d{1,3}\](?!\()(?:[ \t]*,?[ \t]*\[\d{1,3}\](?!\())*/g

/**
 * Ersetzt `[n]` im Antworttext (Markdown) durch einen Anker auf die
 * Belegkarte: `[k](#beleg-k)`, wobei `k` die Dokumentnummer aus `nummerFuer`
 * ist. Ohne Zuordnung bleibt `n` stehen — die Karte fehlt dann sichtbar,
 * `useBelegSprung` meldet es. Direkt aufeinanderfolgende Marken desselben
 * Dokuments werden zu einer.
 */
export function zitatmarkenImText(markdown: string, nummerFuer?: NummerFuerMarke): string {
  return markdown.replace(MARKEN_LAUF, (lauf) => {
    const nummern: number[] = []
    for (const treffer of lauf.matchAll(/\[(\d{1,3})\]/g)) {
      const n = Number(treffer[1])
      const k = nummerFuer?.(n) ?? n
      if (!nummern.includes(k)) nummern.push(k)
    }
    return nummern.map((k) => `[${k}](#beleg-${k})`).join(' ')
  })
}
