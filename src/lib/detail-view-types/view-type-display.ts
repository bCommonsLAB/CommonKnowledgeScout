/**
 * Anzeige-Utilities fuer DetailViewTypes (Welle A4) — formatunabhaengige Galerie.
 *
 * Eine themenzentrierte Library kann gemischte Formate enthalten (pro Dokument
 * ein `detailViewType`). Diese reinen Helfer liefern lesbare Format-Labels und
 * die im Bestand tatsaechlich vorkommenden Typen — Grundlage fuer „Tabellen-
 * Spalten je Typ" und das formatgerechte Anzeigen je Dokument.
 *
 * Unbekannte Typen ergeben `null`/werden ausgelassen — kein stilles Raten eines
 * Labels (no-silent-fallbacks.mdc).
 */

import { DETAIL_VIEW_TYPES, type DetailViewType, isValidDetailViewType } from './registry'

/** Lesbares, deutsches Label je Inhaltstyp. */
export const VIEW_TYPE_LABELS: Record<DetailViewType, string> = {
  book: 'Buch',
  session: 'Session',
  testimonial: 'Erfahrungsbericht',
  blog: 'Blog',
  climateAction: 'Klimamaßnahme',
  divaDocument: 'DIVA-Dokument',
  divaTexture: 'DIVA-Textur',
  refurbedDevice: 'Refurbed-Gerät',
  website: 'Webseite',
}

/** Liefert das Format-Label oder `null` (unbekannter/fehlender Typ). */
export function getViewTypeLabel(viewType: string | undefined): string | null {
  if (!viewType || !isValidDetailViewType(viewType)) return null
  return VIEW_TYPE_LABELS[viewType as DetailViewType]
}

/**
 * Distinkte, gueltige DetailViewTypes aus einer Werteliste (z.B. pro Dokument).
 * Reihenfolge folgt der Registry (`DETAIL_VIEW_TYPES`), nicht dem Eingangs-Array.
 */
export function getPresentDetailViewTypes(
  values: ReadonlyArray<string | undefined>
): DetailViewType[] {
  const present = new Set<string>()
  for (const value of values) {
    if (value && isValidDetailViewType(value)) present.add(value)
  }
  return DETAIL_VIEW_TYPES.filter((type) => present.has(type))
}
