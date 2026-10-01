/**
 * Zitatmarken im gerenderten Antworttext mit einem Titel versehen (D7/D6b).
 *
 * `zitatmarkenImText` macht aus `[n]` den Anker `#beleg-n`; nach dem Rendern
 * bekommt jeder dieser Anker ein `title`-Attribut („Dokument: stützt sich auf
 * n Textstellen") und `data-beleg`, damit der Klick-Handler ihn erkennt.
 * Reine String-Arbeit auf dem HTML des Markdown-Renderers — kein zweiter
 * Renderer, ein Weg fuer App und Embed.
 */

import type { DocReference } from '@ks/contracts'

export type MarkenTitel = (beleg: DocReference) => string

function attribut(wert: string): string {
  return wert.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Belege nach Nummer; aeltere Antworten tragen je Textstelle eine Nummer — jede bleibt erreichbar. */
export function belegeNachNummer(belege: DocReference[]): Map<number, DocReference> {
  const map = new Map<number, DocReference>()
  for (const b of belege) if (!map.has(b.number)) map.set(b.number, b)
  return map
}

export function mitMarkenTiteln(html: string, belege: DocReference[], titel: MarkenTitel): string {
  const nachNummer = belegeNachNummer(belege)
  return html.replace(/<a href="#beleg-(\d+)"/g, (treffer, n: string) => {
    const beleg = nachNummer.get(Number(n))
    if (!beleg) return `${treffer} data-beleg="${n}"`
    return `${treffer} data-beleg="${n}" title="${attribut(titel(beleg))}"`
  })
}
