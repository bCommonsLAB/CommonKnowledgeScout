/**
 * Deterministische Wert-Koercion fuer Facetten-Typen (Welle A1).
 *
 * Eine Quelle fuer BEIDE Seiten: die Pruefung entscheidet damit, ob ein Befund
 * auto-reparierbar ist; die Reparatur wendet exakt dieselbe Koercion an. So kann
 * Pruef- und Repair-Logik nie auseinanderlaufen.
 *
 * Wichtig (no-silent-fallbacks): `null` Rueckgabe = echter Typ-Konflikt, der
 * NICHT still „weg-defaulted" wird, sondern als harter Befund stehen bleibt.
 */

import type { FacetType } from '@/lib/chat/dynamic-facets'
import { stripWrappingQuotes, toStringArrayFromUnknown } from '@/lib/chat/dynamic-facets'

export interface CoercionOutcome {
  /** true, wenn der Wert normalisiert werden musste (Reparatur sinnvoll). */
  changed: boolean
  /** Der typgerechte Wert. */
  value: unknown
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

/**
 * Versucht, `raw` in den Ziel-Facetten-Typ zu ueberfuehren.
 * @returns `CoercionOutcome` bei Erfolg, `null` bei echtem (nicht auto-fixbarem) Konflikt.
 */
export function coerceToFacetType(raw: unknown, type: FacetType): CoercionOutcome | null {
  switch (type) {
    case 'string[]': {
      const arr = toStringArrayFromUnknown(raw)
      if (!arr || arr.length === 0) return null
      const alreadyClean = Array.isArray(raw) && arraysEqual(raw, arr)
      return { changed: !alreadyClean, value: arr }
    }
    case 'number':
    case 'integer-range': {
      if (typeof raw === 'number') return Number.isFinite(raw) ? { changed: false, value: raw } : null
      if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw)
        return Number.isFinite(n) ? { changed: true, value: n } : null
      }
      return null
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { changed: false, value: raw }
      if (raw === 'true') return { changed: true, value: true }
      if (raw === 'false') return { changed: true, value: false }
      return null
    }
    case 'string':
    case 'date': {
      if (typeof raw === 'string') {
        const trimmed = stripWrappingQuotes(raw)
        return { changed: trimmed !== raw, value: trimmed }
      }
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return { changed: true, value: String(raw) }
      }
      return null
    }
    default:
      // Alle FacetType-Werte sind oben abgedeckt; ein neuer Typ darf nicht still
      // hier landen (no-silent-fallbacks.mdc).
      return null
  }
}
