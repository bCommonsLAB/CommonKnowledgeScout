/**
 * Banner-Regeln der Website-Landingpage (Welle S1) — reine Funktionen.
 *
 * Das Raster „Mehr aus dieser Bibliothek" holt seine Karten aus der
 * oeffentlichen Docs-API. Vier flache Frontmatter-Felder des Seiten-Docs
 * steuern es: `banner_tag` (Facetten-Filter `tags=`), `banner_title`
 * (Ueberschrift), `banner_limit` (Kartenzahl) und seit Welle F3 (ADR 0012)
 * `banner_sort`: `rating` (Vorgabe, Prioritaets-Index) oder `stars` (Spitze
 * der Sterne-Rangliste, braucht `starCountsPublic` an der Library). Unbekannte
 * Werte werden laut abgewiesen, nicht still ersetzt (no-silent-fallbacks).
 */

export const BANNER_LIMIT_DEFAULT = 6
export const BANNER_LIMIT_MIN = 3
export const BANNER_LIMIT_MAX = 12
/** Website-Docs werden clientseitig entfernt — deshalb etwas mehr laden. */
const BANNER_UEBERHANG = 5

export const BANNER_SORTS = ['rating', 'stars'] as const
export type BannerSort = (typeof BANNER_SORTS)[number]
export const BANNER_SORT_DEFAULT: BannerSort = 'rating'

export interface BannerParams {
  tag?: string
  title?: string
  limit: number
  /** Reihung der Karten; fehlend = `rating`. */
  sort?: BannerSort
}

/**
 * `banner_sort` aus dem Frontmatter lesen. Fehlend = `rating`; alles andere
 * als `rating` oder `stars` = Fehler mit dem Wert im Wortlaut.
 */
export function bannerSortAus(wert: unknown): BannerSort {
  if (wert === undefined || wert === null || wert === '') return BANNER_SORT_DEFAULT
  if (typeof wert === 'string' && (BANNER_SORTS as readonly string[]).includes(wert.trim())) {
    return wert.trim() as BannerSort
  }
  throw new Error(`Ungueltiges banner_sort "${String(wert)}" — erlaubt ${BANNER_SORTS.join(', ')}`)
}

/**
 * Adress-Parameter, die der Galerie-Link unter dem Banner mitnimmt, damit
 * „Alle ansehen" dieselbe Menge zeigt: bei `stars` die ganze Rangliste
 * (`starred=1&sort=stars`), bei `rating` nichts (die Galerie-Vorgabe).
 */
export function bannerGalerieParams(sort: BannerSort | undefined): string {
  return sort === 'stars' ? 'starred=1&sort=stars' : ''
}

/**
 * `banner_limit` aus dem Frontmatter lesen. Fehlend = Vorgabe; ausserhalb
 * 3..12 oder keine Zahl = Fehler mit dem Wert im Wortlaut.
 */
export function bannerLimitAus(wert: unknown): number {
  if (wert === undefined || wert === null || wert === '') return BANNER_LIMIT_DEFAULT
  const zahl = typeof wert === 'number' ? wert : Number(wert)
  if (!Number.isInteger(zahl) || zahl < BANNER_LIMIT_MIN || zahl > BANNER_LIMIT_MAX) {
    throw new Error(`Ungueltiges banner_limit "${String(wert)}" — erlaubt ${BANNER_LIMIT_MIN} bis ${BANNER_LIMIT_MAX}`)
  }
  return zahl
}

/**
 * Query fuer die Docs-API: `rating` = Prioritaets-Reihung; `stars` = nur
 * Eintraege mit Stern, die meisten zuerst (der Server filtert und reiht,
 * `stern-filter.ts`). Optional auf einen Tag gefiltert.
 */
export function bannerQuery(params: Pick<BannerParams, 'tag' | 'limit' | 'sort'>): string {
  const sort = params.sort ?? BANNER_SORT_DEFAULT
  const teile = sort === 'stars' ? ['sort=stars', 'starred=1'] : ['sort=rating']
  teile.push(`limit=${params.limit + BANNER_UEBERHANG}`)
  if (params.tag && params.tag.trim()) teile.push(`tags=${encodeURIComponent(params.tag.trim())}`)
  return teile.join('&')
}

/**
 * Schriftgroesse des gestapelten Cover-Titels (Wort je Zeile) in vw. Das
 * laengste Wort muss in die Breite passen: ein Versal-Zeichen ist rund
 * 0,7 em breit, 88 vw stehen zur Verfuegung. Kurze Titel behalten die
 * grosse Vorlage-Groesse (19 vw), lange Woerter werden kleiner.
 */
export function coverTitelGroesseVw(titel: string, maxVw = 19): number {
  const laengstes = titel.split(/\s+/).filter(Boolean).reduce((max, w) => Math.max(max, w.length), 0)
  if (laengstes === 0) return maxVw
  return Math.min(maxVw, Math.floor(88 / (laengstes * 0.7)))
}
