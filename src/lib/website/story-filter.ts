/**
 * Facettenfilter der Story-Sektion (Owner 09.11.2026, SFSCON-Startseite).
 *
 * Marker-Attribut `filter="year=2026"` an `<!-- section layout=story -->`:
 * Paare `facette=wert`, mehrere Paare mit `;`, mehrere Werte einer Facette
 * mit `,`. Ergebnis ist die Form der Galerie-Filter (`GalleryFilters`,
 * Facettenname → Werte), die der Chat-Stream als Adress-Parameter nimmt —
 * Antworten und Belege kommen dann nur aus den passenden Dokumenten.
 * Unlesbares wirft (kein stiller Fallback); der Renderer zeigt den Filter
 * als Chip im Kopf der Story-Karte, damit Besucher sehen, worauf sie fragen.
 */

import type { GalleryFilters } from '@ks/contracts'

const FACETTE_RE = /^[A-Za-z][\w.-]*$/

/** `"year=2026;track=Legal,Main"` → `{ year: ['2026'], track: ['Legal', 'Main'] }`. */
export function storyFilterAusAttribut(roh: string): GalleryFilters {
  const text = roh.trim()
  if (!text) throw new Error('section filter="" ist leer — erwartet "facette=wert" (mehrere mit ";", Werte mit ",")')
  const filter: GalleryFilters = {}
  for (const paar of text.split(';')) {
    const p = paar.trim()
    if (!p) continue
    const gleich = p.indexOf('=')
    if (gleich <= 0) throw new Error(`section filter: "${p}" hat kein "facette=wert"`)
    const facette = p.slice(0, gleich).trim()
    if (!FACETTE_RE.test(facette)) throw new Error(`section filter: Facettenname "${facette}" ist ungueltig`)
    const werte = p.slice(gleich + 1).split(',').map((w) => w.trim()).filter((w) => w.length > 0)
    if (werte.length === 0) throw new Error(`section filter: Facette "${facette}" ohne Wert`)
    filter[facette] = [...(filter[facette] ?? []), ...werte]
  }
  if (Object.keys(filter).length === 0) throw new Error('section filter ohne Paare — erwartet "facette=wert"')
  return filter
}

/** Lesbare Kurzform fuer den Chip: `year = 2026 · track = Legal, Main`. */
export function storyFilterBeschriftung(filter: GalleryFilters): string {
  return Object.entries(filter)
    .map(([facette, werte]) => `${facette} = ${werte.join(', ')}`)
    .join(' · ')
}

/** Filter als Adress-Parameter (wie `streamAdresse` im Story-Paket), z. B. fuer `docs?limit=1&year=2026`. */
export function storyFilterParams(filter: GalleryFilters | undefined, params: URLSearchParams): URLSearchParams {
  for (const [facette, werte] of Object.entries(filter ?? {})) for (const w of werte) params.append(facette, w)
  return params
}
