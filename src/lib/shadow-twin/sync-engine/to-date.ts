/**
 * @fileoverview Tolerante Datums-Konvertierung fuer Mongo-/Storage-Timestamps.
 * @module shadow-twin/sync-engine
 */

/** Wandelt Date|ISO-String in Date; alles andere (fehlend/ungueltig) → null. */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }
  return null
}
