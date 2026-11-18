/**
 * Ausschnitt des Kopfbilds (Owner 18.11.2026, Frontmatter `hero_image_position`).
 *
 * Die Kopf-Varianten `band`, `campaign` und `overlay` schneiden das Bild mit
 * `object-cover` zu — je breiter der Bildschirm, desto flacher der Ausschnitt.
 * Liegt das Wichtige nicht in der Bildmitte (Menschen im unteren Drittel einer
 * Illustration), richtet dieses Feld den Ausschnitt in der Hoehe aus:
 * `top`, `center` (Vorgabe), `bottom` oder ein Prozentwert `0%`–`100%`
 * (0 % = oberer Rand sichtbar, 100 % = unterer Rand). `cover` zeigt das Bild
 * ungeschnitten und braucht das Feld nicht.
 */

const PROZENT_RE = /^(\d{1,3})%$/
const STICHWORTE: Readonly<Record<string, string>> = { top: '0%', center: '50%', bottom: '100%' }

/**
 * Liefert die CSS-`object-position` (`50% <hoehe>`) oder `undefined`, wenn das
 * Feld fehlt (dann bleibt die Mitte). Ein ungueltiger Wert wirft — kein stiller Ersatz.
 */
export function heroBildPosition(wert: unknown): string | undefined {
  if (wert === undefined || wert === null || wert === '') return undefined
  const fehler = `hero_image_position "${String(wert)}" ist ungueltig (erlaubt: top, center, bottom oder 0%–100%)`
  if (typeof wert !== 'string') throw new Error(fehler)
  const w = wert.trim()
  const stichwort = STICHWORTE[w]
  if (stichwort) return `50% ${stichwort}`
  const m = PROZENT_RE.exec(w)
  if (m && Number(m[1]) <= 100) return `50% ${Number(m[1])}%`
  throw new Error(fehler)
}

/** Fuer den Mapper: ungueltig wird laut gemeldet, die Seite zeigt die Bildmitte. */
export function heroBildPositionGeprueft(wert: unknown): string | undefined {
  try {
    return heroBildPosition(wert)
  } catch (error) {
    console.error(`[website] ${error instanceof Error ? error.message : String(error)} — der Kopf zeigt die Bildmitte`)
    return undefined
  }
}
