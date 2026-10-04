/**
 * Zitatmarken im gerenderten Antworttext ausstatten (D7/D6b, D12k).
 *
 * `zitatmarkenImText` macht aus `[n]` den Anker `#beleg-k` (k = Dokument-
 * nummer); nach dem Rendern bekommt jeder dieser Anker die Klasse der Marke
 * (Kreis in fester Groesse, `@ks/ui`), `data-beleg` fuer den Klick-Handler
 * und einen `title` („Dokumenttitel: stützt sich auf n Textstellen").
 * Reine String-Arbeit auf dem HTML des Markdown-Renderers — kein zweiter
 * Renderer, ein Weg fuer App und Embed.
 */

import type { DocReference } from '@ks/contracts'
import { dokumentNummern } from '@ks/util'

/** Titel fuer die Dokumentnummer `k`; `undefined`, wenn kein Beleg dazu bekannt ist. */
export type MarkenTitel = (nummer: number) => string | undefined

function attribut(wert: string): string {
  return wert.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Belege nach Dokumentnummer gruppiert (D12k): aeltere Antworten tragen je
 * Textstelle eine Referenz, die alle auf dasselbe Dokument fallen.
 */
export function belegeNachDokument(belege: DocReference[]): Map<number, DocReference[]> {
  const nummern = dokumentNummern(belege)
  const map = new Map<number, DocReference[]>()
  for (const b of belege) {
    const k = nummern.get(b.number)
    if (k === undefined) continue
    const liste = map.get(k)
    if (liste) liste.push(b)
    else map.set(k, [b])
  }
  return map
}

/** Der Dokumenttitel eines Belegs: Titel, sonst Dateiname, sonst die Begruendung. */
export function belegTitel(beleg: DocReference): string {
  return beleg.title ?? beleg.fileName ?? beleg.description
}

export function mitMarkenTiteln(html: string, titel: MarkenTitel, klasse: string): string {
  return html.replace(/<a href="#beleg-(\d+)"[^>]*>/g, (_treffer, n: string) => {
    const text = titel(Number(n))
    const basis = `<a href="#beleg-${n}" data-beleg="${n}" class="${attribut(klasse)}"`
    return text === undefined ? `${basis}>` : `${basis} title="${attribut(text)}">`
  })
}
