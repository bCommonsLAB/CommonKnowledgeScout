/**
 * Zitatmarken (D7, Plan `story-dreiteilung-fragenchronik`): dieselbe
 * Kreiszahl im Antworttext und an der Belegkarte. Reine Zeichenketten-Arbeit.
 */

const KREISZAHLEN = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

/** Kreiszahl fuer 1–20; darueber „(n)" — keine stille Luecke. */
export function zitatmarke(nummer: number): string {
  if (Number.isInteger(nummer) && nummer >= 1 && nummer <= KREISZAHLEN.length) {
    return Array.from(KREISZAHLEN)[nummer - 1]
  }
  return `(${nummer})`
}

/**
 * Ersetzt `[n]` im Antworttext (Markdown) durch einen Anker auf die
 * Belegkarte: `[①](#beleg-1)`. Ein `[n]`, dem eine Klammer folgt, ist schon
 * ein Markdown-Link und bleibt stehen.
 */
export function zitatmarkenImText(markdown: string): string {
  return markdown.replace(/\[(\d{1,3})\](?!\()/g, (_treffer, n: string) => `[${zitatmarke(Number(n))}](#beleg-${n})`)
}
