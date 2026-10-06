/**
 * Bedeutungskontext je Textstelle im Quellen-Header des Prompts
 * (Plan `story-status-modalitaet`, m3).
 *
 * Jede gefundene Textstelle trägt ihre Facettenwerte im Header. Mit einem
 * Bedeutungs-Wörterbuch (`werte`, m1) wird daraus Klartext mit Bedeutung:
 *
 *   lv_bewertung: nicht_umsetzbar
 *   → Bewertung Landesverwaltung: nicht umsetzbar — Als nicht umsetzbar bewertet; wird nicht umgesetzt.
 *
 * Ohne Wörterbuch-Eintrag bleibt es bei Label und Rohwert; ohne Facetten-
 * Definition bei metaKey und Rohwert (kein Raten). Dokumente ohne das Feld
 * zeigen nichts — so funktioniert es in Libraries mit gemischten Typen.
 *
 * Weil der Header Teil des Prompts ist, gehen Labels und Wörterbuch in den
 * Cache-Hash (`facettenKontextFuerCache`). Pure Helper, keine Seiteneffekte.
 */

import { findeFacetWert, type FacetWert } from './facet-werte'

/** Minimale Sicht auf eine Facette, die der Header braucht. */
export interface KontextFacette {
  metaKey: string
  label?: string
  werte?: FacetWert[]
}

function einzelwertAlsText(wert: unknown, facette: KontextFacette | undefined): string {
  const eintrag = findeFacetWert(facette?.werte, wert)
  if (!eintrag) return String(wert)
  return eintrag.bedeutung ? `${eintrag.label} — ${eintrag.bedeutung}` : eintrag.label
}

/**
 * Formatiert die Facettenwerte einer Textstelle als Header-Teile
 * (`Label: Wert`), in der Reihenfolge der Metadaten. Leere Arrays, null und
 * undefined entfallen; Objekte werden nicht geraten und entfallen ebenfalls.
 */
export function formatiereQuellenMetadaten(
  metadata: Record<string, unknown> | undefined,
  facetDefs?: ReadonlyArray<KontextFacette>,
): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const byKey = new Map((facetDefs ?? []).map((f) => [f.metaKey, f]))
  const parts: string[] = []
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue
    const facette = byKey.get(key)
    const label = facette?.label || key
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      parts.push(`${label}: ${value.map((v) => einzelwertAlsText(v, facette)).join(', ')}`)
    } else if (typeof value === 'string' || typeof value === 'number') {
      parts.push(`${label}: ${einzelwertAlsText(value, facette)}`)
    } else if (typeof value === 'boolean') {
      parts.push(`${label}: ${value ? 'true' : 'false'}`)
    }
  }
  return parts
}

/**
 * Deterministische Kurzform dessen, was den Header beeinflusst (Label und
 * Wörterbuch je Facette), für den Cache-Hash. Reihenfolge der Facetten ist
 * egal (sortiert nach metaKey); ohne Facetten `undefined`.
 */
export function facettenKontextFuerCache(facetDefs?: ReadonlyArray<KontextFacette>): string | undefined {
  if (!facetDefs || facetDefs.length === 0) return undefined
  const teile = [...facetDefs]
    .sort((a, b) => a.metaKey.localeCompare(b.metaKey))
    .map((f) => {
      const werte = (f.werte ?? [])
        .map((w) => [w.wert, w.label, w.bedeutung ?? '', (w.verboten ?? []).join('|')].join('='))
        .join(';')
      return `${f.metaKey}:${f.label ?? ''}:${werte}`
    })
  return teile.join('\n')
}
