/**
 * Banner-Regeln der Website-Landingpage (Welle S1) — reine Funktionen.
 *
 * Das Raster „Mehr aus dieser Bibliothek" holt seine Karten aus der
 * oeffentlichen Docs-API. Drei flache Frontmatter-Felder des Seiten-Docs
 * steuern es: `banner_tag` (Facetten-Filter `tags=`), `banner_title`
 * (Ueberschrift) und `banner_limit` (Kartenzahl). Unbekannte Werte werden
 * laut abgewiesen, nicht still ersetzt (no-silent-fallbacks).
 */

export const BANNER_LIMIT_DEFAULT = 6
export const BANNER_LIMIT_MIN = 3
export const BANNER_LIMIT_MAX = 12
/** Website-Docs werden clientseitig entfernt — deshalb etwas mehr laden. */
const BANNER_UEBERHANG = 5

export interface BannerParams {
  tag?: string
  title?: string
  limit: number
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

/** Query fuer die Docs-API: Prioritaets-Reihung, optional auf einen Tag gefiltert. */
export function bannerQuery(params: Pick<BannerParams, 'tag' | 'limit'>): string {
  const teile = [`sort=rating`, `limit=${params.limit + BANNER_UEBERHANG}`]
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
