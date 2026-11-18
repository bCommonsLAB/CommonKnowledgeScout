/**
 * Welle N2 (Plan website-story-sektion): das Ziel einer Kachel (`<!-- cards -->`).
 *
 * Reine Funktion ohne React und Router: sie liest die Adresse, die der Autor
 * in den Kachel-Link schreibt, und sagt, WOHIN sie fuehrt. Das WIE (Adresse,
 * Klick ohne Neuladen) entscheidet seit WE2 die Navigation-Schnittstelle
 * (`navigation.ts`; in der App `app-navigation.ts`).
 *
 *   ?view=gallery   -> die Galerie (Inhalte)
 *   ?mode=story     -> der Story-Modus
 *   ?site=<slug>    -> eine andere Website-Seite (Slug oder fileId)
 *   http(s)://…     -> eine fremde Adresse
 *
 * Alles andere wirft — kein stiller Fallback auf „irgendein Link"
 * (`no-silent-fallbacks.md`); `seite_pruefen` meldet es vor dem Publizieren.
 */

export type Kartenziel =
  | { art: 'galerie' }
  | { art: 'story' }
  | { art: 'seite'; slug: string }
  | { art: 'extern'; url: string }

const ERLAUBT = '?view=gallery, ?mode=story, ?site=<slug> oder eine absolute http(s)-Adresse'
const EXTERN_RE = /^https?:\/\/\S+$/i

function einzigerParameter(query: URLSearchParams, name: string, href: string): string {
  const namen = [...query.keys()]
  if (namen.length !== 1 || namen[0] !== name) {
    throw new Error(`Kachel-Ziel "${href}": ${name} darf nicht mit weiteren Parametern stehen (erlaubt: ${ERLAUBT})`)
  }
  return query.get(name) ?? ''
}

/** Liest das Ziel einer Kachel; wirft bei allem, was die Navigation nicht kennt. */
export function loeseKartenziel(href: string): Kartenziel {
  const ziel = href.trim()
  if (EXTERN_RE.test(ziel)) return { art: 'extern', url: ziel }
  if (!ziel.startsWith('?')) {
    throw new Error(`Kachel-Ziel "${href}" ist unbekannt (erlaubt: ${ERLAUBT})`)
  }
  const query = new URLSearchParams(ziel.slice(1))
  if (query.has('view')) {
    const wert = einzigerParameter(query, 'view', href)
    if (wert !== 'gallery') throw new Error(`Kachel-Ziel "${href}": view="${wert}" ist unbekannt (erlaubt: ${ERLAUBT})`)
    return { art: 'galerie' }
  }
  if (query.has('mode')) {
    const wert = einzigerParameter(query, 'mode', href)
    if (wert !== 'story') throw new Error(`Kachel-Ziel "${href}": mode="${wert}" ist unbekannt (erlaubt: ${ERLAUBT})`)
    return { art: 'story' }
  }
  if (query.has('site')) {
    const slug = einzigerParameter(query, 'site', href).trim()
    if (!slug) throw new Error(`Kachel-Ziel "${href}": ?site= ohne Seite (erlaubt: ${ERLAUBT})`)
    return { art: 'seite', slug }
  }
  throw new Error(`Kachel-Ziel "${href}" ist unbekannt (erlaubt: ${ERLAUBT})`)
}
